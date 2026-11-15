import { logger } from "../logger.js";

/**
 * Central Error Handler
 * Formats all errors as uniform JSON responses with appropriate HTTP status codes
 */
export const errorHandler = (err, req, res, _next) => {
  const statusCode =
    err.statusCode ||
    (err.status >= 400 && err.status < 600 ? err.status : 500);

  // Log error with structured context
  logger.error(
    {
      err: {
        message: err.message,
        stack: err.stack,
        code: err.code,
      },
      reqId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode,
    },
    err.message || "Internal Server Error",
  );

  // Return clean, informative JSON response
  res.status(statusCode).json({
    error: {
      message: err.message || "Internal Server Error",
      code: err.code || "INTERNAL_ERROR",
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  });
};
