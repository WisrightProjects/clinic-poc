const db = require('../config/db');
const { withTransaction, lockVisit } = require('./transaction');

// createIfUnedited and updateEdit both take the visit lock (lockVisit) first, so a remade
// summary and a doctor's edit can't interleave.

// summary_text is always the AI original. display_text (a generated column,
// migration 008) is what to show: the doctor's edit when there is one, else the AI's.
// Every read and write returns the row + edited_by_name.

// A visit's latest summary, for queries that alias summaries as s (also used by
// visitRepository's queue preview).
const LATEST_FIRST = 's.created_at DESC, s.id DESC';

async function create(visitId, summaryText, generatedBy, client = db) {
  const { rows } = await client.query(
    `INSERT INTO summaries (visit_id, summary_text, generated_by)
     VALUES ($1, $2, $3) RETURNING *, NULL::text AS edited_by_name`,
    [visitId, summaryText, generatedBy]
  );
  return rows[0];
}

// CLINIC-018: a remade summary, stored only while canStore(visit status) holds and the visit's
// latest summary is still `previousId` and unedited, so a doctor's edit made meanwhile is never
// hidden. Returns the new row, or null when it was not stored.
async function createIfUnedited(visitId, previousId, summaryText, generatedBy, canStore) {
  return withTransaction(async client => {
    if (!canStore(await lockVisit(client, visitId))) return null;
    const { rows } = await client.query(
      `INSERT INTO summaries (visit_id, summary_text, generated_by)
       SELECT $1, $2, $3
         FROM (SELECT s.id, s.edited_text FROM summaries s WHERE s.visit_id = $1
                ORDER BY ${LATEST_FIRST} LIMIT 1) latest
        WHERE latest.id = $4 AND latest.edited_text IS NULL
       RETURNING *, NULL::text AS edited_by_name`,
      [visitId, summaryText, generatedBy, previousId]
    );
    return rows[0] || null;
  });
}

async function findByVisitId(visitId) {
  const { rows } = await db.query(
    `SELECT s.*, u.name AS edited_by_name
       FROM summaries s LEFT JOIN users u ON u.id = s.edited_by
      WHERE s.visit_id = $1
      ORDER BY ${LATEST_FIRST} LIMIT 1`,
    [visitId]
  );
  return rows[0] || null;
}

// Stores the doctor's edit on the visit's latest summary and returns it, or null when
// the visit has no summary. summary_text is never touched.
// A regenerated summary is a NEW row, so it starts unedited — CLINIC-018's remake is
// stored only while the latest row is unedited (createIfUnedited, same visit lock).
async function updateEdit(visitId, text, userId) {
  return withTransaction(async client => {
    await lockVisit(client, visitId);
    const { rows } = await client.query(
      `WITH upd AS (
         UPDATE summaries SET edited_text = $1, edited_by = $2, edited_at = now()
          WHERE id = (SELECT s.id FROM summaries s WHERE s.visit_id = $3
                       ORDER BY ${LATEST_FIRST} LIMIT 1)
         RETURNING *)
       SELECT upd.*, u.name AS edited_by_name FROM upd LEFT JOIN users u ON u.id = upd.edited_by`,
      [text, userId, visitId]
    );
    return rows[0] || null;
  });
}

module.exports = { LATEST_FIRST, create, createIfUnedited, findByVisitId, updateEdit };
