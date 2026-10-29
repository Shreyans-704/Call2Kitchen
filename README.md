# Call2Kitchen backend — Phase 7 database verification preparation

Call2Kitchen is an AI-powered restaurant phone-ordering system for the Bolna Symphony Buildathon. A future Bolna voice agent will conduct the customer conversation. This backend is the trusted source of menu data and, in later phases, will enforce validation, prices, quotes, and confirmed orders.

Phase 4 adds confirmed order creation. The database—not the voice model—revalidates trusted menu data and atomically persists an order and its item snapshots. Phase 5 documents the voice-agent plan. Phase 6 adds a narrow authenticated tool gateway. Phase 7 adds a forward-only database hardening migration and a staging verification procedure; it does not claim live Supabase verification.

The health endpoint still means only that the HTTP backend is running—it does **not** claim that Supabase is connected or healthy.

## Architecture

```text
src/server.ts
  ├─ validates application and Supabase configuration at startup
  └─ starts the HTTP server

src/app.ts
  ├─ mounts /api/health
  ├─ mounts /api/menu
  ├─ mounts authenticated /api/tools/:toolName
  ├─ disables direct quote/order HTTP routes when the gateway is enabled
  └─ registers centralized error middleware

src/routes/menu.routes.ts
  └─ validates parameters and turns menu results into HTTP responses

src/routes/order.routes.ts
  └─ validates quote requests and returns an order quote

src/orders/quote.schema.ts
  └─ strictly validates items, UUIDs, quantities, and request shape

src/orders/quote.service.ts
  └─ verifies trusted menu data and calculates exact INR totals in paise

src/orders/order.service.ts + order.repository.ts
  └─ hashes confirmation data and invokes a transactional Supabase RPC

src/tools/tool-gateway.service.ts
  └─ calls the existing menu, quote-creation, and order services; it has no pricing or order-write shortcut

src/middleware/tool-gateway-auth.middleware.ts
  └─ validates an inbound bearer secret with a constant-time comparison

supabase/migrations/20261021202000_create_order_confirmation_and_orders.sql
  └─ creates quotes/orders/order_items and create_confirmed_order RPC

supabase/migrations/20261021230000_harden_order_rpc_and_rls.sql
  └─ enables RLS on server-owned order tables and verifies canonical request hashes in the RPC

src/menu/menu.repository.ts
  └─ uses the server-only Supabase client to query menu_items

supabase/migrations/...sql  creates restaurants and menu_items
supabase/seed.sql           inserts idempotent Spice Garden demo data
```

The menu repository is injected into `createApp` during tests. Therefore tests do not need a Supabase account, network access, or credentials. In the real server, the repository lazily creates the Supabase client when a menu request is made; `server.ts` still validates that the required Supabase configuration exists during startup.

## Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project for using the live menu API

## Install

```bash
npm install
```

## Configure Supabase and environment variables

1. Create a project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. In **Project Settings → API**, copy the project URL and the `service_role` key. Do not share the key in chat or commit it.
3. Copy the safe template and fill only your local `.env` file:

```powershell
Copy-Item .env.example .env
```

```dotenv
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

`.env.example` documents variable names with placeholders and is safe to commit. `.env` contains your real local configuration and is ignored by Git.

`SUPABASE_SERVICE_ROLE_KEY` is a sensitive server-only credential. It bypasses Supabase Row Level Security and must never appear in browser code, a Bolna client configuration, logs, source control, or API responses.

### Enable the voice-tool gateway

The gateway is disabled by default so ordinary local API tests do not require a Bolna credential. Before publicly deploying it, generate a strong random secret, store it only in the server environment, and enable the gateway:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

```dotenv
TOOL_GATEWAY_ENABLED=true
BOLNA_TOOL_GATEWAY_SECRET=the-random-value-generated-above
```

When enabled, startup validates that the secret is at least 32 characters. The server does not print it. This is an **inbound gateway credential**, not a Bolna management/API credential: it authorizes Bolna's configured HTTP function to call this backend; it cannot create or manage Bolna agents.

When the gateway is enabled, direct `POST /api/orders/quote` and `POST /api/orders` return 404. This prevents a public deployment from exposing quote capabilities or order creation beside the authenticated gateway. Public menu reads remain available for this MVP.

## Create the database schema and demo data

This project supplies SQL files but does not execute them automatically. No Supabase project was available to this project when the files were created.

In the Supabase Dashboard, open **SQL Editor → New query**. Run these files in order by copying each file's complete contents:

1. `supabase/migrations/20261021180000_create_restaurants_and_menu_items.sql`
2. `supabase/seed.sql`
3. `supabase/migrations/20261021202000_create_order_confirmation_and_orders.sql`
4. `supabase/migrations/20261021230000_harden_order_rpc_and_rls.sql`

The first migration uses `create table if not exists` and `create index if not exists`; it only creates missing objects. The seed uses fixed UUIDs with `on conflict do nothing`, so it can be run again without creating duplicates or overwriting existing seeded records. The Phase 7 migration is forward-only: apply it after Phase 4, and do not edit or re-run older migrations merely because their application status is uncertain.

### Safe Supabase verification procedure

Use a **staging** project. Before any write, identify it through your team's deployment/configuration records; this repository cannot determine whether an arbitrary Supabase URL is staging or production. Never paste a service-role key, database password, confirmation token, or full connection string into chat, shell history, or source control.

After applying the four files above through the Supabase SQL Editor or your approved migration workflow, use these read-only SQL checks in the SQL Editor:

```sql
select to_regclass('public.restaurants'), to_regclass('public.menu_items'),
       to_regclass('public.order_quotes'), to_regclass('public.orders'),
       to_regclass('public.order_items');

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('order_quotes', 'orders', 'order_items')
order by tablename;

select p.proname, pg_get_function_arguments(p.oid) as arguments,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_confirmed_order';

select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public' and routine_name = 'create_confirmed_order'
order by grantee, privilege_type;
```

Expected results: all five tables exist; RLS is enabled on the three order-owned tables; the function has five arguments and `security_definer = true`; `service_role` is the only application role granted `EXECUTE`. Confirm function ownership in your Supabase dashboard or with an administrator-approved catalog query before production use.

For staging writes, use the backend/tool gateway—not ad-hoc client SQL—to create a quote and then an explicitly confirmed order. Keep the confirmation token in a secure test client. Verify only the returned order ID with:

```sql
select id, restaurant_id, quote_id, status, total_amount, currency, created_at
from public.orders
where id = '<returned-order-id>';

select menu_item_id, item_name, quantity, unit_price, line_total, line_number
from public.order_items
where order_id = '<returned-order-id>'
order by line_number;
```

Retry the identical order request with the same idempotency key and confirm that the API returns the same order ID with a replay result. For rollback/concurrency testing, use a disposable staging project and an approved integration test that deliberately causes a controlled item-write failure; mocked tests cannot prove PostgreSQL transaction rollback.

The complete staging test matrix, including expired/consumed quotes, price changes, concurrent retries, rollback, and RPC-permission checks, is in [docs/supabase-staging-verification.md](docs/supabase-staging-verification.md).

For Phase 8, use [docs/phase-8-staging-verification.md](docs/phase-8-staging-verification.md) before linking a staging project, inspecting migration history, applying any SQL, or executing quote/order writes. It separates read-only inspection from approval-required changes.

Verification status is deliberately separated:

| Level | Current status |
| --- | --- |
| Static SQL/code review | Completed locally |
| Local isolated automated tests | Completed locally |
| Live Supabase reads | Not verified: no configured credentials/environment |
| Live Supabase writes | Not verified and not attempted |
| Transaction/concurrency verification | Not verified against PostgreSQL |

### Schema

`restaurants` represents a restaurant location:

| Field | Meaning |
| --- | --- |
| `id` | UUID primary key. |
| `name` | Required restaurant name. |
| `phone`, `address` | Optional contact/location information. |
| `is_open` | Operational-state flag, defaulting to `true`. |
| `created_at`, `updated_at` | Insert timestamps. |

`menu_items` contains items that belong to a restaurant:

| Field | Meaning |
| --- | --- |
| `id` | UUID primary key. |
| `restaurant_id` | Required foreign key to `restaurants.id`. |
| `name`, `category` | Required customer-facing menu fields. |
| `description` | Optional customer-facing text. |
| `price` | `numeric(12,2)`, required and constrained to be nonnegative. |
| `is_available` | Whether the item can currently be ordered. |
| `allergens` | JSONB array of allergen strings, defaulting to `[]`. |
| `created_at`, `updated_at` | Insert timestamps. |

The migration adds an index for `restaurant_id` and a partial index for available items ordered by category and name. `updated_at` gets its value on insert through its default; there is no trigger because Phase 2 performs no writes. A later write phase must update it explicitly or introduce a carefully reviewed trigger.

`supabase/seed.sql` provides ten **demo-only** Spice Garden items. Its prices are explicit sample data, not price claims for a real restaurant. Garlic Naan is intentionally unavailable, so it will not appear in either menu endpoint.

## Run the backend

```bash
npm run dev
```

The production workflow is:

```bash
npm run build
npm start
```

If either Supabase variable is missing or malformed, the production server exits clearly at startup. Creating the client validates configuration but does not test a database connection, so `/api/health` retains its Phase 1 meaning.

## API

### `GET /api/health`

Returns HTTP `200` when the backend is running. It does not test Supabase.

### `GET /api/menu`

Returns all available menu items, ordered by category and then name. Phase 2 seeds one restaurant (Spice Garden) and does not yet expose restaurant selection; the response includes `restaurantId` so multi-restaurant routing can be added later without changing each item shape.

```powershell
Invoke-RestMethod http://localhost:3000/api/menu
```

Example response:

```json
{
  "data": [
    {
      "id": "00000000-0000-4000-8000-000000000108",
      "restaurantId": "00000000-0000-4000-8000-000000000001",
      "name": "Mango Lassi",
      "description": "Chilled yogurt drink blended with mango",
      "price": "110.00",
      "category": "Beverages",
      "isAvailable": true,
      "allergens": ["dairy"]
    }
  ]
}
```

Prices are JSON strings. This avoids treating currency as a floating-point value. If Supabase returns its `NUMERIC(12,2)` value as a JavaScript number, the repository converts it back to a two-decimal string before returning it.

### `GET /api/menu/:id`

Returns one available menu item by UUID:

```powershell
Invoke-RestMethod http://localhost:3000/api/menu/00000000-0000-4000-8000-000000000103
```

- Invalid UUID: HTTP `400`
- Missing or unavailable item: HTTP `404`
- Database failure: HTTP `500` with a generic error; no raw database detail is returned

All errors use this structure:

```json
{
  "error": {
    "message": "Menu item not found",
    "statusCode": 404
  }
}
```

### `POST /api/orders/quote`

Creates an informational, read-only quote. It does not insert an order, change inventory, reserve an item, or promise that an eventual order will still be valid. Order creation must revalidate the menu later.

```powershell
$body = @{
  items = @(
    @{ menuItemId = "00000000-0000-4000-8000-000000000103"; quantity = 2 }
    @{ menuItemId = "00000000-0000-4000-8000-000000000104"; quantity = 4 }
  )
} | ConvertTo-Json

Invoke-RestMethod http://localhost:3000/api/orders/quote -Method Post -ContentType "application/json" -Body $body
```

Request contract:

```json
{
  "items": [
    {
      "menuItemId": "00000000-0000-4000-8000-000000000103",
      "quantity": 2
    }
  ]
}
```

Successful response:

```json
{
  "data": {
    "items": [
      {
        "menuItemId": "00000000-0000-4000-8000-000000000103",
        "name": "Paneer Butter Masala",
        "quantity": 2,
        "unitPrice": "260.00",
        "lineTotal": "520.00"
      }
    ],
    "totalAmount": "520.00",
    "currency": "INR"
  }
}
```

Validation rules:

- `items` is required, must be nonempty, and may contain at most 20 distinct items.
- Each item has exactly `menuItemId` and `quantity`; extra properties such as a client-provided `price` are rejected.
- Each ID must be a UUID, duplicate IDs are rejected, and quantity must be an integer from 1 through 50.
- Every requested item must exist in trusted database data and currently be available.
- Missing or unavailable items return HTTP `400`; malformed requests return HTTP `400`; unexpected database failures return a generic HTTP `500`.

The quote service fetches all requested IDs in one database query. It parses trusted two-decimal price strings into integer paise using `BigInt`, multiplies and adds paise exactly, then formats response values such as `"520.00"`. It never accepts a request price or uses JavaScript floating-point arithmetic for money.

Each successful quote now also returns `quoteId`, `confirmationToken`, and `expiresAt`. The token is a cryptographically random, five-minute, single-use capability stored only as a SHA-256 hash in `order_quotes`. It must be retained only by the trusted server-side voice orchestration flow and submitted only after the customer explicitly confirms the final spoken summary.

### `POST /api/orders`

This endpoint creates an order only from a still-valid, confirmed quote:

```json
{
  "quoteId": "quote-uuid",
  "confirmationToken": "server-generated-token-from-the-quote",
  "idempotencyKey": "a-stable-unique-key-for-this-submission",
  "items": [
    {
      "menuItemId": "00000000-0000-4000-8000-000000000103",
      "quantity": 2
    }
  ]
}
```

The body is strict: extra properties such as `price`, `totalAmount`, `name`, `restaurantId`, or `confirmed` are rejected. The server does not trust a client boolean as customer confirmation.

The `create_confirmed_order` PostgreSQL RPC locks the quote and, in one transaction:

1. Checks the token hash, expiration, and one-time-use state.
2. Checks that request items exactly match the quoted items.
3. Retrieves current menu data from the quote's restaurant.
4. Rejects missing, unavailable, changed-price, or changed-name items.
5. Inserts `orders` and `order_items` snapshots.
6. Marks the quote consumed.

It returns HTTP `201` for a new order and HTTP `200` for a safe retry with the same idempotency key and identical request content. Reusing a key with different content returns HTTP `409`.

`orders` stores the restaurant, quote reference, status (`NEW`), exact total, currency, idempotency key, and request hash. `order_items` snapshots the trusted item name and price, so historical orders remain meaningful when the menu changes.

The RPC is `SECURITY DEFINER` with a safe search path. Its execute permission is revoked from public/anonymous/authenticated roles and granted only to `service_role`; it must never be called from browser code.

Important limitation: the token proves that this API call refers to a specific, server-created quote. Without an authenticated Bolna webhook or user-facing confirmation channel, the backend cannot independently prove a human uttered “yes.” The trusted voice orchestration component must enforce that conversational step before presenting the token to this endpoint.

### `POST /api/tools/:toolName`

This is the only endpoint intended for an externally hosted voice tool after `TOOL_GATEWAY_ENABLED=true`. Valid tool names are `get_menu`, `get_item_details`, `quote_order`, and `place_order`. It is a fixed allow-list, not an HTTP proxy.

Each request must include the server-configured secret as an HTTP header:

```http
Authorization: Bearer <BOLNA_TOOL_GATEWAY_SECRET>
Content-Type: application/json
```

The JSON body is the tool's exact arguments. The gateway allows at most 16 KB and validates all input with the same strict Zod schemas used by the existing quote/order routes.

| Tool | Request body | Trusted behavior |
| --- | --- | --- |
| `get_menu` | `{}` | Returns currently available menu records. |
| `get_item_details` | `{ "menuItemId": "uuid" }` | Returns one currently available item or 404. |
| `quote_order` | `{ "items": [{ "menuItemId": "uuid", "quantity": 2 }] }` | Creates the same stored quote, trusted total, token, and expiry as Phase 3/4. |
| `place_order` | Exact Phase 4 order body | Uses the same confirmation, revalidation, idempotency, and RPC persistence path. |

Successful gateway responses are wrapped separately from regular APIs so a tool can identify its dispatch result:

```json
{
  "success": true,
  "tool": "get_menu",
  "data": { "items": [] }
}
```

Failed requests use the existing safe error structure, for example `401` for missing/incorrect credentials or `400` for invalid arguments. The response never includes a secret, SQL statement, database credential, or stack trace. A gateway timeout never means an order failed to persist: retry `place_order` only with the **same** idempotency key and request body.

## Test and build

```bash
npm test
npm run build
```

Tests use an injected in-memory repository rather than live credentials. They cover the Phase 1 health endpoint, menu response contract, available-only filtering, detail retrieval, quote validation, exact money totals, safe database failure responses, and the fact that quotation has no order-creation operation.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| `Supabase configuration is missing or invalid` | Create `.env`, ensure `SUPABASE_URL` is a URL, and supply a nonempty server-side service-role key. |
| Menu endpoint returns HTTP 500 | Confirm both SQL files were run in order, credentials are for the intended project, and inspect server logs—not API output—for the underlying error. |
| Menu endpoint returns `data: []` | Confirm the seed ran and items have `is_available = true`. |
| Menu item returns 404 | Confirm the UUID is valid and the item is available; unavailable items are deliberately hidden. |

## Security precautions

- Never commit `.env` or put real keys in documentation.
- Never expose the Supabase service-role key to a browser, phone client, or public response.
- Do not copy raw database errors into API responses.
- Do not treat the voice model as the source of prices; later ordering logic must query trusted database data.

## Bolna voice-agent preparation

The complete Phase 5 prompt, tool schemas, existing API contracts, manual dashboard steps, and verification status are in `docs/bolna-agent-setup.md`.

Bolna officially supports Custom Functions that call external APIs using OpenAI-style function definitions and configurable request headers. Configure the four functions only against `POST https://your-backend.example/api/tools/<tool-name>` with the bearer header above—not against `/api/orders/*`. Complete field-by-field setup, schemas, rotation instructions, and verification status are in [docs/bolna-agent-setup.md](docs/bolna-agent-setup.md). [Bolna Custom Functions documentation](https://www.bolna.ai/docs/tool-calling/custom-function-calls) describes the dashboard setup and tool schema format.

## Implemented and deferred work

Implemented: the Phase 1 foundation, Supabase schema/seed files, menu APIs, persisted expiring quotes, transactional confirmed-order creation, and a locally tested authenticated tool-gateway adapter.

Deferred: a configured Bolna agent, live tool calls, webhook authentication, human-identity confirmation, customer/session identity, restaurant selection, menu administration, remote Phase 4 migration/RPC verification, and the kitchen dashboard.
