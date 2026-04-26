-- ============================================================
-- Smokzy schema v2 — adds Master Flavour Library
-- Run this ONCE in Supabase SQL Editor (after the original schema.sql).
-- ============================================================

-- Add blend_type to legacy flavors so existing items participate in the
-- two-section grouping (Signature / Imported) on the customer page.
alter table flavors add column if not exists blend_type text default 'signature';

-- Master library: every Smokzy flavour, defined ONCE.
create table if not exists flavor_library (
  id            text primary key,
  name          text default '',
  blend_type    text default 'signature' check (blend_type in ('signature','imported')),
  strength      int  default 5,
  description   text default '',
  notes         jsonb default '[]'::jsonb,
  image         text default '',
  default_price int  default 0,
  popular       boolean default false,
  created_at    timestamptz default now()
);
alter table flavor_library enable row level security;

-- Link table: which library flavours appear in which pots.
-- One library flavour can be linked to many pots.
-- An optional price_override lets a flavour cost more in a premium pot.
create table if not exists pot_library_flavors (
  pot_id          text references pots(id)            on delete cascade,
  library_id      text references flavor_library(id)  on delete cascade,
  position        int default 0,
  price_override  int,
  primary key (pot_id, library_id)
);
alter table pot_library_flavors enable row level security;
create index if not exists plf_pot_idx on pot_library_flavors(pot_id);
