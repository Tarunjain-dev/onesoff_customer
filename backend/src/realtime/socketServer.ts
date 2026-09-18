import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { socketCorsOptions } from '../config/cors';
import {
  parseBearerToken,
  verifySessionBackedAccessToken
} from '../utils/authSession';
import logger from '../utils/logger';

type SocketAuthPayload = {
  userId: string;
  role: string;
  sessionId: string;
  customerId?: string;
  vendorId?: string;
  adminId?: string;
};

type NotificationSocketPayload = {
  unreadCount?: number;
  notification?: Record<string, unknown>;
  changedAt: string;
};

type RealtimeDataDomain =
  | 'orders'
  | 'products'
  | 'trials'
  | 'operations'
  | 'refunds'
  | 'finance'
  | 'support'
  | 'dashboard';

type DataUpdateSocketPayload = {
  domains: RealtimeDataDomain[];
  refs?: Record<string, string>;
  reason?: string;
  changedAt: string;
};

const SOCKET_PATH = '/socket.io';
const SOCKET_NOTIFICATION_EVENT = 'notifications:updated';
const SOCKET_DATA_UPDATED_EVENT = 'data:updated';

let io: SocketIOServer | null = null;

const roomForUser = (userId: string) => `user:${String(userId).trim()}`;
const roomForRole = (role: string) => `role:${String(role).trim().toUpperCase()}`;

const extractToken = (socket: Socket) => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim();
  }

  const headerAuth = socket.handshake.headers.authorization;
  if (typeof headerAuth === 'string' && headerAuth.trim()) {
    return parseBearerToken(headerAuth);
  }

  return '';
};

const attachSocketRooms = (socket: Socket, payload: SocketAuthPayload) => {
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

export const initializeSocketServer = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
    path: SOCKET_PATH,
    cors: socketCorsOptions
  });

  io.use(async (socket, next) => {
    const token = extractToken(socket);
    if (!token) {
      return next(new Error('Access token required'));
    }

    const payload = await verifySessionBackedAccessToken(token);
    if (!payload) {
      return next(new Error('Session expired'));
    }

    socket.data.user = payload as SocketAuthPayload;
    return next();
  });

  io.on('connection', socket => {
    const payload = socket.data.user as SocketAuthPayload | undefined;
    if (!payload?.userId) {
      socket.disconnect(true);
      return;
    }

    attachSocketRooms(socket, payload);
    logger.info(
      {
        userId: payload.userId,
        role: payload.role,
        socketId: socket.id
      },
      'Socket connected'
    );

    socket.on('disconnect', reason => {
      logger.info(
        {
          userId: payload.userId,
          role: payload.role,
          socketId: socket.id,
          reason
        },
        'Socket disconnected'
      );
    });
  });

  return io;
};

export const emitNotificationUpdated = (
  userId: string,
  payload: Omit<NotificationSocketPayload, 'changedAt'>
) => {
  if (!io) return;
  io.to(roomForUser(userId)).emit(SOCKET_NOTIFICATION_EVENT, {
    ...payload,
    changedAt: new Date().toISOString()
  });
};

export const emitDataUpdatedToUser = (
  userId: string,
  payload: Omit<DataUpdateSocketPayload, 'changedAt'>
) => {
  if (!io) return;
  const domains = Array.isArray(payload.domains)
    ? Array.from(new Set(payload.domains.filter(Boolean)))
    : [];
  if (domains.length === 0) return;

  io.to(roomForUser(userId)).emit(SOCKET_DATA_UPDATED_EVENT, {
    ...payload,
    domains,
    changedAt: new Date().toISOString()
  });
};

export const emitDataUpdatedToRole = (
  role: string,
  payload: Omit<DataUpdateSocketPayload, 'changedAt'>
) => {
  if (!io) return;
  const domains = Array.isArray(payload.domains)
    ? Array.from(new Set(payload.domains.filter(Boolean)))
    : [];
  if (domains.length === 0) return;

  io.to(roomForRole(role)).emit(SOCKET_DATA_UPDATED_EVENT, {
    ...payload,
    domains,
    changedAt: new Date().toISOString()
  });
};

export const getSocketServer = () => io;

export const SOCKET_SERVER_CONSTANTS = {
  path: SOCKET_PATH,
  events: {
    notificationsUpdated: SOCKET_NOTIFICATION_EVENT,
    dataUpdated: SOCKET_DATA_UPDATED_EVENT
  }
} as const;
