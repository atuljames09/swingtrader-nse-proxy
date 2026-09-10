// api/quote.js
// GET /api/quote?symbol=SBIN
// Uses Yahoo Finance — NO cookies or crumb needed (confirmed working without auth)
// Tries .NS (NSE) first, falls back to .BO (BSE) if .NS not found on Yahoo
// Returns NSE priceInfo format so Android NseQuoteResponse model works unchanged
// Cache: 30 sec at Vercel edge

const axios = require('axios');

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'application/json, */*',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Referer':         'https://finance.yahoo.com/'
};

// Stocks with known Yahoo Finance symbol overrides
const SYMBOL_OVERRIDES = {
  'NIFTY 50':   '^NSEI',
  'SENSEX':     '^BSESN',
  'BANK NIFTY': '^NSEBANK',
  'NIFTY IT':   '^CNXIT'
};

async function yahooQuote(nseSymbol) {
  const override = SYMBOL_OVERRIDES[nseSymbol];
  const suffixes = override ? [override] : [`${nseSymbol}.NS`, `${nseSymbol}.BO`];

  for (const sym of suffixes) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`;
      const { data } = await axios.get(url, { headers: HEADERS, timeout: 8000 });
      const meta = data.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) {
        const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
        const ltp       = meta.regularMarketPrice;
        const change    = ltp - prevClose;
        const pChange   = prevClose > 0 ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;
        return {
          priceInfo: {
            lastPrice:     ltp,
            change:        parseFloat(change.toFixed(2)),
            pChange:       pChange,
            open:          meta.regularMarketOpen  || ltp,
            previousClose: prevClose,
            intraDayHighLow: {
              max: meta.regularMarketDayHigh || ltp,
              min: meta.regularMarketDayLow  || ltp
            }
          },
          metadata: {
            companyName: meta.longName || meta.shortName || nseSymbol,
            industry: ''
          },
          source: 'yahoo',
          yahooSymbol: sym
        };
      }
    } catch(e) {
      if (e.response?.status !== 404) throw e;   // Only continue on 404 (try next suffix)
    }
  }
  return null;   // Not found on Yahoo Finance (e.g., TATAMOTORS)
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const symbol = (req.query.symbol || '').toUpperCase().trim();
  if (!symbol) {
    return res.status(400).json({ error: 'symbol required', example: '/api/quote?symbol=SBIN' });
  }

  try {
    const data = await yahooQuote(symbol);
    if (data) return res.json(data);
    return res.status(404).json({ error: `${symbol} not found on Yahoo Finance`, symbol });
  } catch(err) {
    return res.status(503).json({ error: 'Yahoo Finance request failed', message: err.message });
  }
};
