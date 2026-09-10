// api/historical.js
// GET /api/historical?symbol=TATAMOTORS&interval=1d&range=1y
// Uses Yahoo Finance (NSE historical is blocked from Node.js servers)
// Returns NSE-compatible format so Android app needs NO code changes
// Cache: 15 min at Vercel edge

const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const YAHOO_MAP = {
  'NIFTY 50': '^NSEI', 'SENSEX': '^BSESN', 'BANK NIFTY': '^NSEBANK',
  'NIFTY IT': '^CNXIT', 'NIFTY MIDCAP': '^NSEMDCP50', 'M&M': 'M%26M.NS'
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  const symbol   = (req.query.symbol   || '').toUpperCase().trim();
  const interval = req.query.interval  || '1d';   // 1d | 1wk | 1mo
  const range    = req.query.range     || '1y';   // 6mo | 1y | 2y | 5y

  if (!symbol) {
    return res.status(400).json({
      error: 'symbol required',
      example: '/api/historical?symbol=TATAMOTORS&interval=1d&range=1y'
    });
  }

  const ySym     = YAHOO_MAP[symbol] || `${symbol}.NS`;
  const yInterval = interval === '1wk' ? '1wk' : interval === '1mo' ? '1mo' : '1d';
  const yRange    = range === '6mo' ? '6mo' : range === '2y' ? '2y' : range === '5y' ? '5y' : '1y';

  try {
    const jar    = new CookieJar();
    const client = wrapper(axios.create({ jar, withCredentials: true, timeout: 8000 }));
    const hdrs   = {
      'User-Agent':      UA,
      'Accept':          'application/json, text/html, */*',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Referer':         'https://finance.yahoo.com/'
    };

    // Step 1: Seed .yahoo.com cookies
    await client.get('https://finance.yahoo.com/', { headers: hdrs }).catch(() => {});

    // Step 2: Get crumb (session token)
    let crumb = '';
    try {
      const cr = await client.get('https://query1.finance.yahoo.com/v1/test/getcrumb', {
        headers: { ...hdrs, Accept: '*/*' }
      });
      if (typeof cr.data === 'string' && !cr.data.startsWith('{')) crumb = cr.data.trim();
    } catch(e) {}

    // Step 3: Fetch OHLCV chart
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ySym}` +
      `?interval=${yInterval}&range=${yRange}&includePrePost=false` +
      (crumb ? `&crumb=${encodeURIComponent(crumb)}` : '');

    const { data } = await client.get(chartUrl, {
      headers: { ...hdrs, Referer: `https://finance.yahoo.com/quote/${ySym}/` }
    });

    const result = data.chart?.result?.[0];
    if (!result) {
      return res.status(502).json({ error: 'No data from Yahoo Finance', yahoo_symbol: ySym });
    }

    const times = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};

    // Convert to NSE-compatible format (so Android NseHistoricalEntry model works as-is)
    const entries = times.map((ts, i) => {
      const close = quote.close?.[i];
      if (!close || close <= 0) return null;
      const d = new Date(ts * 1000);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return {
        CH_TIMESTAMP:      dateStr,
        CH_OPENING_PRICE:  quote.open?.[i]   || close,
        CH_HIGH_PRICE:     quote.high?.[i]   || close,
        CH_LOW_PRICE:      quote.low?.[i]    || close,
        CH_CLOSING_PRICE:  close,
        CH_TOT_TRADED_QTY: quote.volume?.[i] || 0
      };
    }).filter(Boolean);

    return res.json({ data: entries, count: entries.length, source: 'yahoo', symbol: ySym });

  } catch (err) {
    return res.status(503).json({ error: 'Failed to fetch historical data', message: err.message });
  }
};
