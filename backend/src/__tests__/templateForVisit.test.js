// CLINIC-020: a visit keeps the list it was registered on after that list is replaced.
// The DB is mocked: only the repository's choice of template is tested.

jest.mock('../config/db', () => ({ query: jest.fn() }));

const db = require('../config/db');
const templateRepository = require('../repositories/templateRepository');

const oldList = { id: 10, clinic_id: 1, department_id: 3, is_active: false };
const newList = { id: 20, clinic_id: 1, department_id: 3, is_active: true };
const questions = templateId => [{ id: templateId * 100, template_id: templateId, order_index: 1, text: 'Q1' }];

beforeEach(() => db.query.mockReset());

test('AC2: a visit uses the list it was registered on, even if that list is now inactive', async () => {
  db.query
    .mockResolvedValueOnce({ rows: [oldList] })
    .mockResolvedValueOnce({ rows: questions(oldList.id) });
  const template = await templateRepository.findForVisit({ id: 7, clinic_id: 1, department_id: 3, template_id: oldList.id });
  expect(template.id).toBe(oldList.id);
  expect(template.questions[0].template_id).toBe(oldList.id);
  expect(db.query.mock.calls[0][1]).toEqual([oldList.id, 1]); // by id, within the visit's clinic
});

test('AC2: a visit without a recorded list gets the active list, and it is stored on the visit', async () => {
  db.query
    .mockResolvedValueOnce({ rows: [newList] })
    .mockResolvedValueOnce({ rows: questions(newList.id) })
    .mockResolvedValueOnce({ rows: [] });
  const template = await templateRepository.findForVisit({ id: 8, clinic_id: 1, department_id: 3, template_id: null });
  expect(template.id).toBe(newList.id);
  expect(db.query.mock.calls[0][1]).toEqual([1, 3]);
  // Stored only if still empty, so a later list swap can't move this visit.
  expect(db.query.mock.calls[2][0]).toMatch(/UPDATE visits SET template_id = \$1 WHERE id = \$2 AND template_id IS NULL/);
  expect(db.query.mock.calls[2][1]).toEqual([newList.id, 8]);
});

test('a visit with no list available stores nothing', async () => {
  db.query.mockResolvedValueOnce({ rows: [] });
  expect(await templateRepository.findForVisit({ id: 9, clinic_id: 1, department_id: 4, template_id: null })).toBeNull();
  expect(db.query).toHaveBeenCalledTimes(1);
});
