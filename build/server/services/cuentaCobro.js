import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
// ---- Configuracion editable (se guarda en appSetting, sin migracion) ----
export const CUENTA_COBRO_KEYS = [
    'cc_acreedor_name',
    'cc_acreedor_id',
    'cc_deudor_name',
    'cc_deudor_id',
    'cc_rep_name',
    'cc_rep_role',
    'cc_rep_id',
    'cc_city',
    'cc_concept',
    'cc_signer_name',
    'cc_signer_id',
    'cc_contact'
];
export const CUENTA_COBRO_DEFAULTS = {
    cc_acreedor_name: 'Centro Digital de Diseno',
    cc_acreedor_id: '',
    cc_deudor_name: 'Servimil',
    cc_deudor_id: '',
    cc_rep_name: 'Julian',
    cc_rep_role: 'Representante de Servimil',
    cc_rep_id: '',
    cc_city: 'Bogota D.C.',
    cc_concept: 'Servicios de cuentas premium del periodo facturado.',
    cc_signer_name: 'Centro Digital de Diseno',
    cc_signer_id: '',
    cc_contact: ''
};
// ---- Numero a letras (pesos colombianos) ----
const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
const VEINTI = ['VEINTE', 'VEINTIUNO', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
function seccion(n) {
    if (n === 0)
        return '';
    if (n === 100)
        return 'CIEN';
    const c = Math.floor(n / 100);
    const dd = n % 100;
    let out = c ? CENTENAS[c] + ' ' : '';
    if (dd <= 20)
        out += UNIDADES[dd];
    else if (dd < 30)
        out += VEINTI[dd - 20];
    else {
        const d = Math.floor(dd / 10);
        const u = dd % 10;
        out += DECENAS[d] + (u ? ' Y ' + UNIDADES[u] : '');
    }
    return out.trim();
}
export function numeroALetras(value) {
    const num = Math.floor(Math.abs(Number(value) || 0));
    if (num === 0)
        return 'CERO';
    const millones = Math.floor(num / 1000000);
    const miles = Math.floor((num % 1000000) / 1000);
    const resto = num % 1000;
    const partes = [];
    if (millones)
        partes.push(millones === 1 ? 'UN MILLON' : `${seccion(millones)} MILLONES`);
    if (miles)
        partes.push(miles === 1 ? 'MIL' : `${seccion(miles)} MIL`);
    if (resto)
        partes.push(seccion(resto));
    return partes.join(' ').replace(/\s+/g, ' ').trim();
}
export function montoEnLetras(value) {
    return `${numeroALetras(value)} PESOS M/CTE`;
}
const C = {
    blue: rgb(0.231, 0.510, 0.965),
    violet: rgb(0.545, 0.361, 0.965),
    ink: rgb(0.059, 0.090, 0.165),
    muted: rgb(0.392, 0.451, 0.549),
    border: rgb(0.796, 0.835, 0.882),
    soft: rgb(0.945, 0.961, 0.976),
    white: rgb(1, 1, 1)
};
let logoBuf = null;
function logo() {
    if (!logoBuf)
        logoBuf = readFileSync(path.resolve(process.cwd(), 'src/assets/centro-digital-imagotipo.png'));
    return logoBuf;
}
function winAnsi(v) {
    return String(v ?? '').replace(/[^\x09\x0A\x0D\x20-\xFF]/g, ' ');
}
export async function buildCuentaCobroPdf(invoice, opts) {
    const { money, formatDate, config } = opts;
    const deudor = config.cc_deudor_name || invoice.user?.name || 'Servimil';
    const rangeLabel = invoice.period_start || invoice.period_end
        ? `${formatDate(invoice.period_start)} a ${formatDate(invoice.period_end)}`
        : invoice.period;
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const img = await pdf.embedPng(logo());
    const W = 595.28;
    const H = 841.89;
    const M = 48;
    const contentW = W - M * 2;
    const page = pdf.addPage([W, H]);
    const text = (s, x, y, size, f = font, color = C.ink) => page.drawText(winAnsi(s), { x, y, size, font: f, color });
    const widthOf = (s, size, f = font) => f.widthOfTextAtSize(winAnsi(s), size);
    const center = (s, y, size, f = font, color = C.ink) => text(s, (W - widthOf(s, size, f)) / 2, y, size, f, color);
    const wrap = (s, size, maxW, f = font) => {
        const words = winAnsi(s).split(/\s+/).filter(Boolean);
        const out = [];
        let cur = '';
        for (const w of words) {
            const nx = cur ? `${cur} ${w}` : w;
            if (f.widthOfTextAtSize(nx, size) > maxW && cur) {
                out.push(cur);
                cur = w;
            }
            else
                cur = nx;
        }
        if (cur)
            out.push(cur);
        return out.length ? out : [''];
    };
    let y = H - M;
    // Encabezado
    const logoH = 34;
    const d = img.scale(logoH / img.height);
    page.drawImage(img, { x: M, y: y - logoH, width: d.width, height: logoH });
    text(config.cc_acreedor_name || 'Centro Digital de Diseno', M + d.width + 10, y - 12, 12, bold);
    if (config.cc_acreedor_id)
        text(`NIT/CC ${config.cc_acreedor_id}`, M + d.width + 10, y - 26, 8.5, font, C.muted);
    const numLabel = `No. ${invoice.invoice_number}`;
    text(numLabel, W - M - widthOf(numLabel, 10, bold), y - 12, 10, bold, C.blue);
    const cityDate = `${config.cc_city || 'Bogota D.C.'}, ${formatDate(invoice.issue_date)}`;
    text(cityDate, W - M - widthOf(cityDate, 9), y - 26, 9, font, C.muted);
    y -= logoH + 14;
    for (let i = 0; i < 80; i++) {
        const t = i / 79;
        page.drawRectangle({ x: M + (contentW / 80) * i, y, width: contentW / 80 + 0.5, height: 4, color: rgb(0.231 + (0.545 - 0.231) * t, 0.510 + (0.361 - 0.510) * t, 0.965) });
    }
    y -= 40;
    center('CUENTA DE COBRO', y, 22, bold);
    y -= 40;
    // Deudor
    center(`${deudor}${config.cc_deudor_id ? `  ·  NIT/CC ${config.cc_deudor_id}` : ''}`, y, 13, bold);
    y -= 40;
    // Cuerpo
    const bodySize = 11.5;
    const lh = 18;
    const body = (label, value) => {
        text(label, M, y, bodySize, bold);
        const startX = M + widthOf(label + ' ', bodySize, bold);
        const first = wrap(value, bodySize, contentW - (startX - M));
        text(first[0], startX, y, bodySize, font);
        y -= lh;
        for (let i = 1; i < first.length; i++) {
            text(first[i], M, y, bodySize, font);
            y -= lh;
        }
    };
    text('DEBE A:', M, y, bodySize, bold);
    text(`${config.cc_acreedor_name}${config.cc_acreedor_id ? `  ·  NIT/CC ${config.cc_acreedor_id}` : ''}`, M + widthOf('DEBE A: ', bodySize, bold), y, bodySize, font);
    y -= lh + 6;
    body('La suma de:', money(invoice.total_amount));
    // Monto en letras (destacado)
    page.drawRectangle({ x: M, y: y - 4, width: contentW, height: 22, color: C.soft, borderColor: C.border, borderWidth: 1 });
    text(montoEnLetras(invoice.total_amount), M + 10, y + 3, 10.5, bold, C.ink);
    y -= 22 + 12;
    body('Por concepto de:', config.cc_concept || 'Servicios prestados.');
    y -= 4;
    body('Periodo:', rangeLabel);
    y -= 4;
    body('A cargo de:', `${config.cc_rep_name}${config.cc_rep_role ? ` (${config.cc_rep_role})` : ''}${config.cc_rep_id ? `  ·  CC ${config.cc_rep_id}` : ''}`);
    y -= 10;
    // Detalle opcional (cuentas del periodo)
    const lines = invoice.lines || [];
    if (lines.length) {
        text('Detalle del periodo:', M, y, 9, bold, C.muted);
        y -= 16;
        page.drawRectangle({ x: M, y: y - 2, width: contentW, height: 16, color: C.soft });
        text('SERVICIO', M + 8, y + 2, 8, bold, C.muted);
        text('CANT', M + contentW - 130, y + 2, 8, bold, C.muted);
        text('TOTAL', M + contentW - 8 - widthOf('TOTAL', 8, bold), y + 2, 8, bold, C.muted);
        y -= 16;
        for (const l of lines) {
            if (y < M + 150)
                break;
            text(l.description || '-', M + 8, y, 8.5, font);
            text(String(l.quantity), M + contentW - 130, y, 8.5, font);
            const tt = money(l.total);
            text(tt, M + contentW - 8 - widthOf(tt, 8.5), y, 8.5, font);
            page.drawLine({ start: { x: M, y: y - 5 }, end: { x: W - M, y: y - 5 }, thickness: 0.4, color: C.border });
            y -= 16;
        }
        y -= 6;
    }
    // Firma
    const signY = Math.max(y - 30, M + 70);
    page.drawLine({ start: { x: M, y: signY }, end: { x: M + 220, y: signY }, thickness: 0.8, color: C.ink });
    text(config.cc_signer_name || config.cc_acreedor_name, M, signY - 14, 10, bold);
    if (config.cc_signer_id)
        text(`CC/NIT ${config.cc_signer_id}`, M, signY - 27, 8.5, font, C.muted);
    text('Firma', M, signY - (config.cc_signer_id ? 42 : 27) - 0, 8, font, C.muted);
    if (config.cc_contact)
        center(config.cc_contact, M + 24, 8.5, font, C.muted);
    return Buffer.from(await pdf.save());
}
