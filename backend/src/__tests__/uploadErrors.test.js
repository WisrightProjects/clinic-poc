'use strict';
// errorHandler turns multer's limit errors into the API's error shape (413 / 400) instead of
// a 500, for every upload route. Pure: a fake res, no server.

const multer = require('multer');
const { errorHandler } = require('../utils/errors');

function run(err) {
  const res = { statusCode: 0, body: null, set: jest.fn() };
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.body = body; return res; };
  errorHandler(err, {}, res, () => {});
  return res;
}

test('a file over the route limit is 413 FILE_TOO_LARGE', () => {
  const res = run(new multer.MulterError('LIMIT_FILE_SIZE', 'audio'));
  expect(res.statusCode).toBe(413);
  expect(res.body.error.code).toBe('FILE_TOO_LARGE');
});

test('any other multer error (e.g. an unexpected field) is 400 BAD_REQUEST, not a 500', () => {
  const res = run(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'recording'));
  expect(res.statusCode).toBe(400);
  expect(res.body.error.code).toBe('BAD_REQUEST');
});
