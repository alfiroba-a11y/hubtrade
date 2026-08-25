const fetch = require('node-fetch');
const WebSocket = require('ws');

const DATA_BASE = 'https://data.alpaca.markets';
const STREAM_URL = 'wss://stream.data.alpaca.markets/v2/iex';

class PriceEngine {
  constructor({ apiKey, secretKey }) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.latest = new Map();
    this.browserClients = new Set();
    this.alpacaWs = null;
    this.subscribedSymbols = new Set();
  }

  headers() {
    return {
      'APCA-API-KEY-ID': this.apiKey,
      'APCA-API-SECRET-KEY': this.secretKey,
    };
  }

  async getLatestQuote(symbol) {
    const res = await fetch(`${DATA_BASE}/v2/stocks/${symbol}/quotes/latest`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Alpaca quote error ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async getBars(symbol, timeframe = '1Min', limit = 100) {
    const url = `${DATA_BASE}/v2/stocks/${symbol}/bars?timeframe=${timeframe}&limit=${limit}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Alpaca bars error ${res.status}: ${await res.text()}`);
    return res.json();
  }

  connectStream(symbols) {
    this.alpacaWs = new WebSocket(STREAM_URL);

    this.alpacaWs.on('open', () => {
      this.alpacaWs.send(JSON.stringify({ action: 'auth', key: this.apiKey, secret: this.secretKey }));
    });

    this.alpacaWs.on('message', (raw) => {
      let msgs;
      try {
        msgs = JSON.parse(raw.toString());
      } catch {
        return;
      }
      for (const msg of msgs) {
        if (msg.T === 'error') {
          console.error('Alpaca stream error:', msg.msg);
        }
        if (msg.T === 'success' && msg.msg === 'authenticated') {
          const subs = symbols.length ? symbols : Array.from(this.subscribedSymbols);
          subs.forEach((s) => this.subscribedSymbols.add(s));
          this.alpacaWs.send(JSON.stringify({ action: 'subscribe', trades: subs, quotes: subs }));
          console.log('Alpaca stream authenticated, subscribed to', subs.join(', '));
        }
        if (msg.T === 't' || msg.T === 'q') {
          this.latest.set(msg.S, msg);
          this.broadcast({ type: 'tick', data: msg });
        }
      }
    });

    this.alpacaWs.on('close', () => {
      console.warn('Alpaca stream closed — reconnecting in 3s');
      setTimeout(() => this.connectStream(Array.from(this.subscribedSymbols)), 3000);
    });

    this.alpacaWs.on('error', (err) => {
      console.error('Alpaca stream socket error:', err.message);
    });
  }

  addBrowserClient(ws) {
    this.browserClients.add(ws);
    ws.on('close', () => this.browserClients.delete(ws));
  }

  broadcast(payload) {
    const msg = JSON.stringify(payload);
    for (const ws of this.browserClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }
}

module.exports = PriceEngine;
