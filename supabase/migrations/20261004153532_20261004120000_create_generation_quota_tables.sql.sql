/*
# Create generation quota tables

1. New Tables
- `generation_quota` — tracks daily generation count per subject (logged-in user or anonymous IP) for the generate-strategy edge function.
  - `subject` (text, not null) — 'user:<uuid>' for authenticated calls, 'ip:<address>' for anonymous calls.
  - `day` (date, not null) — the calendar day the quota applies to.
  - `count` (integer, not null, default 0) — number of generations consumed that day.
  - Primary key: (subject, day).
- `content_generation_quota` — tracks daily content generation count per authenticated user for the generate-content edge function.
  - `user_id` (uuid, not null) — the authenticated user's ID.
  - `day` (date, not null) — the calendar day the quota applies to.
  - `count` (integer, not null, default 0) — number of content generations consumed that day.
  - Primary key: (user_id, day).

2. Security
- Both tables are accessed only server-side by edge functions using the service role key (which bypasses RLS).
- RLS is enabled on both tables to lock them down from direct anon/authenticated client access.
- No policies are added — all access is via the service role key from edge functions only.

3. Notes
- These tables are write-heavy (upsert on every generation call).
- Idempotent: uses IF NOT EXISTS so re-running is safe.
*/

CREATE TABLE IF NOT EXISTS generation_quota (
  subject text NOT NULL,
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (subject, day)
);

ALTER TABLE generation_quota ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS content_generation_quota (
  user_id uuid NOT NULL,
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE content_generation_quota ENABLE ROW LEVEL SECURITY;
