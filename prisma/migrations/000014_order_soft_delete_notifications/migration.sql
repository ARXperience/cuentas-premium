ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;

CREATE INDEX IF NOT EXISTS "orders_deleted_at_idx" ON "orders"("deleted_at");
