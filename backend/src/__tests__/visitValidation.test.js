// Tests for backend/src/utils/visitValidation.js
// Covers AC9 (server-side field validation) and AC12 (validation is field-based, not status-based)

const { validateNewVisit } = require('../utils/visitValidation');

describe('AC9: validateNewVisit — server-side field validation', () => {
  // ---- valid inputs ----

  test('accepts a fully valid payload and returns normalised data', () => {
    const result = validateNewVisit({
      patientName: '  Lakshmi K.  ',
      age: 35,
      sex: 'F',
      departmentId: 1,
    });
    expect(result).toEqual({
      patientName: 'Lakshmi K.',
      age: 35,
      sex: 'F',
      departmentId: 1,
    });
  });

  test('accepts payload with age and sex omitted (optional fields)', () => {
    const result = validateNewVisit({
      patientName: 'Ravi',
      age: null,
      sex: null,
      departmentId: 2,
    });
    expect(result.patientName).toBe('Ravi');
    expect(result.age).toBeNull();
    expect(result.sex).toBeNull();
  });

  test('accepts payload with age = 0 (boundary)', () => {
    const result = validateNewVisit({
      patientName: 'Baby',
      age: 0,
      sex: 'M',
      departmentId: 1,
    });
    expect(result.age).toBe(0);
  });

  test('accepts payload with age = 120 (boundary)', () => {
    const result = validateNewVisit({
      patientName: 'Elder',
      age: 120,
      sex: 'O',
      departmentId: 1,
    });
    expect(result.age).toBe(120);
  });

  // ---- blank / missing patientName ----

  test('throws when patientName is empty string', () => {
    expect(() =>
      validateNewVisit({ patientName: '', age: 30, sex: 'M', departmentId: 1 })
    ).toThrow();
  });

  test('throws when patientName is whitespace only', () => {
    expect(() =>
      validateNewVisit({ patientName: '   ', age: 30, sex: 'M', departmentId: 1 })
    ).toThrow();
  });

  test('throws when patientName is missing (undefined)', () => {
    expect(() =>
      validateNewVisit({ patientName: undefined, age: 30, sex: 'M', departmentId: 1 })
    ).toThrow();
  });

  test('error for blank patientName includes field key "patientName"', () => {
    let thrown;
    try {
      validateNewVisit({ patientName: '', age: 30, sex: 'M', departmentId: 1 });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeDefined();
    expect(thrown.fields).toBeDefined();
    expect(thrown.fields.patientName).toBeDefined();
  });

  // ---- missing departmentId ----

  test('throws when departmentId is null', () => {
    expect(() =>
      validateNewVisit({ patientName: 'Ravi', age: 30, sex: 'M', departmentId: null })
    ).toThrow();
  });

  test('throws when departmentId is undefined', () => {
    expect(() =>
      validateNewVisit({ patientName: 'Ravi', age: 30, sex: 'M', departmentId: undefined })
    ).toThrow();
  });

  test('error for missing departmentId includes field key "departmentId"', () => {
    let thrown;
    try {
      validateNewVisit({ patientName: 'Ravi', age: 30, sex: 'M', departmentId: null });
    } catch (err) {
      thrown = err;
    }
    expect(thrown.fields.departmentId).toBeDefined();
  });

  // ---- age out of range ----

  test('throws when age is -1 (below 0)', () => {
    expect(() =>
      validateNewVisit({ patientName: 'Ravi', age: -1, sex: 'M', departmentId: 1 })
    ).toThrow();
  });

  test('throws when age is 121 (above 120)', () => {
    expect(() =>
      validateNewVisit({ patientName: 'Ravi', age: 121, sex: 'M', departmentId: 1 })
    ).toThrow();
  });

  test('error for out-of-range age includes field key "age"', () => {
    let thrown;
    try {
      validateNewVisit({ patientName: 'Ravi', age: 200, sex: 'M', departmentId: 1 });
    } catch (err) {
      thrown = err;
    }
    expect(thrown.fields.age).toBeDefined();
  });

  test('does NOT throw when age is not provided (undefined) — age is optional', () => {
    expect(() =>
      validateNewVisit({ patientName: 'Ravi', age: undefined, sex: 'M', departmentId: 1 })
    ).not.toThrow();
  });

  // ---- invalid sex ----

  test('throws when sex is an unrecognised value', () => {
    expect(() =>
      validateNewVisit({ patientName: 'Ravi', age: 30, sex: 'X', departmentId: 1 })
    ).toThrow();
  });

  test('error for invalid sex includes field key "sex"', () => {
    let thrown;
    try {
      validateNewVisit({ patientName: 'Ravi', age: 30, sex: 'Z', departmentId: 1 });
    } catch (err) {
      thrown = err;
    }
    expect(thrown.fields.sex).toBeDefined();
  });

  test('does NOT throw when sex is empty string (not provided)', () => {
    // sex is optional — empty string means "not provided"
    expect(() =>
      validateNewVisit({ patientName: 'Ravi', age: 30, sex: '', departmentId: 1 })
    ).not.toThrow();
  });

  // ---- multiple errors at once ----

  test('collects multiple field errors in one throw', () => {
    let thrown;
    try {
      validateNewVisit({ patientName: '', age: 999, sex: 'X', departmentId: null });
    } catch (err) {
      thrown = err;
    }
    expect(thrown.fields.patientName).toBeDefined();
    expect(thrown.fields.age).toBeDefined();
    expect(thrown.fields.sex).toBeDefined();
    expect(thrown.fields.departmentId).toBeDefined();
  });

  // ---- error shape (AC9 requires 400 response) ----

  test('thrown error has httpStatus 400', () => {
    let thrown;
    try {
      validateNewVisit({ patientName: '', departmentId: null });
    } catch (err) {
      thrown = err;
    }
    expect(thrown.httpStatus).toBe(400);
  });

  test('thrown error has code VALIDATION_ERROR', () => {
    let thrown;
    try {
      validateNewVisit({ patientName: '', departmentId: null });
    } catch (err) {
      thrown = err;
    }
    expect(thrown.code).toBe('VALIDATION_ERROR');
  });

  // ---- POST /api/visits is NOT called on invalid input (enforced by service layer) ----
  // The fact that validateNewVisit throws before any DB call happens is the unit-testable
  // proxy for "POST /api/visits is not called until fields are valid" (AC9).
});
