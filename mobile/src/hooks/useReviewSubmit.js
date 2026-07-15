// Purpose: Back the Review & Submit screen (M-04). Loads the visit detail,
// derives the ordered Q&A + completeness, and drives the guarded/idempotent
// submit lifecycle. Reloads on focus so an edit/retake round-trip is reflected.
// Output: { visit, qa, total, answeredCount, allAnswered, summaryText,
//           loading, error, submitState, submitError, submit, reload }

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getVisitDetail, submitVisit } from '../api/visitApi';

export function useReviewSubmit(visitId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitState, setSubmitState] = useState('idle'); // idle | sending | error
  const [submitError, setSubmitError] = useState(null);

  const load = useCallback(async () => {
    if (!visitId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getVisitDetail(visitId));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  // Reload on focus — handles the edit/retake round-trip back to Review (AC6)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Derive ordered Q&A — questions live in template, transcripts in answers
  const questions = data?.template?.questions ?? [];
  const answers = data?.answers ?? [];
  const byQuestion = new Map(answers.map((a) => [a.question_id, a]));
  const qa = [...questions]
    .sort((a, b) => a.order_index - b.order_index)
    .map((q) => ({
      id: q.id,
      text: q.text,
      transcript: byQuestion.get(q.id)?.transcript ?? null,
    }));

  const total = qa.length;
  const answeredCount = qa.filter((q) => q.transcript && q.transcript.trim()).length;
  const allAnswered = total > 0 && answeredCount === total;
  const summaryText = data?.summary?.summary_text ?? null;

  const submit = useCallback(async () => {
    if (submitState === 'sending') return null; // guard double-tap (AC5 client side)
    setSubmitState('sending');
    setSubmitError(null);
    try {
      const res = await submitVisit(visitId); // guarded + idempotent server-side
      await load(); // refresh status + stored summary
      setSubmitState('idle');
      return res;
    } catch (err) {
      setSubmitError(
        err?.response?.data?.error?.message ?? err?.message ?? 'Could not send. Please retry.'
      );
      setSubmitState('error'); // AC9
      return null;
    }
  }, [visitId, submitState, load]);

  return {
    visit: data?.visit,
    qa,
    total,
    answeredCount,
    allAnswered,
    summaryText,
    loading,
    error,
    submitState,
    submitError,
    submit,
    reload: load,
  };
}
