-- Phase 7: forward-only hardening for databases that already received the
-- Phase 4 migration. It preserves all order data and replaces only the RPC.

-- These tables are server-owned. The service-role client used by this backend
-- bypasses RLS; no browser, anon, or authenticated role receives a policy.
alter table public.order_quotes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Keep the original function signature because the TypeScript repository
-- invokes it through Supabase RPC. Including extensions supports Supabase's
-- normal pgcrypto schema while retaining compatibility when it is in public.
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
set search_path = public, extensions, pg_temp
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
  v_canonical_request text;
begin
  select * into v_quote
  from public.order_quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'quote_not_found';
  end if;

  -- A retry following an ambiguous network response is safe only when its
  -- idempotency key and canonical request hash both match the saved order.
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

  -- Match Node's canonicalOrderRequest(): quoteId, then an ordered array of
  -- objects with menuItemId followed by quantity. Inputs already passed Zod,
  -- but this database check stops a privileged caller from storing an
  -- arbitrary idempotency/request hash alongside different data.
  select
    '{"quoteId":"' || p_quote_id::text || '","items":[' ||
    coalesce(
      string_agg(
        '{"menuItemId":"' || (requested.item ->> 'menuItemId') ||
        '","quantity":' || ((requested.item ->> 'quantity')::integer)::text || '}',
        ',' order by requested.line_number
      ),
      ''
    ) || ']}'
  into v_canonical_request
  from jsonb_array_elements(p_items) with ordinality as requested(item, line_number);

  if p_request_hash <> encode(digest(v_canonical_request, 'sha256'), 'hex') then
    raise exception 'invalid_request_hash';
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
