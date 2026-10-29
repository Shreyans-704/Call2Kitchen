-- Run this migration once in the Supabase SQL Editor, before supabase/seed.sql.
-- It only creates new objects; it does not drop or overwrite existing data.

create table if not exists public.restaurants (
  id uuid primary key,
  name text not null,
  phone text,
  address text,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key,
  restaurant_id uuid not null references public.restaurants(id),
  name text not null,
  description text,
  price numeric(12, 2) not null check (price >= 0),
  category text not null,
  is_available boolean not null default true,
  allergens jsonb not null default '[]'::jsonb check (jsonb_typeof(allergens) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Supports joins and future restaurant-scoped menu operations.
create index if not exists menu_items_restaurant_id_idx on public.menu_items (restaurant_id);

-- Supports the available-menu query's filter and category/name ordering.
create index if not exists menu_items_available_category_name_idx
  on public.menu_items (category, name)
  where is_available = true;

-- updated_at receives its insert timestamp from the default above. No update
-- trigger is needed yet because Phase 2 exposes only read-only menu APIs.
