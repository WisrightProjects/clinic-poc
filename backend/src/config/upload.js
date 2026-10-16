const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('./index');

if (!fs.existsSync(config.audioDir)) {
  fs.mkdirSync(config.audioDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.audioDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.m4a';
    const visitId = String(req.params.id || '').replace(/[^a-zA-Z0-9]/g, '');
    const questionId = String(req.body.questionId || 'unknown').replace(/[^a-zA-Z0-9]/g, '');
    cb(null, `visit-${visitId}-q${questionId}-${Date.now()}${ext}`);
  },
});

// 5 MB per recording: the app caps an answer at 2 minutes (about 1-2 MB), and the server caps
// the file too, so an upload sent around the app can't fill the disk or run up a paid
// transcription. Over the limit → 413 FILE_TOO_LARGE (errorHandler).
module.exports = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
