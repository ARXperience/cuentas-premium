CREATE TABLE IF NOT EXISTS "client_invoices" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "invoice_number" TEXT NOT NULL UNIQUE,
  "user_id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "currency" TEXT NOT NULL DEFAULT 'COP',
  "issue_date" TIMESTAMP(3) NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  "total_amount" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "auto_generated" BOOLEAN NOT NULL DEFAULT true,
  "admin_notified_at" TIMESTAMP(3),
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "client_invoice_lines" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "invoice_id" TEXT NOT NULL,
  "order_id" TEXT,
  "delivered_account_id" TEXT,
  "description" TEXT NOT NULL,
  "account_email" TEXT,
  "account_password" TEXT,
  "profile_name" TEXT,
  "pin" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_price" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "ordered_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "notes" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "client_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "client_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "client_invoice_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "client_invoice_lines_delivered_account_id_fkey" FOREIGN KEY ("delivered_account_id") REFERENCES "delivered_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_invoices_user_id_period_key" ON "client_invoices"("user_id", "period");
CREATE INDEX IF NOT EXISTS "client_invoices_user_id_idx" ON "client_invoices"("user_id");
CREATE INDEX IF NOT EXISTS "client_invoices_period_idx" ON "client_invoices"("period");
CREATE INDEX IF NOT EXISTS "client_invoices_status_idx" ON "client_invoices"("status");
CREATE INDEX IF NOT EXISTS "client_invoices_due_date_idx" ON "client_invoices"("due_date");
CREATE INDEX IF NOT EXISTS "client_invoice_lines_invoice_id_idx" ON "client_invoice_lines"("invoice_id");
CREATE INDEX IF NOT EXISTS "client_invoice_lines_order_id_idx" ON "client_invoice_lines"("order_id");
CREATE INDEX IF NOT EXISTS "client_invoice_lines_delivered_account_id_idx" ON "client_invoice_lines"("delivered_account_id");
