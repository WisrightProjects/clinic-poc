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
    const questionId = req.body.questionId || 'unknown';
    cb(null, `visit-${req.params.id}-q${questionId}-${Date.now()}${ext}`);
  },
});

module.exports = multer({ storage });
