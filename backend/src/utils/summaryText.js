// Purpose: the markers inside a stored summary's text that the code writes for itself or asks
// the AI for — one place, so the code that writes, splits and reads the text agrees.
// (The "Vitals:" line lives with withVitalsLine in utils/vitals.js.)

// Where the "From reports" paragraph starts (CLINIC-018): at the start of a line (with the
// blank lines before it), in any case and with markdown.
const FROM_REPORTS = /(^|\n+)[^\w\n]*from reports/i;
// The "Since last visit (date): …" line (CLINIC-027), at the start of a line.
const SINCE_LAST_VISIT = /^\W*since last visit/i;
// The doctor card's headings (CLINIC-028): asked for by summary/prompt.js, read back by
// doctorCard.js. Always English, whatever the summary language.
const CARD_HEADINGS = { today: "Today's status", history: 'Relevant history' };

module.exports = { FROM_REPORTS, SINCE_LAST_VISIT, CARD_HEADINGS };
