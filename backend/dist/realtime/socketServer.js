"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCKET_SERVER_CONSTANTS = exports.getSocketServer = exports.emitDataUpdatedToRole = exports.emitDataUpdatedToUser = exports.emitNotificationUpdated = exports.initializeSocketServer = void 0;
const socket_io_1 = require("socket.io");
const cors_1 = require("../config/cors");
const authSession_1 = require("../utils/authSession");
const logger_1 = __importDefault(require("../utils/logger"));
const SOCKET_PATH = '/socket.io';
const SOCKET_NOTIFICATION_EVENT = 'notifications:updated';
const SOCKET_DATA_UPDATED_EVENT = 'data:updated';
let io = null;
const roomForUser = (userId) => `user:${String(userId).trim()}`;
const roomForRole = (role) => `role:${String(role).trim().toUpperCase()}`;
const extractToken = (socket) => {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
        return authToken.trim();
    }
    const headerAuth = socket.handshake.headers.authorization;
    if (typeof headerAuth === 'string' && headerAuth.trim()) {
        return (0, authSession_1.parseBearerToken)(headerAuth);
    }
    return '';
};
const attachSocketRooms = (socket, payload) => {
    socket.join(roomForUser(payload.userId));
    if (payload.role) {
        socket.join(roomForRole(payload.role));
    }
    if (payload.customerId) {
        socket.join(`customer:${String(payload.customerId).trim()}`);
    }
    if (payload.vendorId) {
        socket.join(`vendor:${String(payload.vendorId).trim()}`);
    }
    if (payload.adminId) {
        socket.join(`admin:${String(payload.adminId).trim()}`);
    }
};
const initializeSocketServer = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        path: SOCKET_PATH,
        cors: cors_1.socketCorsOptions
    });
    io.use(async (socket, next) => {
        const token = extractToken(socket);
        if (!token) {
            return next(new Error('Access token required'));
        }
        const payload = await (0, authSession_1.verifySessionBackedAccessToken)(token);
        if (!payload) {
            return next(new Error('Session expired'));
        }
        socket.data.user = payload;
        return next();
    });
    io.on('connection', socket => {
        const payload = socket.data.user;
        if (!payload?.userId) {
            socket.disconnect(true);
            return;
        }
        attachSocketRooms(socket, payload);
        logger_1.default.info({
            userId: payload.userId,
            role: payload.role,
            socketId: socket.id
        }, 'Socket connected');
        socket.on('disconnect', reason => {
            logger_1.default.info({
                userId: payload.userId,
                role: payload.role,
                socketId: socket.id,
                reason
            }, 'Socket disconnected');
        });
    });
    return io;
};
exports.initializeSocketServer = initializeSocketServer;
const emitNotificationUpdated = (userId, payload) => {
    if (!io)
        return;
    io.to(roomForUser(userId)).emit(SOCKET_NOTIFICATION_EVENT, {
        ...payload,
        changedAt: new Date().toISOString()
    });
};
exports.emitNotificationUpdated = emitNotificationUpdated;
const emitDataUpdatedToUser = (userId, payload) => {
    if (!io)
        return;
    const domains = Array.isArray(payload.domains)
        ? Array.from(new Set(payload.domains.filter(Boolean)))
        : [];
    if (domains.length === 0)
        return;
    io.to(roomForUser(userId)).emit(SOCKET_DATA_UPDATED_EVENT, {
        ...payload,
        domains,
        changedAt: new Date().toISOString()
    });
};
exports.emitDataUpdatedToUser = emitDataUpdatedToUser;
const emitDataUpdatedToRole = (role, payload) => {
    if (!io)
        return;
    const domains = Array.isArray(payload.domains)
        ? Array.from(new Set(payload.domains.filter(Boolean)))
        : [];
    if (domains.length === 0)
        return;
    io.to(roomForRole(role)).emit(SOCKET_DATA_UPDATED_EVENT, {
        ...payload,
        domains,
        changedAt: new Date().toISOString()
    });
};
exports.emitDataUpdatedToRole = emitDataUpdatedToRole;
const getSocketServer = () => io;
exports.getSocketServer = getSocketServer;
exports.SOCKET_SERVER_CONSTANTS = {
    path: SOCKET_PATH,
    events: {
        notificationsUpdated: SOCKET_NOTIFICATION_EVENT,
        dataUpdated: SOCKET_DATA_UPDATED_EVENT
    }
};
