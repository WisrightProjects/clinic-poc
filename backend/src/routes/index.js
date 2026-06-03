const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const roleGuard = require('../utils/roleGuard');
const healthController = require('../controllers/healthController');
const departmentController = require('../controllers/departmentController');
const templateController = require('../controllers/templateController');
const visitController = require('../controllers/visitController');
const answerController = require('../controllers/answerController');

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/health', wrap(healthController.check));

router.use(roleGuard);

router.get('/departments', wrap(departmentController.list));
router.get('/templates', wrap(templateController.list));
router.put('/templates/:id', wrap(templateController.update));
router.post('/visits', wrap(visitController.create));
router.get('/visits', wrap(visitController.list));
router.get('/visits/:id', wrap(visitController.getById));
router.post('/visits/:id/answers', upload.single('audio'), wrap(answerController.create));
router.patch('/visits/:id/status', wrap(visitController.updateStatus));
router.post('/visits/:id/submit', wrap(visitController.submit));

module.exports = router;
