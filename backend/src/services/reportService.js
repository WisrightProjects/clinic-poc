const fs = require('fs');
const path = require('path');
const config = require('../config');
const reportRepository = require('../repositories/reportRepository');
const visitService = require('./visitService');
const statusEngine = require('./statusEngine');
const { AppError } = require('../utils/errors');
const { remainingReportSlots, MAX_REPORTS_PER_VISIT, tooManyReports } = require('../utils/reportValidation');

function assertEditable(status) {
  if (!statusEngine.canEditReports(status)) {
    throw new AppError('REPORTS_LOCKED', 'Reports cannot be changed after the visit is submitted', 409);
  }
}

// Runs BEFORE the upload is read: the visit must be in the caller's clinic (404),
// still open (409) and not full (422). Returns how many files it may still take.
async function prepareUpload(clinicId, visitId) {
  const visit = await visitService.findVisit(clinicId, visitId);
  assertEditable(visit.status);
  return { visit, slots: remainingReportSlots(await reportRepository.countByVisitId(visit.id)) };
}

// files: saved by reportUpload, each with detectedType. On any rejection the
// errorHandler deletes them; once rows reference them they are marked stored.
async function addReports(visit, files, userId) {
  if (!files || files.length === 0) {
    throw new AppError('BAD_REQUEST', 'Attach at least one image in the "report" field', 400);
  }
  const rows = files.map(f => ({
    path: path.relative(config.reportsDir, f.path), mimeType: f.detectedType, size: f.size,
  }));
  // prepareUpload checked these before the upload; check again at insert time in case
  // another upload or a submit happened while this one was streaming.
  const reports = await reportRepository.createMany(visit.id, userId, rows, (status, existing) => {
    assertEditable(status);
    if (existing + files.length > MAX_REPORTS_PER_VISIT) throw tooManyReports();
  });
  files.forEach(f => { f.stored = true; });
  return reports;
}

async function listReports(clinicId, visitId) {
  const visit = await visitService.findVisit(clinicId, visitId);
  return reportRepository.findByVisitId(visit.id);
}

// Own clinic only (AC3); includes file_path and mime_type for serving.
async function findReport(clinicId, id) {
  const report = await reportRepository.findByIdForClinic(clinicId, id);
  if (!report) throw new AppError('NOT_FOUND', 'Report not found', 404);
  return report;
}

async function deleteReport(clinicId, id) {
  const report = await findReport(clinicId, id);
  assertEditable(report.visit_status);
  await reportRepository.remove(report.id);
  fs.promises.unlink(path.join(config.reportsDir, report.file_path)).catch(() => {});
}

module.exports = { prepareUpload, addReports, listReports, findReport, deleteReport };
