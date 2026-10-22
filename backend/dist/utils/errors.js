"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessLogicError = exports.NotFoundError = exports.AuthError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode = 500, code) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.code = code;
        this.name = this.constructor.name;
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message) {
        super(message, 400, "VALIDATION_ERROR");
    }
}
exports.ValidationError = ValidationError;
class AuthError extends AppError {
    constructor(message) {
        super(message, 401, "AUTH_ERROR");
    }
}
exports.AuthError = AuthError;
class NotFoundError extends AppError {
    constructor(message) {
        super(message, 404, "NOT_FOUND");
    }
}
exports.NotFoundError = NotFoundError;
class BusinessLogicError extends AppError {
    constructor(message) {
        super(message, 400, "BUSINESS_LOGIC_ERROR");
    }
}
exports.BusinessLogicError = BusinessLogicError;
