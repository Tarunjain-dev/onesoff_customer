DROP INDEX "Cart_userId_productId_variantId_key";

CREATE UNIQUE INDEX "Cart_userId_productId_variantId_issueDate_returnDate_size_c_key"
ON "Cart"(
  "userId",
  "productId",
  "variantId",
  "issueDate",
  "returnDate",
  "size",
  "color",
  "alterationRequired"
);

CREATE INDEX "Cart_userId_productId_variantId_idx"
ON "Cart"("userId", "productId", "variantId");
