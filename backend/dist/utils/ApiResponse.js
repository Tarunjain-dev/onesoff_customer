"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
const clientErrorMessage_1 = require("./clientErrorMessage");
exports.ApiResponse = {
    success(res, data = null, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data
        });
    },
    error(res, message = 'Error', statusCode = 400, errors = null) {
        return res.status(statusCode).json({
            success: false,
            message: (0, clientErrorMessage_1.sanitizeClientErrorMessage)(message, 'Something went wrong. Please try again.'),
            errors
        });
    },
    unauthorized(res, message = 'Unauthorized') {
        return res.status(401).json({
            success: false,
            message
        });
    },
    forbidden(res, message = 'Forbidden') {
        return res.status(403).json({
            success: false,
            message
        });
    },
    notFound(res, message = 'Not found') {
        return res.status(404).json({
            success: false,
            message
        });
    }
};
