// Purpose: Serve a private stored upload (answer recordings, report photos).
// `root` keeps relPath inside its folder (send refuses '..'); nosniff makes the
// browser trust the given type. Headers are passed to sendFile so they are only
// sent with the file, never with the 404 JSON. A missing file is 404.
//
// immutable: true only when the URL always means the same file (a report photo).
// An answer's audio URL is reused when the question is re-recorded, so it must
// be revalidated (no-cache + ETag) or the browser would replay the old recording.

const { AppError } = require('./errors');

function sendStoredFile(res, next, root, relPath, { contentType, immutable, notFoundMessage }) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': immutable ? 'private, max-age=31536000, immutable' : 'private, no-cache',
  };
  if (contentType) headers['Content-Type'] = contentType;
  res.sendFile(relPath, { root, headers, cacheControl: false }, err => {
    if (err && !res.headersSent) next(new AppError('NOT_FOUND', notFoundMessage, 404));
  });
}

module.exports = { sendStoredFile };
