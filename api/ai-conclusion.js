const axios = require('axios');

const MODEL = 'gemini-3.5-flash';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1/models/' + MODEL + ':generateContent';

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel env vars' });

  var body = req.body || {};
  var symbol = body.symbol || 'UNKNOWN';
  var t = body.technicals || {};
  var f = body.fundamentals || {};

  var prompt = 'You are an expert Indian stock market analyst. Analyze the following data for ' + symbol + ' listed on NSE and give a clear conclusion.\n\nTECHNICAL:\n- Score: ' + (t.score || 'N/A') + '/100 | Signal: ' + (t.signal || 'N/A') + '\n- RSI Daily: ' + (t.rsi_daily || 'N/A') + ' | Weekly: ' + (t.rsi_weekly || 'N/A') + ' | Monthly: ' + (t.rsi_monthly || 'N/A') + '\n- SuperTrend: ' + (t.superTrend || 'N/A') + ' | MACD: ' + (t.macd || 'N/A') + ' | BB: ' + (t.bbPosition || 'N/A') + '\n- EMA Alignment: ' + (t.ema20AboveEma50 ? 'Bullish (EMA20 > EMA50)' : 'Bearish (EMA20 < EMA50)') + '\n- Volume: ' + (t.volumeRatio || 'N/A') + 'x avg (' + (t.volumeContext || 'N/A') + ')\n- 52W: ' + (t.week52HighPct || 'N/A') + '% from High | +' + (t.week52LowPct || 'N/A') + '% from Low\n- ATR: Rs.' + (t.atr14 || 'N/A') + ' (' + (t.atrPct || 'N/A') + '% of price)\n- Structure: HH=' + (t.higherHigh ? 'Yes' : 'No') + ' HL=' + (t.higherLow ? 'Yes' : 'No') + '\n- Entry: ' + (t.entrySignal || 'N/A') + ' | Risk: ' + (t.riskLevel || 'N/A') + '\n\nFUNDAMENTALS:\n- Price: Rs.' + (f.currentPrice || 'N/A') + ' | Market Cap: ' + (f.marketCap ? 'Rs.' + (f.marketCap/1e7).toFixed(0) + ' Cr' : 'N/A') + '\n- P/E: ' + (f.trailingPE || 'N/A') + ' | P/B: ' + (f.priceToBook || 'N/A') + ' | EPS: ' + (f.eps || 'N/A') + '\n- Revenue: ' + (f.revenue ? 'Rs.' + (f.revenue/1e7).toFixed(0) + ' Cr' : 'N/A') + ' | Net Income: ' + (f.netIncome ? 'Rs.' + (f.netIncome/1e7).toFixed(0) + ' Cr' : 'N/A') + '\n- Debt/Equity: ' + (f.debtToEquity || 'N/A') + ' | Dividend Yield: ' + (f.dividendYield || 'N/A') + '%\n- Beta: ' + (f.beta || 'N/A') + ' | Institutional Holding: ' + (f.institutionalHolding || 'N/A') + '%\n' + (f.quarterlyEarnings ? '- Recent Earnings: ' + f.quarterlyEarnings + '\n' : '') + '\nWrite analysis in this exact format:\n\n**OVERALL STATUS**\n(2-3 sentences about current stock position and trend)\n\n**TECHNICAL OUTLOOK**\n(2-3 sentences about price action, momentum, key levels)\n\n**FUNDAMENTAL HEALTH**\n(2-3 sentences about company financial strength)\n\n**KEY RISKS**\n- Risk 1\n- Risk 2\n- Risk 3\n\n**VERDICT: [BULLISH/BEARISH/NEUTRAL]**\n(One clear sentence)\n\n[!] Disclaimer: This is AI-generated analysis for educational purposes only. Not financial advice. Consult a SEBI-registered advisor before investing.\n\nMax 350 words. Simple language for retail investors.';

  try {
    var resp = await axios.post(GEMINI_URL + '?key=' + apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 700 }
    }, { timeout: 25000 });

    var text = resp.data && resp.data.candidates && resp.data.candidates[0] && resp.data.candidates[0].content && resp.data.candidates[0].content.parts && resp.data.candidates[0].content.parts[0] && resp.data.candidates[0].content.parts[0].text;
    if (!text) return res.status(502).json({ error: 'Empty Gemini response' });

    var upper = text.toUpperCase();
    var verdict = upper.indexOf('VERDICT: BULLISH') !== -1 ? 'BULLISH' : upper.indexOf('VERDICT: BEARISH') !== -1 ? 'BEARISH' : 'NEUTRAL';
    return res.status(200).json({ conclusion: text, verdict: verdict });

  } catch(e) {
    var detail = e.response ? JSON.stringify(e.response.data).substring(0, 300) : e.message;
    return res.status(500).json({ error: e.message, detail: detail });
  }
};
