// api/quote.js
// GET /api/quote?symbol=TATAMOTORS
// Primary:  NSE quote-equity (works if session establishes from Mumbai)
// Fallback: Yahoo Finance (reliable from server, no bot protection)
// Returns NSE priceInfo format so Android NseQuoteResponse model works as-is
// Cache: 30 sec at Vercel edge

const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { BASE, createNseClient } = require('../lib/nse');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchYahooQuote(symbol) {
  const ySym   = `${symbol}.NS`;
  const jar    = new CookieJar();
  const client = wrapper(axios.create({ jar, withCredentials: true, timeout: 8000 }));
  const hdrs   = {
    'User-Agent':      UA,
    'Accept':          'application/json, text/html, */*',
    'Accept-Language': 'en-IN,en;q=0.9',
    'Referer':         'https://finance.yahoo.com/'
  };

  // Seed cookies
  await client.get('https://finance.yahoo.com/', { headers: hdrs }).catch(() => {});

  // Get crumb
  let crumb = '';
  try {
    const cr = await client.get('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...hdrs, Accept: '*/*' }
    });
    if (typeof cr.data === 'string' && !cr.data.startsWith('{')) crumb = cr.data.trim();
  } catch(e) {}

  // Fetch last 5 days chart (gives live price)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ySym}?interval=1d&range=5d` +
    (crumb ? `&crumb=${encodeURIComponent(crumb)}` : '');

  const { data } = await client.get(url, {
    headers: { ...hdrs, Referer: `https://finance.yahoo.com/quote/${ySym}/` }
  });

  const meta = data.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) throw new Error('No price from Yahoo Finance');

  const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
  const ltp    = meta.regularMarketPrice;
  const change = ltp - prevClose;
  const pChange = prevClose > 0 ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;

  // Return in NSE priceInfo format so Android NseQuoteResponse.priceInfo works unchanged
  return {
    priceInfo: {
      lastPrice:    ltp,
      change:       parseFloat(change.toFixed(2)),
      pChange:      pChange,
      open:         meta.regularMarketOpen  || ltp,
      previousClose: prevClose,
      intraDayHighLow: {
        max: meta.regularMarketDayHigh || ltp,
        min: meta.regularMarketDayLow  || ltp
      }
    },
    metadata: { companyName: meta.longName || meta.shortName || symbol, industry: '' },
    source: 'yahoo'
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const symbol = (req.query.symbol || '').toUpperCase().trim();
  if (!symbol) {
    return res.status(400).json({ error: 'symbol required', example: '/api/quote?symbol=SBIN' });
  }

  // ── Source 1: NSE direct ──────────────────────────────────────────────────
  try {
    const { client, headers } = await createNseClient();
    const { data } = await client.get(`${BASE}/api/quote-equity?symbol=${symbol}`, {
      headers: { ...headers, Referer: `${BASE}/get-quotes/equity?symbol=${symbol}` }
    });
    if (data?.priceInfo?.lastPrice) return res.json({ ...data, source: 'nse' });
  } catch(e) { /* fall through to Yahoo */ }

  // ── Source 2: Yahoo Finance fallback ──────────────────────────────────────
  try {
    const data = await fetchYahooQuote(symbol);
    return res.json(data);
  } catch(err) {
    return res.status(503).json({
      error: 'Both NSE and Yahoo Finance failed to return quote',
      message: err.message
    });
  }
};
