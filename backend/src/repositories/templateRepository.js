const db = require('../config/db');

async function findActiveByDepartmentId(departmentId) {
  const { rows } = await db.query(
    'SELECT * FROM question_templates WHERE department_id = $1 AND is_active = true LIMIT 1',
    [departmentId]
  );
  if (!rows[0]) return null;
  const template = rows[0];
  const { rows: questions } = await db.query(
    'SELECT * FROM questions WHERE template_id = $1 ORDER BY order_index',
    [template.id]
  );
  return { ...template, questions };
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM question_templates WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const template = rows[0];
  const { rows: questions } = await db.query(
    'SELECT * FROM questions WHERE template_id = $1 ORDER BY order_index',
    [template.id]
  );
  return { ...template, questions };
}

async function updateQuestions(templateId, questions) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM questions WHERE template_id = $1', [templateId]);
    for (let i = 0; i < questions.length; i++) {
      await client.query(
        'INSERT INTO questions (template_id, order_index, text) VALUES ($1, $2, $3)',
        [templateId, i + 1, questions[i].text]
      );
    }
    await client.query('COMMIT');
    return findById(templateId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { findActiveByDepartmentId, findById, updateQuestions };
