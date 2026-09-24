/*
# Add content_data column to content_tasks

## Summary
Adds a `content_data` jsonb column to store the full AI-generated content result
(title, body, callToAction) alongside the existing `content` text column.

## Modified Tables
### content_tasks
- New column: `content_data` (jsonb, nullable) — stores the structured AI post result
- New column: `topic` is already text, no change needed

## Security
- No RLS policy changes. Existing policies still apply.
*/

ALTER TABLE public.content_tasks
  ADD COLUMN IF NOT EXISTS content_data jsonb;
