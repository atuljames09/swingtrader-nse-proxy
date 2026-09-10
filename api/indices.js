// api/indices.js
// GET /api/indices
// Returns NSE allIndices data (all NIFTY indices) + SENSEX from Yahoo Finance
// SENSEX is a BSE index — NSE's allIndices does NOT include it
// We fetch ^BSESN from Yahoo Finance and inject it into the response
// Cache: 30 sec at Vercel edge

const axios = require('axios');
const { BASE, createNseClient } = require('../lib/nse');

const YAHOO_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'application/json, */*',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Referer':         'https://finance.yahoo.com/'
};

// Fetch SENSEX from Yahoo Finance (^BSESN) and format as NseIndexData-compatible object
async function fetchSensex() {
  try {
    const { data } = await axios.get(
      'https://query1.finance.yahoo.com/v8/finance/chart/%5EBSESN?interval=1d&range=5d',
      { headers: YAHOO_HEADERS, timeout: 8000 }
    );
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;

    const last      = meta.regularMarketPrice;
    const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
    const change    = last - prevClose;
    const pctChange = prevClose > 0 ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;

    // Field names must match NseIndexData @SerializedName annotations exactly:
    // "index" → name, "last" → last, "percentChange" → pctChange, etc.
    return {
      index:             'S&P BSE SENSEX',
      last,
      change:            parseFloat(change.toFixed(2)),
      percentChange:     pctChange,
      open:              meta.regularMarketOpen || last,
      previousClose:     prevClose,
      high:              meta.regularMarketDayHigh || last,
      low:               meta.regularMarketDayLow  || last,
      yearHigh:          meta.fiftyTwoWeekHigh     || 0,
      yearLow:           meta.fiftyTwoWeekLow      || 0,
      totalTradedVolume: 0
    };
  } catch(_) { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  try {
    // Fetch NSE allIndices + SENSEX in parallel
    const [nseResult, sensex] = await Promise.all([
      (async () => {
        const { client, headers } = await createNseClient();
        const { data } = await client.get(`${BASE}/api/allIndices`, {
          headers: { ...headers, Referer: `${BASE}/market-data/` }
        });
        return data;
      })(),
      fetchSensex()
    ]);

    if (typeof nseResult !== 'object' || !nseResult.data) {
      return res.status(502).json({ error: 'NSE returned unexpected response' });
    }

    // Inject SENSEX after NIFTY 50 (index position 1)
    if (sensex) {
      nseResult.data.splice(1, 0, sensex);
    }

    return res.json(nseResult);
  } catch (err) {
    return res.status(503).json({ error: 'Failed to fetch indices', message: err.message });
  }
};
