// Purpose: Tests before consultation (CLINIC-014), attender side. Backend contract:
//   POST /test-requests/:id/acknowledge  "Informed patient" (attender only). 409 REQUEST_CLOSED
//                                        if the patient is already back from tests.
//   POST /visits/:id/requeue             "Back in queue": the visit returns to 'summarised' with a
//                                        new place at the END of today's queue (queue_date /
//                                        queue_token); the original visit_date and token_number
//                                        are kept. 409 if the visit is not waiting for tests.

import { apiClient } from './client';

export function acknowledgeTestRequest(testRequestId) {
  return apiClient.post(`/test-requests/${testRequestId}/acknowledge`).then((r) => r.data);
}

export function requeueVisit(visitId) {
  return apiClient.post(`/visits/${visitId}/requeue`).then((r) => r.data);
}
