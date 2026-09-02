ALTER TABLE "client_invoices" ADD COLUMN IF NOT EXISTS "period_start" TIMESTAMP(3);
ALTER TABLE "client_invoices" ADD COLUMN IF NOT EXISTS "period_end" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "client_invoices_period_start_idx" ON "client_invoices"("period_start");
CREATE INDEX IF NOT EXISTS "client_invoices_period_end_idx" ON "client_invoices"("period_end");
