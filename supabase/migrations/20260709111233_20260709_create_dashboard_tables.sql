/*
# Dashboard Tables: businesses, marketing_strategies, content_tasks

## Summary
Creates 3 tables to power the user dashboard (My businesses, Marketing strategies, Content creation).

## New Tables

### `businesses`
Stores businesses registered by authenticated users.
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, DEFAULT auth.uid())
- `name` (text) — business display name
- `website` (text) — domain or URL
- `business_model` (text) — B2B or B2C
- `company_age` (text) — age range
- `team_size` (text) — team size range
- `geographic_market` (text) — target country/market
- `created_at` (timestamptz)

### `marketing_strategies`
Stores AI-generated marketing strategy results, linked to a business.
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, DEFAULT auth.uid())
- `business_id` (uuid, FK → businesses, nullable)
- `business_name` (text) — denormalized for display
- `website` (text) — denormalized for display
- `strategy_data` (jsonb) — full AI strategy response
- `created_at` (timestamptz)

### `content_tasks`
Stores content creation tasks linked to a business.
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, DEFAULT auth.uid())
- `business_id` (uuid, FK → businesses, nullable)
- `task_name` (text)
- `topic` (text)
- `content` (text) — generated or written content
- `status` (text) — pending / in_progress / done
- `created_at` (timestamptz)

## Security
- RLS enabled on all 3 tables.
- 4 separate per-verb policies on each table, scoped TO authenticated.
- Users can only access their own rows (auth.uid() = user_id).
- user_id defaults to auth.uid() so clients can omit it on insert.
*/

-- ─────────────────────────────────────────────
-- businesses
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  website text NOT NULL,
  business_model text DEFAULT '',
  company_age text DEFAULT '',
  team_size text DEFAULT '',
  geographic_market text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_businesses" ON public.businesses;
CREATE POLICY "select_own_businesses" ON public.businesses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_businesses" ON public.businesses;
CREATE POLICY "insert_own_businesses" ON public.businesses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_businesses" ON public.businesses;
CREATE POLICY "update_own_businesses" ON public.businesses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_businesses" ON public.businesses;
CREATE POLICY "delete_own_businesses" ON public.businesses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- marketing_strategies
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  business_name text NOT NULL DEFAULT '',
  website text DEFAULT '',
  strategy_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.marketing_strategies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_strategies" ON public.marketing_strategies;
CREATE POLICY "select_own_strategies" ON public.marketing_strategies FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_strategies" ON public.marketing_strategies;
CREATE POLICY "insert_own_strategies" ON public.marketing_strategies FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_strategies" ON public.marketing_strategies;
CREATE POLICY "update_own_strategies" ON public.marketing_strategies FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_strategies" ON public.marketing_strategies;
CREATE POLICY "delete_own_strategies" ON public.marketing_strategies FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- content_tasks
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  task_name text NOT NULL,
  topic text DEFAULT '',
  content text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.content_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_content_tasks" ON public.content_tasks;
CREATE POLICY "select_own_content_tasks" ON public.content_tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_content_tasks" ON public.content_tasks;
CREATE POLICY "insert_own_content_tasks" ON public.content_tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_content_tasks" ON public.content_tasks;
CREATE POLICY "update_own_content_tasks" ON public.content_tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_content_tasks" ON public.content_tasks;
CREATE POLICY "delete_own_content_tasks" ON public.content_tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- indexes for frequent lookups
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON public.businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_strategies_user_id ON public.marketing_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_strategies_business_id ON public.marketing_strategies(business_id);
CREATE INDEX IF NOT EXISTS idx_content_tasks_user_id ON public.content_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_content_tasks_business_id ON public.content_tasks(business_id);
