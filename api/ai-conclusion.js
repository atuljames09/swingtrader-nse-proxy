const axios = require('axios');

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(200).json({ error: 'No API key' });

  try {
    var r = await axios.get('https://generativelanguage.googleapis.com/v1/models?key=' + apiKey, { timeout: 10000 });
    var names = (r.data.models || []).slice(0, 15).map(function(m) { return m.name; });
    return res.status(200).json({ models: names, keyLen: apiKey.length });
  } catch(e) {
    return res.status(200).json({ error: e.message, detail: e.response ? JSON.stringify(e.response.data).substring(0, 300) : 'no detail' });
  }
};
