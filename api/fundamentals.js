const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
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
    // Create cookie-jar-enabled axios client (maintains cookies between requests)
    var jar = new CookieJar();
    var client = wrapper(axios.create({ jar: jar, withCredentials: true }));

    // Step 1: Fetch crumb (Yahoo sets session cookie automatically)
    var crumbResp = await client.get('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: 8000
    });
    var crumb = crumbResp.data;
    if (!crumb || typeof crumb !== 'string' || crumb.length > 50) {
      return res.status(500).json({ error: 'Bad crumb', raw: String(crumb).substring(0, 100) });
    }

    // Step 2: Call quoteSummary (cookies auto-included by jar)
    for (var i = 0; i < 2; i++) {
      var host = i === 0 ? 'query1' : 'query2';
      try {
        var url = 'https://' + host + '.finance.yahoo.com/v10/finance/quoteSummary/' + yahooSym +
                  '?modules=' + MODULES + '&crumb=' + encodeURIComponent(crumb);
        var r = await client.get(url, {
          headers: { 'User-Agent': UA, 'Accept': 'application/json' },
          timeout: 12000
        });
        var result = r.data && r.data.quoteSummary && r.data.quoteSummary.result && r.data.quoteSummary.result[0];
        if (result) return res.status(200).json(r.data);
      } catch(e) { continue; }
    }
    return res.status(404).json({ error: 'No data found', crumb: crumb });

  } catch(e) {
    return res.status(500).json({ error: e.message, detail: e.response ? JSON.stringify(e.response.data).substring(0,200) : '' });
  }
};
