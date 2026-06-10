#!/usr/bin/env node
/**
 * findings-merge.mjs — merge a batch of code-review / security findings into ONE
 * central, version-controlled markdown triage file, concurrency-safely and
 * status-preservingly.
 *
 * The pipeline calls this once per story/source. It is the ONLY writer of the
 * triage table. It:
 *   - never overwrites a hand-edited Status,
 *   - never reuses an ID,
 *   - never duplicates a finding already listed (dedup by location + issue),
 *   - serializes concurrent runs via an atomic directory lock,
 *   - writes atomically (tmp + rename).
 *
 * Usage:
 *   node findings-merge.mjs --file SECURITY-FINDINGS.md --source security \
 *        --story EP-003 --input /tmp/sec.json [--project <dir>]
 *
 * Args:
 *   --project <dir>  project root the findings file lives in (default: cwd)
 *   --file <name>    triage filename, resolved relative to --project
 *   --source <security|review>   ID prefix: security->SEC, review->CR
 *   --story <id>     story id stamped on new rows (e.g. EP-003)
 *   --input <path>   JSON file: { "findings": [...] } OR a bare array [...]
 *
 * Each finding: { severity, location, note, effort: "S"|"M"|"L", recommendSoon? }
 *
 * Exit codes: 0 ok · 2 bad args · 3 could not acquire lock.
 *
 * No npm dependencies. Built-ins only. Requires Node 18+.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Embedded header templates. These MUST stay byte-identical to the files in
// templates/SECURITY-FINDINGS.md and templates/REVIEW-FINDINGS.md so that a
// freshly-created file matches the documented contract exactly.
// ---------------------------------------------------------------------------

const SECURITY_HEADER = `# Security Findings — Triage

All security-audit findings captured by the \`develop-story\` pipeline, across every story.
Findings are **captured, never auto-fixed** — a developer triages them here, and the accepted
ones are fixed in a later batch pass.

**Owner:** security lead.

## How this file works
- The pipeline's findings-merge step is the **only** writer. It appends genuinely-new findings
  and **never overwrites a Status you have set**.
- **Set the Status column to triage a finding** — your value is preserved on every re-run. The
  merge step will never reset \`Accepted-by-design\` / \`Won't-fix\` / \`Fixed\` back to \`Open\`.
- **Status vocabulary:** \`Open\` · \`Recommend-soon\` · \`Accepted-by-design\` · \`Won't-fix\` · \`Fixed\`.
  New findings default to \`Open\`; cheap-but-compounding ones may start as \`Recommend-soon\`.
- **Severity:** \`Critical\` · \`High\` · \`Med\` · \`Low\`.  **Effort:** \`S\` (≤15m) · \`M\` (≤1h) · \`L\` (>1h).
- IDs (\`SEC-NNN\`) are stable and never reused. Dedup is by location + issue, so re-running a story
  never duplicates a finding already listed here.
- For a cross-file view of everything still open, run \`node scripts/findings-rollup.mjs\`.

| ID | Story | Source | Severity | Effort | Status | Location | Note |
|----|-------|--------|----------|--------|--------|----------|------|
`;

const REVIEW_HEADER = `# Code Review Findings — Triage

All code-review findings captured by the \`develop-story\` pipeline, across every story.
Findings are **captured, never auto-fixed** — a developer triages them here, and the accepted
ones are fixed in a later batch pass.

**Owner:** dev lead.

## How this file works
- The pipeline's findings-merge step is the **only** writer. It appends genuinely-new findings
  and **never overwrites a Status you have set**.
- **Set the Status column to triage a finding** — your value is preserved on every re-run. The
  merge step will never reset \`Accepted-by-design\` / \`Won't-fix\` / \`Fixed\` back to \`Open\`.
- **Status vocabulary:** \`Open\` · \`Recommend-soon\` · \`Accepted-by-design\` · \`Won't-fix\` · \`Fixed\`.
  New findings default to \`Open\`; cheap-but-compounding ones may start as \`Recommend-soon\`.
- **Severity:** \`Blocking\` · \`Major\` · \`Minor\` · \`Nit\`.  **Effort:** \`S\` (≤15m) · \`M\` (≤1h) · \`L\` (>1h).
- IDs (\`CR-NNN\`) are stable and never reused. Dedup is by location + issue, so re-running a story
  never duplicates a finding already listed here.
- For a cross-file view of everything still open, run \`node scripts/findings-rollup.mjs\`.

| ID | Story | Source | Severity | Effort | Status | Location | Note |
|----|-------|--------|----------|--------|--------|----------|------|
`;

const PREFIX_BY_SOURCE = { security: 'SEC', review: 'CR' };
const HEADER_BY_SOURCE = { security: SECURITY_HEADER, review: REVIEW_HEADER };

// The data-row column order, for reference / rendering.
const COLUMNS = ['id', 'story', 'source', 'severity', 'effort', 'status', 'location', 'note'];

// Lock tuning.
const LOCK_RETRIES = 50;
const LOCK_SLEEP_MS = 100;
const STALE_LOCK_MS = 60_000;

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

function usage(msg) {
  if (msg) process.stderr.write(`findings-merge: ${msg}\n`);
  process.stderr.write(
    'usage: node findings-merge.mjs --file <name> --source <security|review> ' +
      '--story <id> --input <path> [--project <dir>]\n'
  );
  process.exit(2);
}

/** Parse `--k v` style args into a plain object. */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

/**
 * Normalize a string for dedup-key purposes: lowercase, collapse all
 * whitespace to single spaces, trim, strip backticks, strip trailing
 * punctuation.
 */
function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:!?]+$/g, '')
    .trim();
}

/** Stable dedup key = normalized location + normalized note (first 80 chars). */
function dedupKey(location, note) {
  return normalize(location) + '||' + normalize(note).slice(0, 80);
}

/** Make a markdown table cell safe: escape pipes, collapse newlines. */
function cell(text) {
  return String(text ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Unescape a parsed cell (reverse of cell() pipe-escaping) and trim. */
function uncell(text) {
  return String(text ?? '').replace(/\\\|/g, '|').trim();
}

/** Zero-pad a numeric id to 3 digits. */
function pad3(n) {
  return String(n).padStart(3, '0');
}

/** Render one parsed row object back to a markdown table line. */
function renderRow(row) {
  return (
    '| ' +
    COLUMNS.map((c) => cell(row[c])).join(' | ') +
    ' |'
  );
}

/**
 * Parse the existing file content into { lines, rows, tableStart, tableEnd }.
 *
 * `rows` are parsed data rows (objects). We locate the header separator line
 * (the `|----|...` row) and treat every subsequent line beginning with `|` as
 * a data row until the table ends.
 */
function parseFile(content) {
  const lines = content.split('\n');
  let sepIndex = -1;

  // Find the separator line that follows the table header. It is a `|` line
  // whose cells are only dashes / colons / spaces.
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('|') && /^\|[\s:\-|]+\|?$/.test(t) && t.includes('-')) {
      sepIndex = i;
      break;
    }
  }

  const rows = [];
  let tableEnd = sepIndex; // last index that belongs to the table

  if (sepIndex !== -1) {
    for (let i = sepIndex + 1; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw.trim().startsWith('|')) {
        // table ended (blank line or other content)
        if (raw.trim() === '') {
          tableEnd = i - 1;
        }
        break;
      }
      const row = parseRow(raw);
      if (row) {
        rows.push(row);
        tableEnd = i;
      }
    }
  }

  return { lines, rows, sepIndex, tableEnd };
}

/**
 * Parse a single `| a | b | ... |` line into a row object using COLUMNS order.
 * Robust to a Note that itself contains pipes: any overflow cells beyond the
 * fixed columns are re-joined into the final Note column.
 */
function parseRow(raw) {
  let line = raw.trim();
  if (!line.startsWith('|')) return null;
  // Drop the leading and trailing pipe boundaries (only the outer ones).
  if (line.startsWith('|')) line = line.slice(1);
  if (line.endsWith('|')) line = line.slice(0, -1);

  // Split on unescaped pipes only.
  const cells = splitUnescaped(line).map((c) => uncell(c));

  if (cells.length < COLUMNS.length) {
    // Not enough cells to be a real data row.
    // Still tolerate if it at least has an ID-looking first cell.
    if (cells.length === 0) return null;
  }

  const row = {};
  for (let i = 0; i < COLUMNS.length - 1; i++) {
    row[COLUMNS[i]] = cells[i] !== undefined ? cells[i] : '';
  }
  // Last column (note) absorbs all overflow cells.
  const noteParts = cells.slice(COLUMNS.length - 1);
  row.note = noteParts.join(' | ').trim();

  // Guard: ignore an accidental re-parse of the header row.
  if (normalize(row.id) === 'id' && normalize(row.story) === 'story') return null;

  return row;
}

/** Split on `|` but not on `\|`. */
function splitUnescaped(line) {
  const out = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && line[i + 1] === '|') {
      cur += '\\|';
      i++;
      continue;
    }
    if (ch === '|') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Extract the max numeric id for a given prefix (e.g. SEC) across rows. */
function maxIdForPrefix(rows, prefix) {
  let max = 0;
  const re = new RegExp('^' + prefix + '-(\\d+)$', 'i');
  for (const r of rows) {
    const m = re.exec(String(r.id || '').trim());
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}

// ---------------------------------------------------------------------------
// Locking — atomic directory lock with stale-lock breaking. Synchronous.
// ---------------------------------------------------------------------------

/** Portable synchronous sleep using Atomics.wait on a SharedArrayBuffer. */
function sleepSync(ms) {
  try {
    const sab = new SharedArrayBuffer(4);
    const ia = new Int32Array(sab);
    Atomics.wait(ia, 0, 0, ms);
  } catch {
    // Fallback busy-wait if SharedArrayBuffer/Atomics unavailable.
    const end = Date.now() + ms;
    while (Date.now() < end) {
      /* spin */
    }
  }
}

/**
 * Acquire an exclusive lock by creating a lock directory atomically. Retries
 * with a short sleep. Breaks a stale lock (mtime older than STALE_LOCK_MS).
 * Returns the lock path on success; exits(3) on failure.
 */
function acquireLock(file) {
  const lock = file + '.lock';
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt++) {
    try {
      fs.mkdirSync(lock);
      return lock; // got it
    } catch (err) {
      if (err && err.code === 'EEXIST') {
        // Lock held. Check for staleness.
        try {
          const st = fs.statSync(lock);
          if (Date.now() - st.mtimeMs > STALE_LOCK_MS) {
            // Crashed run — break the stale lock and retry immediately.
            try {
              fs.rmdirSync(lock);
            } catch {
              /* someone else may have just cleaned it; ignore */
            }
            continue;
          }
        } catch {
          // Lock vanished between mkdir and stat; retry immediately.
          continue;
        }
        sleepSync(LOCK_SLEEP_MS);
        continue;
      }
      // Unexpected error (e.g. permissions).
      process.stderr.write(`findings-merge: lock error: ${err.message}\n`);
      process.exit(3);
    }
  }
  process.stderr.write(
    `findings-merge: could not acquire lock on ${file} after ${LOCK_RETRIES} attempts\n`
  );
  process.exit(3);
}

function releaseLock(lock) {
  if (!lock) return;
  try {
    fs.rmdirSync(lock);
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Input loading
// ---------------------------------------------------------------------------

/** Load findings from the input JSON. Accept {findings:[...]} or [...] . */
function loadFindings(inputPath) {
  let txt;
  try {
    txt = fs.readFileSync(inputPath, 'utf8');
  } catch (err) {
    usage(`cannot read --input ${inputPath}: ${err.message}`);
  }
  let data;
  try {
    data = JSON.parse(txt);
  } catch (err) {
    usage(`--input is not valid JSON: ${err.message}`);
  }
  let arr;
  if (Array.isArray(data)) arr = data;
  else if (data && Array.isArray(data.findings)) arr = data.findings;
  else usage('--input must be an array or an object with a "findings" array');
  return arr;
}

// ---------------------------------------------------------------------------
// Core merge (pure given parsed inputs)
// ---------------------------------------------------------------------------

/**
 * Compute the merge result.
 * Returns { newRows, added, duplicates, existingCount }.
 */
function computeMerge(existingRows, findings, prefix, story, source) {
  // Build dedup set from existing rows.
  const seen = new Set();
  for (const r of existingRows) {
    seen.add(dedupKey(r.location, r.note));
  }

  let nextId = maxIdForPrefix(existingRows, prefix);
  const newRows = [];
  let added = 0;
  let duplicates = 0;

  for (const f of findings) {
    const location = f && f.location != null ? String(f.location) : '';
    const note = f && f.note != null ? String(f.note) : '';
    const key = dedupKey(location, note);

    if (seen.has(key)) {
      duplicates++;
      continue; // existing row (and its Status) wins; also dedups within batch
    }
    seen.add(key);

    nextId += 1;
    const status = f && f.recommendSoon === true ? 'Recommend-soon' : 'Open';
    newRows.push({
      id: `${prefix}-${pad3(nextId)}`,
      story,
      source,
      severity: f && f.severity != null ? String(f.severity) : '',
      effort: f && f.effort != null ? String(f.effort) : '',
      status,
      location,
      note,
    });
    added++;
  }

  return { newRows, added, duplicates, existingCount: existingRows.length };
}

/**
 * Render the full file: keep everything up to and including the last table row,
 * append new rows, then keep any trailing content after the table.
 */
function renderFile(content, parsed, newRows) {
  const { lines, sepIndex, tableEnd } = parsed;
  const newLines = newRows.map(renderRow);

  if (sepIndex === -1) {
    // No table found at all — shouldn't happen for a valid header, but be safe:
    // append the rows at the end.
    const body = content.endsWith('\n') ? content : content + '\n';
    return body + newLines.join('\n') + (newLines.length ? '\n' : '');
  }

  const head = lines.slice(0, tableEnd + 1); // header + separator + existing rows
  const tail = lines.slice(tableEnd + 1); // trailing content (blank lines, etc.)

  const out = [...head, ...newLines, ...tail].join('\n');
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));

  const project = typeof args.project === 'string' ? args.project : process.cwd();
  const fileArg = args.file;
  const source = args.source;
  const story = args.story;
  const input = args.input;

  if (typeof fileArg !== 'string' || !fileArg) usage('missing --file');
  if (source !== 'security' && source !== 'review') {
    usage('--source must be "security" or "review"');
  }
  if (typeof story !== 'string' || !story) usage('missing --story');
  if (typeof input !== 'string' || !input) usage('missing --input');

  const prefix = PREFIX_BY_SOURCE[source];
  const header = HEADER_BY_SOURCE[source];
  const file = path.resolve(project, fileArg);

  const findings = loadFindings(input);

  const lock = acquireLock(file);
  try {
    // Create from template if missing — byte-identical to templates/*.md.
    let content;
    if (!fs.existsSync(file)) {
      content = header;
      // Ensure parent dir exists.
      fs.mkdirSync(path.dirname(file), { recursive: true });
    } else {
      content = fs.readFileSync(file, 'utf8');
    }

    const parsed = parseFile(content);
    const { newRows, added, duplicates, existingCount } = computeMerge(
      parsed.rows,
      findings,
      prefix,
      story,
      source
    );

    const outContent = renderFile(content, parsed, newRows);

    // Atomic write: tmp + rename on same filesystem.
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, outContent);
    fs.renameSync(tmp, file);

    process.stdout.write(
      `${fileArg}: +${added} new, ${duplicates} duplicate(s) skipped, ` +
        `${existingCount} existing preserved\n`
    );
  } finally {
    releaseLock(lock);
  }

  process.exit(0);
}

main();
