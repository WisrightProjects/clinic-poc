import { apiClient } from './client';

export const getTemplateByDepartment = (departmentId) =>
  apiClient.get('/templates', { params: { departmentId } }).then((r) => r.data);

export const saveTemplateQuestions = (templateId, questions) =>
  apiClient.put(`/templates/${templateId}`, { questions }).then((r) => r.data);

export const getDepartments = () =>
  apiClient.get('/departments').then((r) => r.data);
