    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
    const prompt = buildPrompt(symbol, technicals, fundamentals || {});
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 600,
          topP: 0.9
        }
      })
    });
    clearTimeout(timeout);
    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      return res.status(502).json({ error: `Gemini error: ${geminiRes.status}`, detail: err });
    }
    const geminiData = await geminiRes.json();
    const conclusion = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!conclusion) return res.status(502).json({ error: 'Empty response from Gemini' });
    return res.status(200).json({
      conclusion,
      verdict: extractVerdict(conclusion)
    });
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({ error: 'Gemini timeout — try again' });
    console.error('ai-conclusion error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
