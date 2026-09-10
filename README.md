# SwingTrader NSE Proxy

A serverless proxy that fetches live NSE India market data for the SwingTrader Android app.

Deployed on **Vercel Mumbai (bom1)** region — Indian IP address ensures NSE never blocks requests.

## Endpoints

| Endpoint | Description | Cache |
|---|---|---|
| `GET /api/health` | Health check | No cache |
| `GET /api/quote?symbol=TATAMOTORS` | Live stock price | 30 sec |
| `GET /api/indices` | All NSE/BSE indices | 30 sec |
| `GET /api/historical?symbol=TATAMOTORS&from=10-09-2025&to=10-09-2026` | Historical OHLCV | 15 min |

## Deploy to Vercel

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Select the repository → Deploy
4. Copy the deployment URL (e.g. `https://swingtrader-proxy.vercel.app`)
5. Add the URL to the Android app's `ProxyClient.kt`

## Architecture

```
SwingTrader App → Vercel Mumbai → NSE India Servers
```

The proxy runs in Mumbai so NSE sees an Indian IP address — no bot protection issues.
