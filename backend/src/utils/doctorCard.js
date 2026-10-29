// Purpose: CLINIC-028 — the doctor card (client document Section 10, "Doctor Smart Summary").
// The AI still writes plain text (so edits, the queue preview, Back-in-queue remakes and the
// CLINIC-027 comparison keep working on display_text); the prompt asks for fixed headings and
// "- Label: value" lines, and this reads them back into the card's blocks. Pure — no DB.

const { VITALS_LINE } = require('./vitals');
const { FROM_REPORTS, SINCE_LAST_VISIT, CARD_HEADINGS } = require('./summaryText');

const BULLET = /^[-•*]\s*/;
const HEADING_KEYS = Object.keys(CARD_HEADINGS);
const normal = (text) => text.replace(/^\W+|[:\s]+$/g, '').replace(/’/g, "'").toLowerCase();

// A line without markdown emphasis and outer spaces.
const clean = (line) => line.replace(/\*\*|__/g, '').trim();

// The card section a line opens and any text after the heading on the same line
// ("Relevant history: none significant"), or null.
function headingOf(line) {
  const at = line.indexOf(':');
  const head = at < 0 ? line : line.slice(0, at);
  const key = HEADING_KEYS.find((k) => CARD_HEADINGS[k].toLowerCase() === normal(head));
  return key ? { key, rest: at < 0 ? '' : line.slice(at + 1).trim() } : null;
}

// "- Complaint: Fever 7 days" -> { label: 'Complaint', value: 'Fever 7 days' } (no label: '').
function item(line) {
  const text = line.replace(BULLET, '');
  const at = text.indexOf(':');
  return at > 0 ? { label: text.slice(0, at).trim(), value: text.slice(at + 1).trim() } : { label: '', value: text };
}

// The card's AI blocks from a summary's text, or null when it has none of the headings (a
// visit from before CLINIC-028, the demo or "not available" text, or a doctor's edit without
// them) — the doctor web then shows the paragraph as before. Nothing the AI wrote is dropped:
// a line outside the blocks goes to `other`, which is shown too. `vitals` is the summary's
// "Vitals:" line (the code's, or the AI's from a spoken vitals answer on older lists).
function parseSummaryCard(text) {
  if (!text) return null;
  const at = text.search(FROM_REPORTS);
  const main = at < 0 ? text : text.slice(0, at);
  const card = { since: null, today: [], history: [], vitals: null, other: [], reports: [] };
  let section = null;
  let last = null; // the item the previous (non-blank) line added, for wrapped lines

  for (const raw of main.split('\n')) {
    const line = clean(raw);
    if (!line) { last = null; continue; } // a blank line ends a wrapped value
    const heading = headingOf(line);
    if (heading) {
      section = heading.key;
      last = heading.rest ? card[section][card[section].push({ label: '', value: heading.rest }) - 1] : null;
      continue;
    }
    if (SINCE_LAST_VISIT.test(line)) { card.since = line.replace(BULLET, ''); last = null; continue; }
    if (VITALS_LINE.test(line)) { card.vitals = line; last = null; continue; }
    // Continues the item above: an indented line, or one with neither a bullet nor a label.
    const continues = last && !BULLET.test(line) && (/^\s/.test(raw) || !line.includes(':'));
    if (continues) { last.value += ` ${line}`; continue; }
    if (!section || !BULLET.test(line) && !line.includes(':')) { card.other.push(line); last = null; continue; }
    last = card[section][card[section].push(item(line)) - 1];
  }
  if (!section) return null; // no heading at all
  // "From reports:" (CLINIC-018) and the code's notes under it, word for word.
  if (at >= 0) {
    card.reports = text.slice(at).split('\n').map(clean).filter(Boolean)
      .map((l, i) => (i === 0 ? l.replace(/^\W*from reports\s*:?\s*/i, '') : l)).filter(Boolean);
  }
  return card;
}

// The main problem: the first tap (choice) question the visit is asked — the labels of the
// options tapped, and its details text — exactly as the attender entered it. `questions`: the
// visit's asked questions (not a section it doesn't have). Null when there is no tap question
// (General, Gynaecologist) or it isn't answered.
function mainProblem(questions, answers) {
  const q = (questions || []).filter((x) => x.answer_type === 'choice')
    .sort((a, b) => a.order_index - b.order_index)[0];
  const value = q && (answers || []).find((a) => a.question_id === q.id)?.value;
  if (!value?.choices?.length) return null;
  const labelOf = (v) => (q.options || []).find((o) => o.value === v)?.label ?? v;
  return { choices: value.choices.map(labelOf), details: value.details || null };
}

module.exports = { parseSummaryCard, mainProblem };
