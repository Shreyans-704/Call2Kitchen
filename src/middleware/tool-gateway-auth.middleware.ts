import { timingSafeEqual } from "node:crypto";

import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error.js";
import { env, getToolGatewayEnvironment } from "../lib/env.js";

const bearerPrefix = "Bearer ";

/**
 * Compares a bearer credential without leaking partial-match information.
 * It deliberately returns only true/false, so callers receive one generic
 * authentication failure for missing and incorrect credentials alike.
 */
export function hasValidGatewayAuthorization(
  authorizationHeader: string | undefined,
  expectedSecret: string
): boolean {
  if (!authorizationHeader?.startsWith(bearerPrefix)) {
    return false;
  }

  const suppliedSecret = Buffer.from(authorizationHeader.slice(bearerPrefix.length));
  const expectedSecretBuffer = Buffer.from(expectedSecret);

  return (
    suppliedSecret.length === expectedSecretBuffer.length &&
    timingSafeEqual(suppliedSecret, expectedSecretBuffer)
  );
}

export function createToolGatewayAuthMiddleware(
  secretProvider: () => string | undefined = getConfiguredGatewaySecret
): RequestHandler {
  return (request, _response, next) => {
    const expectedSecret = secretProvider();

    if (!expectedSecret) {
      next(new AppError("Tool gateway is not enabled", 404));
      return;
    }

    if (!hasValidGatewayAuthorization(request.header("authorization"), expectedSecret)) {
      next(new AppError("Unauthorized tool request", 401));
      return;
    }

    next();
  };
}

function getConfiguredGatewaySecret(): string | undefined {
  if (!env.TOOL_GATEWAY_ENABLED) {
    return undefined;
  }

  return getToolGatewayEnvironment().BOLNA_TOOL_GATEWAY_SECRET;
}
