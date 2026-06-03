require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const app = require('./app');
const config = require('./config');

const MIGRATIONS_DIR = path.join(__dirname, '../../db/migrations');

async function runMigrations(pool) {
  await pool.query('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())');
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT name FROM _migrations');
  const applied = new Set(rows.map(r => r.name));
  const pending = files.filter(f => !applied.has(f));
  for (const file of pending) {
    console.log(`Migration: ${file}`);
    await pool.query('BEGIN');
    await pool.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    await pool.query('INSERT INTO _migrations(name) VALUES ($1)', [file]);
    await pool.query('COMMIT');
  }
}

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
