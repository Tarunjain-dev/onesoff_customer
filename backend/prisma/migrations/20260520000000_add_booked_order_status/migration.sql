-- Add BOOKED status to OrderItemStatus enum
ALTER TYPE "OrderItemStatus" ADD VALUE 'BOOKED' AFTER 'PLACED';
