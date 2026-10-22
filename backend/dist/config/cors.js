"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllowedCorsOrigins = exports.socketCorsOptions = exports.corsOptions = void 0;
const normalizeOrigin = (value) => value.trim().replace(/\/+$/, '');
const parseOrigins = (value) => String(value || '')
    .split(',')
    .map(entry => normalizeOrigin(entry))
    .filter(Boolean);
const parsePort = (value, fallback) => {
    const parsed = Number(String(value || '').trim());
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};
const buildLocalOrigins = (ports) => Array.from(new Set(ports))
    .flatMap(port => [`http://localhost:${port}`, `http://127.0.0.1:${port}`]);
const resolveDevelopmentOrigins = () => {
    const explicit = parseOrigins(process.env.FRONTEND_DEV_ORIGINS);
    if (explicit.length > 0) {
        return explicit;
    }
    const devPort = parsePort(process.env.FRONTEND_DEV_PORT, 5173);
    const previewPort = parsePort(process.env.FRONTEND_PREVIEW_PORT, 4173);
    return buildLocalOrigins([devPort, previewPort]);
};
const resolveAllowedOrigins = () => {
    const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
    const configured = [
        ...parseOrigins(process.env.CORS_ALLOWED_ORIGINS),
        ...parseOrigins(process.env.FRONTEND_URL)
    ];
    const developmentOrigins = isProduction ? [] : resolveDevelopmentOrigins();
    if (configured.length > 0 || developmentOrigins.length > 0) {
        return Array.from(new Set([...configured, ...developmentOrigins]));
    }
    if (isProduction) {
        return [];
    }
    return developmentOrigins;
};
const allowedOrigins = resolveAllowedOrigins();
const isOriginAllowed = (origin) => {
    if (!origin)
        return true;
    if (allowedOrigins.length === 0)
        return false;
    return allowedOrigins.includes(normalizeOrigin(origin));
};
const handleCorsOrigin = (origin, callback) => {
    if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
    }
    callback(new Error('Not allowed by CORS'));
};
exports.corsOptions = {
    origin: handleCorsOrigin,
    credentials: true
};
exports.socketCorsOptions = {
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
};
const getAllowedCorsOrigins = () => [...allowedOrigins];
exports.getAllowedCorsOrigins = getAllowedCorsOrigins;
