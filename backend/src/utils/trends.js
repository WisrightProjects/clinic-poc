// Purpose: CLINIC-030 — report trends on the doctor card: the same measurement across a returning
// patient's visits (client document, doctor summary). Pure — no DB.
//
// Where each value comes from:
//   - BP, pulse, temperature, SpO2, sugar (by type) and weight: the fields the attender entered
//     (CLINIC-023 / 024) — exact.
//   - HbA1c: the "From reports" lines of that visit's summary (CLINIC-018, the doctor's edit when
//     there is one) — read by the AI from the photos, so the row is marked `source: 'reports'`.
//     Only report lines are read: the review points, "Since last visit" and history quote
//     earlier values. The reports list only ABNORMAL results, so a visit without HbA1c there
//     is "not listed", never "not tested" (it may have been normal).
// The change is today vs the latest earlier value, as up / down / same only — no better/worse.

const { reportLines } = require('./doctorCard');
const { isRealSummary } = require('./summaryText');
const { SUGAR_TYPES } = require('./vitals');

const MAX_ROWS = 6;

// The test's name — not "Hb 11.2".
const HBA1C_NAME = /\b(?:hba1c|a1c|glycated ha?emoglobin|glycosylated ha?emoglobin)\b/gi;
// A report date: "12 Sep 2026", "Sep 12, 2026", "2026-09-12", "12/09/2026" (day first, as in
// India; the same separator twice, four-digit year — so a range like "6.5-10" is never a date).
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON = MONTHS.join('|');
const REPORT_DATE = new RegExp(
  `\\b\\d{1,2}[ -](?:${MON})[a-z]*,?[ -]\\d{4}\\b|\\b(?:${MON})[a-z]* \\d{1,2},? \\d{4}\\b`
  + `|\\b\\d{4}-\\d{2}-\\d{2}\\b|(?<![\\d.])\\d{1,2}([/.-])\\d{1,2}\\1\\d{4}(?![\\d.])`, 'gi');
// What is cut before the value is looked for: a reference range ("(ref 4-5.6 %)", "4.0 - 5.7 %",
// "< 5.7 %"), so a range's number is never read as the result.
const REFERENCE = /\(?\b(?:bio\.? ?)?(?:ref(?:erence)?|range|normal|target)\b[^)\]\n]*[)\]]?/gi;
const RANGE = /(?<![\w.])\d+(?:\.\d+)?\s*(?:-|–|to)\s*\d+(?:\.\d+)?\s*%?/gi;
const LIMIT = /[<>≤≥]\s*=?\s*\d+(?:\.\d+)?\s*%?/g;
// The value: the first number left, in % (a report in mmol/mol only is left out, never shown as %).
// The report's flag may sit between them, copied from its result column: "7.6 H %", "7.6 (H) %",
// "7.6 HH %", "7.6 H* %", "7.6 [H] %", "7.6 ↑ %". (A line naming HbA1c whose value still can't be
// read is "check photos" — hba1cOf — never "not listed".)
const FLAG = String.raw`(?:hh?|ll?|high|low|a|abnormal|\*+|↑|↓)\*?`;
const VALUE = new RegExp(String.raw`^[^\d\n]{0,25}?(?<![\w.])(\d{1,2}(?:\.\d{1,2})?)\s*(?:(?:\(${FLAG}\)|\[${FLAG}\]|${FLAG})\s*)?%`, 'i');
// The code's / the AI's notes that some report photos or values were not read (CLINIC-018).
const NOT_READ = /could not be read|no results listed|please check the (photos|original)/i;

// "12 Sep 2026" -> a time to compare report dates by (NaN when unknown).
function dateTime(text) {
  if (!text) return NaN;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return Date.UTC(+iso[1], iso[2] - 1, +iso[3]);
  const numeric = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (numeric) return Date.UTC(+numeric[3], numeric[2] - 1, +numeric[1]);
  const month = MONTHS.findIndex((m) => text.toLowerCase().includes(m));
  const [day, year] = [text.match(/\b\d{1,2}\b/)?.[0], text.match(/\b\d{4}\b/)?.[0]];
  return month < 0 || !day || !year ? NaN : Date.UTC(+year, month, +day);
}

// { value, date } of a report line's HbA1c, or null. Only the line's own part up to ";" or "|"
// (another test may follow it), without dates and reference ranges.
function hba1cInLine(line) {
  const name = line.search(HBA1C_NAME);
  if (name < 0) return null;
  // Both names may be written: "Glycated haemoglobin (HbA1c) 7.9 %".
  const part = line.slice(name).split(/[;|]/)[0].replace(HBA1C_NAME, ' ');
  const value = part.replace(REPORT_DATE, ' ').replace(REFERENCE, ' ').replace(LIMIT, ' ').replace(RANGE, ' ').match(VALUE);
  if (!value) return null;
  return { value: Number(value[1]), date: (part.match(REPORT_DATE) || line.match(REPORT_DATE))?.[0] || null };
}

// The visit's HbA1c from its report lines: { value, date } — the latest report when there are
// several (dated); { unread: true } when none was found but some photos or values were not read,
// or a line names HbA1c in a form not read here (e.g. "> 14 %", mmol/mol first) — never "not
// listed" for a test that is listed; { notListed: true } when the reports list results without it
// (it may have been normal); null
// when there are no report lines. `summary`: a summaries row (display_text, generated_by, edited_text).
function hba1cOf(summary) {
  if (!isRealSummary(summary)) return null;
  const lines = reportLines(summary.display_text);
  const found = lines.map(hba1cInLine).filter(Boolean);
  if (found.length) {
    const time = (h) => (Number.isNaN(dateTime(h.date)) ? -Infinity : dateTime(h.date));
    return found.reduce((best, h) => (time(h) > time(best) ? h : best));
  }
  if (lines.some((l) => NOT_READ.test(l) || l.search(HBA1C_NAME) >= 0)) return { unread: true };
  return lines.length ? { notListed: true } : null;
}

const num = (v) => (v == null ? null : Number(v)); // pg returns NUMERIC as a string

// The rows, in display order (the six agreed first, so the row limit drops the others). `get(visit)`
// -> { nums, text } or null for one visit; `nums` is the value as numbers for the change (BP:
// two), `unit` keeps unlike values from being compared; a value-less marker ({ notListed },
// { unread }, { repeat }) is shown as such and never counts.
const SUGAR = (type) => ({
  key: `sugar_${type}`, label: `${SUGAR_TYPES[type][0].toUpperCase()}${SUGAR_TYPES[type].slice(1)} sugar (mg/dL)`, source: 'vitals',
  get: (s) => (s.vitals?.sugar != null && s.vitals.sugar_type === type
    ? { nums: [num(s.vitals.sugar)], text: String(num(s.vitals.sugar)) } : null),
});
const ROWS = [
  {
    key: 'hba1c', label: 'HbA1c (%)', source: 'reports',
    get: (s) => {
      const h = hba1cOf(s.summary);
      return h?.value != null ? { nums: [h.value], text: String(h.value), date: h.date } : h;
    },
  },
  SUGAR('fasting'),
  SUGAR('post_meal'),
  {
    key: 'bp', label: 'BP (mmHg)', source: 'vitals',
    get: (s) => (s.vitals?.bp_systolic != null && s.vitals.bp_diastolic != null
      ? { nums: [num(s.vitals.bp_systolic), num(s.vitals.bp_diastolic)], text: `${s.vitals.bp_systolic}/${s.vitals.bp_diastolic}` } : null),
  },
  {
    key: 'pulse', label: 'Pulse (/min)', source: 'vitals',
    get: (s) => (s.vitals?.pulse != null ? { nums: [num(s.vitals.pulse)], text: String(s.vitals.pulse) } : null),
  },
  {
    key: 'weight', label: 'Weight (kg)', source: 'registration',
    get: (s) => (s.weight_kg != null ? { nums: [num(s.weight_kg)], text: String(num(s.weight_kg)) } : null),
  },
  SUGAR('random'),
  {
    key: 'temperature', label: 'Temperature', source: 'vitals',
    get: (s) => (s.vitals?.temperature != null
      ? { nums: [num(s.vitals.temperature)], text: `${num(s.vitals.temperature)} °${s.vitals.temperature_unit}`, unit: s.vitals.temperature_unit } : null),
  },
  {
    key: 'spo2', label: 'SpO2 (%)', source: 'vitals',
    get: (s) => (s.vitals?.spo2 != null ? { nums: [num(s.vitals.spo2)], text: String(s.vitals.spo2) } : null),
  },
];

// [{ dir, by }] per number ("↓ 0.6", "↑ 4 / ↓ 2", "→"), rounded to one decimal so 7.6 - 8.2
// never shows as 0.5999; null when there is nothing to compare or the units differ.
function changeOf(earlier, today) {
  if (!earlier || !today || earlier.unit !== today.unit) return null;
  return today.nums.map((n, i) => {
    const d = Math.round((n - earlier.nums[i]) * 10) / 10;
    return { dir: d > 0 ? 'up' : d < 0 ? 'down' : 'same', by: Math.abs(d) };
  });
}

// A cell with a value (not null, not "not listed") — the only kind that counts or compares.
const has = (c) => Boolean(c?.nums);

// The trends block, or null when there is nothing to compare (a new patient, or no measurement
// on 2 or more visits). `today` and each of `earlier` (newest first, as the repository returns
// them): trendSource(...).
function buildTrends(today, earlier) {
  if (!earlier?.length) return null;
  const visits = [...earlier].reverse().concat(today); // oldest first, today last
  const rows = [];
  for (const def of ROWS) {
    const cells = visits.map((v) => def.get(v));
    // The same report photo sent again on a later visit (same value and report date) is not a
    // new result: counted once, at the visit it first came with; later it says "same report".
    // (Only report values have a date.)
    cells.forEach((c, i) => {
      if (c?.date && cells.slice(0, i).some((p) => has(p) && p.date === c.date && p.nums[0] === c.nums[0])) {
        cells[i] = { repeat: true };
      }
    });
    if (cells.filter(has).length < 2) continue;
    const last = cells.length - 1;
    const before = cells.slice(0, last).reverse().find(has);
    rows.push({
      key: def.key, label: def.label, source: def.source,
      values: cells.map((c) => (has(c) ? { text: c.text, date: c.date || null } : c)),
      change: has(cells[last]) ? changeOf(before, cells[last]) : null,
    });
    if (rows.length === MAX_ROWS) break;
  }
  if (!rows.length) return null;
  // Columns: only the visits with a value in some row (today always).
  const keep = visits.map((_, i) => i === visits.length - 1 || rows.some((r) => r.values[i]?.text));
  return {
    visits: visits.filter((_, i) => keep[i]).map((v, i, all) => ({
      id: v.id, visit_date: v.visit_date, today: i === all.length - 1, ...(v.queue_date ? { queue_date: v.queue_date } : {}),
    })),
    rows: rows.map((r) => ({ ...r, values: r.values.filter((_, i) => keep[i]) })),
  };
}

// One visit in buildTrends' shape: the visit row (id, visit_date, queue_date, weight_kg), its vitals row
// and its latest summaries row (display_text, generated_by, edited_text) — for an earlier visit
// all three are the one findTrendHistory row.
function trendSource(visit, vitals, summary) {
  return {
    id: visit.id, visit_date: visit.visit_date, queue_date: visit.queue_date, weight_kg: visit.weight_kg, vitals,
    summary: summary?.display_text ? summary : null,
  };
}

module.exports = { buildTrends, trendSource, hba1cOf };
