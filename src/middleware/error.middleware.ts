import type { ErrorRequestHandler, RequestHandler } from "express";

import { AppError } from "../errors/app-error.js";

export const notFoundMiddleware: RequestHandler = (request, _response, next) => {
  next(new AppError(`Route not found: ${request.method} ${request.originalUrl}`, 404));
};

export const errorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
  const errorStatus = error.statusCode ?? error.status;
  const statusCode = isValidHttpStatus(errorStatus) ? errorStatus : 500;
  const message =
    statusCode >= 500
      ? "Internal server error"
      : statusCode === 413
        ? "Request body too large"
      : error instanceof SyntaxError && statusCode === 400
        ? "Invalid JSON request body"
        : error.message;

  if (statusCode >= 500) {
    console.error(error);
  }

  response.status(statusCode).json({
    error: {
      message,
      statusCode
    }
  });
};

function isValidHttpStatus(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 400 && value <= 599;
}
