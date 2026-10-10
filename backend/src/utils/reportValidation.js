// Purpose: Rules for report photos (CLINIC-011 AC2). Pure — no config/DB/fs.
// The image type is decided by the file's first bytes, not the client's claimed
// mimetype, so a renamed HTML/PDF is rejected and files are served with a known type.

const { AppError } = require('./errors');

const MAX_REPORT_BYTES = 10 * 1024 * 1024;
const MAX_REPORTS_PER_VISIT = 20;

// mimetype -> stored file extension
const ALLOWED_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Returns 'image/jpeg' | 'image/png' | 'image/webp', or null for anything else.
function detectImageType(head) {
  if (!head || head.length < 12) return null;
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function unsupportedMedia() {
  return new AppError('UNSUPPORTED_MEDIA', 'Only JPEG, PNG or WEBP images can be uploaded', 415);
}

function tooManyReports() {
  return new AppError('TOO_MANY_REPORTS', `A visit can have at most ${MAX_REPORTS_PER_VISIT} reports`, 422);
}

// How many more reports the visit can take; throws 422 when it is already full.
function remainingReportSlots(existing) {
  const slots = MAX_REPORTS_PER_VISIT - existing;
  if (slots <= 0) throw tooManyReports();
  return slots;
}

module.exports = {
  MAX_REPORT_BYTES, MAX_REPORTS_PER_VISIT, ALLOWED_TYPES,
  detectImageType, unsupportedMedia, tooManyReports, remainingReportSlots,
};
