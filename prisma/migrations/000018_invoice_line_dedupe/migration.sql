-- Elimina lineas duplicadas: una misma cuenta entregada facturada dos veces en la misma
-- factura (artefacto de la condicion de carrera al generar). Conserva una por grupo.
DELETE FROM "client_invoice_lines" a
USING "client_invoice_lines" b
WHERE a."delivered_account_id" IS NOT NULL
  AND a."invoice_id" = b."invoice_id"
  AND a."delivered_account_id" = b."delivered_account_id"
  AND a."id" > b."id";

-- Garantiza a nivel de BD: una linea por (factura, cuenta entregada).
-- Los NULL son distintos en Postgres, asi que las lineas manuales sin cuenta no se ven afectadas.
CREATE UNIQUE INDEX IF NOT EXISTS "client_invoice_lines_invoice_delivery_key"
  ON "client_invoice_lines" ("invoice_id", "delivered_account_id");

-- Recalcula los totales de las facturas afectadas.
UPDATE "client_invoices" ci
SET "total_amount" = COALESCE(
  (SELECT SUM(l."total") FROM "client_invoice_lines" l WHERE l."invoice_id" = ci."id"),
  0
);
