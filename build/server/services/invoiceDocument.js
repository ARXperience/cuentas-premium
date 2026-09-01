import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
const STATUS_LABELS = {
    draft: 'Borrador',
    sent: 'Enviada',
    paid: 'Pagada',
    cancelled: 'Cancelada'
};
function statusLabel(status) {
    return STATUS_LABELS[status] || status;
}
// Logos live in the repo source tree; server runs from the project root (cwd).
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
// pdf-lib StandardFonts use WinAnsi (Latin-1); drop anything it cannot encode.
function winAnsi(value) {
    return String(value ?? '').replace(/[^\x09\x0A\x0D\x20-\xFF]/g, ' ');
}
export async function buildInvoicePdf(invoice, opts) {
    const { money, formatDateTime } = opts;
    const clientName = opts.clientName || invoice.user?.name || 'Servimil';
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const logos = loadLogos();
    const centroImg = await pdf.embedPng(logos.centro);
    const servimilImg = await pdf.embedPng(logos.servimil);
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const marginX = 40;
    const contentW = pageWidth - marginX * 2;
    const ink = rgb(0.06, 0.09, 0.16);
    const muted = rgb(0.39, 0.45, 0.55);
    const hairline = rgb(0.89, 0.91, 0.94);
    const headBg = rgb(0.95, 0.96, 0.98);
    const columns = [
        { key: 'idx', label: '#', width: 20 },
        { key: 'service', label: 'Servicio', width: 118 },
        { key: 'email', label: 'Correo', width: 132 },
        { key: 'profile', label: 'Perfil', width: 70 },
        { key: 'pin', label: 'PIN', width: 38 },
        { key: 'qty', label: 'Cant.', width: 30 },
        { key: 'unit', label: 'Valor', width: 52 },
        { key: 'total', label: 'Total', width: 55 }
    ];
    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - marginX;
    const draw = (text, x, yy, size, f = font, color = ink) => {
        page.drawText(winAnsi(text), { x, y: yy, size, font: f, color });
    };
    const fit = (text, maxWidth, size, f = font) => {
        let value = winAnsi(text);
        if (f.widthOfTextAtSize(value, size) <= maxWidth)
            return value;
        while (value.length > 1 && f.widthOfTextAtSize(value + '...', size) > maxWidth) {
            value = value.slice(0, -1);
        }
        return value + '...';
    };
    // Header: both logos + names
    const logoH = 34;
    const centroDims = centroImg.scale(logoH / centroImg.height);
    page.drawImage(centroImg, { x: marginX, y: y - logoH, width: centroDims.width, height: logoH });
    draw('Centro Digital de Diseno', marginX + centroDims.width + 10, y - 14, 12, bold);
    draw('Plataforma de gestion de activos', marginX + centroDims.width + 10, y - 28, 8, font, muted);
    const servimilDims = servimilImg.scale(logoH / servimilImg.height);
    const clientX = pageWidth - marginX - 150;
    page.drawImage(servimilImg, { x: clientX, y: y - logoH, width: servimilDims.width, height: logoH });
    draw(fit(clientName, 150 - servimilDims.width - 10, 12, bold), clientX + servimilDims.width + 8, y - 14, 12, bold);
    draw('Cliente codigo 1111', clientX + servimilDims.width + 8, y - 28, 8, font, muted);
    y -= logoH + 16;
    page.drawLine({ start: { x: marginX, y }, end: { x: pageWidth - marginX, y }, thickness: 1.4, color: hairline });
    y -= 26;
    // Title
    draw(fit(invoice.title || 'Factura mensual', contentW, 20, bold), marginX, y, 20, bold);
    y -= 16;
    draw(`${invoice.invoice_number} - Periodo ${invoice.period}`, marginX, y, 9, font, muted);
    y -= 24;
    // Meta grid (3 columns x 2 rows)
    const meta = [
        ['Factura', invoice.invoice_number],
        ['Emision', formatDateTime(invoice.issue_date)],
        ['Vencimiento', formatDateTime(invoice.due_date)],
        ['Estado', statusLabel(invoice.status)],
        ['Cliente', clientName],
        ['Total', money(invoice.total_amount)]
    ];
    const cellW = contentW / 3;
    const cellH = 34;
    meta.forEach(([label, value], i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx = marginX + col * cellW;
        const cy = y - row * cellH;
        page.drawRectangle({ x: cx, y: cy - cellH + 6, width: cellW - 8, height: cellH - 6, borderColor: hairline, borderWidth: 1, color: rgb(1, 1, 1) });
        draw(label.toUpperCase(), cx + 8, cy - 10, 7, bold, muted);
        draw(fit(value, cellW - 24, 10, bold), cx + 8, cy - 24, 10, bold);
    });
    y -= cellH * 2 + 18;
    // Table header
    const rowH = 18;
    const drawTableHead = () => {
        page.drawRectangle({ x: marginX, y: y - rowH + 4, width: contentW, height: rowH, color: headBg });
        let x = marginX;
        for (const c of columns) {
            draw(c.label, x + 4, y - rowH + 10, 8, bold, muted);
            x += c.width;
        }
        y -= rowH;
    };
    drawTableHead();
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
        y -= rowH;
        draw('No hay cuentas entregadas para este periodo.', marginX + 4, y + 4, 9, font, muted);
        y -= 4;
    }
    lines.forEach((line, index) => {
        if (y < marginX + 80) {
            page = pdf.addPage([pageWidth, pageHeight]);
            y = pageHeight - marginX;
            drawTableHead();
        }
        let x = marginX;
        for (const c of columns) {
            const numeric = c.key === 'qty' || c.key === 'unit' || c.key === 'total';
            const value = fit(cellValue(line, c.key, index), c.width - 6, 8);
            const tx = numeric ? x + c.width - 4 - font.widthOfTextAtSize(value, 8) : x + 4;
            draw(value, tx, y - 12, 8);
            x += c.width;
        }
        y -= rowH;
        page.drawLine({ start: { x: marginX, y: y + 3 }, end: { x: pageWidth - marginX, y: y + 3 }, thickness: 0.5, color: hairline });
    });
    // Total
    y -= 16;
    const totalStr = money(invoice.total_amount);
    draw('Total a cobrar', pageWidth - marginX - 200, y, 12, bold);
    draw(totalStr, pageWidth - marginX - bold.widthOfTextAtSize(winAnsi(totalStr), 14), y - 1, 14, bold);
    if (invoice.notes) {
        y -= 28;
        draw('Notas', marginX, y, 8, bold, muted);
        y -= 12;
        for (const chunk of wrapText(invoice.notes, font, 9, contentW)) {
            draw(chunk, marginX, y, 9, font, muted);
            y -= 12;
        }
    }
    const bytes = await pdf.save();
    return Buffer.from(bytes);
}
function wrapText(text, font, size, maxWidth) {
    const words = winAnsi(text).split(/\s+/).filter(Boolean);
    const out = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
            out.push(current);
            current = word;
        }
        else {
            current = next;
        }
    }
    if (current)
        out.push(current);
    return out.length ? out : [''];
}
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
export function buildInvoiceEmail(invoice, opts) {
    const { money, formatDateTime } = opts;
    const clientName = opts.clientName || invoice.user?.name || 'Servimil';
    const logos = loadLogos();
    const rows = (invoice.lines || []).map((line) => `
    <tr>
      <td style="border-bottom:1px solid #e2e8f0;padding:8px;">${escapeHtml(line.order?.order_number || '-')}</td>
      <td style="border-bottom:1px solid #e2e8f0;padding:8px;">${escapeHtml(line.description)}</td>
      <td style="border-bottom:1px solid #e2e8f0;padding:8px;">${escapeHtml(line.account_email || '-')}</td>
      <td style="border-bottom:1px solid #e2e8f0;padding:8px;">${escapeHtml(line.profile_name || '-')}</td>
      <td style="border-bottom:1px solid #e2e8f0;padding:8px;text-align:right;">${escapeHtml(line.quantity)}</td>
      <td style="border-bottom:1px solid #e2e8f0;padding:8px;text-align:right;">${escapeHtml(money(line.unit_price))}</td>
      <td style="border-bottom:1px solid #e2e8f0;padding:8px;text-align:right;">${escapeHtml(money(line.total))}</td>
    </tr>`).join('');
    const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:720px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border:1px solid #dbe4f0;border-radius:16px;padding:28px;">
      <table width="100%" style="border-collapse:collapse;"><tr>
        <td style="vertical-align:middle;"><img src="cid:logo-centro" height="40" alt="Centro Digital" style="vertical-align:middle;" />
          <span style="font-weight:bold;font-size:15px;margin-left:8px;">Centro Digital de Diseno</span></td>
        <td style="text-align:right;vertical-align:middle;"><span style="font-weight:bold;font-size:15px;margin-right:8px;">${escapeHtml(clientName)}</span>
          <img src="cid:logo-servimil" height="40" alt="Servimil" style="vertical-align:middle;" /></td>
      </tr></table>
      <hr style="border:none;border-top:2px solid #e8eef7;margin:18px 0;" />
      <h1 style="font-size:22px;margin:0 0 4px;">${escapeHtml(invoice.title || 'Factura mensual')}</h1>
      <p style="color:#64748b;font-size:12px;margin:0 0 16px;">${escapeHtml(invoice.invoice_number)} - Periodo ${escapeHtml(invoice.period)}</p>
      <table width="100%" style="border-collapse:collapse;font-size:13px;margin-bottom:16px;">
        <tr><td style="padding:4px 0;color:#64748b;">Emision</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(formatDateTime(invoice.issue_date))}</td>
            <td style="padding:4px 0;color:#64748b;">Vencimiento</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(formatDateTime(invoice.due_date))}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Estado</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(statusLabel(invoice.status))}</td>
            <td style="padding:4px 0;color:#64748b;">Total</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${escapeHtml(money(invoice.total_amount))}</td></tr>
      </table>
      <table width="100%" style="border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f1f5f9;color:#475569;text-align:left;">
          <th style="padding:8px;">Orden</th><th style="padding:8px;">Servicio</th><th style="padding:8px;">Correo</th>
          <th style="padding:8px;">Perfil</th><th style="padding:8px;text-align:right;">Cant.</th>
          <th style="padding:8px;text-align:right;">Valor</th><th style="padding:8px;text-align:right;">Total</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="7" style="padding:10px;">No hay cuentas entregadas para este periodo.</td></tr>'}</tbody>
      </table>
      <div style="text-align:right;font-size:18px;font-weight:900;margin-top:18px;">Total a cobrar: ${escapeHtml(money(invoice.total_amount))}</div>
      ${invoice.notes ? `<div style="margin-top:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap;font-size:12px;">${escapeHtml(invoice.notes)}</div>` : ''}
      <p style="color:#94a3b8;font-size:11px;margin-top:20px;">Adjuntamos esta factura en PDF. Gracias por su preferencia.</p>
    </div>
  </div></body></html>`;
    const text = [
        `Factura ${invoice.invoice_number} - Periodo ${invoice.period}`,
        `Cliente: ${clientName}`,
        `Emision: ${formatDateTime(invoice.issue_date)}`,
        `Vencimiento: ${formatDateTime(invoice.due_date)}`,
        `Estado: ${statusLabel(invoice.status)}`,
        `Total a cobrar: ${money(invoice.total_amount)}`,
        '',
        'Adjuntamos esta factura en PDF.'
    ].join('\n');
    const attachments = [
        { filename: 'logo-centro.png', content: logos.centro, contentType: 'image/png', cid: 'logo-centro' },
        { filename: 'servimil.png', content: logos.servimil, contentType: 'image/png', cid: 'logo-servimil' }
    ];
    if (opts.pdf) {
        attachments.unshift({
            filename: `${invoice.invoice_number || 'factura'}-${invoice.period || ''}.pdf`.replace(/[^\w.-]+/g, '-'),
            content: opts.pdf,
            contentType: 'application/pdf'
        });
    }
    return {
        subject: `Factura ${invoice.invoice_number} - ${clientName} (${invoice.period})`,
        text,
        html,
        attachments
    };
}
