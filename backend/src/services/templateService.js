const templateRepository = require('../repositories/templateRepository');
const { AppError } = require('../utils/errors');
const { validateQuestions } = require('../utils/questionValidation');

async function getByDepartment(clinicId, departmentId) {
  if (!departmentId) throw new AppError('BAD_REQUEST', 'departmentId is required', 400);
  const template = await templateRepository.findActiveByDepartmentId(clinicId, departmentId);
  if (!template) throw new AppError('NOT_FOUND', 'No active template for this department', 404);
  return template;
}

// Another clinic's template is NOT_FOUND, so each clinic only edits its own (AC7).
async function update(clinicId, id, questions) {
  validateQuestions(questions);
  const template = await templateRepository.findById(clinicId, id);
  if (!template) throw new AppError('NOT_FOUND', 'Template not found', 404);
  return templateRepository.updateQuestions(clinicId, template.id, questions);
}

module.exports = { getByDepartment, update };
