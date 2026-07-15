const { Pool } = require('pg');
const config = require('./index');

const pool = new Pool({ connectionString: config.databaseUrl });

module.exports = pool;
