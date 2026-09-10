// lib/nse.js — Shared NSE session helper
// Runs from Vercel Mumbai (bom1) → Indian IP → NSE never blocks

const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const BASE = 'https://www.nseindia.com';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
           'AppleWebKit/537.36 (KHTML, like Gecko) ' +
           'Chrome/124.0.0.0 Safari/537.36';

const BASE_HEADERS = {
  'User-Agent':      UA,
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection':      'keep-alive'
};

/**
 * Creates a fresh NSE-authenticated axios client.
 * @param {string|null} symbol  If provided, also visits the stock quote page
 *                              so the historical API Referer check passes.
 */
async function createNseClient(symbol = null) {
  const jar = new CookieJar();
  const client = wrapper(axios.create({
    jar,
    withCredentials: true,
    timeout: 7000,
    headers: BASE_HEADERS
  }));

  // Step 1: NSE homepage — seeds session cookies
  await client.get(`${BASE}/`, {
    headers: { ...BASE_HEADERS, Referer: 'https://www.google.com/' }
  }).catch(() => {});

  // Step 2: Market data page — strengthens session
  await client.get(`${BASE}/market-data/`, {
    headers: { ...BASE_HEADERS, Referer: `${BASE}/` }
  }).catch(() => {});

  // Step 3: Stock quote page (only for historical requests)
  if (symbol) {
    await client.get(`${BASE}/get-quotes/equity?symbol=${symbol}`, {
      headers: { ...BASE_HEADERS, Referer: `${BASE}/market-data/` }
    }).catch(() => {});
  }

  return { client, headers: BASE_HEADERS };
}

module.exports = { BASE, BASE_HEADERS, createNseClient };
