/*
  # Create auth trigger for profile creation

  1. Description
    - Creates automatic profile record when new user signs up
    - Populates profile with user metadata (firstName, lastName, company)
    - Sets work_email from auth.users.email

  2. New Functions
    - `handle_new_user()` - Trigger function that creates profile on user signup

  3. New Triggers
    - `on_auth_user_created` - Fires after INSERT on auth.users table
*/

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();