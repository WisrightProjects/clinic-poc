-- Speeds up the per-row summary_excerpt lookup in visitRepository.list(): for
-- every visit on GET /visits it selects the latest summary by visit_id ordered
-- by created_at. Without an index that is a sequential scan of `summaries` per
-- row, on an endpoint the web dashboard polls every 5s. Index by (visit_id,
-- created_at DESC) so the lookup is a cheap index seek. Forward-only, idempotent.
CREATE INDEX IF NOT EXISTS idx_summaries_visit_created
  ON summaries (visit_id, created_at DESC);
