-- Extend NotificationType enum for order-related notifications
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_PLACED_VENDOR';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_ACCEPTED_CUSTOMER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_REJECTED_CUSTOMER';

