// Purpose: the markers inside a stored summary's text that the code writes for itself or asks
// the AI for — one place, so the code that writes, splits and reads the text agrees.
// (The "Vitals:" line lives with withVitalsLine in utils/vitals.js.)

// Where the "From reports" paragraph starts (CLINIC-018): at the start of a line (with the
// blank lines before it), in any case and with markdown.
const FROM_REPORTS = /(^|\n+)[^\w\n]*from reports/i;
// The "Since last visit (date): …" line (CLINIC-027), at the start of a line.
const SINCE_LAST_VISIT = /^\W*since last visit/i;
// The doctor card's headings (CLINIC-028): asked for by summary/prompt.js, read back by
// doctorCard.js. Always English, whatever the summary language. `review`: the AI's points for
// the doctor to check (CLINIC-029).
const CARD_HEADINGS = { today: "Today's status", history: 'Relevant history', review: 'Doctor to review' };

// A summary row with real content: the doctor edited it, or the AI wrote it — not the demo
// text ('mock') or the "AI summary not available" note ('mock-fallback'). `summary`: a
// summaries row (generated_by, edited_text).
const NOT_AI_SUMMARIES = ['mock', 'mock-fallback'];
const isRealSummary = (summary) => Boolean(summary)
  && (Boolean(summary.edited_text) || !NOT_AI_SUMMARIES.includes(summary.generated_by));

module.exports = { FROM_REPORTS, SINCE_LAST_VISIT, CARD_HEADINGS, isRealSummary };
