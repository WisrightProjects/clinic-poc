/**
 * CLINIC-017.3 (CR-006): "Test results" on the Back from tests screen are only the photos
 * added after the doctor's request. Tests the pure helper the screen and the report strip use
 * (mobile/src/utils/reports.js), imported directly — no React runtime needed.
 */
import { addedSince } from '../mobile/src/utils/reports';

const REQUESTED = '2026-10-13T09:00:00.000Z';
const intake = (id) => ({ id, created_at: '2026-10-13T08:00:00.000Z' });
const result = (id) => ({ id, created_at: '2026-10-13T09:30:00.000Z' });

describe('addedSince', () => {
  test('AC4: 2 intake photos and no results -> 0 test results', () => {
    expect(addedSince([intake(1), intake(2)], REQUESTED)).toEqual([]);
  });

  test('AC4: 2 intake photos + 1 result -> only the result', () => {
    expect(addedSince([intake(1), intake(2), result(3)], REQUESTED)).toEqual([result(3)]);
  });

  test('a photo taken at the exact request time counts as a result', () => {
    const exact = { id: 4, created_at: REQUESTED };
    expect(addedSince([exact], REQUESTED)).toEqual([exact]);
  });

  test('without a request time every report is returned', () => {
    const all = [intake(1), result(2)];
    expect(addedSince(all, undefined)).toBe(all);
  });

  test('compares times, not strings (different offsets / precision)', () => {
    const r = { id: 5, created_at: '2026-10-13T15:00:00+05:30' }; // 09:30Z
    expect(addedSince([r], '2026-10-13T09:00:00Z')).toEqual([r]);
  });
});
