/*
# Add language preference to user_profiles

1. Modified Tables
- `user_profiles`
- Adds `language` (varchar(2), default 'fr') to store the user's UI language preference.

2. Purpose
- The app's language switcher persists the user's choice (fr/en) in the database.
- On login, the DB value takes priority over localStorage so the preference follows the user across devices.

3. Security
- No new table or policy is created.
- Existing RLS policies on `user_profiles` protect this new column through the parent row.

4. Data Safety
- This is additive only. No existing rows or columns are removed or modified.
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS language varchar(2) DEFAULT 'fr';
