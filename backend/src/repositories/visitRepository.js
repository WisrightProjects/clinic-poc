const db = require('../config/db');
const { withTransaction } = require('./transaction');
const testRequests = require('./testRequestRepository');

// Every read is scoped to the caller's clinic (CLINIC-008): another clinic's visit
// comes back null, so callers answer 404 and ids can't be probed.
async function findById(clinicId, id) {
  const { rows } = await db.query('SELECT * FROM visits WHERE id = $1 AND clinic_id = $2', [id, clinicId]);
  return rows[0] || null;
}

// Each queue row carries intake progress so the client can show "answered/total"
// without a per-visit fetch:
//   answered_count  = recorded answer rows for the visit (matches maybeAdvance)
//   total_questions = questions in the clinic's active template for the department
//                     (0 if none). A department is expected to have exactly one active template;
//                     if more than one is ever active, the lowest id wins.
// Counts are cast ::int so pg returns numbers, not bigint strings.
const PROGRESS_COLUMNS = `
  (SELECT COUNT(*)::int FROM answers a WHERE a.visit_id = v.id) AS answered_count,
  (SELECT COUNT(*)::int FROM questions q
     WHERE q.template_id = (
       SELECT t.id FROM question_templates t
        WHERE t.department_id = v.department_id AND t.clinic_id = v.clinic_id AND t.is_active
        ORDER BY t.id LIMIT 1)) AS total_questions`;

// A short excerpt of the visit's AI summary, so the queue row can show a
// two-line preview without a per-visit fetch. Only submitted visits
// (summarised/done) have a summary; others come back null. Truncated to keep
// the list payload small — the client clamps it to two lines anyway.
const SUMMARY_COLUMN = `
  (SELECT LEFT(s.summary_text, 240)
     FROM summaries s
    WHERE s.visit_id = v.id
    ORDER BY s.created_at DESC
    LIMIT 1) AS summary_excerpt`;

// The visit's latest "send for tests" request (CLINIC-014), in the same shape as the
// detail's test_requests entries, so the attender app can show the alert (status
// tests_requested and latest_test_request.acknowledged_at null) from the list it
// already polls. Null for a visit never sent for tests.
const LATEST_TEST_REQUEST = `
  (SELECT row_to_json(x) FROM (
     SELECT ${testRequests.COLUMNS} FROM visit_test_requests t ${testRequests.JOIN_NAMES}
      WHERE t.visit_id = v.id ORDER BY ${testRequests.NEWEST_FIRST} LIMIT 1) x) AS latest_test_request`;

// An empty statusFilter means every status. Ordered by place in the queue
// (queue_date, queue_token): first in, first out, and a patient back from tests is
// at the end of the day they returned.
async function list(clinicId, statusFilter) {
  const { rows } = await db.query(
    `SELECT v.*, ${PROGRESS_COLUMNS}, ${SUMMARY_COLUMN}, ${LATEST_TEST_REQUEST}
       FROM visits v
      WHERE v.clinic_id = $1
        AND (cardinality($2::visit_status[]) = 0 OR v.status = ANY($2::visit_status[]))
      ORDER BY v.queue_date DESC, v.queue_token`,
    [clinicId, statusFilter]
  );
  return rows;
}

async function updateStatus(id, status) {
  const { rows } = await db.query(
    `UPDATE visits SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0];
}

const TOKEN_LOCK_KEY = 20240001;

// "Today" for the queue, in one place. CLINIC-015 must make it the clinic's local
// (IST) date so the queue doesn't switch days at 5:30 am server time.
const TODAY = 'CURRENT_DATE';

// The next place in today's queue for the clinic whose id is SQL parameter clinicParam.
// queue_token is the token the patient is shown and called by; token_number only keeps
// the number from the day they registered.
const nextQueueToken = clinicParam => `(SELECT COALESCE(MAX(queue_token), 0) + 1 FROM visits
   WHERE clinic_id = ${clinicParam} AND queue_date = ${TODAY})`;

// Runs fn(client) in a transaction holding the clinic's token lock. The per-clinic
// advisory lock (two-int form) serializes queue-token allocation within a clinic,
// including its first visit of the day when no rows exist yet to FOR UPDATE.
// Different clinics never wait on each other.
function withTokenLock(clinicId, fn) {
  return withTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [TOKEN_LOCK_KEY, clinicId]);
    return fn(client);
  });
}

// Tokens restart at 1 per clinic per day. A new visit's queue place is its token.
function createWithToken(clinicId, { patientName, age, sex, departmentId }) {
  return withTokenLock(clinicId, async client => {
    const { rows } = await client.query(
      `INSERT INTO visits (clinic_id, token_number, queue_token, queue_date, patient_name, age, sex,
                           department_id, visit_date)
       SELECT $1, n, n, ${TODAY}, $2, $3, $4, $5, ${TODAY} FROM ${nextQueueToken('$1')} AS t(n)
       RETURNING *`,
      [clinicId, patientName, age, sex, departmentId]
    );
    return rows[0];
  });
}

// CLINIC-014 "Back in queue" (run inside withTokenLock): the patient returned from
// tests and gets the next token at the END of today's queue, keeping visit_date and
// token_number; the visit goes back to 'summarised'. Returns null when the visit was
// not (or no longer) waiting for tests.
async function requeue(client, clinicId, visitId) {
  const { rows } = await client.query(
    `UPDATE visits SET status = 'summarised', queue_date = ${TODAY},
            queue_token = ${nextQueueToken('$1')}, updated_at = now()
      WHERE clinic_id = $1 AND id = $2 AND status = 'tests_requested'
     RETURNING *`,
    [clinicId, visitId]
  );
  return rows[0] || null;
}

module.exports = { createWithToken, withTokenLock, requeue, findById, list, updateStatus };
