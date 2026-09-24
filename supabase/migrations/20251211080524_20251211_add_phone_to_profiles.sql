/*
  # Add phone number to profiles table

  1. Modified Tables
    - `profiles`
      - Add `phone_number` column to store the user's phone number
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_number text;
  END IF;
END $$;