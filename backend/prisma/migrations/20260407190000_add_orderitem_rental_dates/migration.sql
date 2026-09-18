-- Add explicit rental lifecycle date fields for accurate vendor dashboard KPIs
ALTER TABLE "OrderItem"
ADD COLUMN "rentalStartDate" TIMESTAMP(3),
ADD COLUMN "returnDueDate" TIMESTAMP(3),
ADD COLUMN "returnedAt" TIMESTAMP(3);

CREATE INDEX "OrderItem_vendorId_returnDueDate_idx"
ON "OrderItem"("vendorId", "returnDueDate");

CREATE INDEX "OrderItem_status_returnDueDate_idx"
ON "OrderItem"("status", "returnDueDate");

