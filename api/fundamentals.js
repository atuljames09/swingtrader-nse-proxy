const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

function grabVal(html, label) {
  var rx = new RegExp(label + '[^<]*<\\/span>[^<]*<span[^>]*>([^<]+)<', 'i');
  var m = html.match(rx);
  return m ? m[1].trim() : '';
}

function toNum(s) {
  if (!s) return 0;
  return parseFloat(String(s).replace(/[₹,%\s,]/g, '')) || 0;
}

function grabTableVal(html, rowLabel, colIndex) {
  colIndex = colIndex || 0;
  var rx = new RegExp(rowLabel + '[\\s\\S]{0,300}?<td[^>]*>([\\d,.-]+)<\\/td>', 'i');
  var m = html.match(rx);
  return m ? parseFloat(m[1].replace(/,/g, '')) || 0 : 0;
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var symbol = req.query.symbol;
  if (!symbol) return res.status(400).json({ error: 'symbol param required' });

  var html = '';
  var errors = [];

  for (var suffix of ['/consolidated/', '/']) {
    try {
      var r = await axios.get('https://www.screener.in/company/' + symbol + suffix, {
        headers: HEADERS, timeout: 12000
      });
      if (r.data && r.data.length > 5000) { html = r.data; break; }
    } catch(e) { errors.push(e.message); }
  }

  if (!html) return res.status(500).json({ error: 'Could not fetch Screener page', details: errors });

  try {
    // ── Top Ratios ─────────────────────────────────────────────────────────
    var mktCapStr   = grabVal(html, 'Market Cap');
    var priceStr    = grabVal(html, 'Current Price');
    var peStr       = grabVal(html, 'Stock P/E');
    var bookStr     = grabVal(html, 'Book Value');
    var divYStr     = grabVal(html, 'Dividend Yield');
    var roeStr      = grabVal(html, 'Return on equity');
    var debtEqStr   = grabVal(html, 'Debt to equity');

    var price     = toNum(priceStr);
    var pe        = toNum(peStr);
    var book      = toNum(bookStr);
    var pb        = (book > 0 && price > 0) ? parseFloat((price / book).toFixed(2)) : 0;
    var divYield  = toNum(divYStr) / 100;
    var roe       = toNum(roeStr) / 100;
    var debtEq    = toNum(debtEqStr);

    // Market Cap: "1,67,462 Cr." → Cr × 1e7 = absolute
    var mktCapCr  = toNum(mktCapStr);
    var mktCap    = mktCapCr * 1e7;

    // ── Financial Tables (values in Cr) ────────────────────────────────────
    var revenueCr  = grabTableVal(html, 'Sales\\+');
    var profitCr   = grabTableVal(html, 'Net Profit\\+');
    var debtCr     = grabTableVal(html, 'Borrowings\\+');
    var cfCr       = grabTableVal(html, 'Cash from Operating');
    var epsCr      = grabTableVal(html, 'EPS in Rs\\+');

    var revenue = revenueCr * 1e7;
    var profit  = profitCr  * 1e7;
    var debt    = debtCr    * 1e7;
    var cf      = cfCr      * 1e7;
    var eps     = epsCr;

    // ── Shareholding ────────────────────────────────────────────────────────
    var promoMatch = html.match(/Promoters[\s\S]{0,50}?([\d.]+)%/);
    var fiiMatch   = html.match(/FII[\s\S]{0,50}?([\d.]+)%/);
    var diiMatch   = html.match(/DII[\s\S]{0,50}?([\d.]+)%/);

    var promoter = promoMatch ? parseFloat(promoMatch[1]) / 100 : 0;
    var fii      = fiiMatch   ? parseFloat(fiiMatch[1])   / 100 : 0;
    var dii      = diiMatch   ? parseFloat(diiMatch[1])   / 100 : 0;
    var instit   = fii + dii;

    // Return in standard quoteSummary format (same as FundamentalsRepository expects)
    return res.status(200).json({
      quoteSummary: {
        result: [{
          financialData: {
            currentPrice:      { raw: price    },
            totalRevenue:      { raw: revenue  },
            netIncome:         { raw: profit   },
            totalDebt:         { raw: debt     },
            debtToEquity:      { raw: debtEq * 100 },
            operatingCashflow: { raw: cf       }
          },
          defaultKeyStatistics: {
            trailingEps: { raw: eps  },
            priceToBook: { raw: pb   },
            beta:        { raw: 0    }
          },
          summaryDetail: {
            marketCap:     { raw: mktCap   },
            trailingPE:    { raw: pe       },
            dividendYield: { raw: divYield }
          },
          majorHoldersBreakdown: {
            institutionsPercentHeld: { raw: instit   },
            insidersPercentHeld:     { raw: promoter }
          },
          earningsHistory: null
        }]
      },
      source: 'screener.in'
    });

  } catch(e) {
    return res.status(500).json({ error: 'Parse error: ' + e.message });
  }
};
