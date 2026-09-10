// api/historical.js
// GET /api/historical?symbol=SBIN&interval=1d&range=1y
//   interval: 1d | 1wk | 1mo
//   range:    6mo | 1y | 2y | 5y
// Uses Yahoo Finance — NO cookies or crumb needed
// Returns NSE-compatible format (CH_TIMESTAMP, CH_CLOSING_PRICE etc.)
// Cache: 15 min at Vercel edge

const axios = require('axios');

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'application/json, */*',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Referer':         'https://finance.yahoo.com/'
};

const SYMBOL_OVERRIDES = {
  'NIFTY 50':   '^NSEI',
  'SENSEX':     '^BSESN',
  'BANK NIFTY': '^NSEBANK',
  'NIFTY IT':   '^CNXIT'
};

async function yahooHistory(nseSymbol, yInterval, yRange) {
  const override = SYMBOL_OVERRIDES[nseSymbol];
  const suffixes = override ? [override] : [`${nseSymbol}.NS`, `${nseSymbol}.BO`];

  for (const sym of suffixes) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}` +
        `?interval=${yInterval}&range=${yRange}&includePrePost=false`;
      const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
      const result = data.chart?.result?.[0];
      if (result?.timestamp?.length > 0) return { result, sym };
    } catch(e) {
      if (e.response?.status !== 404) throw e;
    }
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  const symbol   = (req.query.symbol   || '').toUpperCase().trim();
  const interval = req.query.interval  || '1d';
  const range    = req.query.range     || '1y';

  if (!symbol) {
    return res.status(400).json({
      error: 'symbol required',
      example: '/api/historical?symbol=SBIN&interval=1d&range=1y'
    });
  }

  const yInterval = interval === '1wk' ? '1wk' : interval === '1mo' ? '1mo' : '1d';
  const yRange    = range === '6mo' ? '6mo' : range === '2y' ? '2y' : range === '5y' ? '5y' : '1y';

  try {
    const found = await yahooHistory(symbol, yInterval, yRange);
    if (!found) {
      return res.status(404).json({ error: `${symbol} not found on Yahoo Finance` });
    }

    const { result, sym } = found;
    const times  = result.timestamp   || [];
    const quote  = result.indicators?.quote?.[0] || {};

    // Convert to NSE-compatible format — Android NseHistoricalEntry model works unchanged
    const entries = times.map((ts, i) => {
      const close = quote.close?.[i];
      if (!close || close <= 0) return null;
      const d = new Date(ts * 1000);
      return {
        CH_TIMESTAMP:      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
        CH_OPENING_PRICE:  quote.open?.[i]   || close,
        CH_HIGH_PRICE:     quote.high?.[i]   || close,
        CH_LOW_PRICE:      quote.low?.[i]    || close,
        CH_CLOSING_PRICE:  close,
        CH_TOT_TRADED_QTY: quote.volume?.[i] || 0
      };
    }).filter(Boolean);

    return res.json({ data: entries, count: entries.length, source: 'yahoo', yahooSymbol: sym });

  } catch(err) {
    return res.status(503).json({ error: 'Yahoo Finance request failed', message: err.message });
  }
};
