-- ============================================================
-- Security fixes
-- ============================================================

-- Fix 1: Remove the always-true INSERT policy on profiles.
-- The handle_new_user() trigger runs as SECURITY DEFINER under
-- a superuser role, so it bypasses RLS automatically and does
-- NOT need a WITH CHECK (true) policy.  Leaving such a policy
-- in place lets any authenticated user INSERT arbitrary rows.
DROP POLICY IF EXISTS "Trigger can create profiles" ON public.profiles;

-- Keep (or recreate) a proper INSERT policy so authenticated
-- users can only create their own profile row.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Fix 2: Revoke SELECT from anon on both tables so the tables
-- are no longer discoverable in the GraphQL schema by the
-- public (unauthenticated) role.
REVOKE SELECT ON public.profiles    FROM anon;
REVOKE SELECT ON public.user_profiles FROM anon;

-- Also revoke the other DML privileges anon should never have.
REVOKE INSERT, UPDATE, DELETE ON public.profiles    FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_profiles FROM anon;

-- Fix 3: Revoke EXECUTE on handle_new_user() from anon and
-- authenticated.  This function must only be called by the
-- internal database trigger, never through the REST/GraphQL API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Explicitly grant EXECUTE only to the trigger's owning role
-- so it can still fire from auth.users.
-- (supabase_auth_admin is the role that owns auth.users triggers)
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- Fix 4: Ensure SELECT RLS policies on profiles are properly
-- scoped so authenticated users can only read their own row.
-- (Keeps the authenticated role's SELECT privilege but ensures
--  every query is filtered through auth.uid() = id.)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Ensure UPDATE is also properly scoped.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
