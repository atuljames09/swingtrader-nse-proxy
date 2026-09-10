// api/quote.js
// GET /api/quote?symbol=TATAMOTORS
// Returns NSE quote-equity JSON (same format as NSE direct API)
// Cache: 30 sec at Vercel edge

const { BASE, BASE_HEADERS, createNseClient } = require('../lib/nse');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const symbol = (req.query.symbol || '').toUpperCase().trim();
  if (!symbol) {
    return res.status(400).json({ error: 'symbol query param required. e.g. /api/quote?symbol=SBIN' });
  }

  try {
    const { client, headers } = await createNseClient();
    const url = `${BASE}/api/quote-equity?symbol=${symbol}`;
    const { data } = await client.get(url, {
      headers: { ...headers, Referer: `${BASE}/get-quotes/equity?symbol=${symbol}` }
    });

    // Verify it's real JSON (NSE returns HTML on auth failure)
    if (typeof data !== 'object' || !data.priceInfo) {
      return res.status(502).json({ error: 'NSE returned unexpected response', raw: String(data).slice(0, 200) });
    }

    return res.json(data);
  } catch (err) {
    return res.status(503).json({ error: 'Failed to fetch from NSE', message: err.message });
  }
};
