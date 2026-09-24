/*
  # Add work email to profiles table

  1. Modified Tables
    - `profiles`
      - Add `work_email` column to store the user's work email address
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'work_email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN work_email text UNIQUE;
  END IF;
END $$;