// Purpose: the Save step shared by the answer screens (typed text, tap choices, vitals): runs
// the save, goes back to the intake list (which reloads on focus) on success, and keeps the
// screen with an error message on failure so the attender can retry. fieldErrors: the
// server's per-field messages (CLINIC-024), to show under each field.
// Output: { saving, error, fieldErrors, save(saveFn) }

import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { errorMessage, fieldErrorsOf, CHECK_FIELDS_MESSAGE } from '../utils/apiError';

export function useSaveAnswer() {
  const navigation = useNavigation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  async function save(saveFn, failMessage = 'Could not save the answer. Please retry.') {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      await saveFn();
      navigation.goBack();
    } catch (err) {
      const fields = fieldErrorsOf(err);
      setFieldErrors(fields);
      setError(Object.keys(fields).length ? CHECK_FIELDS_MESSAGE : errorMessage(err, failMessage));
      setSaving(false);
    }
  }

  return { saving, error, fieldErrors, save };
}
