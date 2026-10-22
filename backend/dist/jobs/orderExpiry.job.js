"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoRejectExpiredOrders = autoRejectExpiredOrders;
exports.startOrderExpiryJob = startOrderExpiryJob;
const logger_1 = __importDefault(require("../utils/logger"));
const db_1 = __importDefault(require("../config/db"));
const ORDER_EXPIRY_HOURS = 24;
// Auto-cancel unpaid placed orders that were never completed.
async function autoRejectExpiredOrders() {
    try {
        const cutoff = new Date(Date.now() - ORDER_EXPIRY_HOURS * 60 * 60 * 1000);
        const expiredOrders = await db_1.default.orderItem.findMany({
            where: {
                status: 'PLACED',
                order: {
                    paymentStatus: 'UNPAID',
                    createdAt: {
                        lt: cutoff
                    }
                }
            },
            include: { order: true }
        });
        for (const orderItem of expiredOrders) {
            await db_1.default.$transaction(async (tx) => {
                await tx.orderItem.update({
                    where: { id: orderItem.id },
                    data: {
                        status: 'CANCELLED'
                    }
                });
                await tx.productVariant.update({
                    where: { id: orderItem.variantId },
                    data: {
                        quantity: {
                            increment: orderItem.quantity
                        }
                    }
                });
            });
            logger_1.default.info(`Auto-cancelled expired order item: ${orderItem.id}`);
        }
        logger_1.default.info(`Processed ${expiredOrders.length} expired orders`);
    }
    catch (error) {
        logger_1.default.error({
            error: error instanceof Error ? error.message : String(error)
        }, 'Error in autoRejectExpiredOrders');
    }
}
// Run every 10 minutes
function startOrderExpiryJob() {
    setInterval(autoRejectExpiredOrders, 10 * 60 * 1000);
    logger_1.default.info('Order expiry job started');
}
