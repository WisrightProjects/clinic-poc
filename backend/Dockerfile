# NOTE: this image builds from the REPO ROOT, not from backend/.
#   build: { context: ., dockerfile: backend/Dockerfile }
#
# server.js boots by requiring '../../db/run-migrations' — the migration runner lives at
# the repo root, outside backend/. With a ./backend build context that file is not in the
# image and the container crashloops on MODULE_NOT_FOUND. The runner also resolves its own
# dotenv/pg from the ROOT package.json, so both dependency trees must be present:
#
#   /app/node_modules          <- root deps (dotenv, pg) for db/run-migrations.js
#   /app/backend/node_modules  <- backend deps (express, multer, ...)
#   /app/db/                   <- migration runner + .sql files
#
FROM node:20-slim

WORKDIR /app

# Root deps first (dotenv + pg) — what db/run-migrations.js resolves against.
COPY package*.json ./
RUN npm ci --omit=dev

# Backend deps in their own layer so a source-only change doesn't reinstall them.
COPY backend/package*.json ./backend/
RUN npm ci --omit=dev --prefix backend

# Sources. The layout must mirror the repo so '../../db/...' resolves from backend/src/.
COPY backend ./backend
COPY db ./db

# Migrations run on boot (server.js) before app.listen.
ENV PORT=4000
EXPOSE 4000

CMD ["node", "backend/src/server.js"]
