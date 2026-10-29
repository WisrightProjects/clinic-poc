// Purpose: CLINIC-024 vitals as fields — the checks for what the attender enters, and the one
// readable display of a vitals row: shown by both apps (vitalsDisplay, returned with the visit)
// and used for the "Vitals:" line the code adds to the summary (never written by the AI, so the
// numbers are exactly as entered). Pure — no DB / config.

const { FROM_REPORTS } = require('./summaryText');
const { optionalNumber, throwFieldErrors } = require('./fieldValidation');

// Plausible ranges (also kept as DB checks in migration 016).
const RANGES = {
  bpSystolic: { min: 60, max: 260 },
  bpDiastolic: { min: 30, max: 160 },
  pulse: { min: 30, max: 220 },
  spo2: { min: 50, max: 100 },
  sugar: { min: 20, max: 700 },
};
const TEMPERATURE = { C: { min: 34, max: 43, decimals: 1 }, F: { min: 93, max: 110, decimals: 1 } };
const SUGAR_TYPES = { fasting: 'fasting', post_meal: 'post-meal', random: 'random' };

// Own keys only, so "constructor" / "__proto__" or a list never count as a unit or type.
const pick = (table, key) => (typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : undefined);

// Checks the vitals form; returns the row to store (null = not recorded). A temperature unit
// or sugar type is kept only with its number. Throws 400 VALIDATION_ERROR with err.fields.
function validateVitals(body) {
  const errors = {};
  const out = {
    bpSystolic: null, bpDiastolic: null, pulse: null, temperature: null, temperatureUnit: null,
    spo2: null, sugar: null, sugarType: null,
  };
  for (const [key, range] of Object.entries(RANGES)) {
    const n = optionalNumber(body[key], range);
    if (n.error) errors[key] = n.error;
    else out[key] = n.value;
  }

  if (!errors.bpSystolic && !errors.bpDiastolic) {
    if ((out.bpSystolic == null) !== (out.bpDiastolic == null)) errors.bpSystolic = 'Enter both BP numbers';
    else if (out.bpSystolic != null && out.bpSystolic <= out.bpDiastolic) {
      errors.bpSystolic = 'The first BP number must be higher than the second';
    }
  }

  const range = pick(TEMPERATURE, body.temperatureUnit);
  const temp = optionalNumber(body.temperature, range ?? { min: 0, max: Infinity, decimals: 1 });
  if (temp.error) errors.temperature = temp.error;
  else if (temp.value != null && !range) errors.temperature = 'Choose °C or °F';
  else if (temp.value != null) Object.assign(out, { temperature: temp.value, temperatureUnit: body.temperatureUnit });

  if (out.sugar != null) {
    if (pick(SUGAR_TYPES, body.sugarType)) out.sugarType = body.sugarType;
    else errors.sugar = 'Choose fasting, post-meal or random';
  }

  throwFieldErrors(errors);
  return out;
}

// The five vitals in display order, each { label, value } — value null when not recorded.
// (pg returns the NUMERIC temperature as a string.)
function vitalsDisplay(v) {
  const r = v || {};
  return [
    { label: 'BP', value: r.bp_systolic != null && r.bp_diastolic != null ? `${r.bp_systolic}/${r.bp_diastolic} mmHg` : null },
    { label: 'Pulse', value: r.pulse != null ? `${r.pulse}/min` : null },
    { label: 'Temperature', value: r.temperature != null ? `${Number(r.temperature)} °${r.temperature_unit}` : null },
    { label: 'SpO2', value: r.spo2 != null ? `${r.spo2}%` : null },
    { label: 'Sugar', value: r.sugar != null ? `${r.sugar} mg/dL (${SUGAR_TYPES[r.sugar_type] || r.sugar_type})` : null },
  ];
}

// "BP 140/90 mmHg, Pulse 82/min, Temperature 101 °F, SpO2 98%, Sugar 210 mg/dL (random)",
// only the recorded ones; null when nothing was recorded.
function vitalsText(v) {
  const parts = vitalsDisplay(v).filter(d => d.value).map(d => `${d.label} ${d.value}`);
  return parts.length ? parts.join(', ') : null;
}

// The spoken "Today's vitals (attender)…" question of the lists before migration 017, found
// by its wording as 017 does — any case, even reworded around "vitals (attender)" (safe: a
// replaced list can't be edited in Settings any more — templateService). `questions`: the
// visit's whole list ({ text }).
const SPOKEN_VITALS = /vitals \(attender\)/i;
const asksSpokenVitals = questions => (questions || []).some(q => SPOKEN_VITALS.test(q.text));

// The one rule for the doctor-web row, the summary line and the prompt: the code shows the
// vitals (or "not recorded") — except for a visit with nothing entered whose list has the
// spoken vitals question: its vitals are in that answer.
const codeShowsVitals = (vitals, questions) => Boolean(vitalsText(vitals)) || !asksSpokenVitals(questions);

// The doctor web's vitals row: every vital, "Not recorded" for missing ones — or none.
function vitalsRow(vitals, questions) {
  return codeShowsVitals(vitals, questions) ? vitalsDisplay(vitals) : [];
}

// The line withVitalsLine writes, found again in a stored summary (any case, any markdown).
const VITALS_LINE = /^\W*vitals:/i;

// The summary with "Vitals: …." (or "Vitals: not recorded.") added by code: after the AI's
// own text, before the "From reports" paragraph (CLINIC-018) if any — found the way
// geminiClient finds it (any case, even with markdown such as "**From Reports:**").
function withVitalsLine(summaryText, vitals, questions) {
  if (!codeShowsVitals(vitals, questions)) return summaryText;
  const line = `Vitals: ${vitalsText(vitals) || 'not recorded'}.`;
  const at = summaryText.search(FROM_REPORTS);
  if (at < 0) return `${summaryText.trimEnd()}\n${line}`;
  return `${summaryText.slice(0, at).trimEnd()}\n${line}${summaryText.slice(at)}`;
}

module.exports = { SUGAR_TYPES, validateVitals, vitalsDisplay, vitalsText, vitalsRow, withVitalsLine, asksSpokenVitals, codeShowsVitals, VITALS_LINE };
