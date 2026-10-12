const config = require('../config');
const reportService = require('../services/reportService');
const { sendStoredFile } = require('../utils/sendStoredFile');

// Runs before reportUpload so a rejected visit never writes files to disk.
async function prepareUpload(req, _res, next) {
  const { visit, slots } = await reportService.prepareUpload(req.user.clinicId, req.params.id);
  req.visit = visit;
  req.reportSlots = slots;
  next();
}

async function add(req, res) {
  const reports = await reportService.addReports(req.visit, req.files, req.user.id);
  res.status(201).json(reports);
}

async function list(req, res) {
  res.json(await reportService.listReports(req.user.clinicId, req.params.id));
}

async function file(req, res, next) {
  const report = await reportService.findReport(req.user.clinicId, req.params.id);
  sendStoredFile(res, next, config.reportsDir, report.file_path, {
    contentType: report.mime_type, immutable: true, notFoundMessage: 'Report not found',
  });
}

async function remove(req, res) {
  await reportService.deleteReport(req.user.clinicId, req.params.id);
  res.status(204).end();
}

module.exports = { prepareUpload, add, list, file, remove };
