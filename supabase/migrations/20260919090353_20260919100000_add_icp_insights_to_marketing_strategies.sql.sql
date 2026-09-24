/*
# Store generated ICP customer insights

1. Modified Tables
- `marketing_strategies`
- Adds `icp_insights` (jsonb, nullable), which stores the generated customer insight groups for the saved strategy.

2. Purpose
- The Ideal customer profiles screen can reuse previously generated insights instead of calling the AI every time the user opens the screen.
- The value belongs to the existing strategy row, so it remains scoped by the existing authenticated-user RLS policies.

3. Security
- No new table or policy is created.
- Existing RLS policies on `marketing_strategies` continue to protect the new column through the parent row.

4. Data Safety
- This is additive only. No existing columns, rows, or values are removed or changed.
*/

ALTER TABLE public.marketing_strategies
  ADD COLUMN IF NOT EXISTS icp_insights jsonb;
