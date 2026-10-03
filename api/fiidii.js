// api/fiidii.js — FII/DII Daily Cash Market Data proxy
// Fetches from NSE India with proper session management

const https = require('https');
const zlib  = require('zlib');

const NSE = 'www.nseindia.com';

// ── Promisified NSE request with cookie support ────────────────────────────────
function nseGet(path, cookies, referer) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: NSE,
      port: 443,
      path,
      method: 'GET',
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'application/json, text/plain, */*',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection':      'keep-alive',
        'Referer':         referer || `https://${NSE}/`,
        'Sec-Fetch-Site':  'same-origin',
        'Sec-Fetch-Mode':  'cors',
        'Sec-Fetch-Dest':  'empty',
        ...(cookies ? { 'Cookie': cookies } : {})
      }
    };

    const req = https.request(options, (res) => {
      // Collect set-cookie headers
      const raw = res.headers['set-cookie'] || [];
      const newCookies = raw.map(c => c.split(';')[0]).join('; ');

      // Handle gzip/br/deflate
      let stream = res;
      const enc = res.headers['content-encoding'] || '';
      if (enc.includes('br'))      stream = res.pipe(zlib.createBrotliDecompress());
      else if (enc.includes('gzip')) stream = res.pipe(zlib.createGunzip());
      else if (enc.includes('deflate')) stream = res.pipe(zlib.createInflate());

      let body = '';
      stream.on('data', chunk => { body += chunk; });
      stream.on('end',  () => resolve({ status: res.statusCode, body, newCookies }));
      stream.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// ── Merge cookie strings ───────────────────────────────────────────────────────
function mergeCookies(a, b) {
  if (!a) return b || '';
  if (!b) return a;
  const map = {};
  [...a.split('; '), ...b.split('; ')].forEach(c => {
    const [k, v] = c.split('=');
    if (k && k.trim()) map[k.trim()] = v;
  });
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ── Handler ────────────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Step 1 — Establish NSE session (homepage)
    const home = await nseGet('/', null, null);
    let cookies = home.newCookies;

    // Step 2 — Visit FII/DII market-data page (seeds specific cookies)
    const page = await nseGet(
      '/market-data/fii-dii-data',
      cookies,
      `https://${NSE}/`
    );
    cookies = mergeCookies(cookies, page.newCookies);

    // Step 3 — Call actual FII/DII API
    const api = await nseGet(
      '/api/fiidiiTradeReact',
      cookies,
      `https://${NSE}/market-data/fii-dii-data`
    );

    if (api.status !== 200) {
      return res.status(api.status).json({
        error: `NSE returned HTTP ${api.status}`,
        preview: api.body.substring(0, 200)
      });
    }

    if (!api.body || api.body.trim() === '') {
      return res.status(502).json({ error: 'Empty response from NSE' });
    }

    // Return as-is (JSON array or object)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=300'); // cache 5 min on Vercel edge
    return res.status(200).send(api.body);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
