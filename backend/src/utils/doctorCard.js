// Purpose: CLINIC-028 — the doctor card (client document Section 10, "Doctor Smart Summary").
// The AI still writes plain text (so edits, the queue preview, Back-in-queue remakes and the
// CLINIC-027 comparison keep working on display_text); the prompt asks for fixed headings and
// "- Label: value" lines, and this reads them back into the card's blocks. Pure — no DB.

const { VITALS_LINE } = require('./vitals');
const { FROM_REPORTS, SINCE_LAST_VISIT, CARD_HEADINGS } = require('./summaryText');

// "-", "•", "*" or "1." / "1)" — not the "1." of a decimal such as "1.5 mg".
const BULLET = /^([-•*]|\d+[.)](?!\d))\s*/;
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

// The "From reports:" paragraph (CLINIC-018) and the code's notes under it, word for word, one
// entry per line without the heading — of a card or a paragraph summary; [] when there is none.
// `at`: where the paragraph starts, when the caller has already found it.
function reportLines(text, at = text ? text.search(FROM_REPORTS) : -1) {
  if (at < 0) return [];
  return text.slice(at).split('\n').map(clean).filter(Boolean)
    .map((l, i) => (i === 0 ? l.replace(/^\W*from reports\s*:?\s*/i, '') : l)).filter(Boolean);
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
  // review (CLINIC-029): null = the summary has no "Doctor to review" block (made before it, or
  // edited out) — not the same as [] = the AI checked and found nothing ("- None").
  const card = { since: null, today: [], history: [], review: null, vitals: null, other: [], reports: [] };
  let section = null;
  let last = null; // the item the previous (non-blank) line added, for wrapped lines
  let point = false; // the previous (non-blank) line was a bulleted review point

  for (const raw of main.split('\n')) {
    const line = clean(raw);
    if (!line) { last = null; point = false; continue; } // a blank line ends a wrapped value
    const heading = headingOf(line);
    if (heading) {
      section = heading.key;
      last = null;
      point = false;
      if (section === 'review') {
        card.review = card.review || [];
        if (heading.rest) card.review.push(heading.rest);
      } else if (heading.rest) {
        last = card[section][card[section].push({ label: '', value: heading.rest }) - 1];
      }
      continue;
    }
    if (SINCE_LAST_VISIT.test(line)) { card.since = line.replace(BULLET, ''); last = null; continue; }
    if (VITALS_LINE.test(line)) { card.vitals = line; last = null; point = false; continue; }
    // Review points are plain lines — bulleted, numbered or not. A line without a bullet right
    // after a bulleted point continues it (wrapped); otherwise each line is a point.
    if (section === 'review') {
      const bulleted = BULLET.test(line);
      if (!bulleted && point) card.review[card.review.length - 1] += ` ${line}`;
      else { card.review.push(line.replace(BULLET, '')); point = bulleted; }
      continue;
    }
    // Continues the item above: an indented line, or one with neither a bullet nor a label.
    const continues = last && !BULLET.test(line) && (/^\s/.test(raw) || !line.includes(':'));
    if (continues) { last.value += ` ${line}`; continue; }
    if (!section || !BULLET.test(line) && !line.includes(':')) { card.other.push(line); last = null; continue; }
    last = card[section][card[section].push(item(line)) - 1];
  }
  if (!section) return null; // no heading at all
  // "Doctor to review: - None" — nothing to check (CLINIC-029; the prompt asks for English "None").
  if (card.review?.length === 1 && /^none\.?$/i.test(card.review[0])) card.review = [];
  card.reports = reportLines(text, at);
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

module.exports = { parseSummaryCard, reportLines, mainProblem };
