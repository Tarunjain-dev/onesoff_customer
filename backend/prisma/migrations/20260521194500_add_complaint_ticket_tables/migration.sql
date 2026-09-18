CREATE TABLE "ComplaintTicket" (
    "id" BIGSERIAL NOT NULL,
    "complaintNo" TEXT NOT NULL,
    "raisedByUserId" BIGINT NOT NULL,
    "raisedByRole" TEXT NOT NULL,
    "vendorId" BIGINT,
    "orderId" BIGINT,
    "orderItemId" BIGINT,
    "orderReference" TEXT,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "adminResponse" TEXT,
    "adminRespondedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "resolutionNotes" TEXT,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ComplaintTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplaintTicketMessage" (
    "id" BIGSERIAL NOT NULL,
    "complaintId" BIGINT NOT NULL,
    "senderUserId" BIGINT,
    "senderRole" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintTicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComplaintTicket_complaintNo_key" ON "ComplaintTicket"("complaintNo");
CREATE INDEX "ComplaintTicket_raisedByUserId_createdAt_idx" ON "ComplaintTicket"("raisedByUserId", "createdAt");
CREATE INDEX "ComplaintTicket_vendorId_createdAt_idx" ON "ComplaintTicket"("vendorId", "createdAt");
CREATE INDEX "ComplaintTicket_status_createdAt_idx" ON "ComplaintTicket"("status", "createdAt");
CREATE INDEX "ComplaintTicket_raisedByRole_createdAt_idx" ON "ComplaintTicket"("raisedByRole", "createdAt");
CREATE INDEX "ComplaintTicketMessage_complaintId_createdAt_idx" ON "ComplaintTicketMessage"("complaintId", "createdAt");
CREATE INDEX "ComplaintTicketMessage_senderUserId_createdAt_idx" ON "ComplaintTicketMessage"("senderUserId", "createdAt");

ALTER TABLE "ComplaintTicket"
ADD CONSTRAINT "ComplaintTicket_raisedByUserId_fkey"
FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplaintTicket"
ADD CONSTRAINT "ComplaintTicket_vendorId_fkey"
FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ComplaintTicket"
ADD CONSTRAINT "ComplaintTicket_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ComplaintTicket"
ADD CONSTRAINT "ComplaintTicket_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ComplaintTicketMessage"
ADD CONSTRAINT "ComplaintTicketMessage_complaintId_fkey"
FOREIGN KEY ("complaintId") REFERENCES "ComplaintTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplaintTicketMessage"
ADD CONSTRAINT "ComplaintTicketMessage_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
