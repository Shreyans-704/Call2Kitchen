import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/app.js";
import { errorMiddleware } from "../src/middleware/error.middleware.js";

describe("GET /api/health", () => {
  it("returns a 200 JSON response that confirms the backend is running", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/json/);
    expect(response.body).toEqual({
      status: "ok",
      message: "Call2Kitchen backend is running"
    });
  });
});

describe("error middleware", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("returns a consistent JSON response for unexpected errors", async () => {
    const errorLogger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errorTestApp = express();
    errorTestApp.get("/unexpected-error", () => {
      throw new Error("Unexpected test failure");
    });
    errorTestApp.use(errorMiddleware);

    const response = await request(errorTestApp).get("/unexpected-error");

    expect(response.status).toBe(500);
    expect(response.headers["content-type"]).toMatch(/json/);
    expect(response.body).toEqual({
      error: {
        message: "Internal server error",
        statusCode: 500
      }
    });
    expect(errorLogger).toHaveBeenCalledTimes(1);
  });

  it("does not expose unexpected error details in production", async () => {
    process.env.NODE_ENV = "production";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errorTestApp = express();
    errorTestApp.get("/unexpected-error", () => {
      throw new Error("Sensitive implementation detail");
    });
    errorTestApp.use(errorMiddleware);

    const response = await request(errorTestApp).get("/unexpected-error");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        message: "Internal server error",
        statusCode: 500
      }
    });
  });
});

describe("unknown routes", () => {
  it("returns a 404 in the same JSON error format", async () => {
    const response = await request(app).get("/api/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        message: "Route not found: GET /api/missing",
        statusCode: 404
      }
    });
  });
});
