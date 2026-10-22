"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const http_1 = require("http");
const app_1 = __importDefault(require("./app"));
const orderExpiry_job_1 = require("./jobs/orderExpiry.job");
const socketServer_1 = require("./realtime/socketServer");
const cors_1 = require("./config/cors");
const logger_1 = __importDefault(require("./utils/logger"));
const PORT = process.env.PORT || 3000;
const httpServer = (0, http_1.createServer)(app_1.default);
(0, socketServer_1.initializeSocketServer)(httpServer);
httpServer.listen(PORT, () => {
    logger_1.default.info(`Server running on port ${PORT}`);
    console.log(`Server running on port ${PORT}`);
    logger_1.default.info({ allowedOrigins: (0, cors_1.getAllowedCorsOrigins)() }, 'Resolved CORS allowlist');
    // Start cron jobs
    (0, orderExpiry_job_1.startOrderExpiryJob)();
    logger_1.default.info('All cron jobs started');
});
