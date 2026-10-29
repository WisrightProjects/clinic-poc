// Purpose: CLINIC-027 — the patients seen before on a mobile number, looked up once it is a
// valid 10-digit number: { patients, failed }. [] before that; on an error `failed` is set, so
// the screen can say the check didn't work (it must not look like "no one on this number"); the
// form then works as for a new patient. An answer for a number since changed is dropped.

import { useEffect, useState } from 'react';
import { lookupPatients } from '../api/patientApi';
import { isValidMobile } from '../utils/mobile';

export function usePatientLookup(mobile) {
  const [found, setFound] = useState({ mobile: '', patients: [], failed: false });

  useEffect(() => {
    if (!isValidMobile(mobile)) return undefined;
    let current = true;
    lookupPatients(mobile)
      .then((patients) => current && setFound({ mobile, patients, failed: false }))
      .catch(() => current && setFound({ mobile, patients: [], failed: true }));
    return () => { current = false; };
  }, [mobile]);

  // Only the answer for the number in the box counts.
  return found.mobile === mobile ? found : { patients: [], failed: false };
}
