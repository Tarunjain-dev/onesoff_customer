"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeClientErrorMessage = void 0;
const GENERIC_CLIENT_ERROR_MESSAGE = 'Something went wrong. Please try again.';
const SERVICE_UNAVAILABLE_MESSAGE = 'Service is temporarily unavailable. Please try again in a moment.';
const normalizeMessage = (value) => String(value || '').trim();
const extractMessage = (value) => {
    if (value instanceof Error) {
        return normalizeMessage(value.message);
    }
    if (typeof value === 'object' && value !== null) {
        const candidate = value.message ||
            value.error ||
            value.toString?.();
        return normalizeMessage(candidate);
    }
    return normalizeMessage(value);
};
const TECHNICAL_ERROR_PATTERNS = [
    /invalid\s+`prisma\./i,
    /prismaclient/i,
    /raw query failed/i,
    /can't reach database server/i,
    /database_url/i,
    /p\d{4}/i,
    /econnrefused/i,
    /enotfound/i,
    /etimedout/i,
    /timeout exceeded/i,
    /backend[\\/]+src/i,
    /d:\\/i
];
const PROVIDER_ERROR_PATTERNS = [
    /twilio/i,
    /msg91/i,
    /trial accounts cannot send messages/i,
    /phone number is unverified/i,
    /unverified numbers/i,
    /verify it at twilio\.com/i,
    /sms provider/i,
    /messaging service sid/i,
    /verify service sid/i
];
const STACK_TRACE_PATTERNS = [
    /\n\s*at\s+/i,
    /\binvocation\b/i
];
const looksLikeTechnicalError = (message) => {
    if (!message)
        return false;
    if (TECHNICAL_ERROR_PATTERNS.some(pattern => pattern.test(message))) {
        return true;
    }
    return (message.length > 220 &&
        STACK_TRACE_PATTERNS.some(pattern => pattern.test(message)));
};
const isProviderError = (message) => {
    if (!message)
        return false;
    return PROVIDER_ERROR_PATTERNS.some(pattern => pattern.test(message));
};
const isServiceUnavailableError = (message) => {
    if (!message)
        return false;
    return [
        /can't reach database server/i,
        /database server/i,
        /econnrefused/i,
        /enotfound/i,
        /etimedout/i,
        /timeout exceeded/i
    ].some(pattern => pattern.test(message));
};
const sanitizeClientErrorMessage = (value, fallback = GENERIC_CLIENT_ERROR_MESSAGE) => {
    const message = extractMessage(value);
    if (!message) {
        return fallback;
    }
    if (isServiceUnavailableError(message)) {
        return SERVICE_UNAVAILABLE_MESSAGE;
    }
    if (isProviderError(message)) {
        return fallback;
    }
    if (looksLikeTechnicalError(message)) {
        return fallback;
    }
    return message;
};
exports.sanitizeClientErrorMessage = sanitizeClientErrorMessage;
