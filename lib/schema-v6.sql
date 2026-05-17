-- Smokzy schema v6 — optional pairings page
-- Run ONCE in Supabase SQL Editor after schema-v5.sql.
--
-- Adds a single boolean on settings. When false, the customer book skips
-- the "Recommended pairings" spread entirely. Defaults to true so the page
-- keeps showing unless you explicitly turn it off.

alter table settings add column if not exists pairings_enabled boolean default true;

notify pgrst, 'reload schema';
