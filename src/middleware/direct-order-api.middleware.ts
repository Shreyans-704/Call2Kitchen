import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error.js";
import { env } from "../lib/env.js";

/**
 * Once the external tool gateway is enabled, its authenticated route is the
 * only supported entry point for quote creation and order placement. Menu
 * reads remain public for the MVP.
 */
export const disableDirectOrderApiWhenGatewayEnabled: RequestHandler = (
  _request,
  _response,
  next
) => {
  if (env.TOOL_GATEWAY_ENABLED) {
    next(new AppError("Route not found", 404));
    return;
  }

  next();
};
