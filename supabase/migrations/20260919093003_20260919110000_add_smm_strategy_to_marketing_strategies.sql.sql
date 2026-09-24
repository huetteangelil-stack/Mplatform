/*
# Store generated SMM strategies

1. Modified Tables
- `marketing_strategies`
- Adds `smm_strategy` (jsonb, nullable), which stores the generated TAM, SAM, SOM, and buyer persona strategy for the business.

2. Purpose
- The SMM strategies screen can display the saved market sizing and personas without generating them again every time.
- The generated result is linked to the selected marketing strategy and therefore to the business context that produced it.

3. Security
- No new table or policy is created.
- Existing RLS policies on `marketing_strategies` protect this new column through the authenticated owner's strategy row.

4. Data Safety
- This is additive only. No existing rows or columns are removed or modified.
*/

ALTER TABLE public.marketing_strategies
  ADD COLUMN IF NOT EXISTS smm_strategy jsonb;
