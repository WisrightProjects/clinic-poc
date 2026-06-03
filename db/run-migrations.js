const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations(pool) {
  const ownPool = !pool;
  const db = pool || new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await db.query('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())');
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
    const { rows } = await db.query('SELECT name FROM _migrations');
    const applied = new Set(rows.map(r => r.name));
    const pending = files.filter(f => !applied.has(f));
    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }
    for (const file of pending) {
      console.log(`Applying migration: ${file}`);
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
        await client.query('INSERT INTO _migrations(name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Done: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
    console.log('All migrations applied.');
  } finally {
    if (ownPool) await db.end();
  }
}

module.exports = { runMigrations };

if (require.main === module) {
  runMigrations().catch(err => { console.error(err.message); process.exit(1); });
}
