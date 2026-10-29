-- Phase 4: server-stored quotes plus atomically persisted confirmed orders.
-- Apply after the existing restaurants/menu_items migration. This migration
-- creates new objects only; it never drops or edits existing order data.

create extension if not exists pgcrypto;

create table if not exists public.order_quotes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  requested_items jsonb not null check (jsonb_typeof(requested_items) = 'array'),
  quoted_items jsonb not null check (jsonb_typeof(quoted_items) = 'array'),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  confirmation_token_hash text not null check (char_length(confirmation_token_hash) = 64),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists order_quotes_expiry_idx on public.order_quotes (expires_at);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  quote_id uuid not null unique references public.order_quotes(id),
  status text not null default 'NEW' check (status in ('NEW')),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 200),
  request_hash text not null check (char_length(request_hash) = 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, idempotency_key)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  menu_item_id uuid not null references public.menu_items(id),
  item_name text not null,
  quantity integer not null check (quantity > 0 and quantity <= 50),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  line_number integer not null check (line_number > 0),
  created_at timestamptz not null default now(),
  check (line_total = unit_price * quantity),
  unique (order_id, line_number)
);

create index if not exists orders_restaurant_created_at_idx
  on public.orders (restaurant_id, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- The RPC locks the quote, checks current menu state and quote snapshots,
-- writes the order plus all item snapshots, and consumes the token. A raised
-- exception aborts the RPC statement, so partial writes are rolled back.
create or replace function public.create_confirmed_order(
  p_quote_id uuid,
  p_confirmation_token_hash text,
  p_idempotency_key text,
  p_request_hash text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.order_quotes%rowtype;
  v_existing_order public.orders%rowtype;
  v_order public.orders%rowtype;
  v_requested_count integer;
  v_found_count integer;
  v_current_items jsonb;
  v_current_total numeric(12, 2);
  v_order_items jsonb;
begin
  select * into v_quote
  from public.order_quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'quote_not_found';
  end if;

  -- Check a prior successful request first. This lets a caller safely retry
  -- after a network failure even though the confirmation token was consumed.
  select * into v_existing_order
  from public.orders
  where restaurant_id = v_quote.restaurant_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing_order.request_hash <> p_request_hash then
      raise exception 'idempotency_conflict';
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'menuItemId', menu_item_id,
          'name', item_name,
          'quantity', quantity,
          'unitPrice', unit_price::text,
          'lineTotal', line_total::text
        ) order by line_number
      ),
      '[]'::jsonb
    ) into v_order_items
    from public.order_items
    where order_id = v_existing_order.id;

    return jsonb_build_object(
      'replayed', true,
      'order', jsonb_build_object(
        'id', v_existing_order.id,
        'status', v_existing_order.status,
        'currency', v_existing_order.currency,
        'items', v_order_items,
        'totalAmount', v_existing_order.total_amount::text,
        'createdAt', v_existing_order.created_at
      )
    );
  end if;

  if v_quote.confirmation_token_hash <> p_confirmation_token_hash then
    raise exception 'invalid_confirmation_token';
  end if;

  if v_quote.expires_at <= now() then
    raise exception 'quote_expired';
  end if;

  if v_quote.consumed_at is not null then
    raise exception 'quote_already_consumed';
  end if;

  if jsonb_typeof(p_items) <> 'array' or v_quote.requested_items is distinct from p_items then
    raise exception 'quote_changed';
  end if;

  select count(*) into v_requested_count
  from jsonb_array_elements(p_items);

  select count(*) into v_found_count
  from jsonb_array_elements(p_items) with ordinality as requested(item, line_number)
  join public.menu_items as menu_item
    on menu_item.id = (requested.item ->> 'menuItemId')::uuid
   and menu_item.restaurant_id = v_quote.restaurant_id;

  if v_found_count <> v_requested_count then
    raise exception 'menu_item_missing_or_wrong_restaurant';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as requested(item)
    join public.menu_items as menu_item
      on menu_item.id = (requested.item ->> 'menuItemId')::uuid
     and menu_item.restaurant_id = v_quote.restaurant_id
    where not menu_item.is_available
  ) then
    raise exception 'menu_item_unavailable';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'menuItemId', menu_item.id,
          'name', menu_item.name,
          'quantity', (requested.item ->> 'quantity')::integer,
          'unitPrice', menu_item.price::text,
          'lineTotal', (menu_item.price * (requested.item ->> 'quantity')::integer)::numeric(12, 2)::text
        ) order by requested.line_number
      ),
      '[]'::jsonb
    ),
    coalesce(sum(menu_item.price * (requested.item ->> 'quantity')::integer), 0)::numeric(12, 2)
  into v_current_items, v_current_total
  from jsonb_array_elements(p_items) with ordinality as requested(item, line_number)
  join public.menu_items as menu_item
    on menu_item.id = (requested.item ->> 'menuItemId')::uuid
   and menu_item.restaurant_id = v_quote.restaurant_id;

  if v_quote.quoted_items is distinct from v_current_items
     or v_quote.total_amount <> v_current_total then
    raise exception 'quote_changed';
  end if;

  insert into public.orders (
    restaurant_id, quote_id, status, total_amount, currency, idempotency_key, request_hash
  )
  values (
    v_quote.restaurant_id, v_quote.id, 'NEW', v_current_total, 'INR', p_idempotency_key, p_request_hash
  )
  returning * into v_order;

  insert into public.order_items (
    order_id, menu_item_id, item_name, quantity, unit_price, line_total, line_number
  )
  select
    v_order.id,
    menu_item.id,
    menu_item.name,
    (requested.item ->> 'quantity')::integer,
    menu_item.price,
    (menu_item.price * (requested.item ->> 'quantity')::integer)::numeric(12, 2),
    requested.line_number::integer
  from jsonb_array_elements(p_items) with ordinality as requested(item, line_number)
  join public.menu_items as menu_item
    on menu_item.id = (requested.item ->> 'menuItemId')::uuid
   and menu_item.restaurant_id = v_quote.restaurant_id;

  update public.order_quotes
  set consumed_at = now()
  where id = v_quote.id;

  select jsonb_agg(
    jsonb_build_object(
      'menuItemId', menu_item_id,
      'name', item_name,
      'quantity', quantity,
      'unitPrice', unit_price::text,
      'lineTotal', line_total::text
    ) order by line_number
  ) into v_order_items
  from public.order_items
  where order_id = v_order.id;

  return jsonb_build_object(
    'replayed', false,
    'order', jsonb_build_object(
      'id', v_order.id,
      'status', v_order.status,
      'currency', v_order.currency,
      'items', v_order_items,
      'totalAmount', v_order.total_amount::text,
      'createdAt', v_order.created_at
    )
  );
end;
$$;

revoke all on function public.create_confirmed_order(uuid, text, text, text, jsonb) from public;
revoke all on function public.create_confirmed_order(uuid, text, text, text, jsonb) from anon;
revoke all on function public.create_confirmed_order(uuid, text, text, text, jsonb) from authenticated;
grant execute on function public.create_confirmed_order(uuid, text, text, text, jsonb) to service_role;
