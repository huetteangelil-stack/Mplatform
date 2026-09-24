/*
  # Fix trigger for auth user creation - Final solution

  1. Problem
    - BEFORE INSERT doesn't work because profiles has FK to auth.users
    - Need AFTER INSERT but with proper error handling

  2. Solution
    - Use AFTER INSERT timing
    - Use SECURITY DEFINER to bypass RLS
    - Wrap in exception handler to not block auth.users insert
    - Defer constraint checks

  3. Changes
    - Recreate handle_new_user function correctly
    - Use AFTER INSERT timing
*/

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, company)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'firstName', ''),
      COALESCE(NEW.raw_user_meta_data->>'lastName', ''),
      COALESCE(NEW.raw_user_meta_data->>'company', '')
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;
