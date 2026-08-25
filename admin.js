const express = require('express');
const { Users, Orders } = require('./models');

const router = express.Router();

router.get('/users', (req, res) => {
  res.json(Users.all.all());
});

router.post('/users/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'status must be active or suspended' });
  }
  Users.setStatus.run(status, req.params.id);
  res.json({ ok: true });
});

router.post('/users/:id/role', (req, res) => {
  const { role } = req.body || {};
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'role must be user or admin' });
  }
  Users.setRole.run(role, req.params.id);
  res.json({ ok: true });
});

router.get('/orders', (req, res) => {
  res.json(Orders.all.all());
});

module.exports = router;
