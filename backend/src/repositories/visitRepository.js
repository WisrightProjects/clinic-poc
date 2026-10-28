const db = require('../config/db');
const { withTransaction } = require('./transaction');
const testRequests = require('./testRequestRepository');
const { LATEST_FIRST } = require('./summaryRepository');
const { ACTIVE_TEMPLATE_ID } = require('./templateRepository');
const { VISIBLE_QUESTION_SQL } = require('../utils/questionFlow');
const { CLINIC_TIME_ZONE } = require('../utils/queueDate');

// Every read is scoped to the caller's clinic (CLINIC-008): another clinic's visit
// comes back null, so callers answer 404 and ids can't be probed.
async function findById(clinicId, id) {
  const { rows } = await db.query('SELECT * FROM visits WHERE id = $1 AND clinic_id = $2', [id, clinicId]);
  return rows[0] || null;
}

// The visit row, locked for the rest of the caller's transaction (CLINIC-021: answers and
// Send change the status one at a time). Callers have already checked the clinic.
async function findForUpdate(id, client) {
  const { rows } = await client.query('SELECT * FROM visits WHERE id = $1 FOR UPDATE', [id]);
  return rows[0];
}

// Each queue row carries intake progress so the client can show "answered/total"
// without a per-visit fetch:
//   answered_count  = answers to questions the visit is asked (matches maybeAdvance)
//   total_questions = questions the visit is asked: in its template (CLINIC-020: the list it was
//                     registered on; older rows without one use the clinic's active template for
//                     the department) and, for a section question, in a section the visit has
//                     (CLINIC-021, same rule as utils/questionFlow), 0 if none.
// Counts are cast ::int so pg returns numbers, not bigint strings.
const PROGRESS_COLUMNS = `
  (SELECT COUNT(*)::int FROM answers a JOIN questions q ON q.id = a.question_id
     WHERE a.visit_id = v.id AND ${VISIBLE_QUESTION_SQL}) AS answered_count,
  (SELECT COUNT(*)::int FROM questions q
     WHERE q.template_id = COALESCE(v.template_id, (${ACTIVE_TEMPLATE_ID('v.clinic_id', 'v.department_id')}))
       AND ${VISIBLE_QUESTION_SQL}
  ) AS total_questions`;

// A short excerpt of the visit's summary (the doctor's edit when there is one,
// CLINIC-012), so the queue row can show a two-line preview without a per-visit
// fetch. Only submitted visits (summarised/done) have a summary; others come back
// null. Truncated to keep the list payload small — the client clamps it to two lines.
const SUMMARY_COLUMN = `
  (SELECT LEFT(s.display_text, 240)
     FROM summaries s
    WHERE s.visit_id = v.id
    ORDER BY ${LATEST_FIRST}
    LIMIT 1) AS summary_excerpt`;

// The visit's latest "send for tests" request (CLINIC-014), in the same shape as the
// detail's test_requests entries, so the attender app can show the alert (status
// tests_requested and latest_test_request.acknowledged_at null) from the list it
// already polls. Null for a visit never sent for tests.
const LATEST_TEST_REQUEST = `
  (SELECT row_to_json(x) FROM (
     SELECT ${testRequests.COLUMNS} FROM visit_test_requests t ${testRequests.JOIN_NAMES}
      WHERE t.visit_id = v.id ORDER BY ${testRequests.NEWEST_FIRST} LIMIT 1) x) AS latest_test_request`;

// One day of the queue (CLINIC-015): the visits whose queue place is on `date`, plus every
// patient waiting for tests whatever their day (they have their own "Waiting for tests"
// group). An empty `statuses` means every status. Ordered by place in the queue
// (queue_date, queue_token): first in, first out, and a patient back from tests is at the
// end of the day they returned. Uses the (clinic_id, queue_date, queue_token) index.
async function list(clinicId, { date, statuses }) {
  const { rows } = await db.query(
    `SELECT v.*, ${PROGRESS_COLUMNS}, ${SUMMARY_COLUMN}, ${LATEST_TEST_REQUEST}
       FROM visits v
      WHERE v.clinic_id = $1
        AND (v.queue_date = $3::date OR v.status = 'tests_requested')
        AND (cardinality($2::visit_status[]) = 0 OR v.status = ANY($2::visit_status[]))
      ORDER BY v.queue_date DESC, v.queue_token`,
    [clinicId, statuses, date]
  );
  return rows;
}

async function updateStatus(id, status, client = db) {
  const { rows } = await client.query(
    `UPDATE visits SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0];
}

const TOKEN_LOCK_KEY = 20240001;

// "Today" for the queue, in one place: the clinic's local (IST) date, not the server's, so the
// queue doesn't switch days at 5:30 am (CLINIC-015). Same zone as utils/queueDate.js.
const TODAY = `(now() AT TIME ZONE '${CLINIC_TIME_ZONE}')::date`;

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
                           department_id, visit_date, template_id)
       SELECT $1, n, n, ${TODAY}, $2, $3, $4, $5, ${TODAY}, (${ACTIVE_TEMPLATE_ID('$1', '$5')})
         FROM ${nextQueueToken('$1')} AS t(n)
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

// The sections chosen for the visit (CLINIC-021), recomputed by answerService in its transaction.
async function setSections(id, sections, client = db) {
  await client.query('UPDATE visits SET sections = $1, updated_at = now() WHERE id = $2', [sections, id]);
}

module.exports = { createWithToken, withTokenLock, requeue, findById, findForUpdate, list, updateStatus, setSections };
