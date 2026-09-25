const axios = require('axios');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

  var body = req.body || {};
  var symbol = body.symbol || 'UNKNOWN';
  var t = body.technicals || {};
  var f = body.fundamentals || {};
  var m = body.marketContext || {};

  var stockChangePct = parseFloat(t.priceVsEma20Pct) || 0;
  var marketChange   = parseFloat(m.avgIndexChange) || 0;
  var outperforming  = stockChangePct > marketChange ? 'outperforming' : stockChangePct < marketChange ? 'underperforming' : 'in-line with';

  var prompt =
    'You are an expert Indian stock market analyst. Analyze ' + symbol + ' and give a clear, actionable conclusion for retail investors.\n\n' +
    'MARKET CONTEXT (Today):\n' +
    '- Nifty 50: ' + (m.nifty50Value||'N/A') + ' | Change: ' + (m.nifty50Change||'0') + '%\n' +
    '- Bank Nifty: ' + (m.bankNiftyValue||'N/A') + ' | Change: ' + (m.bankNiftyChange||'0') + '%\n' +
    '- Sensex: ' + (m.sensexValue||'N/A') + ' | Change: ' + (m.sensexChange||'0') + '%\n' +
    '- Market Mood: ' + (m.marketMood||'UNKNOWN') + ' (avg: ' + (m.avgIndexChange||'0') + '%)\n' +
    '- ' + symbol + ' is ' + outperforming + ' the broader market today\n\n' +
    'TECHNICAL INDICATORS:\n' +
    '- Score: ' + (t.score||'N/A') + '/100 | Signal: ' + (t.signal||'N/A') + '\n' +
    '- Entry: ' + (t.entrySignal||'N/A') + ' | Risk: ' + (t.riskLevel||'N/A') + '\n' +
    '- RSI: D=' + (t.rsi_daily||'N/A') + ' W=' + (t.rsi_weekly||'N/A') + ' M=' + (t.rsi_monthly||'N/A') + '\n' +
    '- SuperTrend: ' + (t.superTrend||'N/A') + ' | MACD: ' + (t.macd||'N/A') + ' | BB: ' + (t.bbPosition||'N/A') + '\n' +
    '- EMA: ' + (t.ema20AboveEma50 ? 'Bullish EMA20>EMA50' : 'Bearish EMA20<EMA50') + '\n' +
    '- Price vs EMA20: ' + (t.priceVsEma20Pct||'N/A') + '% | Above EMA20: ' + (t.priceAboveEma20?'Yes':'No') + '\n' +
    '- Structure: HH=' + (t.higherHigh?'Yes':'No') + ' HL=' + (t.higherLow?'Yes':'No') + '\n' +
    '- Volume: ' + (t.volumeRatio||'N/A') + 'x avg (' + (t.volumeContext||'N/A') + ')\n' +
    '- ATR14: Rs.' + (t.atr14||'N/A') + ' (' + (t.atrPct||'N/A') + '%) | 52W High: Rs.' + (t.week52High||'N/A') + ' | 52W Low: Rs.' + (t.week52Low||'N/A') + '\n\n' +
    'FUNDAMENTALS:\n' +
    '- Price: Rs.' + (f.currentPrice||'N/A') + ' | MCap: ' + (f.marketCap?'Rs.'+(f.marketCap/1e7).toFixed(0)+' Cr':'N/A') + '\n' +
    '- PE: ' + (f.trailingPE||'N/A') + ' | PB: ' + (f.priceToBook||'N/A') + ' | EPS: ' + (f.eps||'N/A') + '\n' +
    '- Revenue: ' + (f.revenue?'Rs.'+(f.revenue/1e7).toFixed(0)+' Cr':'N/A') + ' | Net Income: ' + (f.netIncome?'Rs.'+(f.netIncome/1e7).toFixed(0)+' Cr':'N/A') + '\n' +
    '- D/E: ' + (f.debtToEquity||'N/A') + ' | Div Yield: ' + (f.dividendYield||'N/A') + '% | Beta: ' + (f.beta||'N/A') + '\n' +
    '- Institutional: ' + (f.institutionalHolding||'N/A') + '% | Insider: ' + (f.insiderHolding||'N/A') + '%\n\n' +
    'ANALYSIS RULES:\n' +
    '1. Market is ' + (m.marketMood||'UNKNOWN') + ' today. Check if stock move is market-driven or stock-specific.\n' +
    '2. If BEARISH market and stock falling less = relatively strong (positive sign).\n' +
    '3. If BULLISH market and stock falling = weak (warning sign).\n' +
    '4. For banking stocks, Bank Nifty (' + (m.bankNiftyChange||'0') + '%) is most relevant.\n\n' +
    'Reply in EXACTLY this format:\n\n' +
    '**OVERALL STATUS**\n(2-3 sentences)\n\n' +
    '**MARKET CONTEXT IMPACT**\n(1-2 sentences: market-driven or stock-specific? Outperforming or underperforming?)\n\n' +
    '**TECHNICAL OUTLOOK**\n(2-3 sentences)\n\n' +
    '**FUNDAMENTAL HEALTH**\n(1-2 sentences)\n\n' +
    '**KEY RISKS**\n- Risk 1\n- Risk 2\n- Risk 3\n\n' +
    '**VERDICT: [BULLISH/BEARISH/NEUTRAL]**\n(One sentence)\n\n' +
    '[!] Disclaimer: AI-generated. Not financial advice. Consult SEBI-registered advisor.\n\n' +
    'Max 430 words. Simple language.';

  var lastErr = null;
  for (var i = 0; i < MODELS.length; i++) {
    try {
      var resp = await axios.post(GROQ_URL, {
        model: MODELS[i],
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 750
      }, {
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        timeout: 20000
      });
      var text = resp.data && resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message && resp.data.choices[0].message.content;
      if (!text) continue;
      var upper = text.toUpperCase();
      var verdict = upper.indexOf('VERDICT: BULLISH') !== -1 ? 'BULLISH' : upper.indexOf('VERDICT: BEARISH') !== -1 ? 'BEARISH' : 'NEUTRAL';
      return res.status(200).json({ conclusion: text, verdict: verdict, model: MODELS[i] });
    } catch(e) {
      lastErr = e;
      var code = e.response && e.response.status;
      if (code === 503 || code === 429 || code === 404) continue;
      break;
    }
  }
  var detail = lastErr && lastErr.response ? JSON.stringify(lastErr.response.data).substring(0,300) : (lastErr ? lastErr.message : 'unknown');
  return res.status(500).json({ error: 'All models failed', detail: detail });
};
