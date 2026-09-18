-- OrderItem.vendorId should reference VendorProfile.id only.
-- This removes the conflicting FK to User.id that caused inserts to fail
-- when VendorProfile.id != User.id.
ALTER TABLE "OrderItem"
DROP CONSTRAINT IF EXISTS "OrderItem_vendorUser_fkey";
