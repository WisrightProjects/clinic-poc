// Purpose: Fetch visit detail and derive per-question view model + progress.
// CRITICAL: questions are at data.template.questions — NOT data.questions.
// Progress is derived from answers array, NEVER from visit.status (AC12).
// Input:  visitId (string|number)
// Output: { items, answeredCount, total, percent, allAnswered, loading, error, reload, visit }

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getVisitDetail } from '../api/visitApi';

export function useQuestionList(visitId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!visitId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getVisitDetail(visitId);
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  // Reload whenever the screen regains focus (handles initial mount AND return-to-screen)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Derive view model — questions live inside template, not top-level
  const questions = data?.template?.questions ?? [];
  const answers = data?.answers ?? [];

  const answeredIds = new Set(answers.map((a) => a.question_id));

  const items = [...questions]
    .sort((a, b) => a.order_index - b.order_index)
    .map((q) => ({
      ...q,
      answered: answeredIds.has(q.id),
      transcript: answers.find((a) => a.question_id === q.id)?.transcript ?? null,
    }));

  const total = items.length;
  // Answered count is derived from answers array — not from visit.status (AC12)
  const answeredCount = items.filter((i) => i.answered).length;
  const percent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
  const allAnswered = total > 0 && answeredCount === total;

  return {
    items,
    answeredCount,
    total,
    percent,
    allAnswered,
    loading,
    error,
    reload: load,
    visit: data?.visit,
  };
}
