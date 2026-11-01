import type { RequestHandler } from "express";

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3001"];

export interface CorsMiddlewareOptions {
  allowedOrigins?: string[];
}

export function createCorsMiddleware(options: CorsMiddlewareOptions = {}): RequestHandler {
  const allowedOrigins = options.allowedOrigins ?? parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);

  const corsHandler: RequestHandler = (request, response, next) => {
    const origin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;

    if (origin && allowedOrigins.includes(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  };

  return corsHandler;
}

function parseAllowedOrigins(value: string | undefined): string[] {
  const raw = value ?? DEFAULT_ALLOWED_ORIGINS.join(",");
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
}
