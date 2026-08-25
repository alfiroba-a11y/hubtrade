const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watchlist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, symbol)
);

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alpaca_order_id TEXT,
  symbol          TEXT NOT NULL,
  qty             REAL NOT NULL,
  side            TEXT NOT NULL CHECK(side IN ('buy','sell')),
  type            TEXT NOT NULL DEFAULT 'market',
  status          TEXT NOT NULL DEFAULT 'submitted',
  submitted_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

module.exports = {
  db,
  Users: {
    create: db.prepare(
      `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`
    ),
    findByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
    findByUsername: db.prepare(`SELECT * FROM users WHERE username = ?`),
    findById: db.prepare(`SELECT * FROM users WHERE id = ?`),
    all: db.prepare(
      `SELECT id, username, email, role, status, created_at FROM users ORDER BY id DESC`
    ),
    setStatus: db.prepare(`UPDATE users SET status = ? WHERE id = ?`),
    setRole: db.prepare(`UPDATE users SET role = ? WHERE id = ?`),
  },
  Orders: {
    create: db.prepare(
      `INSERT INTO orders (user_id, alpaca_order_id, symbol, qty, side, type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ),
    forUser: db.prepare(`SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC`),
    all: db.prepare(
      `SELECT orders.*, users.username
       FROM orders JOIN users ON users.id = orders.user_id
       ORDER BY orders.id DESC`
    ),
  },
  Watchlist: {
    add: db.prepare(`INSERT OR IGNORE INTO watchlist (user_id, symbol) VALUES (?, ?)`),
    remove: db.prepare(`DELETE FROM watchlist WHERE user_id = ? AND symbol = ?`),
    forUser: db.prepare(`SELECT symbol FROM watchlist WHERE user_id = ?`),
  },
};
