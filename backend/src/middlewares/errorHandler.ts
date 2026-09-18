import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "@/utils/errors";
import { sanitizeClientErrorMessage } from "@/utils/clientErrorMessage";
import logger from "@/utils/logger";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error({ err, req: { method: req.method, url: req.url } });

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: err.issues
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: sanitizeClientErrorMessage(err, "Something went wrong. Please try again."),
      code: err.code
    });
  }

  return res.status(500).json({
    success: false,
    error: "Internal server error"
  });
};
