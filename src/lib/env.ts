import "dotenv/config";

import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  TOOL_GATEWAY_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true")
});

const supabaseEnvironmentSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1)
});

const toolGatewayEnvironmentSchema = z.object({
  BOLNA_TOOL_GATEWAY_SECRET: z.string().min(32)
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  console.error("Invalid environment configuration:", parsedEnvironment.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsedEnvironment.data;

export type SupabaseEnvironment = z.infer<typeof supabaseEnvironmentSchema>;
export type ToolGatewayEnvironment = z.infer<typeof toolGatewayEnvironmentSchema>;

/**
 * Validates database configuration only when the real server starts or a
 * database-backed request is made. Keeping it separate lets API tests import
 * the Express app without needing real credentials.
 */
export function getSupabaseEnvironment(): SupabaseEnvironment {
  const parsedSupabaseEnvironment = supabaseEnvironmentSchema.safeParse(process.env);

  if (!parsedSupabaseEnvironment.success) {
    console.error(
      "Invalid Supabase configuration:",
      parsedSupabaseEnvironment.error.flatten().fieldErrors
    );
    throw new Error("Supabase configuration is missing or invalid");
  }

  return parsedSupabaseEnvironment.data;
}

/**
 * Validates the inbound tool credential only when the gateway is enabled.
 * This keeps local API tests and non-Bolna deployments credential-free.
 */
export function getToolGatewayEnvironment(): ToolGatewayEnvironment {
  const parsedToolGatewayEnvironment = toolGatewayEnvironmentSchema.safeParse(process.env);

  if (!parsedToolGatewayEnvironment.success) {
    console.error(
      "Invalid tool gateway configuration:",
      parsedToolGatewayEnvironment.error.flatten().fieldErrors
    );
    throw new Error("Tool gateway configuration is missing or invalid");
  }

  return parsedToolGatewayEnvironment.data;
}
