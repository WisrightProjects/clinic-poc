// CLINIC-030: report trends — pure logic of utils/trends.js.
const { buildTrends, trendSource, hba1cOf } = require('../utils/trends');

const card = (...reports) => ["Today's status:", '- Complaint: Sugar review', '', 'From reports:', ...reports].join('\n');
const visit = (id, day, { vitals = null, weight = null, text = null, by = 'gemini', edited = false } = {}) => ({
  id, visit_date: day, weight_kg: weight, vitals,
  summary: text ? { display_text: text, generated_by: by, edited_text: edited ? text : null } : null,
});
const row = (t, key) => t.rows.find((r) => r.key === key);

describe('hba1cOf', () => {
  const s = (text, extra) => ({ display_text: text, generated_by: 'gemini', edited_text: null, ...extra });
  it.each([
    ['HbA1c 8.2 % (High)', 8.2],
    ['HbA1c: 8.2% 12 Oct 2026 (High)', 8.2],
    ['Glycated haemoglobin (HbA1c) 7.9 % (High)', 7.9],
    ['HbA1c (12 Sep 2026): 8.2 % (High)', 8.2],
    ['HbA1c (ref 4-5.6 %): 8.2 % (High)', 8.2],
    ['HbA1c (ref < 5.7 %) 8.2 % (High)', 8.2],
    ['HbA1c 8.2 % (High; ref 4.00-5.70 %)', 8.2],
    ['HbA1c 6.5-10.0 8.1 %', 8.1],
  ])('reads "%s"', (line, value) => {
    expect(hba1cOf(s(card(line))).value).toBe(value);
  });

  it('keeps the report date on the line', () => {
    expect(hba1cOf(s(card('HbA1c 8.2 % 12 Sep 2026 (High)'))).date).toBe('12 Sep 2026');
  });

  it.each([
    ['HbA1c 8.2 % 2026-09-12 (High)', '2026-09-12'],
    ['HbA1c 8.2 % Sep 12, 2026 (High)', 'Sep 12, 2026'],
    ['HbA1c: 8.2% 12/09/2026 (High)', '12/09/2026'],
    ['HbA1c 8.2 % (ref 4.00-5.70 %)', null],
    ['HbA1c 6.5-10 8.2 %', null],
  ])('reads the date of "%s"', (line, date) => {
    expect(hba1cOf(s(card(line))).date).toBe(date);
  });

  it('takes the latest report when there are several', () => {
    expect(hba1cOf(s(card('HbA1c 9.1 % 12 Mar 2026 (High)', 'HbA1c 7.6 % 25 Oct 2026 (High)'))).value).toBe(7.6);
    expect(hba1cOf(s(card('HbA1c 7.6 % 25 Oct 2026 (High)', 'HbA1c 9.1 % 12 Mar 2026 (High)'))).value).toBe(7.6);
  });

  it("never takes another test's % on the same line", () => {
    expect(hba1cOf(s(card('HbA1c not done; Neutrophils 78 % (High)')))).toEqual({ notListed: true });
  });

  it('says "unread" when photos or values were not read', () => {
    expect(hba1cOf(s(card('2 report photo(s) could not be read — please check the original.')))).toEqual({ unread: true });
    expect(hba1cOf(s(card('From reports: no results listed — please check the photos.')))).toEqual({ unread: true });
  });

  it('leaves out a value not in %', () => {
    expect(hba1cOf(s(card('HbA1c 66 mmol/mol (High)')))).toEqual({ notListed: true });
  });

  it('is null without report lines (no report that visit)', () => {
    expect(hba1cOf(s("Today's status:\n- Complaint: review"))).toBeNull();
  });

  it('does not read Hb as HbA1c', () => {
    expect(hba1cOf(s(card('Hb 11.2 g/dL (Low)')))).toEqual({ notListed: true });
  });

  it('reads only the report lines, never the review points or Since last visit', () => {
    const text = ['Since last visit (10 Oct): HbA1c 8.2 then', "Today's status:", '- Complaint: review',
      'Doctor to review:', '- Review HbA1c 8.2 against last visit'].join('\n');
    expect(hba1cOf(s(text))).toBeNull();
  });

  it('reads a paragraph summary after "From reports"', () => {
    expect(hba1cOf(s('Sugar review, HbA1c 9 mentioned.\n\nFrom reports:\nHbA1c 7.1 % (High)')).value).toBe(7.1);
  });

  it('skips the demo / not-available text unless the doctor edited it', () => {
    const text = card('HbA1c 8.2 % (High)');
    expect(hba1cOf(s(text, { generated_by: 'mock' }))).toBeNull();
    expect(hba1cOf(s(text, { generated_by: 'mock-fallback', edited_text: text })).value).toBe(8.2);
  });
});

describe('buildTrends', () => {
  const bp = (s, d) => ({ bp_systolic: s, bp_diastolic: d });

  it('is null for a new patient or nothing measured twice', () => {
    expect(buildTrends(visit(3, '2026-10-29', { vitals: bp(140, 90) }), [])).toBeNull();
    expect(buildTrends(visit(3, '2026-10-29', { vitals: bp(140, 90) }), [visit(1, '2026-10-01')])).toBeNull();
  });

  it('orders visits oldest first with today last, and compares today with the latest earlier value', () => {
    const t = buildTrends(visit(3, '2026-10-29', { vitals: bp(138, 88) }),
      [visit(2, '2026-10-10', { vitals: bp(145, 90) }), visit(1, '2026-09-12', { vitals: bp(150, 95) })]);
    expect(t.visits.map((v) => [v.id, v.today])).toEqual([[1, false], [2, false], [3, true]]);
    const r = row(t, 'bp');
    expect(r.values.map((v) => v.text)).toEqual(['150/95', '145/90', '138/88']);
    expect(r.change).toEqual([{ dir: 'down', by: 7 }, { dir: 'down', by: 2 }]);
  });

  it('skips a missing visit when finding the earlier value, and rounds the change', () => {
    const t = buildTrends(visit(3, '2026-10-29', { text: card('HbA1c 7.6 % (High)') }),
      [visit(2, '2026-10-10', { vitals: bp(140, 90), text: card('Hb 11 g/dL (Low)') }), visit(1, '2026-09-12', { text: card('HbA1c 8.2 % (High)'), vitals: bp(150, 90) })]);
    const r = row(t, 'hba1c');
    expect(r.source).toBe('reports');
    expect(r.values).toEqual([{ text: '8.2', date: null }, { notListed: true }, { text: '7.6', date: null }]);
    expect(r.change).toEqual([{ dir: 'down', by: 0.6 }]);
  });

  it('has no change when today has no value', () => {
    const t = buildTrends(visit(3, '2026-10-29'), [visit(2, '2026-10-10', { vitals: bp(140, 90) }), visit(1, '2026-09-12', { vitals: bp(150, 90) })]);
    expect(row(t, 'bp').change).toBeNull();
    expect(t.visits.at(-1).today).toBe(true); // today's column is always there
  });

  it('shows the same report photo sent again once, at the first visit', () => {
    const line = 'HbA1c 8.2 % 12 Sep 2026 (High)';
    const t = buildTrends(visit(3, '2026-10-29', { text: card('HbA1c 7.6 % 25 Oct 2026 (High)') }),
      [visit(2, '2026-10-10', { text: card(line) }), visit(1, '2026-09-12', { text: card(line) })]);
    expect(row(t, 'hba1c').values.map((v) => v?.text ?? null)).toEqual(['8.2', '7.6']);
    expect(t.visits.map((v) => v.id)).toEqual([1, 3]); // visit 2 had nothing new
  });

  it('marks the open visit repeated report as "same report", not "not recorded"', () => {
    const line = 'HbA1c 8.2 % 12 Sep 2026 (High)';
    const t = buildTrends(visit(3, '2026-10-29', { text: card(line), vitals: bp(140, 90) }),
      [visit(2, '2026-10-10', { text: card(line), vitals: bp(150, 90) }), visit(1, '2026-09-12', { text: card('HbA1c 9 % 01 Sep 2026') })]);
    const r = row(t, 'hba1c');
    expect(r.values).toEqual([{ text: '9', date: '01 Sep 2026' }, { text: '8.2', date: '12 Sep 2026' }, { repeat: true }]);
    expect(r.change).toBeNull();
  });

  it("passes the open visit's queue day on", () => {
    const today = { ...visit(3, '2026-10-28', { vitals: bp(140, 90) }), queue_date: '2026-10-29' };
    const t = buildTrends(today, [visit(1, '2026-10-01', { vitals: bp(150, 90) })]);
    expect(t.visits.at(-1)).toEqual({ id: 3, visit_date: '2026-10-28', today: true, queue_date: '2026-10-29' });
  });

  it('keeps sugar types apart and reads NUMERIC strings', () => {
    const sugar = (n, type) => ({ sugar: n, sugar_type: type });
    const t = buildTrends(visit(3, '2026-10-29', { vitals: sugar(142, 'fasting'), weight: '78.0' }),
      [visit(2, '2026-10-10', { vitals: sugar(210, 'random'), weight: '80.5' }), visit(1, '2026-09-12', { vitals: sugar(150, 'fasting') })]);
    expect(row(t, 'sugar_fasting').values.map((v) => v?.text ?? null)).toEqual(['150', null, '142']);
    expect(row(t, 'sugar_random')).toBeUndefined(); // only once
    expect(row(t, 'weight').values.map((v) => v?.text ?? null)).toEqual([null, '80.5', '78']);
    expect(row(t, 'weight').change[0]).toEqual({ dir: 'down', by: 2.5 });
  });

  it('does not compare a temperature in °C with one in °F', () => {
    const temp = (n, u) => ({ temperature: n, temperature_unit: u });
    const t = buildTrends(visit(3, '2026-10-29', { vitals: temp('37.0', 'C') }), [visit(1, '2026-10-01', { vitals: temp('100.4', 'F') })]);
    const r = row(t, 'temperature');
    expect(r.values.map((v) => v.text)).toEqual(['100.4 °F', '37 °C']);
    expect(r.change).toBeNull();
  });

  it('shows "same" for no change, at most 6 rows, and drops an earlier visit with no values', () => {
    const all = { bp_systolic: 130, bp_diastolic: 80, pulse: 80, temperature: '98.6', temperature_unit: 'F', spo2: 98, sugar: 120, sugar_type: 'fasting' };
    const t = buildTrends(visit(4, '2026-10-29', { vitals: all, weight: '70', text: card('HbA1c 7 %') }),
      [visit(3, '2026-10-20'), visit(2, '2026-10-10', { vitals: all, weight: '70', text: card('HbA1c 7.5 %') })]);
    expect(t.rows).toHaveLength(6);
    expect(t.visits.map((v) => v.id)).toEqual([2, 4]);
    expect(row(t, 'pulse').change).toEqual([{ dir: 'same', by: 0 }]);
  });

  it('trendSource maps a visit, its vitals and its summary', () => {
    const r = { id: 1, visit_date: '2026-10-01', weight_kg: '70', pulse: 80, display_text: 'x', generated_by: 'gemini', edited_text: null };
    const s = trendSource(r, r, r);
    expect(s).toMatchObject({ id: 1, weight_kg: '70', vitals: { pulse: 80 }, summary: { display_text: 'x', edited_text: null } });
    const empty = { id: 2, display_text: null };
    expect(trendSource(empty, null, empty).summary).toBeNull();
    expect(trendSource(empty, null, null).summary).toBeNull(); // no summary yet
  });
});
