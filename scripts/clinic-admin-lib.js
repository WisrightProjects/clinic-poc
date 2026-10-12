// Pure helpers for scripts/clinic-admin.mjs (CLINIC-008.6): password generation and
// "Name:mobile" parsing. No DB, no I/O — so they can be unit tested
// (backend/src/__tests__/clinicAdmin.test.js).

const crypto = require('crypto');
const { normalizeMobile } = require('../backend/src/utils/mobile');

// No 0/O, 1/l/I — passwords get read out over the phone or copied into a message.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const PASSWORD_LENGTH = 10;

// A mistake the person running the script can fix: printed without a stack trace.
class UsageError extends Error {}

function generatePassword() {
  let out = '';
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    out += PASSWORD_ALPHABET[crypto.randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

// "Dr. Ramesh:9876543210" -> { name, mobile }. Splits on the LAST ':' so a name
// containing a colon still works. Throws a readable Error on bad input.
function parseUserArg(flag, value) {
  const idx = typeof value === 'string' ? value.lastIndexOf(':') : -1;
  const name = idx > 0 ? value.slice(0, idx).trim() : '';
  const mobile = idx > 0 ? normalizeMobile(value.slice(idx + 1).trim()) : null;
  if (!name || !mobile) {
    throw new UsageError(`${flag} must look like "Name:10-digit-mobile" (got ${JSON.stringify(value)})`);
  }
  return { name, mobile };
}

module.exports = { UsageError, generatePassword, parseUserArg };
