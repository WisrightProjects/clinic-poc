// Purpose: the Save step shared by the answer screens (typed text, tap choices): runs the
// save, goes back to the intake list (which reloads on focus) on success, and keeps the
// screen with an error message on failure so the attender can retry.
// Output: { saving, error, save(saveFn) }

import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { errorMessage } from '../utils/apiError';

export function useSaveAnswer() {
  const navigation = useNavigation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save(saveFn) {
    setSaving(true);
    setError(null);
    try {
      await saveFn();
      navigation.goBack();
    } catch (err) {
      setError(errorMessage(err, 'Could not save the answer. Please retry.'));
      setSaving(false);
    }
  }

  return { saving, error, save };
}
