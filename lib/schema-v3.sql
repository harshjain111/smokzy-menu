-- ============================================================
-- Smokzy schema v3 — taste tags + categorical strength
-- Run ONCE in Supabase SQL Editor (after schema.sql and schema-v2.sql).
-- ============================================================

-- Tags (e.g. 'minty','floral','fruity','ice') — flexible jsonb array.
alter table flavor_library add column if not exists tags jsonb default '[]'::jsonb;
alter table flavors        add column if not exists tags jsonb default '[]'::jsonb;

-- Categorical strength: 'light' | 'mild' | 'strong'
-- We keep the numeric `strength` column for backwards compatibility and
-- derive the label from it when this is null.
alter table flavor_library add column if not exists strength_label text;
alter table flavors        add column if not exists strength_label text;
