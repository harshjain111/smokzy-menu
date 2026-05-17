-- Smokzy schema v5 — dynamic pricing model
-- Run ONCE in Supabase SQL Editor after schema-v4.sql.
--
-- New model:
--   pot.base_price            = price for every SIGNATURE blend in that pot
--   settings.imported_upcharge = global flat extra charged for IMPORTED blends
--   imported flavour price    = pot.base_price + settings.imported_upcharge
--
-- The old per-flavour `price` column on `flavors` and per-link `price_override`
-- on `pot_library_flavors` are no longer used. We clear them to avoid stale
-- numbers lingering anywhere.

alter table settings add column if not exists imported_upcharge integer default 0;

update flavors set price = null where price is not null;
update pot_library_flavors set price_override = null where price_override is not null;

notify pgrst, 'reload schema';
