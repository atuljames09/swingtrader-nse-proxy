// api/ai-conclusion.js  (CommonJS — matches existing Vercel proxy files)
// POST /api/ai-conclusion
// Body: { symbol, technicals: {...}, fundamentals: {...} }
// Returns: { conclusion: string, verdict: "BULLISH"|"BEARISH"|"NEUTRAL" }

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

function fmt(val, unit, fallback) {
  unit = unit || '';
  fallback = fallback || 'N/A';
  if (val === null || val === undefined || val === '' || val === 0) return fallback;
  return '' + val + unit;
}

function fmtCr(val) {
  if (!val || val === 0) return 'N/A';
  var cr = val / 1e7;
  if (cr >= 1e5) return '\u20b9' + (cr / 1e5).toFixed(2) + ' Lakh Cr';
  if (cr >= 1e3) return '\u20b9' + (cr / 1e3).toFixed(2) + 'K Cr';
  return '\u20b9' + cr.toFixed(2) + ' Cr';
}

function buildPrompt(symbol, t, f) {
  t = t || {};
  f = f || {};
  return 'You are an expert Indian stock market analyst specializing in NSE-listed equities. Analyze the following comprehensive data for ' + symbol + ' and provide a clear, actionable conclusion about the stock\'s current status.\n\nTECHNICAL ANALYSIS:\n- Overall Score: ' + fmt(t.score) + '/100 | Signal: ' + fmt(t.signal) + '\n- Entry Signal: ' + fmt(t.entrySignal) + ' | Risk Level: ' + fmt(t.riskLevel) + '\n- RSI: Daily ' + fmt(t.rsi_daily) + ' | Weekly ' + fmt(t.rsi_weekly) + ' | Monthly ' + fmt(t.rsi_monthly) + '\n- SuperTrend: ' + fmt(t.superTrend) + ' | MACD: ' + fmt(t.macd) + ' | Bollinger Band: ' + fmt(t.bbPosition) + '\n- EMA 20 vs EMA 50: ' + (t.ema20AboveEma50 ? 'Bullish Alignment \u2713' : 'Bearish Alignment \u2717') + '\n- Price vs EMA20: ' + fmt(t.priceVsEma20Pct, '%') + ' | Price Above EMA20: ' + (t.priceAboveEma20 ? 'Yes' : 'No') + '\n- Market Structure: Higher High=' + (t.higherHigh ? 'Yes' : 'No') + ', Higher Low=' + (t.higherLow ? 'Yes' : 'No') + '\n- Volume: ' + fmt(t.volumeRatio, 'x avg') + ' (' + fmt(t.volumeContext) + ')\n- ATR(14): \u20b9' + fmt(t.atr14) + ' (' + fmt(t.atrPct, '% of price') + ')\n- 52-Week Range: ' + fmt(t.week52HighPct, '% from 52W High') + ' | +' + fmt(t.week52LowPct, '% from 52W Low') + '\n- 52W High: \u20b9' + fmt(t.week52High) + ' | 52W Low: \u20b9' + fmt(t.week52Low) + '\n\nFUNDAMENTAL DATA:\n- Current Price: \u20b9' + fmt(f.currentPrice) + '\n- Market Cap: ' + fmtCr(f.marketCap) + '\n- P/E Ratio: ' + fmt(f.trailingPE) + ' | P/B Ratio: ' + fmt(f.priceToBook) + '\n- EPS (TTM): ' + fmt(f.eps) + ' | Dividend Yield: ' + fmt(f.dividendYield, '%') + '\n- Revenue (TTM): ' + fmtCr(f.revenue) + '\n- Net Income (TTM): ' + fmtCr(f.netIncome) + '\n- Total Debt: ' + fmtCr(f.totalDebt) + ' | Debt/Equity Ratio: ' + fmt(f.debtToEquity) + '\n- Operating Cash Flow: ' + fmtCr(f.operatingCashflow) + '\n- Beta (Market Sensitivity): ' + fmt(f.beta) + '\n- Institutional Holding: ' + fmt(f.institutionalHolding, '%') + ' | Insider Holding: ' + fmt(f.insiderHolding, '%') + '\n' + (f.quarterlyEarnings ? '- Recent Quarterly Earnings: ' + f.quarterlyEarnings + '\n' : '') + '\nProvide your analysis in exactly this structure:\n\n**OVERALL STATUS**\n(2-3 sentences summarizing the stock\'s current position)\n\n**TECHNICAL OUTLOOK**\n(2-3 sentences about price action and momentum)\n\n**FUNDAMENTAL HEALTH**\n(2-3 sentences about the company\'s financial strength)\n\n**KEY RISKS**\n\u2022 (Risk 1)\n\u2022 (Risk 2)\n\u2022 (Risk 3)\n\n**VERDICT: [BULLISH / BEARISH / NEUTRAL]**\n(One clear sentence explaining the overall conclusion)\n\n\u26a0\ufe0f Disclaimer: This AI-generated analysis is for educational and informational purposes only. It does not constitute financial, investment, or trading advice. Trading in equities involves significant risk of loss. Always consult a SEBI-registered investment advisor before making investment decisions. Past performance is not indicative of future results.\n\nKeep total response under 380 words. Use simple language that retail investors can understand.';
}

function extractVerdict(text) {
  var upper = text.toUpperCase();
  if (upper.indexOf('VERDICT: BULLISH') !== -1 || upper.indexOf('**BULLISH**') !== -1) return 'BULLISH';
  if (upper.indexOf('VERDICT: BEARISH') !== -1 || upper.indexOf('**BEARISH**') !== -1) return 'BEARISH';
  return 'NEUTRAL';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    var symbol = req.body.symbol;
    var technicals = req.body.technicals;
    var fundamentals = req.body.fundamentals || {};

    if (!symbol || !technicals) {
      res.status(400).json({ error: 'Missing symbol or technicals' });
      return;
    }

    var apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { res.status(500).json({ error: 'API key not configured' }); return; }

    var prompt = buildPrompt(symbol, technicals, fundamentals);

    var axios = require('axios');
    var geminiResp = await axios.post(
      GEMINI_URL + '?key=' + apiKey,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 600, topP: 0.9 }
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 20000 }
    );

    var conclusion = geminiResp.data &&
      geminiResp.data.candidates &&
      geminiResp.data.candidates[0] &&
      geminiResp.data.candidates[0].content &&
      geminiResp.data.candidates[0].content.parts &&
      geminiResp.data.candidates[0].content.parts[0] &&
      geminiResp.data.candidates[0].content.parts[0].text || '';

    if (!conclusion) { res.status(502).json({ error: 'Empty response from Gemini' }); return; }

    res.status(200).json({ conclusion: conclusion, verdict: extractVerdict(conclusion) });

  } catch (err) {
    console.error('ai-conclusion error:', err.message);
    if (err.code === 'ECONNABORTED') {
      res.status(504).json({ error: 'Gemini timeout — please try again' });
    } else {
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  }
};
