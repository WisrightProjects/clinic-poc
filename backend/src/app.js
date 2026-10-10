const express = require('express');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');
const { errorHandler } = require('./utils/errors');

const app = express();

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());
app.use('/api', routes);
app.use(errorHandler);

module.exports = app;
