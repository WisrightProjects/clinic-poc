const db = require('../config/db');

// Only active users are ever returned, so a deactivated user can neither sign in nor
// use an existing token. password_hash is selected ONLY by findByMobile (login).
const COLUMNS = 'u.id, u.name, u.role, u.clinic_id, c.name AS clinic_name';
const FROM_ACTIVE = 'FROM users u JOIN clinics c ON c.id = u.clinic_id WHERE u.is_active';

async function findByMobile(mobile) {
  const { rows } = await db.query(`SELECT ${COLUMNS}, u.password_hash ${FROM_ACTIVE} AND u.mobile = $1`, [mobile]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await db.query(`SELECT ${COLUMNS} ${FROM_ACTIVE} AND u.id = $1`, [id]);
  return rows[0] || null;
}

module.exports = { findByMobile, findById };
