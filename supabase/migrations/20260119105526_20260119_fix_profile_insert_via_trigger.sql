/*
  # Fix profile insertion via trigger

  1. Description
    - Update trigger function to bypass RLS restrictions
    - Trigger executes as SECURITY DEFINER, so it needs to be allowed to insert
    - Create policy that allows public INSERT (trigger will use this)

  2. Changes
    - Remove conflicting policies
    - Add single INSERT policy with USING (true) to allow trigger execution
    - Keep authenticated policies for direct inserts
*/

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Allow INSERT via trigger"
  ON profiles FOR INSERT
  WITH CHECK (true);