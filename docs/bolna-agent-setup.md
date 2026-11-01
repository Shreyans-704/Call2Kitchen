# Call2Kitchen Bolna agent setup — Phase 5

## Status and safety boundary

This file prepares the Call2Kitchen voice agent for manual configuration in Bolna. Phase 6 implements a local, authenticated backend tool gateway. This document does **not** create an agent, call Bolna APIs, configure a phone number, expose a backend publicly, or verify a live call.

Bolna's current documentation confirms that Custom Functions use OpenAI-style function definitions and that Bolna makes HTTP calls to configured external endpoints. It also documents configurable API tokens/headers. The present Call2Kitchen API has no authentication layer, so it is **not safe** to configure Bolna to call its `/api/*` endpoints directly over the public internet. Do not expose the service-role key, quote confirmation token, or a public unauthenticated order endpoint.

The gateway route is `POST /api/tools/:toolName`. It accepts only four named tools, validates their JSON arguments strictly, and calls the same backend services as the original routes. It is not a proxy and it does not expose Supabase credentials. It requires an `Authorization: Bearer <BOLNA_TOOL_GATEWAY_SECRET>` header. This header convention is Call2Kitchen's server-side design; Bolna's documented custom-function header configuration must be completed manually in its dashboard.

Set `TOOL_GATEWAY_ENABLED=true` and a 32-or-more-character random `BOLNA_TOOL_GATEWAY_SECRET` on the backend before deployment. Generate a new value with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Keep the secret only in the backend environment and Bolna's protected tool header configuration. Never put it in this prompt, a tool description, an agent context variable, a URL/query string, caller-facing speech, logs, or source control. Rotate it by generating a replacement, updating both the backend and Bolna configuration together, then redeploying/retesting. It is different from a Bolna management API key and cannot manage Bolna resources.

## Current backend contracts

All successful API responses are wrapped in `data`; errors are:

```json
{ "error": { "message": "...", "statusCode": 400 } }
```

### `GET /api/menu`

No parameters. Returns HTTP 200 and available items, ordered by category/name:

```json
{ "data": [{ "id": "uuid", "restaurantId": "uuid", "name": "Paneer Butter Masala", "description": "...", "price": "260.00", "category": "Main Course", "isAvailable": true, "allergens": ["dairy"] }] }
```

### `GET /api/menu/:id`

`id` must be a UUID. Returns one available item (200); invalid IDs return 400; missing or unavailable items return 404.

### `POST /api/orders/quote`

Strict JSON body:

```json
{ "items": [{ "menuItemId": "uuid", "quantity": 2 }] }
```

`items` has 1–20 distinct entries; quantity is an integer from 1–50; extra fields including price are rejected. The response contains trusted line totals, `totalAmount`, `currency`, `quoteId`, `confirmationToken`, and `expiresAt`. The token must remain internal to the tool flow and expires after five minutes.

### `POST /api/orders`

Strict JSON body:

```json
{
  "quoteId": "uuid",
  "confirmationToken": "server-issued-secret-token",
  "idempotencyKey": "stable-key-at-least-16-characters",
  "items": [{ "menuItemId": "uuid", "quantity": 2 }]
}
```

This endpoint returns 201 only after the PostgreSQL RPC persists the order. A safe replay returns 200; a conflicting idempotency key returns 409. It revalidates menu data, quote contents, availability, and price.

## Agent system prompt

Use this as the initial system prompt in Bolna:

> You are Call2Kitchen's automated restaurant ordering assistant. Greet callers warmly, say you are an automated ordering assistant, and ask how you can help. Use tools for every menu fact, price, availability statement, quote, and order result; never invent them. Ask a clarifying question whenever an item or quantity is ambiguous. This MVP does not support delivery, pickup, payment, refunds, or customizations unless a tool response explicitly proves otherwise. Before quoting, repeat the intended item names and quantities. Use quote_order to obtain the authoritative total. Read the exact quoted order and total to the caller. Only after the caller explicitly says they confirm that exact order and total may you call place_order. If any item or quantity changes, obtain a new quote and require confirmation again. Keep quote ID, confirmation token, items, and idempotency key internal; never speak them. If a quote expires, menu availability changes, or a tool fails, explain that ordering could not be completed and offer to refresh the menu or quote. On a timeout after place_order, retry only with the same idempotency key and exact request. State an order ID only if place_order returns success. End politely.

## Conversation flow

1. Greet: “Thanks for calling Spice Garden. I’m the automated ordering assistant. How may I help?”
2. For menu/pricing questions, call `get_menu` or `get_item_details`.
3. Collect unambiguous item IDs and quantities; do not guess IDs from names.
4. Call `quote_order`; read the returned names, quantities, and `totalAmount`.
5. Ask: “Would you like me to place this exact order for [total]?”
6. Only after an explicit affirmative response, call `place_order` with exactly the quote's fields and a newly generated stable idempotency key.
7. Confirm only the returned order ID and status.

## Custom functions to configure manually

Bolna documents Custom Functions in the Tools tab. The documented required fields include `name`, `description`, `key: "custom_task"`, and HTTP method. Use its “Write manually” interface or generate from a **reviewed, authenticated** cURL request. Do not paste real credentials into this repository.

The following are OpenAI-style function definitions for the LLM-facing portion. For every tool configure `POST https://your-backend.example/api/tools/<toolName>`, `Content-Type: application/json`, and the authorization header above. The body is exactly the function arguments object. Do not target `/api/orders/*` directly.

### `get_menu`

```json
{
  "name": "get_menu",
  "description": "Use when a caller asks what food is available, menu prices, categories, or allergen information. Never answer menu facts without this tool.",
  "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
}
```

Gateway action: authenticated `POST /api/tools/get_menu` with `{}`. A success response is `{ "success": true, "tool": "get_menu", "data": { "items": [...] } }`.

### `get_item_details`

```json
{
  "name": "get_item_details",
  "description": "Use when the caller asks about one known menu item. Requires its trusted menu item ID; do not guess ingredients or availability.",
  "parameters": { "type": "object", "properties": { "menuItemId": { "type": "string", "description": "A menu item UUID returned by get_menu." } }, "required": ["menuItemId"], "additionalProperties": false }
}
```

Gateway action: authenticated `POST /api/tools/get_item_details` with `{ "menuItemId": "uuid" }`.

### `quote_order`

```json
{
  "name": "quote_order",
  "description": "Use only after collecting exact menu item IDs and integer quantities. Returns the authoritative total and an internal quote capability. Never calculate totals yourself.",
  "parameters": { "type": "object", "properties": { "items": { "type": "array", "minItems": 1, "maxItems": 20, "items": { "type": "object", "properties": { "menuItemId": { "type": "string" }, "quantity": { "type": "integer", "minimum": 1, "maximum": 50 } }, "required": ["menuItemId", "quantity"], "additionalProperties": false } } }, "required": ["items"], "additionalProperties": false }
}
```

Gateway action: authenticated `POST /api/tools/quote_order`, forwarding only `items`. Preserve the returned `quoteId`, `confirmationToken`, and `expiresAt` internally; never say them to a caller.

### `place_order`

```json
{
  "name": "place_order",
  "description": "Use only after the caller explicitly confirms the exact quote and total. Submit exactly the quote ID, confirmation token, items, and the same idempotency key on retries. Never use before confirmation.",
  "parameters": { "type": "object", "properties": { "quoteId": { "type": "string" }, "confirmationToken": { "type": "string" }, "idempotencyKey": { "type": "string" }, "items": { "type": "array", "minItems": 1, "maxItems": 20, "items": { "type": "object", "properties": { "menuItemId": { "type": "string" }, "quantity": { "type": "integer", "minimum": 1, "maximum": 50 } }, "required": ["menuItemId", "quantity"], "additionalProperties": false } } }, "required": ["quoteId", "confirmationToken", "idempotencyKey", "items"], "additionalProperties": false }
}
```

Gateway action: authenticated `POST /api/tools/place_order`, forwarding exactly those fields. It reuses the existing order service/repository logic and never treats a `confirmed` boolean as proof. HTTP 200 only means the gateway dispatched a tool request; inspect `success` and the returned order data before saying an order was placed.

## Manual Bolna setup

1. Create an agent in the Bolna dashboard; do not invent an agent ID.
2. Add the system prompt above.
3. In Tools, add the four Custom Functions with the names, descriptions, and parameter schemas above.
4. Configure each function as `POST /api/tools/<toolName>` against the HTTPS gateway base URL. Add `Authorization: Bearer <BOLNA_TOOL_GATEWAY_SECRET>` only in Bolna's protected header/token UI, if available; do not put it in the LLM-visible definition.
5. First test `get_menu` and `get_item_details` against a staging backend. Use only test data/quotes before allowing `place_order`.
6. Configure a friendly pre-call message for slow operations, such as “Let me check that for you.”
7. Assign an inbound phone number through the dashboard or Bolna's documented inbound setup.
8. Test a complete quote and explicit-confirmation flow on a staging backend before a customer-facing number.

## Tool errors and safe retries

Authentication failures return generic HTTP 401 errors. Unknown tools return 404; invalid arguments return 400; unexpected failures return a generic 500 response. Do not treat an HTTP transport response by itself as an order success: state an order was placed only when the response has `success: true` and `data` includes the persisted order ID.

The gateway waits up to eight seconds for an operation. If `place_order` times out, do not generate another logical order or another idempotency key. Retry the exact same body with the same idempotency key; the Phase 4 database RPC returns the persisted order safely if the prior transaction succeeded. Quote/order confirmation still depends on the Phase 4 SQL migration and RPC having been applied.

The backend disables its direct `POST /api/orders/quote` and `POST /api/orders` routes when `TOOL_GATEWAY_ENABLED=true`; public `GET /api/menu` remains separate. This limits public ordering access to authenticated tool requests. It is still a shared-secret boundary: anyone who obtains the credential can call tools, so use HTTPS, rotate on exposure, restrict access in deployment infrastructure, and consider a future signed/request-bound integration.

## Browser voice session endpoint (Phase B1)

The frontend now connects to a real Bolna voice agent through the backend:

Browser `-->` `POST /api/bolna-session` (Express backend) `-->` `POST https://api.bolna.ai/web-call/freeswitch-session` (Bolna)

The backend session endpoint mints a short-lived WebRTC session through the
Bolna Web Call minting API using server-side credentials and returns the
session response to the browser SDK as-is.

### Server-side environment variables

- `BOLNA_API_KEY` — server-only Bolna API key used for session minting. Never exposed to the browser, logged, or returned.
- `BOLNA_AGENT_ID` — server-only Bolna agent ID used for session minting.

Both are required for the endpoint to mint sessions. When either is missing,
`POST /api/bolna-session` returns HTTP 503 and never echoes configuration values.

The frontend never receives or stores Bolna credentials; it calls
`POST /api/bolna-session` against the backend base URL configured through
`NEXT_PUBLIC_API_URL` (default `http://localhost:3000`).

### Endpoint behavior

- `POST /api/bolna-session` → `200` with the short-lived session response returned by Bolna.
- Upstream non-success → `502`; upstream response missing required session fields → `502`; upstream timeout → `504`.
- Missing server-side configuration → `503`.
- Abuse protection: in-memory per-IP rate limit (10 mint attempts per 60 seconds per client) → `429`.

The success response body is forwarded to the browser exactly as Bolna returned
it, as required by the Web Call SDK session contract (`run_id`, `wss_url`,
`sip_username`, SIP credentials, ICE servers).

### Security controls

- The Bolna API key and session credentials stay server-side; the browser only
  receives short-lived session credentials.
- CORS allow-lists configured frontend origins (default `http://localhost:3001`;
  override with `CORS_ALLOWED_ORIGINS`).
- Generic error responses; configuration values are never included in errors.

### Current authentication boundary

The application does not yet have a browser-user authentication mechanism. The
existing authenticated surface is the server-to-server tool gateway shared
secret (`BOLNA_TOOL_GATEWAY_SECRET`). Until browser user authentication exists,
treat `POST /api/bolna-session` as an internal/trusted-origin surface: use HTTPS,
restrict deployment network access, and add real user authentication before any
public production exposure. CORS and rate limiting are transport/abuse controls,
not authentication.

## Webhooks

No webhook is implemented. Bolna documents call-status webhooks and optional configured headers, but the currently verified documentation does not establish a signed webhook protocol for this project. Do not create a webhook endpoint that trusts `customer_confirmed: true`. A future webhook requires a documented authentication mechanism, strict Zod payload validation, duplicate-event handling, and replay protection.

## Verification matrix

| Area | State |
| --- | --- |
| Local prompt/tool definitions | Documented only |
| Authenticated tool gateway | Implemented locally; service-level tests passed |
| Browser voice session endpoint | Implemented locally; live call not verified |
| Bolna agent/dashboard setup | Not configured |
| Bolna API/tool calls | Not verified |
| Live voice calls/webhooks | Not verified |
| Phase 4 Supabase migration/RPC | Not applied or verified |
