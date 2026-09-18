import "dotenv/config";
import { createServer } from "http";
import app from "./app";
import { startOrderExpiryJob } from "./jobs/orderExpiry.job";
import { initializeSocketServer } from "./realtime/socketServer";
import { getAllowedCorsOrigins } from "./config/cors";
import logger from "./utils/logger";

const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);
initializeSocketServer(httpServer);

httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
  logger.info({ allowedOrigins: getAllowedCorsOrigins() }, 'Resolved CORS allowlist');
  // Start cron jobs
  startOrderExpiryJob();
  
  logger.info('All cron jobs started');
});
