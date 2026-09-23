const yahooFinance = require('yahoo-finance2').default;

const OVERRIDES = { 'M&M': 'M&M.NS', 'NIFTY 50': '^NSEI', 'SENSEX': '^BSESN', 'BANK NIFTY': '^NSEBANK' };

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var symbol = req.query.symbol;
  if (!symbol) return res.status(400).json({ error: 'symbol param required' });
  var yahooSym = OVERRIDES[symbol] || (symbol + '.NS');

  try {
    var result = await yahooFinance.quoteSummary(yahooSym, {
      modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'majorHoldersBreakdown', 'earningsHistory']
    }, { validateResult: false });

    return res.status(200).json({ quoteSummary: { result: [result] } });

  } catch(e) {
    return res.status(500).json({ error: e.message, symbol: yahooSym });
  }
};
