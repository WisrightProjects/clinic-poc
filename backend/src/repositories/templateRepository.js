const db = require('../config/db');
const { withTransaction } = require('./transaction');
const { AppError } = require('../utils/errors');

async function withQuestions(template) {
  if (!template) return null;
  const { rows: questions } = await db.query(
    'SELECT * FROM questions WHERE template_id = $1 ORDER BY order_index',
    [template.id]
  );
  return { ...template, questions };
}

// SQL for the id of a clinic's active template for a department (a department is expected to
// have one active template; if more, the lowest id wins). Used by visitRepository to store it
// on a new visit and to count a visit's questions. The arguments are pasted into the SQL:
// pass only placeholders ('$1') or column names, NEVER a value.
const ACTIVE_TEMPLATE_ID = (clinicIdSql, departmentIdSql) => `
  SELECT t.id FROM question_templates t
   WHERE t.clinic_id = ${clinicIdSql} AND t.department_id = ${departmentIdSql} AND t.is_active
   ORDER BY t.id LIMIT 1`;

// Templates belong to a clinic (CLINIC-008): each clinic edits its own copy, and
// another clinic's template comes back null (-> 404).
async function findActiveByDepartmentId(clinicId, departmentId) {
  const { rows } = await db.query(
    `SELECT * FROM question_templates
      WHERE clinic_id = $1 AND department_id = $2 AND is_active = true
      ORDER BY id LIMIT 1`,
    [clinicId, departmentId]
  );
  return withQuestions(rows[0]);
}

// The template a visit's questions come from: the list it was registered on (CLINIC-020),
// so a visit keeps its questions after that list is replaced. A visit without one (demo
// seeds, no active list at registration, made by an old backend during a deploy, or still
// waiting when migration 011 ran) gets the active list now, stored so it stays on it.
async function findForVisit(visit) {
  if (visit.template_id) return findById(visit.clinic_id, visit.template_id);
  const template = await findActiveByDepartmentId(visit.clinic_id, visit.department_id);
  if (template) {
    await db.query('UPDATE visits SET template_id = $1 WHERE id = $2 AND template_id IS NULL', [template.id, visit.id]);
  }
  return template;
}

async function findById(clinicId, id) {
  const { rows } = await db.query('SELECT * FROM question_templates WHERE id = $1 AND clinic_id = $2', [id, clinicId]);
  return withQuestions(rows[0]);
}

// Reconcile the template's questions in place rather than delete-and-recreate.
// Existing questions (those carrying an `id`) are UPDATEd, new ones are INSERTed,
// and questions dropped by the client are DELETEd only when no answer references
// them — deleting an answered question would orphan patient data, so we reject
// that with a 409 instead of letting the FK raise a raw 500.
async function updateQuestions(clinicId, templateId, questions) {
  await withTransaction(async client => {
    const { rows: existing } = await client.query(
      'SELECT id FROM questions WHERE template_id = $1',
      [templateId]
    );
    const existingIds = new Set(existing.map((q) => q.id));
    const keptIds = new Set();

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const orderIndex = i + 1;
      if (q.id && existingIds.has(q.id)) {
        await client.query(
          'UPDATE questions SET text = $1, order_index = $2 WHERE id = $3 AND template_id = $4',
          [q.text, orderIndex, q.id, templateId]
        );
        keptIds.add(q.id);
      } else {
        await client.query(
          'INSERT INTO questions (template_id, order_index, text) VALUES ($1, $2, $3)',
          [templateId, orderIndex, q.text]
        );
      }
    }

    const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
    if (removedIds.length > 0) {
      const { rows: answered } = await client.query(
        'SELECT DISTINCT question_id FROM answers WHERE question_id = ANY($1)',
        [removedIds]
      );
      if (answered.length > 0) {
        throw new AppError(
          'QUESTION_IN_USE',
          'Cannot remove a question that already has patient answers',
          409
        );
      }
      await client.query('DELETE FROM questions WHERE id = ANY($1)', [removedIds]);
    }
  });
  return findById(clinicId, templateId);
}

module.exports = { ACTIVE_TEMPLATE_ID, findActiveByDepartmentId, findForVisit, findById, updateQuestions };
