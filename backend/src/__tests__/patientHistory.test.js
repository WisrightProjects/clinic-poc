// CLINIC-027: a returning patient's earlier visits. The DB is mocked: the query's scope
// (clinic, mobile, name, earlier, finished only) is checked from its SQL and parameters; the
// match itself was run against Postgres by hand.

jest.mock('../config/db', () => ({ query: jest.fn() }));

const db = require('../config/db');
const visitRepository = require('../repositories/visitRepository');
const STATUSES = ['summarised', 'done'];

const visit = { id: 50, clinic_id: 2, patient_mobile: '9876543210', patient_name: 'Ravi Kumar' };

beforeEach(() => db.query.mockReset());

test('AC1/AC2: same clinic, mobile and name, earlier and finished only, newest day first, at most N', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: 41 }] });
  expect(await visitRepository.findPrevious(visit, STATUSES, 5)).toEqual([{ id: 41 }]);
  const [sql, params] = db.query.mock.calls[0];
  expect(params).toEqual([2, '9876543210', 50, 'Ravi Kumar', STATUSES, 5]);
  expect(sql).toMatch(/v\.clinic_id = \$1 AND v\.patient_mobile = \$2 AND v\.id < \$3/);
  // Names compared case- and space-insensitively on both sides.
  expect(sql).toMatch(/lower\(regexp_replace\(btrim\(v\.patient_name\)[^=]+= lower\(regexp_replace\(btrim\(\$4::text\)/);
  expect(sql).toMatch(/v\.status = ANY\(\$5::visit_status\[\]\)/);
  expect(sql).toMatch(/ORDER BY v\.visit_date DESC, v\.id DESC\s+LIMIT \$6/);
});

test('AC3: a visit without a mobile has no history (no query)', async () => {
  expect(await visitRepository.findPrevious({ ...visit, patient_mobile: null }, STATUSES, 5)).toEqual([]);
  expect(db.query).not.toHaveBeenCalled();
});

describe('PR B: patients on a mobile (lookup)', () => {
  const patientService = require('../services/patientService');

  test('AC4: one row per patient name on that number in this clinic, last seen first', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ name: 'Ravi Kumar', visit_count: 2 }] });
    expect(await patientService.lookup(2, { mobile: '+91 98765 43210' }))
      .toEqual({ patients: [{ name: 'Ravi Kumar', visit_count: 2 }] });
    const [sql, params] = db.query.mock.calls[0];
    // Normalised mobile, visits sent to the doctor only, at most 10.
    expect(params).toEqual([2, '9876543210', ['summarised', 'tests_requested', 'done'], 10]);
    expect(sql).toMatch(/WHERE clinic_id = \$1 AND patient_mobile = \$2 AND status = ANY\(\$3::visit_status\[\]\)/);
    expect(sql).toMatch(/age \+ EXTRACT\(YEAR FROM age\(CURRENT_DATE, visit_date\)\)::int AS age/);
    expect(sql).toMatch(/DISTINCT ON \(lower\(regexp_replace\(btrim\(patient_name\)/);
    expect(sql).toMatch(/ORDER BY last_visit_date DESC, id DESC\s+LIMIT \$4/);
  });

  test.each([[undefined], ['12345'], ['5876543210'], [{ x: 1 }]])('a bad mobile (%p) is 400 under the field', async (mobile) => {
    await expect(patientService.lookup(2, { mobile })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', httpStatus: 400, fields: { mobile: expect.any(String) },
    });
    expect(db.query).not.toHaveBeenCalled();
  });
});
