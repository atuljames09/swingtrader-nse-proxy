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
  var symbol  = body.symbol || 'UNKNOWN';
  var t = body.technicals    || {};
  var m = body.marketContext || {};

  var prompt =
    symbol + ' ke vital technical indicators ko analyze karke mujhe options trading planning ke liye help karo.\n\n' +

    'TECHNICAL DATA:\n' +
    '- Price vs EMA20: ' + (t.priceVsEma20Pct||'N/A') + '% | Above EMA20: ' + (t.priceAboveEma20?'Yes':'No') + '\n' +
    '- EMA Alignment: ' + (t.ema20AboveEma50 ? 'EMA20 > EMA50 (Bullish trend)' : 'EMA20 < EMA50 (Bearish trend)') + '\n' +
    '- RSI: Daily=' + (t.rsi_daily||'N/A') + ' | Weekly=' + (t.rsi_weekly||'N/A') + ' | Monthly=' + (t.rsi_monthly||'N/A') + '\n' +
    '- SuperTrend: ' + (t.superTrend||'N/A') + ' | MACD: ' + (t.macd||'N/A') + ' | BB Position: ' + (t.bbPosition||'N/A') + '\n' +
    '- Market Structure: Higher High=' + (t.higherHigh?'Yes':'No') + ' | Higher Low=' + (t.higherLow?'Yes':'No') + '\n' +
    '- Volume: ' + (t.volumeRatio||'N/A') + 'x avg (' + (t.volumeContext||'N/A') + ')\n' +
    '- ATR(14): Rs.' + (t.atr14||'N/A') + ' (' + (t.atrPct||'N/A') + '% of price) = average daily move\n' +
    '- 52W High: Rs.' + (t.week52High||'N/A') + ' (' + (t.week52HighPct||'N/A') + '% se current price neeche)\n' +
    '- 52W Low: Rs.' + (t.week52Low||'N/A') + ' (+' + (t.week52LowPct||'N/A') + '% current price upar)\n' +
    '- Overall Signal: ' + (t.signal||'N/A') + ' | Score: ' + (t.score||'N/A') + '/100\n' +
    '- Entry Signal: ' + (t.entrySignal||'N/A') + ' | Risk Level: ' + (t.riskLevel||'N/A') + '\n\n' +

    'MARKET TODAY:\n' +
    '- Nifty 50: ' + (m.nifty50Change||'0') + '% | Bank Nifty: ' + (m.bankNiftyChange||'0') + '% | Mood: ' + (m.marketMood||'N/A') + '\n\n' +

    'Is EXACT format mein analysis do:\n\n' +

    '**1. STRUCTURE READ**\n' +
    '(Daily vs Weekly vs Monthly — RSI, MACD, SuperTrend, EMA compare karo. Signals aligned hain ya conflicting? Trend strength batao.)\n\n' +

    '**2. KEY LEVELS**\n' +
    '(Support/resistance zones nikalo — 52W high/low, EMA zones, swing levels se. Price ladder format mein:\n' +
    'R2: Rs.XXX — reason\n' +
    'R1: Rs.XXX — reason\n' +
    '>>> CURRENT ZONE <<<\n' +
    'S1: Rs.XXX — reason\n' +
    'S2: Rs.XXX — reason)\n\n' +

    '**3. VOLATILITY CONTEXT**\n' +
    '(ATR = Rs.' + (t.atr14||'?') + ' per day average move. Options premium aur strike selection ke liye iska kya matlab hai — practically samjhao.)\n\n' +

    '**4. SCENARIO VIEW**\n' +
    '(a) Range-bound: Kab hoga, kaunse levels ke beech, kaunsi strategy suit karegi?\n' +
    '(b) Breakout ↑: Trigger level? Kaunsa indicator confirm karega?\n' +
    '(c) Breakdown ↓: Trigger level? Kaunsa indicator confirm karega?\n\n' +

    '**5. CONFIDENCE CHECK**\n' +
    '(Volume currently ' + (t.volumeContext||'N/A') + ' — confirmation strong/weak hai? Position sizing ke liye kya dhyan rakhe?)\n\n' +

    'RULES:\n' +
    '- "Buy karo" ya "ye option lo" BILKUL mat kaho\n' +
    '- Sirf technical scenarios aur levels do — final decision reader ka hai\n' +
    '- Hinglish mein likho, mobile-friendly rakho\n' +
    '- Price ladder section clearly structured rakho\n\n' +
    '[!] Disclaimer: Educational purposes only. Not financial/options advice.';

  var lastErr = null;
  for (var i = 0; i < MODELS.length; i++) {
    try {
      var resp = await axios.post(GROQ_URL, {
        model: MODELS[i],
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 850
      }, {
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        timeout: 25000
      });

      var text = resp.data && resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message && resp.data.choices[0].message.content;
      if (!text) continue;
      return res.status(200).json({ conclusion: text });

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
