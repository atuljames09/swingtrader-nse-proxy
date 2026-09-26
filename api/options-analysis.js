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
  var symbol  = body.symbol    || 'UNKNOWN';
  var t = body.technicals      || {};
  var m = body.marketContext   || {};

  var prompt =
    symbol + ' ke vital technical indicators ko analyze karke mujhe options trading planning ke liye help karo.\n\n' +

    'TECHNICAL DATA:\n' +
    '- Price vs EMA20: **' + (t.priceVsEma20Pct||'N/A') + '%** | Above EMA20: ' + (t.priceAboveEma20?'Yes':'No') + '\n' +
    '- EMA Alignment: ' + (t.ema20AboveEma50 ? 'EMA20 > EMA50 (Bullish trend)' : 'EMA20 < EMA50 (Bearish trend)') + '\n' +
    '- RSI: Daily=' + (t.rsi_daily||'N/A') + ' | Weekly=' + (t.rsi_weekly||'N/A') + ' | Monthly=' + (t.rsi_monthly||'N/A') + '\n' +
    '- SuperTrend: ' + (t.superTrend||'N/A') + ' | MACD: ' + (t.macd||'N/A') + ' | BB Position: ' + (t.bbPosition||'N/A') + '\n' +
    '- Market Structure: Higher High=' + (t.higherHigh?'Yes':'No') + ' | Higher Low=' + (t.higherLow?'Yes':'No') + '\n' +
    '- Volume: ' + (t.volumeRatio||'N/A') + 'x avg (' + (t.volumeContext||'N/A') + ')\n' +
    '- ATR(14): Rs.' + (t.atr14||'N/A') + ' (' + (t.atrPct||'N/A') + '% of price)\n' +
    '- 52W High: Rs.' + (t.week52High||'N/A') + ' | 52W Low: Rs.' + (t.week52Low||'N/A') + '\n' +
    '- Signal: ' + (t.signal||'N/A') + ' | Score: ' + (t.score||'N/A') + '/100\n' +
    '- Entry: ' + (t.entrySignal||'N/A') + ' | Risk: ' + (t.riskLevel||'N/A') + '\n\n' +

    'MARKET TODAY: Nifty ' + (m.nifty50Change||'0') + '% | BankNifty ' + (m.bankNiftyChange||'0') + '% | ' + (m.marketMood||'N/A') + '\n\n' +

    'FORMATTING RULES (STRICT — follow exactly):\n' +
    '- Section headers: wrap in ** on both sides, full line. Example: **1. STRUCTURE READ**\n' +
    '- Key values (prices, %, signals): wrap in **bold**. Example: **Rs.2450** ya **RSI 67**\n' +
    '- Table format: use markdown pipe tables with header row + separator row\n' +
    '- Price ladder: use exact format below\n' +
    '- Bullet points: start with -\n\n' +

    'Is EXACT format mein analysis do:\n\n' +

    '**1. STRUCTURE READ**\n' +
    'Signals comparison table banao:\n' +
    '| Indicator | Daily | Weekly | Monthly |\n' +
    '|-----------|-------|--------|----------|\n' +
    '| RSI | value | value | value |\n' +
    '| SuperTrend | BUY/SELL | BUY/SELL | - |\n' +
    '| MACD | Bullish/Bearish | - | - |\n' +
    '| EMA Trend | Above/Below | - | - |\n' +
    'Phir ek line mein: signals aligned hain ya conflicting, aur overall trend strength.\n\n' +

    '**2. KEY LEVELS**\n' +
    'Price ladder format EXACTLY is tarah:\n' +
    'R2: **Rs.XXX** — reason (52W high / swing high)\n' +
    'R1: **Rs.XXX** — reason (EMA50 / recent swing)\n' +
    '>>> CURRENT ZONE: ~Rs.XXX <<<\n' +
    'S1: **Rs.XXX** — reason (EMA20 / recent low)\n' +
    'S2: **Rs.XXX** — reason (52W low / major support)\n\n' +

    '**3. VOLATILITY CONTEXT**\n' +
    '**ATR = Rs.' + (t.atr14||'?') + '** (daily average move **' + (t.atrPct||'?') + '%**). Options ke liye practically samjhao:\n' +
    '- Strike selection ke liye ATR ka use kaise karein\n' +
    '- Premium expectation kis range mein hogi\n\n' +

    '**4. SCENARIO VIEW**\n' +
    '- (a) **Range-bound**: Kab hoga, kaunse levels ke beech — key price range **bold** karo\n' +
    '- (b) **Breakout ↑**: Trigger level **Rs.XXX** — kaunsa indicator confirm karega\n' +
    '- (c) **Breakdown ↓**: Trigger level **Rs.XXX** — kaunsa indicator confirm karega\n\n' +

    '**5. CONFIDENCE CHECK**\n' +
    'Volume **' + (t.volumeContext||'N/A') + '** (' + (t.volumeRatio||'N/A') + 'x avg) — confirmation **strong/weak** hai. Position sizing ke liye 1-2 key points.\n\n' +

    'RULES:\n' +
    '- "Buy karo" ya "ye option lo" BILKUL mat kaho\n' +
    '- Sirf technical scenarios aur levels do\n' +
    '- Hinglish mein, mobile-friendly, concise\n' +
    '[!] Disclaimer: Educational only. Not financial/options advice.';

  var lastErr = null;
  for (var i = 0; i < MODELS.length; i++) {
    try {
      var resp = await axios.post(GROQ_URL, {
        model: MODELS[i],
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 900
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
