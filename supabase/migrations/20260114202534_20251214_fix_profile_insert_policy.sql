/*
  # Fix profile insert policy for auth trigger

  1. Modified Tables
    - `profiles`
      - Add service role policy for INSERT to allow the auth trigger to insert profiles
      - The trigger runs with SECURITY DEFINER, needing proper permissions
*/

CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  TO service_role
  WITH CHECK (true);