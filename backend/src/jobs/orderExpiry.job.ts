import { PaymentService } from '../services/PaymentService';
import logger from '../utils/logger';
import prisma from '../config/db';

const ORDER_EXPIRY_HOURS = 24;

// Auto-cancel unpaid placed orders that were never completed.
export async function autoRejectExpiredOrders() {
  try {
    const cutoff = new Date(Date.now() - ORDER_EXPIRY_HOURS * 60 * 60 * 1000);
    const expiredOrders = await prisma.orderItem.findMany({
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
      await prisma.$transaction(async (tx) => {
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

      logger.info(`Auto-cancelled expired order item: ${orderItem.id}`);
    }

    logger.info(`Processed ${expiredOrders.length} expired orders`);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error)
      },
      'Error in autoRejectExpiredOrders'
    );
  }
}

// Run every 10 minutes
export function startOrderExpiryJob() {
  setInterval(autoRejectExpiredOrders, 10 * 60 * 1000);
  logger.info('Order expiry job started');
}
