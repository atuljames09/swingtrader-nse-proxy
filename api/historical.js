// api/historical.js
// GET /api/historical?symbol=TATAMOTORS&from=10-09-2025&to=10-09-2026
// Returns NSE historical/cm/equity JSON (same format as NSE direct API)
// Cache: 15 min at Vercel edge (historical data is stable)

const { BASE, BASE_HEADERS, createNseClient } = require('../lib/nse');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  const symbol = (req.query.symbol || '').toUpperCase().trim();
  const from   = (req.query.from  || '').trim();   // dd-MM-yyyy
  const to     = (req.query.to    || '').trim();   // dd-MM-yyyy

  if (!symbol || !from || !to) {
    return res.status(400).json({
      error: 'Required: symbol, from, to (dd-MM-yyyy)',
      example: '/api/historical?symbol=TATAMOTORS&from=10-09-2025&to=10-09-2026'
    });
  }

  try {
    // Pass symbol so the client visits the stock's NSE page (sets correct Referer cookies)
    const { client, headers } = await createNseClient(symbol);

    const series  = encodeURIComponent('["EQ"]');
    const url     = `${BASE}/api/historical/cm/equity?symbol=${symbol}&series=${series}&from=${from}&to=${to}`;
    const referer = `${BASE}/get-quotes/equity?symbol=${symbol}`;

    const { data } = await client.get(url, {
      headers: { ...headers, Referer: referer }
    });

    if (typeof data !== 'object' || !Array.isArray(data.data)) {
      return res.status(502).json({ error: 'NSE returned unexpected response', raw: String(data).slice(0, 200) });
    }

    return res.json(data);
  } catch (err) {
    return res.status(503).json({ error: 'Failed to fetch historical data from NSE', message: err.message });
  }
};
