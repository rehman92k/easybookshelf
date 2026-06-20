-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "list_unit_price" DECIMAL(10,2);
ALTER TABLE "order_items" ADD COLUMN "member_discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "order_items" SET "list_unit_price" = "unit_price" WHERE "list_unit_price" IS NULL;

ALTER TABLE "order_items" ALTER COLUMN "list_unit_price" SET NOT NULL;
