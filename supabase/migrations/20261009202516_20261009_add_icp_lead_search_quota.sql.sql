/*
# ICP Lead Search — create icp_lead_search_quota table

1. New table
- `icp_lead_search_quota` — per-user daily quota for Clay people searches, independent
  from other quotas (Clay search runs have a real cost).
  - `user_id` (uuid, part of composite PK)
  - `day` (date, part of composite PK)
  - `count` (integer, default 0)
2. Security
- RLS enabled on `icp_lead_search_quota`.
- Owner-scoped CRUD: each authenticated user can only read/write their own quota rows.
*/

CREATE TABLE IF NOT EXISTS icp_lead_search_quota (
  user_id uuid NOT NULL,
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE icp_lead_search_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_icp_lead_search_quota" ON icp_lead_search_quota;
CREATE POLICY "select_own_icp_lead_search_quota"
ON icp_lead_search_quota FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_icp_lead_search_quota" ON icp_lead_search_quota;
CREATE POLICY "insert_own_icp_lead_search_quota"
ON icp_lead_search_quota FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_icp_lead_search_quota" ON icp_lead_search_quota;
CREATE POLICY "update_own_icp_lead_search_quota"
ON icp_lead_search_quota FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_icp_lead_search_quota" ON icp_lead_search_quota;
CREATE POLICY "delete_own_icp_lead_search_quota"
ON icp_lead_search_quota FOR DELETE
TO authenticated USING (auth.uid() = user_id);