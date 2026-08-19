-- CreateEnum
CREATE TYPE "Role" AS ENUM ('client', 'provider', 'admin');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('admin_payment_pending', 'provider_delivery_pending', 'wallet_pending', 'payout_processing', 'pending_payment', 'paid', 'pending', 'processing', 'delivered', 'payout_failed', 'payment_failed', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "access_code" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'client',
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "provider_cost" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "brand_key" TEXT NOT NULL DEFAULT 'default',
    "duration" TEXT,
    "screens" TEXT,
    "content_type" TEXT,
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "total" INTEGER NOT NULL,
    "sale_total" INTEGER NOT NULL DEFAULT 0,
    "provider_total" INTEGER NOT NULL DEFAULT 0,
    "profit_total" INTEGER NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending_payment',
    "wallet_status" TEXT NOT NULL DEFAULT 'pending',
    "payout_status" TEXT NOT NULL DEFAULT 'pending',
    "billing_period" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "payment_method" TEXT,
    "payment_reference" TEXT,
    "payment_provider" TEXT,
    "payment_amount" INTEGER,
    "payment_confirmed_at" TIMESTAMP(3),
    "payment_receipt_url" TEXT,
    "whatsapp_sent" BOOLEAN NOT NULL DEFAULT false,
    "admin_notified_at" TIMESTAMP(3),
    "admin_notification_channel" TEXT,
    "provider_payment_marked_at" TIMESTAMP(3),
    "delivery_processed_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "client_notified_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "deleted_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_movements" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_payouts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "transaction_id" TEXT,
    "reference" TEXT,
    "admin_payment_reference" TEXT,
    "admin_payment_notes" TEXT,
    "admin_marked_by" TEXT,
    "admin_marked_at" TIMESTAMP(3),
    "destination_type" TEXT,
    "destination_phone" TEXT,
    "destination_document" TEXT,
    "receipt_text" TEXT,
    "raw_response" JSONB,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_payment_configs" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT,
    "method" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "document" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_payment_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_outbox" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "order_id" TEXT,
    "payout_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_inbound_messages" (
    "id" TEXT NOT NULL,
    "whatsapp_message_id" TEXT,
    "from" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "raw_payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'received',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_inbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_drafts" (
    "id" TEXT NOT NULL,
    "inbound_message_id" TEXT,
    "order_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'needs_review',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "raw_text" TEXT NOT NULL,
    "parsed_data" JSONB NOT NULL,
    "review_notes" TEXT,
    "created_by" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "transaction_id" TEXT,
    "reference" TEXT,
    "raw_response" JSONB,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivered_accounts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "delivered_email" TEXT,
    "delivered_password" TEXT,
    "profile_name" TEXT,
    "pin" TEXT,
    "notes" TEXT,
    "delivered_by" TEXT NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivered_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "order_id" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "private" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_access_code_key" ON "users"("access_code");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_active_idx" ON "products"("active");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_order_number_idx" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_provider_id_idx" ON "orders"("provider_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_payment_status_idx" ON "orders"("payment_status");

-- CreateIndex
CREATE INDEX "orders_wallet_status_idx" ON "orders"("wallet_status");

-- CreateIndex
CREATE INDEX "orders_payout_status_idx" ON "orders"("payout_status");

-- CreateIndex
CREATE INDEX "orders_billing_period_idx" ON "orders"("billing_period");

-- CreateIndex
CREATE INDEX "orders_deleted_at_idx" ON "orders"("deleted_at");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "client_wallets_user_id_key" ON "client_wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallet_movements_wallet_id_idx" ON "wallet_movements"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_movements_user_id_idx" ON "wallet_movements"("user_id");

-- CreateIndex
CREATE INDEX "wallet_movements_order_id_idx" ON "wallet_movements"("order_id");

-- CreateIndex
CREATE INDEX "wallet_movements_type_idx" ON "wallet_movements"("type");

-- CreateIndex
CREATE INDEX "provider_payouts_order_id_idx" ON "provider_payouts"("order_id");

-- CreateIndex
CREATE INDEX "provider_payouts_status_idx" ON "provider_payouts"("status");

-- CreateIndex
CREATE INDEX "provider_payouts_transaction_id_idx" ON "provider_payouts"("transaction_id");

-- CreateIndex
CREATE INDEX "provider_payouts_reference_idx" ON "provider_payouts"("reference");

-- CreateIndex
CREATE INDEX "provider_payment_configs_provider_id_idx" ON "provider_payment_configs"("provider_id");

-- CreateIndex
CREATE INDEX "provider_payment_configs_method_idx" ON "provider_payment_configs"("method");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_outbox_payout_id_key" ON "whatsapp_outbox"("payout_id");

-- CreateIndex
CREATE INDEX "whatsapp_outbox_status_idx" ON "whatsapp_outbox"("status");

-- CreateIndex
CREATE INDEX "whatsapp_outbox_created_at_idx" ON "whatsapp_outbox"("created_at");

-- CreateIndex
CREATE INDEX "whatsapp_outbox_order_id_idx" ON "whatsapp_outbox"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_inbound_messages_whatsapp_message_id_key" ON "whatsapp_inbound_messages"("whatsapp_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_inbound_messages_from_idx" ON "whatsapp_inbound_messages"("from");

-- CreateIndex
CREATE INDEX "whatsapp_inbound_messages_status_idx" ON "whatsapp_inbound_messages"("status");

-- CreateIndex
CREATE INDEX "whatsapp_inbound_messages_created_at_idx" ON "whatsapp_inbound_messages"("created_at");

-- CreateIndex
CREATE INDEX "delivery_drafts_order_id_idx" ON "delivery_drafts"("order_id");

-- CreateIndex
CREATE INDEX "delivery_drafts_status_idx" ON "delivery_drafts"("status");

-- CreateIndex
CREATE INDEX "delivery_drafts_created_at_idx" ON "delivery_drafts"("created_at");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_transaction_id_idx" ON "payments"("transaction_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "delivered_accounts_order_id_idx" ON "delivered_accounts"("order_id");

-- CreateIndex
CREATE INDEX "delivered_accounts_order_item_id_idx" ON "delivered_accounts"("order_item_id");

-- CreateIndex
CREATE INDEX "delivered_accounts_product_id_idx" ON "delivered_accounts"("product_id");

-- CreateIndex
CREATE INDEX "delivered_accounts_delivered_by_idx" ON "delivered_accounts"("delivered_by");

-- CreateIndex
CREATE INDEX "movements_order_id_idx" ON "movements"("order_id");

-- CreateIndex
CREATE INDEX "movements_user_id_idx" ON "movements"("user_id");

-- CreateIndex
CREATE INDEX "movements_type_idx" ON "movements"("type");

-- CreateIndex
CREATE INDEX "movements_created_at_idx" ON "movements"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_order_id_idx" ON "notifications"("order_id");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_wallets" ADD CONSTRAINT "client_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_movements" ADD CONSTRAINT "wallet_movements_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "client_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_movements" ADD CONSTRAINT "wallet_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_payouts" ADD CONSTRAINT "provider_payouts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_payment_configs" ADD CONSTRAINT "provider_payment_configs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivered_accounts" ADD CONSTRAINT "delivered_accounts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivered_accounts" ADD CONSTRAINT "delivered_accounts_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivered_accounts" ADD CONSTRAINT "delivered_accounts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivered_accounts" ADD CONSTRAINT "delivered_accounts_delivered_by_fkey" FOREIGN KEY ("delivered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

