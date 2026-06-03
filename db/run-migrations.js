const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())');
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
    const { rows } = await pool.query('SELECT name FROM _migrations');
    const applied = new Set(rows.map(r => r.name));
    const pending = files.filter(f => !applied.has(f));
    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }
    for (const file of pending) {
      console.log(`Applying migration: ${file}`);
      await pool.query('BEGIN');
      await pool.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
      await pool.query('INSERT INTO _migrations(name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`Done: ${file}`);
    }
    console.log('All migrations applied.');
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await pool.end();
  }
}

runMigrations().catch(err => { console.error(err.message); process.exit(1); });
