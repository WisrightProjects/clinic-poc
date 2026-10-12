// Purpose: Fetch the patient queue for the Home screen.
// Reloads on every screen focus so a newly-created or updated visit appears the moment
// the attender returns to Home (same pattern as useQuestionList). While Home is focused
// and the app is in the foreground it also refreshes quietly every POLL_MS (no spinner),
// so the alert for a doctor's "send for tests" request shows up within about 10 seconds
// (CLINIC-014 AC2).
// Output: { visits, loading, error, reload }

import { useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getVisits } from '../api/visitApi';

const POLL_MS = 8000;

export function useVisitQueue() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);

  // silent = a background refresh: no spinner, a failed poll keeps what is on screen,
  // and a poll is skipped while the previous request is still running.
  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent && inFlight.current) return;
    inFlight.current = true;
    if (!silent) setLoading(true);
    try {
      const rows = await getVisits();
      setVisits(Array.isArray(rows) ? rows : []);
      setError(null);
    } catch (err) {
      if (!silent) setError(err);
    } finally {
      inFlight.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  // Load when Home gains focus, then poll while it stays focused and the app is active.
  useFocusEffect(
    useCallback(() => {
      let timer = null;
      const start = () => {
        if (!timer) timer = setInterval(() => load({ silent: true }), POLL_MS);
      };
      const stop = () => {
        clearInterval(timer);
        timer = null;
      };

      load();
      start();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          load({ silent: true }); // catch up on what happened while in the background
          start();
        } else {
          stop();
        }
      });
      return () => {
        stop();
        subscription.remove();
      };
    }, [load])
  );

  return { visits, loading, error, reload: load };
}
