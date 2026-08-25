require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const { router: authRouter, authenticate, requireAdmin } = require('./src/auth');
const tradeRouter = require('./src/trade');
const adminRouter = require('./src/admin');
const PriceEngine = require('./src/priceEngine');

const REQUIRED_ENV = ['JWT_SECRET', 'ALPACA_API_KEY', 'ALPACA_SECRET_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    console.error('Copy .env.example to .env and fill in real values before starting.');
    process.exit(1);
  }
}

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRouter);
app.use('/api/trade', authenticate, tradeRouter);
app.use('/api/admin', authenticate, requireAdmin, adminRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

const priceEngine = new PriceEngine({
  apiKey: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
});
const WATCH_SYMBOLS = (process.env.WATCH_SYMBOLS || 'AAPL,MSFT,TSLA,SPY').split(',');
priceEngine.connectStream(WATCH_SYMBOLS);

app.get('/api/prices/bars/:symbol', authenticate, async (req, res) => {
  try {
    const bars = await priceEngine.getBars(
      req.params.symbol,
      req.query.timeframe || '1Min',
      req.query.limit || 100
    );
    res.json(bars);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws/prices' });

wss.on('connection', (ws) => {
  priceEngine.addBrowserClient(ws);
  ws.send(JSON.stringify({ type: 'symbols', data: WATCH_SYMBOLS }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Trader's Hub running at http://localhost:${PORT}`);
  console.log(`Mode: ${process.env.ALPACA_PAPER === 'false' ? 'LIVE TRADING' : 'paper trading'}`);
});
