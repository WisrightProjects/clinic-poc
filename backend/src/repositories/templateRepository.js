const db = require('../config/db');
const { AppError } = require('../utils/errors');

// Templates belong to a clinic (CLINIC-008): each clinic edits its own copy, and
// another clinic's template comes back null (-> 404).
async function withQuestions(template) {
  if (!template) return null;
  const { rows: questions } = await db.query(
    'SELECT * FROM questions WHERE template_id = $1 ORDER BY order_index',
    [template.id]
  );
  return { ...template, questions };
}

async function findActiveByDepartmentId(clinicId, departmentId) {
  const { rows } = await db.query(
    `SELECT * FROM question_templates
      WHERE clinic_id = $1 AND department_id = $2 AND is_active = true
      ORDER BY id LIMIT 1`,
    [clinicId, departmentId]
  );
  return withQuestions(rows[0]);
}

async function findById(clinicId, id) {
  const { rows } = await db.query('SELECT * FROM question_templates WHERE id = $1 AND clinic_id = $2', [id, clinicId]);
  return withQuestions(rows[0]);
}

// Reconcile the template's questions in place rather than delete-and-recreate.
// Callers must first load the template through the clinic-scoped findById.
// Existing questions (those carrying an `id`) are UPDATEd, new ones are INSERTed,
// and questions dropped by the client are DELETEd only when no answer references
// them — deleting an answered question would orphan patient data, so we reject
// that with a 409 instead of letting the FK raise a raw 500.
async function updateQuestions(templateId, questions) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

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

    await client.query('COMMIT');
    const { rows } = await db.query('SELECT * FROM question_templates WHERE id = $1', [templateId]);
    return withQuestions(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { findActiveByDepartmentId, findById, updateQuestions };
