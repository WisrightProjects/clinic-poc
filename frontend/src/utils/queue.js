// A visit's place in the queue (CLINIC-014). queue_date / queue_token are always set by the
// API (migration 009), and are what a patient is called by: a patient back from tests keeps
// their original visit_date / token_number but gets today's queue_date and a token at the end.
// Keep in step with mobile/src/utils/queue.js.

// Patients the doctor sent for tests leave the day queue and form their own group.
export const TESTS_GROUP = 'tests'

// The day (YYYY-MM-DD) of the visit's queue place.
export const queueDay = (v) => v.queue_date.slice(0, 10)

// The group a visit is listed under: "Waiting for tests", or its queue day.
export const groupKey = (v) => (v.status === 'tests_requested' ? TESTS_GROUP : queueDay(v))

// True when the visit is waiting in the queue for the given day (not away for tests).
export const isInQueueOn = (v, day) => groupKey(v) === day
