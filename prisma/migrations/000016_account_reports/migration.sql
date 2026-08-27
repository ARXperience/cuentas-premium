CREATE TABLE IF NOT EXISTS "account_reports" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "delivered_account_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "evidence_data_url" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "admin_notes" TEXT,
  "resolved_by" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "account_reports_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "account_reports_delivered_account_id_fkey" FOREIGN KEY ("delivered_account_id") REFERENCES "delivered_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "account_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "account_reports_user_id_idx" ON "account_reports"("user_id");
CREATE INDEX IF NOT EXISTS "account_reports_order_id_idx" ON "account_reports"("order_id");
CREATE INDEX IF NOT EXISTS "account_reports_delivered_account_id_idx" ON "account_reports"("delivered_account_id");
CREATE INDEX IF NOT EXISTS "account_reports_status_idx" ON "account_reports"("status");
CREATE INDEX IF NOT EXISTS "account_reports_created_at_idx" ON "account_reports"("created_at");
