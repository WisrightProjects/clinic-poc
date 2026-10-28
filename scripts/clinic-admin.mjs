#!/usr/bin/env node
/**
 * clinic-admin.mjs — onboard trial clinics without an admin screen (CLINIC-008.6).
 *
 *   node scripts/clinic-admin.mjs create-clinic "Sri Clinic, Madurai" \
 *        --doctor "Dr. Ramesh:9876543210" --attender "Priya:9876500000"
 *   node scripts/clinic-admin.mjs reset-password 9876543210
 *
 * create-clinic: makes the clinic, gives it its own copy of every active question
 * template of the Default Clinic, and creates the doctor and attender with random
 * passwords. All in one transaction — a failure leaves nothing half-created.
 * reset-password: sets a new random password and signs that user out everywhere
 * (users.password_changed_at = now(); older tokens are rejected).
 *
 * Passwords are printed ONCE; only a bcrypt hash is stored. Uses DATABASE_URL from
 * backend/.env (like the db runners) — set DATABASE_URL in the environment to
 * target another database.
 */

import { createRequire } from 'module';
import path from 'path';
import { parseArgs } from 'util';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const require = createRequire(import.meta.url);
const { UsageError, generatePassword, parseUserArg } = require('./clinic-admin-lib.js');
const { normalizeMobile } = require('../backend/src/utils/mobile.js');

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../backend/.env') });

const TEMPLATE_SOURCE_CLINIC = 'Default Clinic';
// Keep in step with DUMMY_HASH in backend/src/services/authService.js ($2a$10$): login
// compares against it for unknown mobiles so response time stays the same.
const BCRYPT_ROUNDS = 10;
const CLINIC_NAME_CONSTRAINT = 'clinics_name_key'; // migration 006
const USAGE = `Usage:
  node scripts/clinic-admin.mjs create-clinic "<clinic name>" --doctor "<name>:<mobile>" --attender "<name>:<mobile>"
  node scripts/clinic-admin.mjs reset-password <mobile>`;

async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Copy every active template (and its questions) from the Default Clinic.
async function copyTemplates(client, clinicId) {
  const { rows: sources } = await client.query(
    `SELECT t.id, t.department_id, t.name
       FROM question_templates t JOIN clinics c ON c.id = t.clinic_id
      WHERE c.name = $1 AND t.is_active
      ORDER BY t.id`,
    [TEMPLATE_SOURCE_CLINIC]
  );
  for (const src of sources) {
    const { rows } = await client.query(
      `INSERT INTO question_templates (department_id, name, is_active, clinic_id)
       VALUES ($1, $2, true, $3) RETURNING id`,
      [src.department_id, src.name, clinicId]
    );
    await client.query(
      // With the answer types, options and sections (CLINIC-021), so a branching list copies whole.
      `INSERT INTO questions (template_id, order_index, text, answer_type, options, multi, section)
       SELECT $1, order_index, text, answer_type, options, multi, section FROM questions WHERE template_id = $2`,
      [rows[0].id, src.id]
    );
  }
  return sources.length;
}

async function createClinic(pool, argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { doctor: { type: 'string' }, attender: { type: 'string' } },
  });
  const clinicName = positionals[0]?.trim();
  if (!clinicName || positionals.length > 1) {
    throw new UsageError(`give exactly one clinic name — quote it if it has spaces.\n${USAGE}`);
  }
  if (!values.doctor || !values.attender) throw new UsageError(`--doctor and --attender are both required.\n${USAGE}`);

  const parsed = [
    { ...parseUserArg('--doctor', values.doctor), role: 'doctor' },
    { ...parseUserArg('--attender', values.attender), role: 'attender' },
  ];
  if (parsed[0].mobile === parsed[1].mobile) throw new UsageError('the doctor and attender need different mobile numbers.');

  const users = await Promise.all(
    parsed.map(async (u) => {
      const password = generatePassword();
      return { ...u, password, hash: await bcrypt.hash(password, BCRYPT_ROUNDS) };
    })
  );

  let result;
  try {
    result = await withTransaction(pool, async (client) => {
      const { rows } = await client.query('INSERT INTO clinics (name) VALUES ($1) RETURNING id', [clinicName]);
      const clinicId = rows[0].id;
      const templates = await copyTemplates(client, clinicId);
      for (const u of users) {
        await client.query(
          `INSERT INTO users (clinic_id, name, mobile, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
          [clinicId, u.name, u.mobile, u.hash, u.role]
        );
      }
      return { clinicId, templates };
    });
  } catch (err) {
    if (err.code === '23505') {
      throw new UsageError(
        err.constraint === CLINIC_NAME_CONSTRAINT
          ? `a clinic named "${clinicName}" already exists.`
          : 'one of those mobile numbers already belongs to another user.'
      );
    }
    throw err;
  }

  console.log(`Created clinic #${result.clinicId}: ${clinicName}`);
  console.log(`Copied ${result.templates} question template(s) from "${TEMPLATE_SOURCE_CLINIC}".`);
  if (result.templates === 0) console.warn(`Warning: "${TEMPLATE_SOURCE_CLINIC}" has no active templates, so this clinic has none.`);
  console.log('\nLogins (shown once — they cannot be retrieved later):');
  for (const u of users) {
    console.log(`  ${u.role.padEnd(8)} ${u.name}  mobile ${u.mobile}  password ${u.password}`);
  }
}

async function resetPassword(pool, argv) {
  const mobile = normalizeMobile(argv[0]);
  if (!mobile) throw new UsageError(`a valid 10-digit mobile number is required.\n${USAGE}`);

  const password = generatePassword();
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { rows } = await pool.query(
    `UPDATE users SET password_hash = $1, password_changed_at = now()
      WHERE mobile = $2 RETURNING name, role, is_active`,
    [hash, mobile]
  );
  if (rows.length === 0) throw new UsageError(`no user with mobile ${mobile}.`);

  const user = rows[0];
  console.log(`Password reset for ${user.role} ${user.name} (${mobile}). They are signed out of every device.`);
  console.log(`New password (shown once): ${password}`);
  if (!user.is_active) console.warn('Warning: this user is deactivated and still cannot sign in.');
}

const COMMANDS = { 'create-clinic': createClinic, 'reset-password': resetPassword };

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!COMMANDS[command]) throw new UsageError(`unknown or missing command.\n${USAGE}`);
  if (!process.env.DATABASE_URL) throw new UsageError('DATABASE_URL is not set (expected in backend/.env).');

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await COMMANDS[command](pool, rest);
  } finally {
    await pool.end();
  }
}

// The only place that sets the exit code. Bad input (UsageError, or a bad flag from
// util.parseArgs) prints just the message; anything unexpected prints the stack.
main().catch((err) => {
  const expected = err instanceof UsageError || err.code?.startsWith?.('ERR_PARSE_ARGS');
  console.error(expected || !err.stack ? `Error: ${err.message}` : err.stack);
  process.exitCode = 1;
});
