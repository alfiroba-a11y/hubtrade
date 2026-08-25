const express = require('express');
const fetch = require('node-fetch');
const { Orders } = require('./models');

const TRADING_BASE =
  process.env.ALPACA_PAPER === 'false'
    ? 'https://api.alpaca.markets'
    : 'https://paper-api.alpaca.markets';

function headers() {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
    'Content-Type': 'application/json',
  };
}

const router = express.Router();

router.get('/account', async (req, res) => {
  const r = await fetch(`${TRADING_BASE}/v2/account`, { headers: headers() });
  const body = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: body });
  res.json(body);
});

router.get('/positions', async (req, res) => {
  const r = await fetch(`${TRADING_BASE}/v2/positions`, { headers: headers() });
  const body = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: body });
  res.json(body);
});

router.post('/orders', async (req, res) => {
  const { symbol, qty, side, type = 'market', time_in_force = 'day' } = req.body || {};

  if (!symbol || !qty || !side) {
    return res.status(400).json({ error: 'symbol, qty and side are required' });
  }
  if (!['buy', 'sell'].includes(side)) {
    return res.status(400).json({ error: 'side must be buy or sell' });
  }
  if (!(Number(qty) > 0)) {
    return res.status(400).json({ error: 'qty must be a positive number' });
  }

  const r = await fetch(`${TRADING_BASE}/v2/orders`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ symbol: symbol.toUpperCase(), qty, side, type, time_in_force }),
  });
  const body = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: body });

  Orders.create.run(req.user.id, body.id, symbol.toUpperCase(), qty, side, type, body.status);
  res.status(201).json(body);
});

router.get('/orders', (req, res) => {
  res.json(Orders.forUser.all(req.user.id));
});

module.exports = router;
