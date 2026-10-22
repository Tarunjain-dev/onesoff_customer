"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const errors_1 = require("@/utils/errors");
const clientErrorMessage_1 = require("@/utils/clientErrorMessage");
const logger_1 = __importDefault(require("@/utils/logger"));
const errorHandler = (err, req, res, next) => {
    logger_1.default.error({ err, req: { method: req.method, url: req.url } });
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            success: false,
            error: "Validation failed",
            details: err.issues
        });
    }
    if (err instanceof errors_1.AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: (0, clientErrorMessage_1.sanitizeClientErrorMessage)(err, "Something went wrong. Please try again."),
            code: err.code
        });
    }
    return res.status(500).json({
        success: false,
        error: "Internal server error"
    });
};
exports.errorHandler = errorHandler;
