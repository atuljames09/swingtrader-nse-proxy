const axios = require('axios');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set in Vercel env vars' });

  var body = req.body || {};
  var symbol = body.symbol || 'UNKNOWN';
  var t = body.technicals || {};
  var f = body.fundamentals || {};

  var prompt = 'You are an expert Indian stock market analyst specializing in NSE-listed stocks. Analyze the following comprehensive data for ' + symbol + ' and provide a clear, actionable conclusion for retail investors.\n\nTECHNICAL INDICATORS:\n- Overall Score: ' + (t.score||'N/A') + '/100 | Signal: ' + (t.signal||'N/A') + '\n- Entry Signal: ' + (t.entrySignal||'N/A') + ' | Risk Level: ' + (t.riskLevel||'N/A') + '\n- RSI: Daily=' + (t.rsi_daily||'N/A') + ' | Weekly=' + (t.rsi_weekly||'N/A') + ' | Monthly=' + (t.rsi_monthly||'N/A') + '\n- SuperTrend: ' + (t.superTrend||'N/A') + ' | MACD: ' + (t.macd||'N/A') + ' | Bollinger Band: ' + (t.bbPosition||'N/A') + '\n- EMA Alignment: ' + (t.ema20AboveEma50 ? 'Bullish - EMA20 above EMA50' : 'Bearish - EMA20 below EMA50') + '\n- Price vs EMA20: ' + (t.priceVsEma20Pct||'N/A') + '% | Above EMA20: ' + (t.priceAboveEma20 ? 'Yes' : 'No') + '\n- Market Structure: Higher High=' + (t.higherHigh?'Yes':'No') + ', Higher Low=' + (t.higherLow?'Yes':'No') + '\n- Volume: ' + (t.volumeRatio||'N/A') + 'x average (' + (t.volumeContext||'N/A') + ')\n- ATR(14): Rs.' + (t.atr14||'N/A') + ' (' + (t.atrPct||'N/A') + '% of price)\n- 52-Week: ' + (t.week52HighPct||'N/A') + '% from High | +' + (t.week52LowPct||'N/A') + '% from Low\n- 52W High: Rs.' + (t.week52High||'N/A') + ' | 52W Low: Rs.' + (t.week52Low||'N/A') + '\n\nFUNDAMENTAL DATA:\n- Price: Rs.' + (f.currentPrice||'N/A') + ' | Market Cap: ' + (f.marketCap ? 'Rs.'+(f.marketCap/1e7).toFixed(0)+' Cr' : 'N/A') + '\n- P/E: ' + (f.trailingPE||'N/A') + ' | P/B: ' + (f.priceToBook||'N/A') + ' | EPS: ' + (f.eps||'N/A') + '\n- Revenue: ' + (f.revenue ? 'Rs.'+(f.revenue/1e7).toFixed(0)+' Cr' : 'N/A') + ' | Net Income: ' + (f.netIncome ? 'Rs.'+(f.netIncome/1e7).toFixed(0)+' Cr' : 'N/A') + '\n- Total Debt: ' + (f.totalDebt ? 'Rs.'+(f.totalDebt/1e7).toFixed(0)+' Cr' : 'N/A') + ' | Debt/Equity: ' + (f.debtToEquity||'N/A') + '\n- Operating Cash Flow: ' + (f.operatingCashflow ? 'Rs.'+(f.operatingCashflow/1e7).toFixed(0)+' Cr' : 'N/A') + '\n- Dividend Yield: ' + (f.dividendYield||'N/A') + '% | Beta: ' + (f.beta||'N/A') + '\n- Institutional Holding: ' + (f.institutionalHolding||'N/A') + '% | Insider: ' + (f.insiderHolding||'N/A') + '%\n' + (f.quarterlyEarnings ? '- Recent Earnings: ' + f.quarterlyEarnings + '\n' : '') + '\nRespond in EXACTLY this format:\n\n**OVERALL STATUS**\n(2-3 sentences about current stock position and trend)\n\n**TECHNICAL OUTLOOK**\n(2-3 sentences about price action, momentum, key technical levels)\n\n**FUNDAMENTAL HEALTH**\n(2-3 sentences about company financials, debt, profitability)\n\n**KEY RISKS**\n- Risk 1\n- Risk 2\n- Risk 3\n\n**VERDICT: [BULLISH/BEARISH/NEUTRAL]**\n(One clear sentence with final conclusion)\n\n[!] Disclaimer: This is AI-generated analysis for educational purposes only. Not financial advice. Consult a SEBI-registered investment advisor before making any investment decisions.\n\nKeep response under 380 words. Use simple language for retail investors.';

  try {
    var resp = await axios.post(GROQ_URL, {
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 700
    }, {
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    var text = resp.data && resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message && resp.data.choices[0].message.content;
    if (!text) return res.status(502).json({ error: 'Empty response from Groq' });

    var upper = text.toUpperCase();
    var verdict = upper.indexOf('VERDICT: BULLISH') !== -1 ? 'BULLISH' : upper.indexOf('VERDICT: BEARISH') !== -1 ? 'BEARISH' : 'NEUTRAL';
    return res.status(200).json({ conclusion: text, verdict: verdict });

  } catch(e) {
    var detail = e.response ? JSON.stringify(e.response.data).substring(0, 300) : e.message;
    return res.status(500).json({ error: e.message, detail: detail });
  }
};
