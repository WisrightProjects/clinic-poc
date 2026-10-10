const authService = require('../services/authService');

async function login(req, res) {
  const { mobile, password } = req.body || {};
  const result = await authService.login(mobile, password);
  res.json(result);
}

async function me(req, res) {
  res.json({ user: authService.toPublicUser(req.user) });
}

module.exports = { login, me };
