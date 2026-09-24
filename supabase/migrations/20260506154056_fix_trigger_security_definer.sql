/*
  # Fix trigger with proper SECURITY DEFINER

  The trigger function needs SECURITY DEFINER set to postgres (superuser) to properly 
  access auth.users and insert into profiles without RLS restrictions.
*/

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, company)
  VALUES (
    new.id,
    new.raw_user_metadata->>'firstName',
    new.raw_user_metadata->>'lastName',
    new.raw_user_metadata->>'company'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
