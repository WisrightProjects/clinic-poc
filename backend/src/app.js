const express = require('express');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');
const { errorHandler } = require('./utils/errors');
const { TRUSTED_PROXIES } = require('./utils/clientIp');

const app = express();

// Behind Coolify's proxy (and, for the doctor web, its nginx), req.socket is the proxy.
// Trust only proxies on the private network (utils/clientIp.js), so req.ip is the real
// client address from X-Forwarded-For and a client can't fake it (used by the login limiter).
app.set('trust proxy', TRUSTED_PROXIES);

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());
app.use('/api', routes);
app.use(errorHandler);

module.exports = app;
