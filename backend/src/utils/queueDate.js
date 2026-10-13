// Purpose: the queue's day (CLINIC-015). The queue is one list per day, and "today" is the
// clinic's local day (IST), not the server's UTC day — otherwise the queue would switch days
// at 5:30 am. The SQL side uses the same zone (CLINIC_TODAY_SQL in visitRepository).

const { AppError } = require('./errors');

const CLINIC_TIME_ZONE = 'Asia/Kolkata';

// Today's date (YYYY-MM-DD) in the clinic's time zone. `now` is injectable for tests.
function clinicToday(now = new Date()) {
  // The en-CA locale formats a date as YYYY-MM-DD.
  return now.toLocaleDateString('en-CA', { timeZone: CLINIC_TIME_ZONE });
}

// The ?date= query: a real calendar date as YYYY-MM-DD (not 2026-02-30), or today when none
// is given. Anything else is a 400.
function parseQueueDate(value, now = new Date()) {
  if (value === undefined || value === '') return clinicToday(now);
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const [, y, m, d] = match.map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d) return value;
  }
  throw new AppError('BAD_REQUEST', 'date must be a valid date as YYYY-MM-DD', 400);
}

module.exports = { CLINIC_TIME_ZONE, clinicToday, parseQueueDate };
