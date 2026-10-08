/*
# Technology Scraper — add tech_stack column + tech_scrape_quota table

1. New column
- `marketing_strategies.tech_stack` (jsonb, nullable) — stores the detected technology
  stack from the Apify technology scraper, so a saved strategy page doesn't need to
  re-run the scraper on every reload.
2. New table
- `tech_scrape_quota` — per-user daily quota for technology scans, independent from
  `generation_quota` (strategy generation) and `content_generation_quota` (content
  generation) so a burst of tech scrapes can't starve those quotas.
  - `user_id` (uuid, part of composite PK)
  - `day` (date, part of composite PK)
  - `count` (integer, default 0)
3. Security
- RLS enabled on `tech_scrape_quota`.
- Owner-scoped CRUD: each authenticated user can only read/write their own quota rows.
*/

ALTER TABLE marketing_strategies ADD COLUMN IF NOT EXISTS tech_stack jsonb;

CREATE TABLE IF NOT EXISTS tech_scrape_quota (
  user_id uuid NOT NULL,
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE tech_scrape_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tech_scrape_quota" ON tech_scrape_quota;
CREATE POLICY "select_own_tech_scrape_quota"
ON tech_scrape_quota FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tech_scrape_quota" ON tech_scrape_quota;
CREATE POLICY "insert_own_tech_scrape_quota"
ON tech_scrape_quota FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tech_scrape_quota" ON tech_scrape_quota;
CREATE POLICY "update_own_tech_scrape_quota"
ON tech_scrape_quota FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tech_scrape_quota" ON tech_scrape_quota;
CREATE POLICY "delete_own_tech_scrape_quota"
ON tech_scrape_quota FOR DELETE
TO authenticated USING (auth.uid() = user_id);