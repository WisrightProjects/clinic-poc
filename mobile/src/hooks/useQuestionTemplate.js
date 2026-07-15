import { useCallback, useState } from 'react';
import { getTemplateByDepartment, saveTemplateQuestions } from '../api/templates.api';
import { isQuestionValid } from '../utils/questionValidation';

export function useQuestionTemplate() {
  const [templateId, setTemplateId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | saving | error

  const load = useCallback(async (departmentId) => {
    setStatus('loading');
    try {
      const t = await getTemplateByDepartment(departmentId);
      setTemplateId(t.id);
      setQuestions(
        t.questions.map((q) => ({ key: String(q.id), id: q.id, text: q.text }))
      );
      setStatus('idle');
    } catch {
      setStatus('error');
      throw new Error('Could not load template');
    }
  }, []);

  const addQuestion = () =>
    setQuestions((qs) => [...qs, { key: `new-${Date.now()}`, text: '' }]);

  const editQuestion = (key, text) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, text } : q)));

  const deleteQuestion = (key) =>
    setQuestions((qs) => qs.filter((q) => q.key !== key));

  const reorder = (next) => setQuestions(next);

  const canSave =
    questions.length > 0 && questions.every((q) => isQuestionValid(q.text));

  const save = useCallback(async () => {
    if (!templateId) return false;
    setStatus('saving');
    const payload = questions.map((q, i) => ({
      id: q.id,
      text: q.text.trim(),
      order_index: i,
    }));
    try {
      const saved = await saveTemplateQuestions(templateId, payload);
      setQuestions(
        saved.questions.map((q) => ({ key: String(q.id), id: q.id, text: q.text }))
      );
      setStatus('idle');
      return true;
    } catch {
      setStatus('error');
      return false;
    }
  }, [templateId, questions]);

  return {
    questions,
    status,
    canSave,
    load,
    addQuestion,
    editQuestion,
    deleteQuestion,
    reorder,
    save,
  };
}
