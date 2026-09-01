import assert from 'node:assert';
import { buildInvoicePdf, buildInvoiceEmail } from '../server/services/invoiceDocument.js';

const money = (v: number) => `$${new Intl.NumberFormat('es-CO').format(v)}`;
const formatDateTime = (v: Date | string | null | undefined) => (v ? new Date(v).toLocaleString('es-CO') : '-');

const invoice = {
  invoice_number: 'FAC-202608-SERVIMIL',
  period: '2026-08',
  title: 'Factura mensual Servimil — Diseño & entregas',
  status: 'draft',
  issue_date: new Date('2026-08-28T17:00:00Z'),
  due_date: new Date('2026-08-30T17:00:00Z'),
  total_amount: 125000,
  notes: 'Cuentas entregadas del período con acentos: canción, ñandú.',
  user: { name: 'Servimil Colombia' },
  lines: [
    { description: 'Netflix Premium', account_email: 'user@correo.com', profile_name: 'Perfil 1', pin: '1234', quantity: 1, unit_price: 25000, total: 25000, order: { order_number: 'ORD-001' } },
    { description: 'Disney+ Estándar', account_email: 'otro@correo.com', profile_name: 'Perfil 2', pin: '9999', quantity: 4, unit_price: 25000, total: 100000, order: { order_number: 'ORD-002' } }
  ]
};

const opts = { money, formatDateTime, clientName: 'Servimil Colombia' };

const pdf = await buildInvoicePdf(invoice as any, opts);
assert(Buffer.isBuffer(pdf), 'PDF debe ser Buffer');
assert(pdf.subarray(0, 5).toString() === '%PDF-', 'debe comenzar con %PDF-');
assert(pdf.length > 3000, `PDF demasiado pequeno: ${pdf.length} bytes`);

const email = buildInvoiceEmail(invoice as any, { ...opts, pdf });
assert(email.subject.includes('FAC-202608-SERVIMIL'), 'subject con numero de factura');
assert(email.html.includes('cid:logo-centro') && email.html.includes('cid:logo-servimil'), 'html referencia ambos logos por cid');
assert(email.attachments.length === 3, 'adjuntos: pdf + 2 logos');
assert(email.attachments[0].contentType === 'application/pdf', 'primer adjunto es el PDF');

console.log(`OK: PDF ${pdf.length} bytes, email con ${email.attachments.length} adjuntos.`);
