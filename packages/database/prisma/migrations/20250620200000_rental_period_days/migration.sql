-- Add flexible rental order type and persist rental duration at purchase time.
ALTER TYPE "OrderItemType" ADD VALUE IF NOT EXISTS 'rental';

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "rental_days" INTEGER;

UPDATE "order_items" SET "rental_days" = 15 WHERE "type" = 'rental_15' AND "rental_days" IS NULL;
UPDATE "order_items" SET "rental_days" = 30 WHERE "type" = 'rental_30' AND "rental_days" IS NULL;

INSERT INTO "platform_config" ("key", "value", "updated_at")
VALUES ('rental_period_days', '[15, 30]', NOW())
ON CONFLICT ("key") DO NOTHING;
