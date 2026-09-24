/*
  # Fix unique constraint on work_email and update trigger

  1. Changes
    - Remove UNIQUE constraint from work_email column (allows NULL values)
    - Update trigger to populate work_email with auth.users.email
    - Ensure proper handling of NULL metadata fields
*/

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_work_email_key;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, company, work_email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_metadata->>'firstName', ''),
    COALESCE(new.raw_user_metadata->>'lastName', ''),
    COALESCE(new.raw_user_metadata->>'company', ''),
    new.email
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    first_name = COALESCE(new.raw_user_metadata->>'firstName', profiles.first_name),
    last_name = COALESCE(new.raw_user_metadata->>'lastName', profiles.last_name),
    company = COALESCE(new.raw_user_metadata->>'company', profiles.company),
    work_email = COALESCE(new.email, profiles.work_email),
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();