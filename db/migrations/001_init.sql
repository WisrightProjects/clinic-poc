CREATE TYPE visit_status AS ENUM ('waiting','answering','answered','summarised','done');
CREATE TYPE transcript_status AS ENUM ('pending','done','failed');

CREATE TABLE departments (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE question_templates (
  id            SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  name          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id          SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES question_templates(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  text        TEXT NOT NULL
);

CREATE TABLE visits (
  id            SERIAL PRIMARY KEY,
  token_number  INTEGER NOT NULL,
  patient_name  TEXT NOT NULL,
  age           INTEGER,
  sex           TEXT,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  status        visit_status NOT NULL DEFAULT 'waiting',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE answers (
  id                SERIAL PRIMARY KEY,
  visit_id          INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  question_id       INTEGER NOT NULL REFERENCES questions(id),
  audio_path        TEXT,
  transcript        TEXT,
  transcript_status transcript_status NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visit_id, question_id)
);

CREATE TABLE summaries (
  id           SERIAL PRIMARY KEY,
  visit_id     INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'mock',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
