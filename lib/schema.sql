-- ============================================================
-- Smokzy schema for Supabase / Postgres
-- Run this once in Supabase: SQL Editor → paste → Run
-- ============================================================

-- single-row config: brand, partner, cover, founder note
create table if not exists settings (
  id              int  primary key default 1,
  brand_name      text default 'SMOKZY',
  tagline         text default 'The Art of Shisha',
  logo_url        text default '',
  partner_name    text default '',
  partner_logo_url text default '',
  cover           jsonb default '{}'::jsonb,
  founder_note    jsonb default '{}'::jsonb,
  constraint settings_singleton check (id = 1)
);
insert into settings (id) values (1) on conflict do nothing;

-- pots (one row = one shisha pot in the menu book)
create table if not exists pots (
  id          text primary key,
  name        text default '',
  tagline     text default '',
  image       text default '',
  base_price  int  default 0,
  description text default '',
  position    int  default 0,
  created_at  timestamptz default now()
);

-- flavors (children of pots)
create table if not exists flavors (
  id          text primary key,
  pot_id      text references pots(id) on delete cascade,
  name        text default '',
  strength    int  default 5,
  description text default '',
  notes       jsonb default '[]'::jsonb,
  category    text default 'fruit',
  popular     boolean default false,
  price       int  default 0,
  image       text default '',
  position    int  default 0
);
create index if not exists flavors_pot_idx on flavors(pot_id);

-- pairings
create table if not exists pairings (
  id       text primary key,
  drink    text default '',
  flavor   text default '',
  reason   text default '',
  position int  default 0
);

-- guest feedback
create table if not exists feedback (
  id               text primary key,
  created_at       timestamptz default now(),
  name             text default '',
  rating           int default 5,
  experience       text default '',
  favorite_flavor  text default '',
  would_recommend  boolean default true
);

-- analytics events (we aggregate at query time)
create table if not exists analytics_events (
  id          bigserial primary key,
  created_at  timestamptz default now(),
  type        text not null,           -- 'view' or 'flavor_tap'
  visitor_id  text,
  flavor_id   text
);
create index if not exists ae_type_idx on analytics_events(type);
create index if not exists ae_created_idx on analytics_events(created_at);
create index if not exists ae_flavor_idx on analytics_events(flavor_id);

-- ============================================================
-- Storage bucket for image uploads (logo, cover bg, pot/flavor images)
-- Create bucket "menu-images" with PUBLIC read in Supabase dashboard:
--   Storage → New bucket → name: menu-images → Public bucket: ON
-- (Or run the SQL below)
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('menu-images', 'menu-images', true)
  on conflict (id) do nothing;

-- ============================================================
-- RLS: we keep tables LOCKED for the public anon key (default),
-- and access them only from the server with the SERVICE ROLE key
-- which bypasses RLS. This is the standard pattern for an admin
-- backend that proxies all reads/writes.
-- ============================================================
alter table settings          enable row level security;
alter table pots              enable row level security;
alter table flavors           enable row level security;
alter table pairings          enable row level security;
alter table feedback          enable row level security;
alter table analytics_events  enable row level security;
