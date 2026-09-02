import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
// Paleta de la web
const C = {
    blue: rgb(0.231, 0.510, 0.965), // #3b82f6
    violet: rgb(0.545, 0.361, 0.965), // #8b5cf6
    slate900: rgb(0.059, 0.090, 0.165), // #0f172a
    slate600: rgb(0.278, 0.335, 0.412), // #475569
    slate500: rgb(0.392, 0.451, 0.549), // #64748b
    slate100: rgb(0.945, 0.961, 0.976), // #f1f5f9
    slate50: rgb(0.973, 0.980, 0.988), // #f8fafc
    border: rgb(0.886, 0.910, 0.941), // #e2e8f0
    white: rgb(1, 1, 1),
    green: rgb(0.016, 0.471, 0.341) // #047857
};
let logoCache = null;
function loadLogos() {
    if (logoCache)
        return logoCache;
    const root = process.cwd();
    logoCache = {
        centro: readFileSync(path.resolve(root, 'src/assets/centro-digital-imagotipo.png')),
        servimil: readFileSync(path.resolve(root, 'src/assets/clients/servimil.png'))
    };
    return logoCache;
}
// StandardFonts usan WinAnsi (Latin-1); descarta lo que no pueda codificar.
function winAnsi(value) {
    return String(value ?? '').replace(/[^\x09\x0A\x0D\x20-\xFF]/g, ' ');
}
function lerp(a, b, t) {
    return rgb(a.red + (b.red - a.red) * t, a.green + (b.green - a.green) * t, a.blue + (b.blue - a.blue) * t);
}
export async function buildInvoicePdf(invoice, opts) {
    const { money, formatDateTime } = opts;
    const clientName = opts.clientName || invoice.user?.name || 'Servimil';
    const rangeLabel = invoice.period_start || invoice.period_end
        ? `${formatDateTime(invoice.period_start)} a ${formatDateTime(invoice.period_end)}`
        : invoice.period;
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const logos = loadLogos();
    const centroImg = await pdf.embedPng(logos.centro);
    const servimilImg = await pdf.embedPng(logos.servimil);
    const W = 595.28;
    const H = 841.89;
    const M = 42;
    const contentW = W - M * 2;
    let page = pdf.addPage([W, H]);
    const text = (s, x, y, size, f = font, color = C.slate900) => page.drawText(winAnsi(s), { x, y, size, font: f, color });
    const widthOf = (s, size, f = font) => f.widthOfTextAtSize(winAnsi(s), size);
    const rightText = (s, xRight, y, size, f = font, color = C.slate900) => text(s, xRight - widthOf(s, size, f), y, size, f, color);
    const fit = (s, maxW, size, f = font) => {
        let v = winAnsi(s);
        if (f.widthOfTextAtSize(v, size) <= maxW)
            return v;
        while (v.length > 1 && f.widthOfTextAtSize(v + '...', size) > maxW)
            v = v.slice(0, -1);
        return v + '...';
    };
    const gradientBand = (x, y, w, h) => {
        const steps = 80;
        const sw = w / steps;
        for (let i = 0; i < steps; i++) {
            page.drawRectangle({ x: x + i * sw, y, width: sw + 0.5, height: h, color: lerp(C.blue, C.violet, i / (steps - 1)) });
        }
    };
    // ---- Encabezado ----
    let y = H - M;
    const logoH = 30;
    const cDims = centroImg.scale(logoH / centroImg.height);
    page.drawImage(centroImg, { x: M, y: y - logoH, width: cDims.width, height: logoH });
    text('Centro Digital de Diseno', M + cDims.width + 10, y - 11, 12, bold);
    text('Plataforma de gestion de activos', M + cDims.width + 10, y - 24, 8, font, C.slate500);
    rightText('FACTURA', W - M, y - 16, 26, bold, C.blue);
    rightText(`${invoice.invoice_number}  ·  Rango ${rangeLabel}`, W - M, y - 30, 9, font, C.slate500);
    y -= logoH + 14;
    gradientBand(M, y, contentW, 5);
    y -= 22;
    // ---- Recuadros De / Para ----
    const boxH = 62;
    const boxW = (contentW - 14) / 2;
    const boxY = y - boxH;
    // De
    page.drawRectangle({ x: M, y: boxY, width: boxW, height: boxH, color: C.slate50, borderColor: C.border, borderWidth: 1 });
    text('DE', M + 12, y - 14, 7, bold, C.slate500);
    text('Centro Digital de Diseno', M + 12, y - 30, 11, bold);
    text('Plataforma de gestion de activos', M + 12, y - 44, 8.5, font, C.slate500);
    // Para
    const px = M + boxW + 14;
    page.drawRectangle({ x: px, y: boxY, width: boxW, height: boxH, color: C.white, borderColor: C.border, borderWidth: 1 });
    text('FACTURAR A', px + 12, y - 14, 7, bold, C.slate500);
    const sH = 22;
    const sDims = servimilImg.scale(sH / servimilImg.height);
    page.drawImage(servimilImg, { x: px + 12, y: y - 34, width: sDims.width, height: sH });
    text(fit(clientName, boxW - sDims.width - 30, 11, bold), px + 12 + sDims.width + 8, y - 26, 11, bold);
    text('Cliente codigo 1111', px + 12, y - 50, 8.5, font, C.slate500);
    y = boxY - 18;
    // ---- Datos de factura ----
    const metaY = y;
    const chip = (label, value, x, w) => {
        page.drawRectangle({ x, y: metaY - 34, width: w, height: 34, color: C.white, borderColor: C.border, borderWidth: 1 });
        text(label.toUpperCase(), x + 10, metaY - 13, 7, bold, C.slate500);
        text(fit(value, w - 20, 10.5, bold), x + 10, metaY - 27, 10.5, bold);
    };
    const chipW = (contentW - 20) / 3;
    chip('Emision', formatDateTime(invoice.issue_date), M, chipW);
    chip('Vencimiento', formatDateTime(invoice.due_date), M + chipW + 10, chipW);
    chip('Total', money(invoice.total_amount), M + (chipW + 10) * 2, chipW);
    y = metaY - 34 - 22;
    // ---- Tabla ----
    const columns = [
        { key: 'idx', label: '#', width: 18, align: 'l' },
        { key: 'service', label: 'SERVICIO', width: 116, align: 'l' },
        { key: 'email', label: 'CORREO', width: 132, align: 'l' },
        { key: 'profile', label: 'PERFIL', width: 60, align: 'l' },
        { key: 'pin', label: 'PIN', width: 33, align: 'l' },
        { key: 'qty', label: 'CANT', width: 28, align: 'r' },
        { key: 'unit', label: 'VALOR', width: 52, align: 'r' },
        { key: 'total', label: 'TOTAL', width: 72, align: 'r' }
    ];
    const rowH = 20;
    const headH = 22;
    const drawHead = () => {
        gradientBand(M, y - headH, contentW, headH);
        let x = M;
        for (const c of columns) {
            if (c.align === 'r')
                rightText(c.label, x + c.width - 6, y - headH + 7, 8, bold, C.white);
            else
                text(c.label, x + 6, y - headH + 7, 8, bold, C.white);
            x += c.width;
        }
        y -= headH;
    };
    drawHead();
    const lines = invoice.lines || [];
    const cellValue = (line, key, index) => {
        switch (key) {
            case 'idx': return String(index + 1);
            case 'service': return line.description || '-';
            case 'email': return line.account_email || '-';
            case 'profile': return line.profile_name || '-';
            case 'pin': return line.pin || '-';
            case 'qty': return String(line.quantity);
            case 'unit': return money(line.unit_price);
            case 'total': return money(line.total);
            default: return '';
        }
    };
    if (!lines.length) {
        page.drawRectangle({ x: M, y: y - rowH, width: contentW, height: rowH, color: C.slate50 });
        text('No hay cuentas entregadas para este periodo.', M + 8, y - 13, 9, font, C.slate500);
        y -= rowH;
    }
    lines.forEach((line, index) => {
        if (y < M + 120) {
            page = pdf.addPage([W, H]);
            y = H - M;
            drawHead();
        }
        if (index % 2 === 1)
            page.drawRectangle({ x: M, y: y - rowH, width: contentW, height: rowH, color: C.slate50 });
        let x = M;
        for (const c of columns) {
            const v = fit(cellValue(line, c.key, index), c.width - 8, 8.5);
            if (c.align === 'r')
                rightText(v, x + c.width - 6, y - 13, 8.5);
            else
                text(v, x + 6, y - 13, 8.5);
            x += c.width;
        }
        page.drawLine({ start: { x: M, y: y - rowH }, end: { x: W - M, y: y - rowH }, thickness: 0.4, color: C.border });
        y -= rowH;
    });
    // ---- Caja de total (estilo slate-900 de la web) ----
    y -= 14;
    const totH = 40;
    const totW = 230;
    const totX = W - M - totW;
    if (y - totH < M + 40) {
        page = pdf.addPage([W, H]);
        y = H - M;
    }
    page.drawRectangle({ x: totX, y: y - totH, width: totW, height: totH, color: C.slate900 });
    text('TOTAL A COBRAR', totX + 16, y - 16, 8, bold, rgb(0.7, 0.75, 0.82));
    rightText(money(invoice.total_amount), totX + totW - 16, y - 30, 16, bold, C.white);
    y -= totH + 18;
    // ---- Notas ----
    if (invoice.notes) {
        const notes = winAnsi(invoice.notes);
        const wrapped = [];
        let cur = '';
        for (const word of notes.split(/\s+/).filter(Boolean)) {
            const nx = cur ? `${cur} ${word}` : word;
            if (widthOf(nx, 8.5) > contentW - 24 && cur) {
                wrapped.push(cur);
                cur = word;
            }
            else
                cur = nx;
        }
        if (cur)
            wrapped.push(cur);
        const nH = 22 + wrapped.length * 12;
        page.drawRectangle({ x: M, y: y - nH, width: contentW, height: nH, color: C.slate50, borderColor: C.border, borderWidth: 1 });
        text('NOTAS', M + 12, y - 15, 7, bold, C.slate500);
        let ny = y - 30;
        for (const l of wrapped) {
            text(l, M + 12, ny, 8.5, font, C.slate600);
            ny -= 12;
        }
        y -= nH + 14;
    }
    // ---- Pie ----
    page.drawLine({ start: { x: M, y: M + 24 }, end: { x: W - M, y: M + 24 }, thickness: 0.5, color: C.border });
    text('Gracias por su preferencia.', M, M + 12, 8, font, C.slate500);
    rightText('Centro Digital de Diseno  ·  Servimil', W - M, M + 12, 8, font, C.slate500);
    const bytes = await pdf.save();
    return Buffer.from(bytes);
}
