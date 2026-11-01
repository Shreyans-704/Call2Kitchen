import { Router } from "express";

import { getBolnaEnvironment, type BolnaEnvironment } from "../lib/env.js";
import { AppError } from "../errors/app-error.js";

const BOLNA_SESSION_MINT_ENDPOINT = "https://api.bolna.ai/web-call/freeswitch-session";
const BOLNA_SESSION_MINT_TIMEOUT_MS = 8_000;
const BOLNA_SESSION_RATE_LIMIT_MAX = 10;
const BOLNA_SESSION_RATE_LIMIT_WINDOW_MS = 60_000;

export interface BolnaSessionRouterDependencies {
  getBolnaEnvironment?: () => BolnaEnvironment;
}

export function createBolnaSessionRouter(dependencies: BolnaSessionRouterDependencies = {}): Router {
  const resolveBolnaEnvironment = dependencies.getBolnaEnvironment ?? getBolnaEnvironment;
  const router = Router();

  const mintAttemptsByIp = new Map<string, number[]>();

  function consumeMintAttempt(clientIp: string): boolean {
    const now = Date.now();
    const attempts = (mintAttemptsByIp.get(clientIp) ?? []).filter(
      (timestamp) => now - timestamp < BOLNA_SESSION_RATE_LIMIT_WINDOW_MS
    );

    if (attempts.length >= BOLNA_SESSION_RATE_LIMIT_MAX) {
      mintAttemptsByIp.set(clientIp, attempts);
      return false;
    }

    attempts.push(now);
    mintAttemptsByIp.set(clientIp, attempts);

    if (mintAttemptsByIp.size > 10_000) {
      mintAttemptsByIp.clear();
    }

    return true;
  }

  router.post("/", async (request, response) => {
    const clientIp = request.ip ?? "unknown";

    if (!consumeMintAttempt(clientIp)) {
      throw new AppError("Too many voice session requests", 429);
    }

    let bolna: BolnaEnvironment;
    try {
      bolna = resolveBolnaEnvironment();
    } catch {
      throw new AppError("Voice session minting is not configured", 503);
    }

    const session = await mintBolnaSession(bolna);
    return response.status(200).json(session);
  });

  return router;
}

async function mintBolnaSession(bolna: BolnaEnvironment): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BOLNA_SESSION_MINT_TIMEOUT_MS);

  try {
    const response = await fetch(BOLNA_SESSION_MINT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bolna.BOLNA_API_KEY}`
      },
      body: JSON.stringify({ agent_id: bolna.BOLNA_AGENT_ID }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new AppError("Voice session could not be created", 502);
    }

    const session = (await response.json()) as Record<string, unknown>;

    if (!isUsableSession(session)) {
      throw new AppError("Voice session response was invalid", 502);
    }

    return session;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new AppError("Voice session request timed out", 504);
    }

    throw new AppError("Voice session could not be created", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function isUsableSession(value: Record<string, unknown>): boolean {
  return (
    typeof value.run_id === "string" &&
    typeof value.agent_id === "string" &&
    typeof value.sip_username === "string" &&
    typeof value.sip_password === "string" &&
    typeof value.sip_domain === "string" &&
    typeof value.sip_register === "boolean" &&
    typeof value.expires_in === "number" &&
    Array.isArray(value.ice_servers)
  );
}
