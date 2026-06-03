require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Pool } = require('pg');
const app = require('./app');
const config = require('./config');
const { runMigrations } = require('../../db/run-migrations');

async function start() {
  const migrationPool = new Pool({ connectionString: config.databaseUrl });
  try {
    await runMigrations(migrationPool);
  } finally {
    await migrationPool.end();
  }
  app.listen(config.port, () => {
    console.log(`ClinicAI backend running on http://localhost:${config.port}`);
  });
}

start().catch(err => { console.error(err.message); process.exit(1); });
