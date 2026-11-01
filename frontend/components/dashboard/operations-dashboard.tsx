"use client";

import { Section, Stack, Grid } from "@/components/ui/layout";
import { Text, Heading, Label } from "@/components/ui/typography";
import { StatusIndicator } from "@/components/ui/status-indicator";

/**
 * Restaurant Operations Dashboard — Phase 1 placeholder.
 *
 * Staff-facing surface for monitoring incoming orders. No live data is
 * displayed in this phase: order listing and status management connect to
 * the Express backend in a later phase.
 */
export function OperationsDashboard() {
  return (
    <Section padding="lg" className="bg-ink-black min-h-screen">
      <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
        <Stack gap="md" className="pt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Heading level="h1" className="text-gradient-azure">
                Operations Dashboard
              </Heading>
              <Text className="text-text-secondary">
                Monitor and manage incoming restaurant orders.
              </Text>
            </div>

            <div className="flex items-center gap-3">
              <StatusIndicator variant="idle" label="Dashboard standby" />
            </div>
          </div>

          <Grid cols={3} className="mt-6">
            <div className="rounded-lg border border-ink-border bg-ink-surface p-6">
              <Label className="mb-2 block">Orders today</Label>
              <Heading level="h3" className="text-2xl">—</Heading>
            </div>
            <div className="rounded-lg border border-ink-border bg-ink-surface p-6">
              <Label className="mb-2 block">Pending confirmation</Label>
              <Heading level="h3" className="text-2xl">—</Heading>
            </div>
            <div className="rounded-lg border border-ink-border bg-ink-surface p-6">
              <Label className="mb-2 block">Total revenue</Label>
              <Heading level="h3" className="text-2xl">—</Heading>
            </div>
          </Grid>

          <div className="mt-8 rounded-lg border border-ink-border bg-ink-surface">
            <div className="border-b border-ink-border p-6">
              <Heading level="h3" className="mb-1">
                Recent orders
              </Heading>
              <Text small muted>
                Order history appears here once the backend order-listing
                endpoints are integrated.
              </Text>
            </div>
            <div className="p-6 text-center text-text-muted">
              No recent orders
            </div>
          </div>
        </Stack>
      </div>
    </Section>
  );
}
