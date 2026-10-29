# Phase 8 — approved Supabase staging verification

This is the operational checklist for proving Call2Kitchen's quote-to-order flow against a real Supabase **staging** project. It does not authorize writes by itself. Do not run a migration, seed, quote, order, data mutation, or cleanup step until the project has been identified as staging and the owner has approved the exact proposed operation.

## 1. Prerequisites

- An approved disposable or staging Supabase project; do not infer this from a project URL or name alone.
- Node.js 20+ and this repository's dependencies.
- Supabase CLI installed by the operator, and the repository linked only to the approved staging project.
- A local `.env` file, ignored by Git, containing the required values by name:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TOOL_GATEWAY_ENABLED` when testing the protected gateway
  - `BOLNA_TOOL_GATEWAY_SECRET` when `TOOL_GATEWAY_ENABLED=true`
- No secret in a command line, URL, committed file, test fixture, screenshot, or ticket.

The service-role key is for server-side code only. It must never be sent to a browser or a voice agent.

## 2. Expected schema

Migrations must be considered in this order:

1. `supabase/migrations/20261021180000_create_restaurants_and_menu_items.sql`
2. `supabase/seed.sql` — demo-only seed; run only if the staging owner confirms it is needed.
3. `supabase/migrations/20261021202000_create_order_confirmation_and_orders.sql`
4. `supabase/migrations/20261021230000_harden_order_rpc_and_rls.sql`

Expected tables: `restaurants`, `menu_items`, `order_quotes`, `orders`, and `order_items`.

Expected RPC: `public.create_confirmed_order(uuid, text, text, text, jsonb)`.

The Phase 7 migration must enable RLS on `order_quotes`, `orders`, and `order_items`; it leaves these server-owned tables without public policies. The RPC is `SECURITY DEFINER`, locks its quote, validates its token/hash/expiry/current menu state, writes an order plus item snapshots in one transaction, consumes the quote, and grants execution only to `service_role`.

## 3. Read-only staging inspection — approval not required for writes

With an operator-managed, linked staging project, run:

```powershell
supabase migration list --linked
```

Compare the remote timestamps with the four expected migration timestamps above. The CLI tracks its remote history in `supabase_migrations.schema_migrations`; history alone is insufficient if prior SQL was applied manually, so also inspect the schema through the Supabase SQL Editor.

Run these read-only checks in the staging SQL Editor:

```sql
select to_regclass('public.restaurants') as restaurants,
       to_regclass('public.menu_items') as menu_items,
       to_regclass('public.order_quotes') as order_quotes,
       to_regclass('public.orders') as orders,
       to_regclass('public.order_items') as order_items;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('order_quotes', 'orders', 'order_items')
order by tablename;

select p.proname, pg_get_function_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       pg_get_functiondef(p.oid) like '%invalid_request_hash%' as validates_request_hash
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_confirmed_order';

select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'create_confirmed_order'
order by grantee, privilege_type;

select id, name, is_open
from public.restaurants
order by name;

select id, restaurant_id, name, price, is_available
from public.menu_items
order by category, name;
```

Expected result: tables and function exist; the three order-owned tables show `rowsecurity = true`; the function is `SECURITY DEFINER`, contains canonical hash validation, and only `service_role` is granted application-level execute permission. Record only status and migration IDs, never credentials, tokens, or raw error contents.

If history and schema disagree, do **not** rerun a migration and do not use `supabase migration repair` casually. First have the staging owner confirm actual schema state. Migration repair changes history records; it does not apply SQL.

## 4. Proposed write plan — requires explicit approval

After the read-only inspection confirms the project is staging, present the exact missing migration/seed filenames and test records to the owner. Wait for approval before any of these commands:

```powershell
# Preview only; review the listed SQL before authorizing an apply.
supabase db push --dry-run

# Apply only after owner approval and a reviewed dry run.
supabase db push
```

Do not run `supabase db reset`, `migration repair`, `truncate`, `drop`, or a broad seed against an existing environment. If demo data is absent, use `supabase/seed.sql` only after the owner confirms its stable Spice Garden IDs will not conflict with existing staging data.

## 5. API verification plan

Perform calls through the backend or the authenticated gateway, never with the service-role key in a client. Keep confirmation tokens in a secure local test client and do not paste them into logs.

### Menu retrieval

- `GET /api/menu`: returns available items only, ordered by category/name.
- `GET /api/menu/:id`: returns a known available item.
- Invalid UUID: HTTP 400.
- Missing or unavailable item: HTTP 404 without extra database detail.

### Quote creation

- Create a quote with valid menu IDs and quantities.
- Verify trusted database prices determine decimal-string totals.
- Verify extra `price`, duplicate IDs, invalid UUIDs, quantities outside 1–50, more than 20 items, unavailable items, and missing items are rejected.
- Verify the response includes `quoteId`, `confirmationToken`, and `expiresAt` only through the existing trusted contract.
- Verify quote expiration by using a short-lived test fixture or waiting beyond the configured five-minute lifetime; do not alter production-like data to speed this up.

### Order creation

- Create one quote, then submit its exact items, token, quote ID, and an idempotency key.
- Confirm the returned order ID exists and that `order_items` snapshots match trusted names, prices, quantities, and line totals.
- Submit an invalid token and an expired/consumed quote; both must fail without creating another order.
- Retry the exact successful request with the same idempotency key; expect the original order with replay behavior.
- Reuse that key with different content; expect a conflict and no new order.
- In a disposable staging project only, test menu price/name/availability changes after quotation, same-key concurrent submissions, and an intentionally failed item write. Confirm no partial order or consumed quote remains after a failed transaction.

### Gateway security

With `TOOL_GATEWAY_ENABLED=true`:

- Direct `POST /api/orders/quote` and `POST /api/orders` return 404.
- Missing and wrong gateway bearer credentials return 401.
- A correct credential can invoke only the four allowed tools.
- The gateway must not log or return credentials, confirmation tokens in diagnostics, raw SQL errors, or service-role data.

## 6. Persistence and cleanup checks

Use the returned order ID, never a token, for read-only persistence checks:

```sql
select id, restaurant_id, quote_id, status, total_amount, currency, created_at
from public.orders
where id = '<returned-order-id>';

select menu_item_id, item_name, quantity, unit_price, line_total, line_number
from public.order_items
where order_id = '<returned-order-id>'
order by line_number;
```

Create clearly labelled test records only in a disposable staging environment. Cleanup must target only IDs recorded when the records were created, must respect foreign keys, and requires separate owner approval. Never delete a record merely because its name looks like a test record.

## 7. Troubleshooting

| Symptom | Safe response |
| --- | --- |
| Missing `.env` or Supabase values | Create local `.env` from `.env.example`; obtain values from the approved project dashboard; never send them in chat. |
| CLI missing or project not linked | Install/link the CLI through the operator's approved workflow; inspect migration history before pushing. |
| Remote history differs from schema | Stop. Compare catalog results, migration files, and team deployment records before repair or apply. |
| RPC permission denied | Inspect function grants and role context; do not broaden grants to `anon` or `authenticated`. |
| Gateway returns 404 | Confirm gateway mode/configuration and use `/api/tools/:toolName`, not direct order routes. |
| Quote/order fails after menu edits | This is expected trusted revalidation; create a new quote and obtain a new confirmation. |

## 8. Verification checklist

| Item | Local status | Remote staging status |
| --- | --- | --- |
| TypeScript build | Run locally | Not applicable |
| Isolated service/migration tests | Run locally | Not applicable |
| HTTP/Supertest suite | Environment-dependent | Not yet run against staging |
| Migration history and schema | Static review only | Not inspected |
| RLS, RPC definition, and grants | Static review only | Not inspected |
| Menu read | Not live verified | Not verified |
| Quote persistence | Not live verified | Not verified |
| Order persistence/replay | Not live verified | Not verified |
| Transaction rollback/concurrency | Not live verified | Not verified |
| Gateway HTTP authentication | Unit-tested | Not live verified |
