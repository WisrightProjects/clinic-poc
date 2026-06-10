#!/usr/bin/env node
/*
 * findings-rollup.mjs — on-demand actionable-findings rollup
 * ============================================================
 *
 * PURPOSE
 *   Scans the two central triage files produced by the story pipeline
 *   (SECURITY-FINDINGS.md and REVIEW-FINDINGS.md) at the project root and
 *   prints everything still actionable (Status = Open or Recommend-soon).
 *   Accepted-by-design / Won't-fix / Fixed rows are excluded.
 *
 * USAGE
 *   node findings-rollup.mjs [--project <dir>]
 *     --project <dir>   Directory containing the two findings files.
 *                       Defaults to process.cwd().
 *
 * INPUT FORMAT
 *   Each file holds a markdown table with this exact column order:
 *     | ID | Story | Source | Severity | Effort | Status | Location | Note |
 *   Severity vocab:
 *     security : Critical · High · Med · Low
 *     review   : Blocking · Major · Minor · Nit
 *   Status vocab (both): Open · Recommend-soon · Accepted-by-design · Won't-fix · Fixed
 *
 * EXIT CODES
 *   0  normal (including when a file is simply missing)
 *   1  unexpected read/parse error
 *
 * No npm dependencies — only node:fs, node:path, node:process.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILES = [
  { file: 'SECURITY-FINDINGS.md', source: 'security' },
  { file: 'REVIEW-FINDINGS.md', source: 'review' },
];

const ACTIONABLE_STATUSES = new Set(['Open', 'Recommend-soon']);

// Most-severe-first. Security and review severities interleaved by rough rank.
const SEVERITY_ORDER = [
  'Critical',
  'High',
  'Blocking',
  'Major',
  'Med',
  'Minor',
  'Low',
  'Nit',
];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Parse CLI args into an options object.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ project: string }}
 */
export function parseArgs(argv) {
  const opts = { project: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project') {
      const val = argv[i + 1];
      if (val === undefined) {
        throw new Error('--project requires a directory argument');
      }
      opts.project = val;
      i++;
    }
  }
  return opts;
}

/**
 * Split a single markdown table row into trimmed cell strings.
 * Strips the leading/trailing pipe-borders.
 * @param {string} line
 * @returns {string[]}
 */
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

/**
 * Detect a markdown separator row, e.g. `|---|:--:|---|`.
 * @param {string} line
 * @returns {boolean}
 */
function isSeparatorRow(line) {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c));
}

const HEADER_CELLS = [
  'ID',
  'Story',
  'Source',
  'Severity',
  'Effort',
  'Status',
  'Location',
  'Note',
];

/**
 * Detect the table header row.
 * @param {string} line
 * @returns {boolean}
 */
function isHeaderRow(line) {
  const cells = splitRow(line).map((c) => c.toLowerCase());
  return HEADER_CELLS.every((h, idx) => cells[idx] === h.toLowerCase());
}

/**
 * Parse a markdown table from raw file text into finding objects.
 * Robust to extra `|` inside the Note column (overflow is re-joined).
 * Skips header and separator rows and any non-table lines.
 *
 * @param {string} text - full file contents
 * @param {string} source - 'security' | 'review'
 * @returns {Array<{id,story,source,severity,effort,status,location,note}>}
 */
export function parseTable(text, source) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.includes('|')) continue; // not a table line
    if (isSeparatorRow(trimmed)) continue;
    if (isHeaderRow(trimmed)) continue;

    const cells = splitRow(trimmed);
    // Need at least the 8 defined columns.
    if (cells.length < 8) continue;

    const [id, story, src, severity, effort, status, location] = cells;
    // Re-join any overflow cells back into the Note (extra `|` in note text).
    const note = cells.slice(7).join(' | ');

    // Guard against stray non-data rows: require a plausible id.
    if (!id) continue;

    rows.push({
      id,
      story,
      // Prefer the file's source label; fall back to the row's Source cell.
      source: source || src || '',
      severity,
      effort,
      status,
      location,
      note,
    });
  }
  return rows;
}

/**
 * Rank a severity for sort ordering. Unknown severities sort last.
 * @param {string} severity
 * @returns {number}
 */
export function severityRank(severity) {
  const idx = SEVERITY_ORDER.indexOf(severity);
  return idx === -1 ? SEVERITY_ORDER.length : idx;
}

/**
 * Keep only rows whose status is actionable (Open or Recommend-soon).
 * @param {Array} rows
 * @returns {Array}
 */
export function filterActionable(rows) {
  return rows.filter((r) => ACTIONABLE_STATUSES.has(r.status));
}

/**
 * Format one finding as a report line.
 * @param {object} f
 * @returns {string}
 */
function formatFinding(f) {
  const loc = f.location || '(no location)';
  const note = f.note || '(no note)';
  const eff = f.effort || '?';
  return `  ${f.id}  [${f.source}/${f.story}]  ${loc}  — ${note}  (effort ${eff})`;
}

/**
 * Build the full plain-text report string.
 * @param {Array} actionable - already filtered to actionable rows
 * @returns {string}
 */
export function buildReport(actionable) {
  const out = [];
  out.push('Findings Rollup — actionable items (Open / Recommend-soon)');
  out.push('='.repeat(58));
  out.push('');

  if (actionable.length === 0) {
    out.push('Nothing open — all findings triaged.');
    return out.join('\n');
  }

  // --- Recommend-soon group FIRST (across both sources) ---
  const recommendSoon = actionable
    .filter((f) => f.status === 'Recommend-soon')
    .sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        a.id.localeCompare(b.id),
    );

  out.push(`Recommend-soon (${recommendSoon.length}) — cheap but compounding, do these soon`);
  out.push('-'.repeat(58));
  if (recommendSoon.length === 0) {
    out.push('  (none)');
  } else {
    for (const f of recommendSoon) out.push(formatFinding(f));
  }
  out.push('');

  // --- Remaining Open items grouped by severity ---
  const open = actionable.filter((f) => f.status === 'Open');
  out.push(`Open (${open.length}) — grouped by severity (most severe first)`);
  out.push('-'.repeat(58));

  if (open.length === 0) {
    out.push('  (none)');
  } else {
    const bySeverity = new Map();
    for (const f of open) {
      if (!bySeverity.has(f.severity)) bySeverity.set(f.severity, []);
      bySeverity.get(f.severity).push(f);
    }
    // Known severities in canonical order, then any unknown ones.
    const knownInOrder = SEVERITY_ORDER.filter((s) => bySeverity.has(s));
    const unknown = [...bySeverity.keys()]
      .filter((s) => !SEVERITY_ORDER.includes(s))
      .sort();
    const groups = [...knownInOrder, ...unknown];

    for (const sev of groups) {
      const items = bySeverity
        .get(sev)
        .sort((a, b) => a.id.localeCompare(b.id));
      out.push('');
      out.push(`${sev} (${items.length}):`);
      for (const f of items) out.push(formatFinding(f));
    }
  }

  out.push('');
  out.push(buildSummary(actionable));
  return out.join('\n');
}

/**
 * Build the summary count block.
 * @param {Array} actionable
 * @returns {string}
 */
export function buildSummary(actionable) {
  const lines = [];
  lines.push('-'.repeat(58));
  lines.push(`Summary: ${actionable.length} actionable finding(s)`);

  // By status
  const byStatus = countBy(actionable, (f) => f.status);
  lines.push(
    `  By status:   ` +
      ['Open', 'Recommend-soon']
        .map((s) => `${s}=${byStatus[s] || 0}`)
        .join('  '),
  );

  // By source
  const bySource = countBy(actionable, (f) => f.source);
  lines.push(
    `  By source:   ` +
      ['security', 'review']
        .map((s) => `${s}=${bySource[s] || 0}`)
        .join('  '),
  );

  // By severity (canonical order first, then any extras)
  const bySeverity = countBy(actionable, (f) => f.severity);
  const sevKeys = [
    ...SEVERITY_ORDER.filter((s) => bySeverity[s]),
    ...Object.keys(bySeverity)
      .filter((s) => !SEVERITY_ORDER.includes(s))
      .sort(),
  ];
  lines.push(
    `  By severity: ` +
      (sevKeys.length
        ? sevKeys.map((s) => `${s}=${bySeverity[s]}`).join('  ')
        : '(none)'),
  );

  return lines.join('\n');
}

/**
 * Count items by a key function.
 * @param {Array} arr
 * @param {(item:any)=>string} keyFn
 * @returns {Record<string, number>}
 */
function countBy(arr, keyFn) {
  const acc = {};
  for (const item of arr) {
    const k = keyFn(item) || '(unknown)';
    acc[k] = (acc[k] || 0) + 1;
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  const projectDir = resolve(opts.project);
  const allRows = [];
  const notes = [];

  for (const { file, source } of FILES) {
    const path = join(projectDir, file);
    if (!existsSync(path)) {
      notes.push(`note: ${file} not found in ${projectDir} — skipped.`);
      continue;
    }
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch (err) {
      // Unexpected read error (not "missing") -> fail.
      process.stderr.write(`Error reading ${path}: ${err.message}\n`);
      process.exit(1);
    }
    try {
      allRows.push(...parseTable(text, source));
    } catch (err) {
      process.stderr.write(`Error parsing ${path}: ${err.message}\n`);
      process.exit(1);
    }
  }

  const actionable = filterActionable(allRows);

  for (const n of notes) process.stdout.write(n + '\n');
  if (notes.length) process.stdout.write('\n');

  process.stdout.write(buildReport(actionable) + '\n');
  process.exit(0);
}

main();
