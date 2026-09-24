/*
  # Fix profile trigger permissions

  The trigger function needs proper permissions to insert profiles when a new user is created.
  This migration removes overly restrictive policies and adds a proper trigger execution policy.
*/

DROP POLICY IF EXISTS "Allow trigger to create profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Trigger can create profiles"
  ON profiles
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
