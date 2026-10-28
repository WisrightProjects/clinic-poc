const db = require('../config/db');

// CLINIC-024: one vitals row per visit. A save replaces every value (an emptied field is
// stored as not recorded). `client` lets a caller run it inside its transaction.
async function upsert(visitId, v, userId, client = db) {
  const { rows } = await client.query(
    `INSERT INTO visit_vitals (visit_id, bp_systolic, bp_diastolic, pulse, temperature, temperature_unit,
                               spo2, sugar, sugar_type, recorded_by, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (visit_id) DO UPDATE
       SET bp_systolic = EXCLUDED.bp_systolic, bp_diastolic = EXCLUDED.bp_diastolic,
           pulse = EXCLUDED.pulse, temperature = EXCLUDED.temperature,
           temperature_unit = EXCLUDED.temperature_unit, spo2 = EXCLUDED.spo2,
           sugar = EXCLUDED.sugar, sugar_type = EXCLUDED.sugar_type,
           recorded_by = EXCLUDED.recorded_by, recorded_at = now()
     RETURNING *`,
    [visitId, v.bpSystolic, v.bpDiastolic, v.pulse, v.temperature, v.temperatureUnit,
      v.spo2, v.sugar, v.sugarType, userId]
  );
  return rows[0];
}

async function findByVisitId(visitId, client = db) {
  const { rows } = await client.query('SELECT * FROM visit_vitals WHERE visit_id = $1', [visitId]);
  return rows[0] || null;
}

module.exports = { upsert, findByVisitId };
