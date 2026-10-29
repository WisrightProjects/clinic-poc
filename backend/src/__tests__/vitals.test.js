// CLINIC-024: vitals as fields — the form checks, the display both apps show, and the
// "Vitals:" line the code adds to the summary. Pure logic only.

const { validateVitals, vitalsDisplay, vitalsText, vitalsRow, withVitalsLine, asksSpokenVitals } = require('../utils/vitals');

const SPOKEN_LIST = [{ text: 'Since when?' }, { text: "Today's vitals (attender): BP (mmHg), pulse" }];
const { buildSummaryPrompt } = require('../utils/summary/prompt');

const fieldsOf = body => {
  try { validateVitals(body); } catch (e) { return e.fields; }
  return null;
};

describe('AC1/AC2: validateVitals', () => {
  test('all fields: normalised (text from the app, decimal comma)', () => {
    expect(validateVitals({
      bpSystolic: '140', bpDiastolic: '90', pulse: '82', temperature: '101,4', temperatureUnit: 'F',
      spo2: '98', sugar: '210', sugarType: 'random',
    })).toEqual({
      bpSystolic: 140, bpDiastolic: 90, pulse: 82, temperature: 101.4, temperatureUnit: 'F',
      spo2: 98, sugar: 210, sugarType: 'random',
    });
  });

  test('everything empty is allowed (not recorded)', () => {
    expect(validateVitals({})).toEqual({
      bpSystolic: null, bpDiastolic: null, pulse: null, temperature: null, temperatureUnit: null,
      spo2: null, sugar: null, sugarType: null,
    });
  });

  test('a unit or sugar type without its number is dropped', () => {
    expect(validateVitals({ temperatureUnit: 'C', sugarType: 'fasting' }))
      .toMatchObject({ temperatureUnit: null, sugarType: null });
  });

  test.each([
    ['BP 300/90', { bpSystolic: 300, bpDiastolic: 90 }, 'bpSystolic'],
    ['BP only one number', { bpSystolic: 140 }, 'bpSystolic'],
    ['BP the wrong way round', { bpSystolic: 80, bpDiastolic: 120 }, 'bpSystolic'],
    ['pulse 20', { pulse: 20 }, 'pulse'],
    ['pulse with decimals', { pulse: '82.5' }, 'pulse'],
    ['SpO2 101', { spo2: 101 }, 'spo2'],
    ['temperature without a unit', { temperature: 38 }, 'temperature'],
    ['temperature 101 °C', { temperature: 101, temperatureUnit: 'C' }, 'temperature'],
    ['temperature 37 °F', { temperature: 37, temperatureUnit: 'F' }, 'temperature'],
    ['temperature two decimals', { temperature: '98.65', temperatureUnit: 'F' }, 'temperature'],
    ['sugar without a type', { sugar: 210 }, 'sugar'],
    ['sugar with an unknown type', { sugar: 210, sugarType: 'after_tea' }, 'sugar'],
    ['sugar 900', { sugar: 900, sugarType: 'random' }, 'sugar'],
    ['hex text', { pulse: '0x50' }, 'pulse'],
    ['a list', { spo2: [98] }, 'spo2'],
    ['an inherited key as the unit', { temperature: 38, temperatureUnit: 'constructor' }, 'temperature'],
    ['a list as the sugar type', { sugar: 120, sugarType: ['random'] }, 'sugar'],
  ])('refuses %s', (_n, body, field) => {
    expect(fieldsOf(body)).toHaveProperty(field);
  });

  test('messages are ready to show (capitalised)', () => {
    expect(fieldsOf({ pulse: 20 }).pulse).toBe('Must be a whole number 30–220');
  });
});

describe('AC3/AC4: display and the summary line, added by code', () => {
  const row = { bp_systolic: 140, bp_diastolic: 90, pulse: 82, temperature: '101.0', temperature_unit: 'F', spo2: 98, sugar: 210, sugar_type: 'post_meal' };

  test('exact values, readable', () => {
    expect(vitalsText(row)).toBe('BP 140/90 mmHg, Pulse 82/min, Temperature 101 °F, SpO2 98%, Sugar 210 mg/dL (post-meal)');
  });

  test('only what was recorded; nothing recorded = no text', () => {
    expect(vitalsText({ pulse: 70 })).toBe('Pulse 70/min');
    expect(vitalsText({ pulse: null })).toBeNull();
    expect(vitalsText(null)).toBeNull();
  });

  test('display for the apps: all five in order, null when not recorded', () => {
    expect(vitalsDisplay({ spo2: 97 })).toEqual([
      { label: 'BP', value: null }, { label: 'Pulse', value: null }, { label: 'Temperature', value: null },
      { label: 'SpO2', value: '97%' }, { label: 'Sugar', value: null },
    ]);
    expect(vitalsDisplay(null).every(d => d.value === null)).toBe(true);
  });

  test('placed after the AI text and before "From reports:"', () => {
    const text = ['Headache for 2 days.', '', 'From reports:', 'HbA1c 8.2 (High)'].join('\n');
    expect(withVitalsLine(text, { pulse: 70 }))
      .toBe(['Headache for 2 days.', 'Vitals: Pulse 70/min.', '', 'From reports:', 'HbA1c 8.2 (High)'].join('\n'));
  });

  test.each([['**From Reports:**'], ['From reports -'], ['FROM REPORTS:']])('finds the reports heading written as %s', (heading) => {
    const NL = String.fromCharCode(10);
    expect(withVitalsLine(['Fever.', '', heading, 'CRP 40 (High)'].join(NL), { pulse: 90 }))
      .toBe(['Fever.', 'Vitals: Pulse 90/min.', '', heading, 'CRP 40 (High)'].join(NL));
  });

  test('no reports: added at the end; no vitals on a list with the spoken question: text unchanged', () => {
    expect(withVitalsLine('Headache.\n', { spo2: 97 })).toBe('Headache.\nVitals: SpO2 97%.');
    expect(withVitalsLine('Headache.', null, SPOKEN_LIST)).toBe('Headache.');
  });

  test('PR B: nothing recorded on a list without the spoken question says so', () => {
    expect(withVitalsLine('Headache.', null, [{ text: 'Since when?' }])).toBe(['Headache.', 'Vitals: not recorded.'].join('\n'));
    expect(withVitalsLine('Headache.', { pulse: 70 }, SPOKEN_LIST)).toBe(['Headache.', 'Vitals: Pulse 70/min.'].join('\n'));
  });

  test('PR B: doctor-web row: five "Not recorded" on a new list, none on an old list with nothing entered', () => {
    expect(vitalsRow(null, [{ text: 'Since when?' }])).toHaveLength(5);
    expect(vitalsRow(null, SPOKEN_LIST)).toEqual([]);
    expect(vitalsRow({ pulse: 70 }, SPOKEN_LIST)).toHaveLength(5);
  });

  test('PR B: a list asks spoken vitals only while it has the old question', () => {
    expect(asksSpokenVitals(SPOKEN_LIST)).toBe(true);
    expect(asksSpokenVitals([{ text: 'today’s VITALS (attender) — BP' }])).toBe(true); // reworded
    expect(asksSpokenVitals([{ text: 'Since when?' }])).toBe(false);
    expect(asksSpokenVitals(undefined)).toBe(false);
  });

  test('the prompt gives the vitals as context and tells the AI not to write its own Vitals line', () => {
    const qa = [{ question: "Today's vitals (attender)", answer: 'BP 140/90' }];
    const p = buildSummaryPrompt({ sex: 'M', age: 50, vitals: row }, qa);
    expect(p).toContain("Today's vitals, measured by the attender: BP 140/90 mmHg, Pulse 82/min");
    expect(p).toContain('do not write a "Vitals:" line');
    expect(p).not.toContain('Only if one of the questions asks for today');
    expect(buildSummaryPrompt({ sex: 'M', age: 50 }, qa)).toContain('Only if one of the questions asks for today');
    // PR B: no spoken question and nothing entered: the code writes "not recorded", the AI writes none.
    const noSpoken = buildSummaryPrompt({ sex: 'M', age: 50 }, [{ question: 'Recent BP readings?', answer: '150/90 at home' }]);
    expect(noSpoken).toContain('do not write a "Vitals:" line');
    expect(noSpoken).not.toContain('Only if one of the questions asks for today');
  });
});
