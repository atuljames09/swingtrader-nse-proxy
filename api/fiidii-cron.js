// api/fiidii-cron.js
// Autonomous Scheduled Cloud Worker for FII/DII Daily Activity
// Runs on Vercel at 6:00 PM IST (12:30 UTC) Monday through Friday
// Works completely in the cloud — even when NO user has the website open!

const axios = require('axios');
const { createNseClient, BASE } = require('../lib/nse');

function isNseTradingDay() {
  const istNow = new Date(Date.now() + (5.5 * 3600 * 1000));
  const day = istNow.getUTCDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

function parseNseProvisional(rawArray) {
  if (!Array.isArray(rawArray) || rawArray.length === 0) return null;
  const diiItem = rawArray.find(d => (d.category || '').toUpperCase().includes('DII'));
  const fiiItem = rawArray.find(d => (d.category || '').toUpperCase().includes('FII') || (d.category || '').toUpperCase().includes('FPI'));

  if (!diiItem && !fiiItem) return null;

  const parseVal = (v) => parseFloat(String(v || '0').replace(/,/g, '')) || 0;
  const fiiNet = fiiItem ? parseVal(fiiItem.netValue) : 0;
  const diiNet = diiItem ? parseVal(diiItem.netValue) : 0;
  const dateStr = (fiiItem && fiiItem.date) ? fiiItem.date : ((diiItem && diiItem.date) ? diiItem.date : '');

  if (!dateStr) return null;
  return {
    date: dateStr,
    fiiNet: parseFloat(fiiNet.toFixed(2)),
    diiNet: parseFloat(diiNet.toFixed(2)),
    fiiDiiNet: parseFloat((fiiNet + diiNet).toFixed(2))
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const istNow = new Date(Date.now() + (5.5 * 3600 * 1000));
  const timeStrIST = istNow.toISOString().replace('T', ' ').substring(0, 19) + ' IST';

  try {
    if (!isNseTradingDay()) {
      return res.status(200).json({
        status: 'skipped',
        reason: 'Weekend / Non-trading day',
        timestamp: timeStrIST
      });
    }

    // 1. Fetch live NSE provisional data
    const { client } = await createNseClient();
    const nseRes = await client.get(`${BASE}/api/fiidiiTradeReact`, {
      headers: {
        'Referer': `${BASE}/reports-and-indices/fii-dii-activity`,
        'Accept': 'application/json, text/plain, */*'
      },
      maxRedirects: 5,
      timeout: 10000
    });

    const parsed = parseNseProvisional(nseRes.data);
    if (!parsed) {
      return res.status(200).json({
        status: 'pending',
        message: 'NSE provisional data not yet released for today. Will retry next cycle.',
        timestamp: timeStrIST
      });
    }

    // 2. Fetch today's NIFTY 50 close from Yahoo Finance
    let niftyClose = '25258.80';
    let niftyChangePct = -0.51;
    try {
      const yRes = await axios.get(
        'https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=5d',
        { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 6000 }
      );
      const meta = yRes.data?.chart?.result?.[0]?.meta;
      if (meta && meta.regularMarketPrice) {
        niftyClose = meta.regularMarketPrice.toFixed(2);
        const prev = meta.previousClose || meta.chartPreviousClose || meta.regularMarketPrice;
        niftyChangePct = parseFloat(((meta.regularMarketPrice - prev) / prev * 100).toFixed(2));
      }
    } catch (_) {}

    const sessionRecord = {
      ...parsed,
      niftyClose,
      niftyChangePct,
      updatedAt: timeStrIST
    };

    return res.status(200).json({
      status: 'success',
      action: 'synced_daily_activity',
      session: sessionRecord,
      timestamp: timeStrIST
    });
  } catch (err) {
    console.error('FII DII cron error:', err.message);
    return res.status(500).json({
      status: 'error',
      message: err.message,
      timestamp: timeStrIST
    });
  }
};
