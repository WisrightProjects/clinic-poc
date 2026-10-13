'use strict';
// CLINIC-015: the queue's day. "Today" is the clinic's IST day, not the server's UTC day, and
// ?date= must be a real YYYY-MM-DD.

const { clinicToday, parseQueueDate } = require('../utils/queueDate');

describe('clinicToday (IST)', () => {
  test('mid-day IST is the same date', () => {
    expect(clinicToday(new Date('2026-10-13T06:30:00Z'))).toBe('2026-10-13'); // 12:00 IST
  });

  test('just after midnight IST is already the next date (UTC is still the day before)', () => {
    expect(clinicToday(new Date('2026-10-12T18:45:00Z'))).toBe('2026-10-13'); // 00:15 IST
  });

  test('just before midnight IST is still the same date', () => {
    expect(clinicToday(new Date('2026-10-13T18:29:00Z'))).toBe('2026-10-13'); // 23:59 IST
  });

  test('the queue does not switch days at 5:30 am IST', () => {
    expect(clinicToday(new Date('2026-10-13T00:00:00Z'))).toBe('2026-10-13'); // 05:30 IST
    expect(clinicToday(new Date('2026-10-12T23:59:00Z'))).toBe('2026-10-13'); // 05:29 IST
  });
});

describe('parseQueueDate', () => {
  const NOW = new Date('2026-10-13T06:30:00Z');

  test('AC4: no date -> today', () => {
    expect(parseQueueDate(undefined, NOW)).toBe('2026-10-13');
    expect(parseQueueDate('', NOW)).toBe('2026-10-13');
  });

  test('AC4: a valid date is returned as given', () => {
    expect(parseQueueDate('2026-10-10', NOW)).toBe('2026-10-10');
    expect(parseQueueDate('2024-02-29', NOW)).toBe('2024-02-29'); // leap day
  });

  test.each(['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '10-10-2026', '2026-1-1', 'today', '2026-10-10T00:00', ' 2026-10-10'])(
    'rejects %p with 400',
    value => {
      expect(() => parseQueueDate(value, NOW)).toThrow(expect.objectContaining({ code: 'BAD_REQUEST', httpStatus: 400 }));
    }
  );

  test('rejects a repeated ?date= (an array)', () => {
    expect(() => parseQueueDate(['2026-10-10', '2026-10-11'], NOW)).toThrow(expect.objectContaining({ httpStatus: 400 }));
  });
});
