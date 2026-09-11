const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,*/*',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Referer': 'https://www.screener.in/'
};

function extractRatio(html, label) {
  const idx = html.indexOf(label);
  if (idx === -1) return null;
  const chunk = html.substring(idx, idx + 400);
  const m = chunk.match(/<span class="number">([^<]+)<\/span>/);
  return m ? m[1].trim().replace(/,/g, '') : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');

  const symbol = (req.query.symbol || '').toUpperCase().trim();
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  try {
    const url = 'https://www.screener.in/company/' + symbol + '/consolidated/';
    const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 12000 });

    const pe              = extractRatio(html, 'Stock P/E');
    const divYield        = extractRatio(html, 'Dividend Yield');
    const roe             = extractRatio(html, 'ROE');
    const bookValue       = extractRatio(html, 'Book Value');
    const currentPriceStr = extractRatio(html, 'Current Price');

    const currentPrice = currentPriceStr ? parseFloat(currentPriceStr) : null;
    const bv = bookValue ? parseFloat(bookValue) : null;
    const pb = (currentPrice && bv && bv > 0)
      ? (Math.round((currentPrice / bv) * 100) / 100).toString()
      : null;

    return res.json({
      symbol:   symbol,
      pe:       pe       || null,
      pb:       pb       || null,
      divYield: divYield ? divYield + '%' : null,
      roe:      roe      ? roe + '%'      : null,
      source:   'screener'
    });

  } catch (err) {
    if (err.response && err.response.status === 404) {
      return res.status(404).json({ error: 'Not found on Screener.in', symbol: symbol });
    }
    return res.status(503).json({ error: 'Failed to fetch fundamentals', message: err.message });
  }
};
