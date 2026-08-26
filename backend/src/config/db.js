const { Pool, types } = require('pg');
const config = require('./index');

// Postgres DATE (OID 1082) → keep the raw 'YYYY-MM-DD' string instead of letting
// node-postgres parse it to a JS Date. The default parse builds a Date at the
// server's LOCAL midnight, and res.json then serializes that to a UTC ISO string,
// which shifts the calendar day by one on any non-UTC (e.g. IST) backend. Every
// client reads visit_date via .slice(0,10) for date grouping / "today" counts, so
// that shift would land rows on the wrong day. Returning the plain date string
// keeps them correct regardless of the server's timezone.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({ connectionString: config.databaseUrl });

module.exports = pool;
