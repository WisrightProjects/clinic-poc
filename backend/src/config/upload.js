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

module.exports = multer({ storage });
