import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBolnaSessionRouter } from "../src/routes/bolna.routes.js";
import { errorMiddleware, notFoundMiddleware } from "../src/middleware/error.middleware.js";
import type { BolnaEnvironment } from "../src/lib/env.js";

const BOLNA_SESSION_MINT_ENDPOINT = "https://api.bolna.ai/web-call/freeswitch-session";

const validSession = {
  run_id: "run-1",
  agent_id: "agent-1",
  sip_username: "sip-user-1",
  sip_password: "sip-pass-1",
  sip_domain: "bolna.example",
  sip_register: false,
  expires_in: 120,
  ice_servers: []
};

const validBolna: BolnaEnvironment = {
  BOLNA_API_KEY: "bn_test_key",
  BOLNA_AGENT_ID: "agent_test"
};

function buildBolnaSessionApp(envProvider: () => BolnaEnvironment) {
  const app = express();
  app.use(express.json({ limit: "16kb" }));
  app.use("/api/bolna-session", createBolnaSessionRouter({ getBolnaEnvironment: envProvider }));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
  return app;
}

describe("POST /api/bolna-session", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 503 when Bolna session configuration is missing", async () => {
    const app = buildBolnaSessionApp(() => {
      throw new Error("Bolna configuration is missing or invalid");
    });

    const response = await request(app).post("/api/bolna-session").send({});

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: {
        // All 5xx responses use a generic message by design.
        message: "Internal server error",
        statusCode: 503
      }
    });
  });

  it("mints a session through the Bolna web-call endpoint and returns it", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => validSession
    }));
    vi.stubGlobal("fetch", fetchMock);

    const app = buildBolnaSessionApp(() => validBolna);
    const response = await request(app).post("/api/bolna-session").send({ user_data: { restaurantId: "restaurant-1" } });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(validSession);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [input, init] = fetchMock.mock.calls[0] as unknown as [string, { method?: string; headers?: Record<string, string>; body?: string }];
    expect(input).toBe(BOLNA_SESSION_MINT_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.headers?.Authorization).toBe(`Bearer ${validBolna.BOLNA_API_KEY}`);
    expect(JSON.parse(init.body ?? "{}")).toEqual({ agent_id: validBolna.BOLNA_AGENT_ID });
  });

  it("returns 502 when the upstream session mint fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: "agent unavailable" } })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const app = buildBolnaSessionApp(() => validBolna);
    const response = await request(app).post("/api/bolna-session").send({});

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: {
        message: "Internal server error",
        statusCode: 502
      }
    });
  });

  it("returns 502 when the upstream session response is invalid", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({})
    }));
    vi.stubGlobal("fetch", fetchMock);

    const app = buildBolnaSessionApp(() => validBolna);
    const response = await request(app).post("/api/bolna-session").send({});

    expect(response.status).toBe(502);
  });

  it("returns 504 when the upstream session mint times out", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    const fetchMock = vi.fn((_input: unknown, _init?: unknown) => Promise.reject(abortError));
    vi.stubGlobal("fetch", fetchMock);

    const app = buildBolnaSessionApp(() => validBolna);
    const response = await request(app).post("/api/bolna-session").send({});

    expect(response.status).toBe(504);
  });

  it("rate limits session minting per client", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => validSession
    }));
    vi.stubGlobal("fetch", fetchMock);

    const app = buildBolnaSessionApp(() => validBolna);
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await request(app).post("/api/bolna-session").send({});
      statuses.push(response.status);
    }

    expect(statuses.filter((status) => status === 200)).toHaveLength(10);
    expect(statuses[10]).toBe(429);
  });

  it("does not include configuration values in error responses", async () => {
    const app = buildBolnaSessionApp(() => {
      throw new Error("Bolna configuration is missing or invalid");
    });

    const response = await request(app).post("/api/bolna-session").send({});

    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain("bn_test_key");
    expect(raw).not.toContain("agent_test");
  });
});
