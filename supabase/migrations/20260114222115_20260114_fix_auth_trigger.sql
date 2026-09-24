/*
  # Fix auth trigger for profile creation

  1. Changes
    - Fix the handle_new_user function to properly handle metadata
    - Ensure NOT NULL constraint on id column
    - Add better error handling
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN id SET NOT NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, company)
  VALUES (
    new.id,
    COALESCE(new.raw_user_metadata->>'firstName', ''),
    COALESCE(new.raw_user_metadata->>'lastName', ''),
    COALESCE(new.raw_user_metadata->>'company', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    first_name = COALESCE(new.raw_user_metadata->>'firstName', profiles.first_name),
    last_name = COALESCE(new.raw_user_metadata->>'lastName', profiles.last_name),
    company = COALESCE(new.raw_user_metadata->>'company', profiles.company),
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();