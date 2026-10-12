// Tests for backend/src/utils/reportValidation.js (CLINIC-011 AC2).
// Pure logic only — no config/DB/network — mirrors visitValidation.test.js style.

const {
  detectImageType, remainingReportSlots, MAX_REPORTS_PER_VISIT, ALLOWED_TYPES,
} = require('../utils/reportValidation');

const pad = bytes => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

describe('AC2: detectImageType (by file content, not the claimed type)', () => {
  test.each([
    ['image/jpeg', pad([0xff, 0xd8, 0xff, 0xe0])],
    ['image/png', pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['image/webp', Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'binary')],
  ])('detects %s, which is an allowed upload type', (type, buf) => {
    expect(detectImageType(buf)).toBe(type);
    expect(ALLOWED_TYPES[type]).toBeDefined();
  });

  test.each([
    ['PDF', Buffer.from('%PDF-1.7 xxxxxxxx')],
    ['HTML named .png', Buffer.from('<html><script>x')],
    ['GIF', Buffer.from('GIF89a xxxxxxxxx')],
    ['RIFF but not WEBP (WAV)', Buffer.from('RIFF\x00\x00\x00\x00WAVEfmt ', 'binary')],
    ['too short', Buffer.from([0xff, 0xd8])],
    ['empty', Buffer.alloc(0)],
  ])('rejects %s', (_name, buf) => expect(detectImageType(buf)).toBeNull());
});

describe(`AC2: remainingReportSlots (max ${MAX_REPORTS_PER_VISIT} per visit)`, () => {
  test('returns how many more a visit can take', () => {
    expect(remainingReportSlots(0)).toBe(MAX_REPORTS_PER_VISIT);
    expect(remainingReportSlots(MAX_REPORTS_PER_VISIT - 1)).toBe(1);
  });
  test('a full visit is rejected with 422 TOO_MANY_REPORTS', () => {
    expect(() => remainingReportSlots(MAX_REPORTS_PER_VISIT))
      .toThrow(expect.objectContaining({ code: 'TOO_MANY_REPORTS', httpStatus: 422 }));
  });
});
