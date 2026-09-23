const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MODULES = 'financialData,defaultKeyStatistics,summaryDetail,majorHoldersBreakdown,earningsHistory';
const OVERRIDES = { 'M&M': 'M%26M.NS', 'NIFTY 50': '%5ENSEI', 'SENSEX': '%5EBSESN', 'BANK NIFTY': '%5ENSEBANK' };

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var symbol = req.query.symbol;
  if (!symbol) return res.status(400).json({ error: 'symbol param required' });
  var yahooSym = OVERRIDES[symbol] || (symbol + '.NS');

  try {
    // Step 1: Get crumb + session cookie from Yahoo Finance
    var crumbResp = await axios.get('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: 8000
    });
    var crumb = crumbResp.data;
    var setCookies = crumbResp.headers['set-cookie'] || [];
    var cookieStr = setCookies.map(function(c) { return c.split(';')[0]; }).join('; ');

    // Step 2: Call quoteSummary with crumb + cookies
    var errors = [];
    for (var i = 0; i < 2; i++) {
      var host = i === 0 ? 'query1' : 'query2';
      try {
        var url = 'https://' + host + '.finance.yahoo.com/v10/finance/quoteSummary/' + yahooSym +
                  '?modules=' + MODULES + '&crumb=' + encodeURIComponent(crumb);
        var r = await axios.get(url, {
          headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Cookie': cookieStr },
          timeout: 12000
        });
        var result = r.data && r.data.quoteSummary && r.data.quoteSummary.result && r.data.quoteSummary.result[0];
        if (result) return res.status(200).json(r.data);
        errors.push('empty result from ' + host);
      } catch(e) {
        errors.push(host + ': ' + e.message);
      }
    }
    return res.status(404).json({ error: 'No data found', details: errors });

  } catch(e) {
    return res.status(500).json({ error: e.message, detail: e.response ? JSON.stringify(e.response.data).substring(0, 200) : '' });
  }
};
