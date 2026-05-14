-- Smokzy schema v4 — monthly highlights feature
-- Run ONCE in Supabase SQL Editor after schema-v3.sql.
alter table settings add column if not exists highlights jsonb default '{"enabled":false,"items":[]}'::jsonb;
notify pgrst, 'reload schema';
