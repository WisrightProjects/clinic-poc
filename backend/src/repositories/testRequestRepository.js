const db = require('../config/db');

// One shape for a test request everywhere: the detail history (findByVisitId) and
// each queue row's latest_test_request (visitRepository.list) use these.
// Timestamps are formatted as UTC ISO strings here, so the list (row_to_json) and the
// detail (pg Date -> JSON) return exactly the same text for the same request.
const iso = col => `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const COLUMNS = `t.id, t.visit_id, t.note, ${iso('t.requested_at')} AS requested_at,
  ${iso('t.acknowledged_at')} AS acknowledged_at, ${iso('t.returned_at')} AS returned_at,
  t.requested_by, rb.name AS requested_by_name, t.acknowledged_by, ab.name AS acknowledged_by_name`;
const JOIN_NAMES = `LEFT JOIN users rb ON rb.id = t.requested_by
  LEFT JOIN users ab ON ab.id = t.acknowledged_by`;
const NEWEST_FIRST = 't.id DESC';

// Moves the clinic's visit summarised -> tests_requested and records the request, in
// one statement. Returns null when the visit was not (or no longer) 'summarised', so
// the caller can answer 409.
async function requestTests(clinicId, visitId, note, userId) {
  const { rows } = await db.query(
    `WITH v AS (
       UPDATE visits SET status = 'tests_requested', updated_at = now()
        WHERE id = $1 AND clinic_id = $2 AND status = 'summarised' RETURNING id),
     t AS (
       INSERT INTO visit_test_requests (visit_id, note, requested_by)
       SELECT id, $3, $4 FROM v RETURNING *)
     SELECT ${COLUMNS} FROM t ${JOIN_NAMES}`,
    [visitId, clinicId, note, userId]
  );
  return rows[0] || null;
}

// "Informed patient": the first acknowledgement wins (repeats keep it). Only an open
// request — the patient still away for tests — can be acknowledged. Returns null when
// nothing was updated; findByIdForClinic then tells 404 from "no longer open".
async function acknowledge(clinicId, id, userId) {
  const { rows } = await db.query(
    `WITH t AS (
       UPDATE visit_test_requests r
          SET acknowledged_at = COALESCE(r.acknowledged_at, now()),
              acknowledged_by = COALESCE(r.acknowledged_by, $3)
         FROM visits v
        WHERE r.id = $1 AND v.id = r.visit_id AND v.clinic_id = $2
          AND r.returned_at IS NULL AND v.status = 'tests_requested'
       RETURNING r.*)
     SELECT ${COLUMNS} FROM t ${JOIN_NAMES}`,
    [id, clinicId, userId]
  );
  return rows[0] || null;
}

// Scoped through the request's visit: another clinic's request comes back null.
async function findByIdForClinic(clinicId, id) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM visit_test_requests t JOIN visits v ON v.id = t.visit_id ${JOIN_NAMES}
      WHERE t.id = $1 AND v.clinic_id = $2`,
    [id, clinicId]
  );
  return rows[0] || null;
}

// Back in queue: the visit's open request is marked returned (same transaction as the
// requeue, so pass its client).
async function markReturned(client, visitId) {
  await client.query(
    'UPDATE visit_test_requests SET returned_at = now() WHERE visit_id = $1 AND returned_at IS NULL',
    [visitId]
  );
}

// The visit's requests, newest first (the doctor's earlier notes, CLINIC-014 AC5).
async function findByVisitId(visitId) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM visit_test_requests t ${JOIN_NAMES}
      WHERE t.visit_id = $1 ORDER BY ${NEWEST_FIRST}`,
    [visitId]
  );
  return rows;
}

module.exports = { COLUMNS, JOIN_NAMES, NEWEST_FIRST, requestTests, acknowledge, findByIdForClinic, markReturned, findByVisitId };
