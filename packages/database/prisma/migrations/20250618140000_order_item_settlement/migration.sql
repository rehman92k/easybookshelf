-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "settlement_id" UUID;

-- CreateIndex
CREATE INDEX "order_items_settlement_id_idx" ON "order_items"("settlement_id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
