ALTER TABLE "client_invoices"
  ADD COLUMN IF NOT EXISTS "scheduled_send_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sent_to" TEXT,
  ADD COLUMN IF NOT EXISTS "send_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_send_error" TEXT;

CREATE INDEX IF NOT EXISTS "client_invoices_scheduled_send_at_idx" ON "client_invoices"("scheduled_send_at");
CREATE INDEX IF NOT EXISTS "client_invoices_sent_at_idx" ON "client_invoices"("sent_at");
