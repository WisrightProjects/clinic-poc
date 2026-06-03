const templateRepository = require('../repositories/templateRepository');
const { AppError } = require('../utils/errors');

async function getByDepartment(departmentId) {
  if (!departmentId) throw new AppError('BAD_REQUEST', 'departmentId is required', 400);
  const template = await templateRepository.findActiveByDepartmentId(departmentId);
  if (!template) throw new AppError('NOT_FOUND', 'No active template for this department', 404);
  return template;
}

async function update(id, questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new AppError('BAD_REQUEST', 'questions must be a non-empty array', 400);
  }
  const template = await templateRepository.findById(id);
  if (!template) throw new AppError('NOT_FOUND', 'Template not found', 404);
  return templateRepository.updateQuestions(id, questions);
}

module.exports = { getByDepartment, update };
