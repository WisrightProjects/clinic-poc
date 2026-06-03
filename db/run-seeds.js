const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const { Pool } = require('pg');

const SEEDS_DIR = path.join(__dirname, 'seeds');

async function runSeeds() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const files = fs.readdirSync(SEEDS_DIR).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      console.log(`Applying seed: ${file}`);
      await pool.query(fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8'));
      console.log(`Done: ${file}`);
    }
    console.log('All seeds applied.');
  } finally {
    await pool.end();
  }
}

runSeeds().catch(err => { console.error(err.message); process.exit(1); });
