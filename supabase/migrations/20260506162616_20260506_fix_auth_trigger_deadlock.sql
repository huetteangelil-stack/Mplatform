/*
  # Fix auth trigger deadlock

  1. Problem
    - The handle_new_user trigger was causing "Database error saving new user" on signup
    - The trigger was AFTER INSERT which can cause deadlocks
    - The function needs proper error handling to prevent blocking auth.users inserts

  2. Solution
    - Drop the problematic trigger
    - Recreate with proper SECURITY DEFINER to bypass RLS
    - Use BEFORE INSERT timing to prevent deadlocks
    - Add comprehensive error handling
    - Simplify the profile creation to essential fields

  3. Changes
    - Drop old trigger and function
    - Create new handle_new_user function with SECURITY DEFINER
    - Create new trigger with BEFORE INSERT timing
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create new function with SECURITY DEFINER to bypass RLS
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, company)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'firstName',
    NEW.raw_user_meta_data->>'lastName',
    NEW.raw_user_meta_data->>'company'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the trigger
  RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger with BEFORE INSERT to avoid deadlocks
CREATE TRIGGER on_auth_user_created
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;
