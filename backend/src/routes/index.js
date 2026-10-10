const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const reportUpload = require('../config/reportUpload');
const { createAuthenticate, requireRole } = require('../utils/auth');
const authService = require('../services/authService');
const authController = require('../controllers/authController');
const healthController = require('../controllers/healthController');
const departmentController = require('../controllers/departmentController');
const templateController = require('../controllers/templateController');
const visitController = require('../controllers/visitController');
const answerController = require('../controllers/answerController');
const reportController = require('../controllers/reportController');

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/health', wrap(healthController.check));

router.post('/auth/login', wrap(authController.login));

// Everything below needs a valid login token. The old x-role header is ignored.
router.use(wrap(createAuthenticate(authService.authenticateToken)));

router.get('/auth/me', wrap(authController.me));

router.get('/departments', wrap(departmentController.list));
router.get('/templates', wrap(templateController.list));
router.put('/templates/:id', wrap(templateController.update));
router.post('/visits', wrap(visitController.create));
router.get('/visits', wrap(visitController.list));
router.get('/visits/:id', wrap(visitController.getById));
router.post('/visits/:id/answers', upload.single('audio'), wrap(answerController.create));
// Doctor marks a visit done (the only status this route sets; see visitService).
router.patch('/visits/:id/status', requireRole('doctor'), wrap(visitController.updateStatus));
router.post('/visits/:id/submit', wrap(visitController.submit));
router.get('/answers/:id/audio', wrap(answerController.audio));
// Previous-report photos (CLINIC-011), multipart field "report" (one or more images).
// prepareUpload checks the visit (clinic, open, not full) before any file is written.
router.post('/visits/:id/reports', requireRole('attender'), wrap(reportController.prepareUpload), reportUpload, wrap(reportController.add));
router.get('/visits/:id/reports', wrap(reportController.list));
router.get('/reports/:id/file', wrap(reportController.file));
router.delete('/reports/:id', requireRole('attender'), wrap(reportController.remove));

module.exports = router;
