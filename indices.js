// api/indices.js
// GET /api/indices
// Returns NSE allIndices JSON (same format as NSE direct API)
// Cache: 30 sec at Vercel edge

const { BASE, BASE_HEADERS, createNseClient } = require('../lib/nse');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  try {
    const { client, headers } = await createNseClient();
    const { data } = await client.get(`${BASE}/api/allIndices`, {
      headers: { ...headers, Referer: `${BASE}/market-data/` }
    });

    if (typeof data !== 'object' || !data.data) {
      return res.status(502).json({ error: 'NSE returned unexpected response' });
    }

    return res.json(data);
  } catch (err) {
    return res.status(503).json({ error: 'Failed to fetch indices from NSE', message: err.message });
  }
};
