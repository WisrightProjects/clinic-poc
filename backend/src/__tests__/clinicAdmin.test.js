// CLINIC-008.6 — pure helpers behind scripts/clinic-admin.mjs (no DB).
const { generatePassword, parseUserArg } = require('../../../scripts/clinic-admin-lib');

describe('generatePassword', () => {
  test('is 10 characters from an unambiguous alphabet (no 0/O, 1/l/I)', () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePassword()).toMatch(/^[A-HJ-NP-Za-km-z2-9]{10}$/);
    }
  });

  test('does not repeat across calls', () => {
    const seen = new Set(Array.from({ length: 200 }, generatePassword));
    expect(seen.size).toBe(200);
  });
});

describe('parseUserArg', () => {
  test('splits "Name:mobile"', () => {
    expect(parseUserArg('--doctor', 'Dr. Ramesh:9876543210')).toEqual({ name: 'Dr. Ramesh', mobile: '9876543210' });
  });

  test('normalises the mobile number', () => {
    expect(parseUserArg('--attender', 'Priya:+91 98765 00000').mobile).toBe('9876500000');
  });

  test('splits on the last colon so names may contain one', () => {
    expect(parseUserArg('--doctor', 'Dr. A: B:9876543210')).toEqual({ name: 'Dr. A: B', mobile: '9876543210' });
  });

  test.each([
    ['no colon', 'Dr Ramesh'],
    ['empty name', ':9876543210'],
    ['bad mobile', 'Dr. Ramesh:12345'],
    ['mobile starting with 5', 'Dr. Ramesh:5876543210'],
    ['not a string', undefined],
  ])('rejects %s', (_label, value) => {
    expect(() => parseUserArg('--doctor', value)).toThrow(/--doctor must look like/);
  });
});
