import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../supabase/migrations/20261021230000_harden_order_rpc_and_rls.sql",
  import.meta.url
);

describe("Phase 7 order-RPC hardening migration", () => {
  it("keeps server-owned order tables behind RLS and the RPC behind service_role", async () => {
    const sql = await readFile(migrationUrl, "utf8");

    expect(sql).toContain("alter table public.order_quotes enable row level security");
    expect(sql).toContain("alter table public.orders enable row level security");
    expect(sql).toContain("alter table public.order_items enable row level security");
    expect(sql).toContain("security definer");
    expect(sql).toContain("revoke all on function public.create_confirmed_order");
    expect(sql).toContain("grant execute on function public.create_confirmed_order");
    expect(sql).toContain("to service_role");
  });

  it("retains atomic order writes and validates the trusted confirmation path", async () => {
    const sql = await readFile(migrationUrl, "utf8");

    expect(sql).toContain("for update");
    expect(sql).toContain("invalid_confirmation_token");
    expect(sql).toContain("quote_expired");
    expect(sql).toContain("quote_already_consumed");
    expect(sql).toContain("invalid_request_hash");
    expect(sql).toContain("idempotency_conflict");
    expect(sql).toContain("insert into public.orders");
    expect(sql).toContain("insert into public.order_items");
    expect(sql).toContain("set consumed_at = now()");
  });
});
