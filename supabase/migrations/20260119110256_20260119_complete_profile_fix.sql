/*
  # Complete profile creation fix

  1. Description
    - Drop and recreate the trigger function to properly handle profile creation
    - Update RLS policy to allow trigger execution
    - Ensure automatic profile creation works on signup

  2. Changes
    - Drop existing trigger
    - Drop and recreate handle_new_user function
    - Create proper INSERT policy for unauthenticated trigger execution
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

DROP POLICY IF EXISTS "Allow INSERT via trigger" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Allow trigger to create profiles"
  ON profiles
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);