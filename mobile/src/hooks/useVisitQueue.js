// Purpose: Fetch today's patient queue for the Home screen.
// Reloads on every screen focus so a newly-created or updated visit appears
// the moment the attender returns to Home (same pattern as useQuestionList).
// Output: { visits, loading, error, reload }

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getVisits } from '../api/visitApi';

export function useVisitQueue() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getVisits();
      setVisits(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever Home regains focus (initial mount AND return-to-screen)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { visits, loading, error, reload: load };
}
