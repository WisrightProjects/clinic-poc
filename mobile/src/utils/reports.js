// Report photos added since a moment (CLINIC-017.3): the "Test results" on the Back from tests
// screen are only the photos taken after the doctor's request; older photos are the intake
// reports. created_at and since are the server's ISO timestamps. Without `since`, all reports.
export const addedSince = (reports, since) =>
  since ? reports.filter((r) => new Date(r.created_at) >= new Date(since)) : reports;
