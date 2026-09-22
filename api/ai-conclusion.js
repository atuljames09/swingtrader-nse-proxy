const axios = require('axios');

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(200).json({ error: 'No GROQ_API_KEY' });

  try {
    var r = await axios.get('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': 'Bearer ' + apiKey },
      timeout: 10000
    });
    var names = (r.data.data || []).map(function(m) { return m.id; });
    return res.status(200).json({ models: names });
  } catch(e) {
    return res.status(200).json({ error: e.message, detail: e.response ? JSON.stringify(e.response.data).substring(0,300) : '' });
  }
};
