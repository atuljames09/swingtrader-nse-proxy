    '(2-3 sentences about price action and momentum)\n\n' +
    '**FUNDAMENTAL HEALTH**\n' +
    '(1-2 sentences about company financials)\n\n' +
    '**KEY RISKS**\n' +
    '- Risk 1\n' +
    '- Risk 2\n' +
    '- Risk 3\n\n' +
    '**VERDICT: [BULLISH/BEARISH/NEUTRAL]**\n' +
    '(One clear sentence)\n\n' +
    '[!] Disclaimer: AI-generated analysis for educational purposes only. Not financial advice. Consult a SEBI-registered investment advisor before investing.\n\n' +
    'Max 430 words. Simple language. Be realistic and market-aware.';
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
