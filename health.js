// api/health.js
// GET /api/health — simple health check
// Use this to verify the proxy is deployed and running

module.exports = (req, res) => {
  res.json({
    status: 'ok',
    service: 'SwingTrader NSE Proxy',
    region: process.env.VERCEL_REGION || 'bom1',
    timestamp: new Date().toISOString(),
    endpoints: {
      quote:      '/api/quote?symbol=TATAMOTORS',
      indices:    '/api/indices',
      historical: '/api/historical?symbol=TATAMOTORS&from=10-09-2025&to=10-09-2026'
    }
  });
};
