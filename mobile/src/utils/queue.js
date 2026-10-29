// A visit's place in the queue (CLINIC-014). queue_date / queue_token are always set by the
// API (migration 009), and are what a patient is called by: a patient back from tests keeps
// their original visit_date / token_number but gets today's queue_date and a token at the end.
// Keep in step with frontend/src/utils/queue.js.

// A day (YYYY-MM-DD) as a compact "25 Aug", built from its parts (no time zone shift).
export function shortDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Patients the doctor sent for tests leave the day queue and form their own section.
export const TESTS_GROUP = 'tests';

// The day (YYYY-MM-DD) of the visit's queue place.
const queueDay = (v) => v.queue_date.slice(0, 10);

// The section a visit is listed under: "Waiting for tests", or its queue day.
export const groupKey = (v) => (v.status === 'tests_requested' ? TESTS_GROUP : queueDay(v));

// True when the visit is waiting in the queue for the given day (not away for tests).
export const isInQueueOn = (v, day) => groupKey(v) === day;

// The day (YYYY-MM-DD) of a token that is not from `today` — only for a patient away for
// tests, whose token keeps the day they were queued (CLINIC-017.4), so two "Token 1" from
// different days can be told apart. null when there is nothing to add.
export const oldTokenDay = (v, today) => (v.status === 'tests_requested' && queueDay(v) !== today ? queueDay(v) : null);
