const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const { createAuthenticate, requireRole } = require('../utils/auth');
const authService = require('../services/authService');
const authController = require('../controllers/authController');
const healthController = require('../controllers/healthController');
const departmentController = require('../controllers/departmentController');
const templateController = require('../controllers/templateController');
const visitController = require('../controllers/visitController');
const answerController = require('../controllers/answerController');

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
// Only the doctor web calls this (to mark done). If attenders ever need PATCH
// transitions, put the allowed role per transition in statusEngine, not here.
router.patch('/visits/:id/status', requireRole('doctor'), wrap(visitController.updateStatus));
router.post('/visits/:id/submit', wrap(visitController.submit));
router.get('/answers/:id/audio', wrap(answerController.audio));

module.exports = router;
