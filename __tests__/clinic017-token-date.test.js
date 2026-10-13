/**
 * CLINIC-017.4 (CR-007): a patient waiting for tests shows the day their token is from, so two
 * "Token 1" from different days are never confused. Tests the pure helper both apps use
 * (oldTokenDay in mobile/src/utils/queue.js, mirrored in frontend/src/utils/queue.js).
 */
import { oldTokenDay } from '../mobile/src/utils/queue';

const TODAY = '2026-10-13';
const visit = (status, queue_date) => ({ status, queue_date, queue_token: 1 });

describe('oldTokenDay', () => {
  test('AC5: Ravi queued 12 Oct, now waiting for tests on 13 Oct -> 2026-10-12', () => {
    expect(oldTokenDay(visit('tests_requested', '2026-10-12'), TODAY)).toBe('2026-10-12');
  });

  test('the API sends queue_date as a timestamp; only the day is used', () => {
    expect(oldTokenDay(visit('tests_requested', '2026-10-12T00:00:00.000Z'), TODAY)).toBe('2026-10-12');
  });

  test('waiting for tests but queued today -> no date', () => {
    expect(oldTokenDay(visit('tests_requested', '2026-10-13'), TODAY)).toBeNull();
  });

  test.each(['waiting', 'answering', 'answered', 'summarised', 'done'])(
    'a patient in the day queue (%s) never gets a date added',
    (status) => {
      expect(oldTokenDay(visit(status, '2026-10-12'), TODAY)).toBeNull();
    }
  );
});
