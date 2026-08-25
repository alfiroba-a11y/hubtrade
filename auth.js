const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Users } = require('./models');

const JWT_SECRET = process.env.JWT_SECRET;

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
});

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
}

function validEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

router.post('/register', authLimiter, (req, res) => {
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email and password are required' });
  }
  if (username.length < 3 || username.length > 32) {
    return res.status(400).json({ error: 'username must be 3-32 characters' });
  }
  if (!validEmail(email)) {
    return res.status(400).json({ error: 'invalid email' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }
  if (Users.findByEmail.get(email)) {
    return res.status(409).json({ error: 'email already registered' });
  }
  if (Users.findByUsername.get(username)) {
    return res.status(409).json({ error: 'username already taken' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const info = Users.create.run(username, email, hash, 'user');
  const user = Users.findById.get(info.lastInsertRowid);
  const token = signToken(user);

  res.status(201).json({
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  });
});

router.post('/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = Users.findByEmail.get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'account suspended — contact an administrator' });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  });
});

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing bearer token' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = Users.findById.get(payload.sub);
    if (!user || user.status === 'suspended') {
      return res.status(401).json({ error: 'invalid session' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin access required' });
  }
  next();
}

router.get('/me', authenticate, (req, res) => {
  const { id, username, email, role, status } = req.user;
  res.json({ id, username, email, role, status });
});

module.exports = { router, authenticate, requireAdmin };
