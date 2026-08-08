import { serviceKeyFromText } from './serviceAliases.js';
const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const allKeyPattern = '(?:correo|email|mail|usuario|user|login|cuenta|contrasena|clave|password|pass|pwd|perfil|profile|pin|url|link|enlace|nota|notas|observacion|observaciones)';
function cleanText(text) {
    return text
        .replace(/Ã±/gi, 'n')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[|*_`~]/g, ' ')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
        .replace(/\r\n/g, '\n')
        .replace(/[^\S\n]+/g, ' ')
        .trim();
}
function labelAlternates(labels) {
    return labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}
function tidyValue(value) {
    if (!value)
        return undefined;
    const cleaned = value
        .replace(new RegExp(`\\s+${allKeyPattern}\\s*[:=\\-].*$`, 'i'), '')
        .replace(/^[\s:=-]+/, '')
        .replace(/[\s,;]+$/, '')
        .trim();
    return cleaned || undefined;
}
function findField(block, labels) {
    const labelPattern = labelAlternates(labels);
    const match = block.match(new RegExp(`(?:^|[\\n\\s;,])(?:${labelPattern})\\s*(?:[:=\\-]|es)?\\s*([^\\n;]+?)(?=\\s+${allKeyPattern}\\s*(?:[:=\\-]|es)?|$)`, 'i'));
    return tidyValue(match?.[1]);
}
function emailFrom(block) {
    return block.match(emailRegex)?.[0];
}
function firstUrl(text) {
    return text.match(/https?:\/\/\S+/i)?.[0];
}
function hasCompleteAccount(text) {
    return Boolean((emailFrom(text) || findField(text, ['usuario', 'user', 'login'])) && findField(text, ['contrasena', 'clave', 'password', 'pass', 'pwd']));
}
function splitServiceBlocks(text) {
    const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
    const blocks = [];
    let current = [];
    let currentService = '';
    for (const line of lines) {
        const serviceKey = serviceKeyFromText(line);
        const looksLikeTitle = Boolean(serviceKey) && line.length <= 80 && !/@/.test(line) && !/contrasena|clave|password|correo|email|usuario\s*:/i.test(line);
        const startsNewAccount = /^(?:cuenta|account|perfil)\s*#?\d+/i.test(line) || ((emailFrom(line) || findField(line, ['usuario', 'user', 'login'])) && hasCompleteAccount(current.join('\n')));
        if ((looksLikeTitle || startsNewAccount) && current.length) {
            blocks.push(current.join('\n'));
            current = [line];
        }
        else {
            if (!serviceKey && currentService && !serviceKeyFromText(line) && current.length === 0)
                current.push(currentService);
            current.push(line);
        }
        if (serviceKey)
            currentService = line;
    }
    if (current.length)
        blocks.push(current.join('\n'));
    return blocks;
}
function parseLooseLine(text) {
    const email = emailFrom(text);
    if (!email)
        return null;
    const afterEmail = text.slice(text.indexOf(email) + email.length);
    const password = findField(afterEmail, ['contrasena', 'clave', 'password', 'pass', 'pwd'])
        || tidyValue(afterEmail.trim().split(/\s+/)[0]);
    const service = serviceKeyFromText(text) || 'servicio';
    return {
        service,
        delivered_email: email,
        delivered_password: password,
        notes: text.replace(email, '').replace(password || '', '').trim() || undefined
    };
}
export function parseAccountMessage(message) {
    const normalizedText = cleanText(message);
    const orderHint = normalizedText.match(/(?:orden|pedido|order)\s*[:#-]?\s*(ORD-\d{4}-\d{6}|CDD-\d{4}-\d{6}|[a-z0-9-]{6,})/i)?.[1];
    const blocks = splitServiceBlocks(normalizedText);
    const accounts = [];
    let lastService = '';
    for (const blockText of blocks) {
        const service = serviceKeyFromText(blockText) || lastService || 'servicio';
        if (service !== 'servicio')
            lastService = service;
        const loose = parseLooseLine(blockText);
        const delivered_email = findField(blockText, ['correo', 'email', 'mail']) || loose?.delivered_email;
        const delivered_user = findField(blockText, ['usuario', 'user', 'login']);
        const delivered_password = findField(blockText, ['contrasena', 'clave', 'password', 'pass', 'pwd']) || loose?.delivered_password;
        const profile_name = findField(blockText, ['perfil', 'profile', 'usuario perfil']);
        const pin = findField(blockText, ['pin de seguridad', 'pin', 'codigo pin']);
        const iptv_url = findField(blockText, ['url para smarters iptv', 'url iptv', 'url', 'link', 'enlace']) || firstUrl(blockText);
        const explicitNotes = findField(blockText, ['nota', 'notas', 'observacion', 'observaciones']);
        if (delivered_email || delivered_user || delivered_password || loose) {
            accounts.push({
                service,
                delivered_email,
                delivered_user,
                delivered_password,
                profile_name,
                pin,
                iptv_url,
                notes: [explicitNotes, loose?.notes, iptv_url ? `URL IPTV: ${iptv_url}` : undefined].filter(Boolean).join(' | ') || undefined
            });
        }
    }
    const completeAccounts = accounts.filter((account) => (account.delivered_email || account.delivered_user) && account.delivered_password);
    let confidence = 35;
    if (orderHint)
        confidence += 25;
    if (accounts.length > 0)
        confidence += 15;
    if (completeAccounts.length === accounts.length && accounts.length > 0)
        confidence += 25;
    if (accounts.some((account) => account.service === 'servicio'))
        confidence -= 10;
    confidence = Math.max(0, Math.min(100, confidence));
    return { orderHint, confidence, accounts, normalizedText };
}
