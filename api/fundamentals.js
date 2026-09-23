const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9'
};

function grabRatio(html, label) {
  var rx = new RegExp(
    'class="name">[\\s\\S]{0,100}' + label.replace(/[/+()]/g, '\\$&') +
    '[\\s\\S]{0,300}?<span class="number">([^<]+)<\\/span>', 'i'
  );
  var m = html.match(rx);
  return m ? m[1].replace(/,/g, '').trim() : '0';
}

function grabHolding(html, label) {
  var rx = new RegExp(label + '[\\s\\S]{0,200}?<td>([\\d.]+)%<\\/td>', 'i');
  var m = html.match(rx);
  return m ? parseFloat(m[1]) : 0;
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var symbol = req.query.symbol;
  if (!symbol) return res.status(400).json({ error: 'symbol param required' });

  var html = '';
  for (var suffix of ['/consolidated/', '/']) {
    try {
      var r = await axios.get('https://www.screener.in/company/' + symbol + suffix, {
        headers: HEADERS, timeout: 12000
      });
      if (r.data && r.data.length > 5000) { html = r.data; break; }
    } catch(e) {}
  }
  if (!html) return res.status(500).json({ error: 'Could not fetch Screener page' });

  try {
    var mktCapStr = grabRatio(html, 'Market Cap');
    var priceStr  = grabRatio(html, 'Current Price');
    var peStr     = grabRatio(html, 'Stock P/E');
    var bookStr   = grabRatio(html, 'Book Value');
    var divStr    = grabRatio(html, 'Dividend Yield');

    var roeMatch  = html.match(/return on equity of ([\d.]+)%/i);
    var roeStr    = roeMatch ? roeMatch[1] : '0';

    var price  = parseFloat(priceStr)  || 0;
    var pe     = parseFloat(peStr)     || 0;
    var book   = parseFloat(bookStr)   || 0;
    var pb     = (book > 0 && price > 0) ? parseFloat((price/book).toFixed(2)) : 0;
    var divY   = parseFloat(divStr)    / 100 || 0;
    var roe    = parseFloat(roeStr)    || 0;
    var mktCap = (parseFloat(mktCapStr) || 0) * 1e7;

    var promoter = grabHolding(html, 'Promoters');
    var fii      = grabHolding(html, 'FIIs');
    var dii      = grabHolding(html, 'DIIs');
    var instit   = fii + dii;

    return res.status(200).json({
      symbol:   symbol,
      pe:       pe   > 0 ? String(pe)                 : 'N/A',
      pb:       pb   > 0 ? String(pb)                 : 'N/A',
      divYield: divY > 0 ? (divY*100).toFixed(2)+'%'  : 'N/A',
      roe:      roe  > 0 ? roe.toFixed(2)+'%'         : 'N/A',
      source:   'screener.in',
      quoteSummary: {
        result: [{
          financialData: {
            currentPrice:      { raw: price },
            totalRevenue:      { raw: 0 },
            netIncome:         { raw: 0 },
            totalDebt:         { raw: 0 },
            debtToEquity:      { raw: 0 },
            operatingCashflow: { raw: 0 }
          },
          defaultKeyStatistics: {
            trailingEps: { raw: 0  },
            priceToBook: { raw: pb },
            beta:        { raw: 0  }
          },
          summaryDetail: {
            marketCap:     { raw: mktCap },
            trailingPE:    { raw: pe     },
            dividendYield: { raw: divY   }
          },
          majorHoldersBreakdown: {
            institutionsPercentHeld: { raw: instit   / 100 },
            insidersPercentHeld:     { raw: promoter / 100 }
          },
          earningsHistory: null
        }]
      }
    });

  } catch(e) {
    return res.status(500).json({ error: 'Parse error: ' + e.message });
  }
};
