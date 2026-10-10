// Upload middleware for report photos (CLINIC-011). Separate from the audio upload:
// own folder, image types only, 10 MB per file, and only as many files as the visit
// has slots left (req.reportSlots, set by reportController.prepareUpload which runs
// first — so a closed visit or a full one never writes anything to disk).
// After multer, every saved file's first bytes decide its real type (file.detectedType)
// and its extension; the client's claimed mimetype is only a loose pre-filter, since
// phones label photos inconsistently (image/jpg, application/octet-stream).
// At most MAX_REPORTS_PER_VISIT files per request: the slot countdown enforces it.
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const config = require('./index');
const { AppError } = require('../utils/errors');
const {
  ALLOWED_TYPES, MAX_REPORT_BYTES, MAX_REPORTS_PER_VISIT,
  detectImageType, unsupportedMedia, tooManyReports,
} = require('../utils/reportValidation');

fs.mkdirSync(config.reportsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.reportsDir),
  filename: (req, file, cb) => {
    const visitId = String(req.params.id || '').replace(/[^0-9]/g, '');
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `visit-${visitId}-${unique}.upload`); // renamed to the detected type's extension
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_REPORT_BYTES },
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype) && file.mimetype !== 'application/octet-stream') {
      return cb(unsupportedMedia());
    }
    req.reportSlots = (req.reportSlots ?? MAX_REPORTS_PER_VISIT) - 1;
    return req.reportSlots < 0 ? cb(tooManyReports()) : cb(null, true);
  },
}).array('report');

const LIMIT_ERRORS = {
  LIMIT_FILE_SIZE: () => new AppError('FILE_TOO_LARGE', `Each image must be ${MAX_REPORT_BYTES / 1024 / 1024} MB or smaller`, 413),
  LIMIT_UNEXPECTED_FILE: () => new AppError('BAD_REQUEST', 'Images must be sent in the "report" field', 400),
};

async function readHead(filePath) {
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const { buffer, bytesRead } = await fh.read(Buffer.alloc(12), 0, 12, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

// Multer removes its own partial files on error; files rejected by the content check
// are removed by the errorHandler (they aren't marked stored).
function reportUpload(req, res, next) {
  upload(req, res, async err => {
    if (err) return next(err.name === 'MulterError' && LIMIT_ERRORS[err.code] ? LIMIT_ERRORS[err.code]() : err);
    // allSettled, not all: every rename must finish before the errorHandler deletes
    // file.path, or a file renamed after a sibling's rejection would be left behind.
    const results = await Promise.allSettled((req.files || []).map(async file => {
      file.detectedType = detectImageType(await readHead(file.path));
      if (!file.detectedType) throw unsupportedMedia();
      const named = file.path.replace(/\.upload$/, ALLOWED_TYPES[file.detectedType]);
      await fs.promises.rename(file.path, named);
      file.path = named;
    }));
    const failed = results.find(r => r.status === 'rejected');
    next(failed ? failed.reason : undefined);
  });
}

module.exports = reportUpload;
