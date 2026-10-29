# 🍽️ Call2Kitchen

### AI-Powered Restaurant Phone Ordering System

**Call2Kitchen** is an AI-powered restaurant ordering platform that enables customers to place food orders through natural voice conversations. It connects voice AI with a restaurant's menu, pricing, order validation, and kitchen workflow.

The goal is simple: make restaurant phone ordering faster and more reliable without requiring staff to manually handle every call.

> **Core principle:** AI understands what the customer wants. The backend validates the order, calculates the price, and controls persistence.

---

## 📌 Table of Contents

* [Overview](#-overview)
* [Problem Statement](#-problem-statement)
* [Key Features](#-key-features)
* [How It Works](#-how-it-works)
* [System Architecture](#-system-architecture)
* [Technology Stack](#-technology-stack)
* [Backend API](#-backend-api)
* [Database Design](#-database-design)
* [Security and Reliability](#-security-and-reliability)
* [Project Structure](#-project-structure)
* [Getting Started](#-getting-started)
* [Environment Variables](#-environment-variables)
* [Database Setup](#-database-setup)
* [Testing](#-testing)
* [Current Development Status](#-current-development-status)
* [Roadmap](#-roadmap)

---

## 🎯 Overview

Restaurant phone ordering can be time-consuming, especially during busy periods. Staff must answer calls, understand requests, check menu availability, calculate totals, and communicate orders to the kitchen.

Call2Kitchen aims to automate this workflow using conversational AI and a backend that enforces business rules.

The system is designed around three responsibilities:

* **Voice AI:** Understand customer requests and guide the conversation.
* **Backend:** Validate menu items, check availability, calculate totals, and create confirmed orders.
* **Kitchen dashboard:** Provide restaurant staff with an interface for managing incoming orders.

The project is being developed with a focus on backend reliability, safe order processing, and voice-agent integration.

## ❗ Problem Statement

Traditional phone ordering introduces several challenges:

* Restaurant staff may miss calls during peak hours.
* Orders can be misunderstood during conversations.
* Menu availability and prices must be checked manually.
* Incorrect quantities or totals can cause order disputes.
* Orders must be communicated reliably to kitchen staff.

Call2Kitchen addresses these problems by combining conversational AI with server-side validation and structured order storage.

---

## ✨ Key Features

### 🤖 Conversational Voice Ordering

* Designed for integration with Bolna voice AI.
* Supports natural-language interactions for menu discovery and ordering.
* Uses structured tools to connect the voice agent to backend operations.

### 📋 Database-Driven Menu

* Retrieves menu items from Supabase PostgreSQL.
* Returns current item prices and availability.
* Prevents the AI agent from treating its own generated prices as authoritative.

### 💰 Reliable Order Quotation

* Validates requested menu item IDs and quantities.
* Checks item availability.
* Calculates totals using trusted database prices.
* Uses integer paise arithmetic internally to avoid floating-point money errors.

### 🔐 Confirmed Order Creation

* Uses server-generated quotes and confirmation tokens.
* Applies server-side validation before order creation.
* Uses PostgreSQL transactions through a database RPC for atomic order persistence.
* Supports idempotency to prevent duplicate orders when requests are retried.

### 🔌 Authenticated Tool Gateway

* Exposes an allow-listed set of tools for the voice agent.
* Supports bearer-secret authentication.
* Validates tool inputs before executing backend operations.
* Can disable direct quote and order routes when gateway mode is enabled.

### 🧪 Automated Testing

* Vitest-based unit and service tests.
* Tests for menu behavior, order services, and tool-gateway logic.
* Migration-related checks for critical database behavior.

---

## 🔄 How It Works

The intended customer journey is:

1. **Customer calls the restaurant.**
2. **AI answers the call** and understands the customer's request.
3. **Menu lookup:** The agent retrieves available menu items from the backend.
4. **Order collection:** The agent collects item selections and quantities.
5. **Order validation:** The backend verifies that the requested items exist and are available.
6. **Price calculation:** The backend calculates the order total using database prices.
7. **Customer confirmation:** The agent communicates the order summary and total, then obtains explicit confirmation.
8. **Order persistence:** The backend validates the quote and creates the order.
9. **Kitchen workflow:** The restaurant dashboard can display and manage the persisted order.

**Important:** A generated quote is not proof of customer confirmation. The voice-agent workflow must obtain explicit customer confirmation before invoking the order-placement operation.

The system must not claim an order was successfully placed until the backend confirms that the order was persisted.

---

## 🏗️ System Architecture

```text
                  ┌──────────────────────┐
                  │      Customer        │
                  │     Phone Call       │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │      Bolna AI        │
                  │   Voice Agent        │
                  └──────────┬───────────┘
                             │
                    Authenticated HTTPS
                             │
                             ▼
                  ┌──────────────────────┐
                  │  Express Backend     │
                  │                      │
                  │  Tool Gateway        │
                  │  Input Validation    │
                  │  Order Services      │
                  │  Price Calculation   │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Supabase PostgreSQL  │
                  │                      │
                  │ Restaurants          │
                  │ Menu Items            │
                  │ Order Quotes          │
                  │ Orders                │
                  │ Order Items           │
                  └──────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  Kitchen Dashboard   │
                  │   Planned Frontend   │
                  └──────────────────────┘
```

### Architecture Principles

* The backend is the source of truth for prices and availability.
* The AI agent interprets requests but does not determine authoritative prices.
* Order creation is performed by the backend, not directly by the language model.
* Database transactions protect the consistency of orders and order items.
* Idempotency helps make order-placement retries safe.
* Sensitive database credentials remain on the server.

---

## 🛠️ Technology Stack

| Component            | Technology              | Purpose                            |
| -------------------- | ----------------------- | ---------------------------------- |
| Runtime              | Node.js                 | Backend execution                  |
| Language             | TypeScript              | Type-safe application development  |
| Web framework        | Express.js              | HTTP API and middleware            |
| Validation           | Zod                     | Request and environment validation |
| Database             | Supabase PostgreSQL     | Persistent application data        |
| Database client      | Supabase JavaScript SDK | Backend database access            |
| Voice AI integration | Bolna                   | Conversational phone ordering      |
| Testing              | Vitest                  | Automated tests                    |
| HTTP testing         | Supertest               | API testing                        |
| Frontend             | Next.js + TypeScript    | Planned kitchen dashboard          |
| Styling              | Tailwind CSS            | Planned dashboard styling          |

---

## 🔌 Backend API

The backend exposes REST endpoints for health checks, menu access, order quotation, order creation, and voice-agent tool execution.

### Base URL

Local development:

```text
http://localhost:3000
```

### 1. Health Check

**Endpoint**

```http
GET /api/health
```

Checks whether the backend is running.

Example response:

```json
{
  "status": "ok",
  "message": "Call2Kitchen backend is running"
}
```

### 2. List Menu Items

**Endpoint**

```http
GET /api/menu
```

Returns available menu items from the database.

### 3. Get a Menu Item

**Endpoint**

```http
GET /api/menu/:id
```

Retrieves a menu item by its UUID. Unavailable items are not exposed through this lookup.

### 4. Generate an Order Quote

**Endpoint**

```http
POST /api/orders/quote
```

Accepts menu item IDs and quantities.

Example request:

```json
{
  "items": [
    {
      "menuItemId": "00000000-0000-4000-8000-000000000101",
      "quantity": 2
    },
    {
      "menuItemId": "00000000-0000-4000-8000-000000000103",
      "quantity": 1
    }
  ]
}
```

The backend validates the request, retrieves trusted menu data, and calculates the order total.

A successful response includes a quote identifier, confirmation token, expiration information, and calculated totals.

**The quote does not place an order.**

### 5. Create a Confirmed Order

**Endpoint**

```http
POST /api/orders
```

Accepts a valid server-generated quote and the associated confirmation details.

Example request shape:

```json
{
  "quoteId": "<quote-id>",
  "confirmationToken": "<confirmation-token>",
  "idempotencyKey": "<unique-request-key>",
  "items": [
    {
      "menuItemId": "00000000-0000-4000-8000-000000000101",
      "quantity": 2
    }
  ]
}
```

The backend validates the quote, verifies the submitted request, and delegates atomic order creation to PostgreSQL.

The application should invoke this operation only after explicit customer confirmation has been obtained by the voice-agent workflow.

### 6. Voice-Agent Tool Gateway

**Endpoint**

```http
POST /api/tools/:toolName
```

Supported tools:

| Tool               | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| `get_menu`         | Retrieve the available menu                                  |
| `get_item_details` | Retrieve details for a menu item                             |
| `quote_order`      | Validate items and generate a quote                          |
| `place_order`      | Create an order using a valid quote and confirmation details |

The gateway requires bearer-secret authentication and must be enabled through server configuration.

Example request headers:

```http
Authorization: Bearer <BOLNA_TOOL_GATEWAY_SECRET>
Content-Type: application/json
```

Example request:

```http
POST /api/tools/get_menu
```

```json
{}
```

**Production requirement:** Expose the gateway only over HTTPS, protect the shared secret, and configure the Bolna agent to call the deployed backend URL.

> **Note:** Order-listing and status-update endpoints should be documented here once implemented and verified. The initial backend implementation should not be assumed to provide these operations merely because they are part of the planned kitchen workflow.

---

## 🗄️ Database Design

Call2Kitchen uses Supabase PostgreSQL for persistent data.

### Tables

| Table          | Responsibility                                        |
| -------------- | ----------------------------------------------------- |
| `restaurants`  | Restaurant information and operating status           |
| `menu_items`   | Menu item names, prices, categories, and availability |
| `order_quotes` | Server-generated quotes and confirmation metadata     |
| `orders`       | Persisted customer orders and order totals            |
| `order_items`  | Order line items with price and item snapshots        |

### Order Processing

The intended order lifecycle is:

```text
Customer Request
       │
       ▼
Menu Validation
       │
       ▼
Server-Generated Quote
       │
       ▼
Explicit Customer Confirmation
       │
       ▼
Atomic Order Creation
       │
       ▼
Persisted Order
```

### Database Migrations

The repository includes these migrations:

```text
supabase/
├── migrations/
│   ├── 20261021180000_create_restaurants_and_menu_items.sql
│   ├── 20261021202000_create_order_confirmation_and_orders.sql
│   └── 20261021230000_harden_order_rpc_and_rls.sql
└── seed.sql
```

The migrations establish the menu schema, order and confirmation structures, and additional database safeguards.

The seed file supplies demo restaurant and menu data for development.

---

## 🔐 Security and Reliability

Security is an important part of the ordering workflow because an incorrect or duplicated order can affect real restaurant operations.

### Server-Side Validation

* Requests are validated using Zod schemas.
* Menu item identifiers and quantities are checked.
* Duplicate item IDs and unexpected input properties are rejected where required.
* Prices are retrieved from the database rather than trusted from client input.

### Order Integrity

* Quotes have limited validity periods.
* Confirmation tokens are stored and validated through server-side logic.
* PostgreSQL handles critical order persistence atomically.
* Idempotency keys support safe retries.
* Reusing an idempotency key with conflicting request content is rejected.

### Credential Protection

* The Supabase service-role key must remain on the backend.
* `.env` is excluded from Git.
* `.sf/`, `node_modules/`, and `dist/` are also excluded.
* The voice-agent gateway uses a server-side shared secret.

### Important Production Considerations

Before production deployment:

* Enable and verify Row Level Security on relevant database tables.
* Verify database grants and policies in the deployed Supabase project.
* Keep the service-role key out of all frontend bundles.
* Use HTTPS for all external API traffic.
* Configure gateway authentication and appropriate rate limiting.
* Verify the complete order lifecycle against a staging database.
* Test concurrent requests, retries, expired quotes, and invalid confirmation tokens.
* Never report an order as placed without a successful backend response.

---

## 📁 Project Structure

```text
project-call2kitchen-phase-1-backend-foundation/
│
├── docs/
│   ├── bolna-agent-setup.md
│   ├── phase-8-staging-verification.md
│   └── supabase-staging-verification.md
│
├── src/
│   ├── errors/
│   ├── lib/
│   ├── menu/
│   ├── middleware/
│   ├── orders/
│   ├── routes/
│   ├── tools/
│   ├── app.ts
│   └── server.ts
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── tests/
│
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

### Directory Responsibilities

* `src/routes/` — HTTP route definitions.
* `src/menu/` — Menu data access and related types.
* `src/orders/` — Quote and order validation, business logic, and persistence.
* `src/tools/` — Voice-agent tool gateway implementation.
* `src/middleware/` — Authentication, request handling, and error middleware.
* `src/lib/` — Shared infrastructure, configuration, and Supabase integration.
* `supabase/migrations/` — Database schema and security migrations.
* `supabase/seed.sql` — Demo data.
* `tests/` — Automated application and migration-related tests.
* `docs/` — Integration and staging verification instructions.

---

## 🚀 Getting Started

### Prerequisites

Install the following:

* Node.js with npm.
* Git.
* A Supabase project.
* A code editor such as Visual Studio Code.
* Bolna access for voice-agent integration.

### 1. Clone the Repository

```bash
git clone https://github.com/Shreyans-704/Call2Kitchen.git
cd Call2Kitchen
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the backend root directory.

Use the environment variables described in the next section.

Never commit this file or share its secret values publicly.

### 4. Configure Supabase

Apply the database migrations in the correct order and seed the database if required.

See the [Database Setup](#-database-setup) section.

### 5. Start the Development Server

```bash
npm run dev
```

The backend is configured to listen on port `3000` by default.

### 6. Verify the Server

Open the following endpoint in a browser or API client:

```text
http://localhost:3000/api/health
```

You should receive a successful health-check response.

### 7. Verify Menu Access

Send a GET request to:

```text
http://localhost:3000/api/menu
```

If the Supabase configuration and database are correct, the backend should return the available menu items.

---

## ⚙️ Environment Variables

Configure the following variables in your local `.env` file.

| Variable                    | Purpose                                             |
| --------------------------- | --------------------------------------------------- |
| `NODE_ENV`                  | Application environment                             |
| `PORT`                      | Backend listening port                              |
| `SUPABASE_URL`              | Supabase project URL                                |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase service-role key               |
| `TOOL_GATEWAY_ENABLED`      | Enables the authenticated tool gateway              |
| `BOLNA_TOOL_GATEWAY_SECRET` | Shared secret used to authenticate gateway requests |

Example configuration with placeholder values:

```dotenv
NODE_ENV=development
PORT=3000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

TOOL_GATEWAY_ENABLED=true
BOLNA_TOOL_GATEWAY_SECRET=replace-with-a-long-random-secret
```

Replace the placeholders with your actual configuration.

**Never commit real credentials to GitHub.**

When gateway mode is enabled, the gateway requires the configured bearer secret, and the direct quote and order routes are disabled by the corresponding middleware.

---

## 🗃️ Database Setup

The backend expects the database schema and functions defined by its SQL migrations.

Apply these migrations in order:

### Migration 1 — Restaurants and Menu

```text
20261021180000_create_restaurants_and_menu_items.sql
```

Creates the initial restaurant and menu schema.

### Migration 2 — Orders and Confirmation

```text
20261021202000_create_order_confirmation_and_orders.sql
```

Introduces the quote and order persistence structures and the database order-creation function.

### Migration 3 — RPC Hardening and RLS

```text
20261021230000_harden_order_rpc_and_rls.sql
```

Adds database-side validation and access-control safeguards.

### Seed Data

```text
supabase/seed.sql
```

Provides the demo restaurant and menu items.

The migrations and seed data can be executed through the Supabase SQL Editor or through an appropriately configured migration workflow.

**Important:** Check which migrations have already been applied before executing them against an existing database. Do not blindly rerun schema-changing SQL against a production database.

After setup, verify:

* All expected tables exist.
* The demo restaurant exists.
* Menu items have the expected prices and availability.
* Row Level Security and database grants match the intended security model.
* The order-creation RPC is present and has the expected permissions.

Additional verification instructions are available in:

* `docs/supabase-staging-verification.md`
* `docs/phase-8-staging-verification.md`

---

## 🧪 Testing

Run the available automated tests with:

```bash
npm test
```

Run the TypeScript build:

```bash
npm run build
```

Run targeted tests:

```bash
npx vitest run tests/order.service.test.ts tests/order-rpc.migration.test.ts tests/tool-gateway.service.test.ts
```

The project includes tests covering health checks, menu behavior, order services, quote behavior, and tool-gateway functionality.

Some HTTP tests may require permission to bind a local port. If the environment prevents localhost binding, those tests may fail before reaching their assertions.

A successful TypeScript build or unit-test run does not by itself prove that the deployed Supabase database, Bolna integration, or complete phone-ordering workflow works end to end.

---

## 🚧 Current Development Status

The current repository contains the backend foundation for Call2Kitchen.

| Component                           | Status                |
| ----------------------------------- | --------------------- |
| Node.js and Express backend         | Implemented           |
| TypeScript configuration            | Implemented           |
| Health-check endpoint               | Implemented           |
| Supabase integration                | Implemented           |
| Menu API                            | Implemented           |
| Order quotation service             | Implemented           |
| Order creation service              | Implemented           |
| PostgreSQL order persistence RPC    | Implemented           |
| Idempotency and quote validation    | Implemented           |
| Authenticated tool gateway          | Implemented           |
| Bolna integration documentation     | Available             |
| Supabase migrations and seed data   | Available             |
| Kitchen dashboard frontend          | Planned               |
| End-to-end live phone-order testing | Requires verification |

The presence of backend code and database migrations should not be interpreted as proof that every production integration has been fully tested.

---

## 🗺️ Roadmap

### Phase 1 — Backend Foundation

* [x] Node.js, Express, and TypeScript setup.
* [x] Environment configuration.
* [x] Health-check endpoint.
* [x] Automated testing foundation.

### Phase 2 — Menu Integration

* [x] Supabase client integration.
* [x] Restaurant and menu schema.
* [x] Menu API.
* [x] Demo seed data.

### Phase 3 — Order Quotation

* [x] Input validation.
* [x] Availability checks.
* [x] Trusted database pricing.
* [x] Exact money arithmetic.

### Phase 4 — Order Persistence

* [x] Quote confirmation data.
* [x] Atomic order creation.
* [x] Order item snapshots.
* [x] Idempotency handling.
* [x] Database-side validation.

### Phase 5 — Voice-Agent Integration Preparation

* [x] Bolna tool definitions and setup documentation.
* [x] Order conversation workflow documentation.
* [ ] Complete live voice-agent integration and verification.

### Phase 6 — Tool Gateway

* [x] Authenticated gateway.
* [x] Allow-listed tools.
* [x] Strict request validation.
* [ ] Live Bolna gateway verification.

### Phase 7 — Database Hardening

* [x] Additional RPC validation.
* [x] RLS hardening migration.
* [x] Staging verification documentation.
* [ ] Verify all deployed database policies and permissions.

### Phase 8 — Kitchen Dashboard

* [ ] Build the Next.js dashboard.
* [ ] Display persisted orders.
* [ ] Implement order-status management.
* [ ] Add menu-management views.
* [ ] Integrate live updates.
* [ ] Test the complete kitchen workflow.

### Phase 9 — Production Readiness

* [ ] Deploy the backend.
* [ ] Configure secure production environment variables.
* [ ] Complete end-to-end order testing.
* [ ] Add appropriate monitoring, logging, and rate limiting.
* [ ] Verify failure handling and recovery.

---

## 🎯 Project Goal

Call2Kitchen aims to bridge conversational AI and real-world restaurant operations through a system that is easy to use and reliable at the point where it matters most: the actual order.

The project emphasizes clear separation of responsibilities, trusted pricing, server-side validation, safe persistence, and a foundation for real-time kitchen operations.

**AI handles the conversation. The backend protects the order.**

---

## 👨‍💻 Repository

GitHub: https://github.com/Shreyans-704/Call2Kitchen

Built with Node.js, TypeScript, Express, Supabase, and Bolna integration in mind.
