import { deliveryServiceFromText } from './serviceAliases.js';
import type { DeliveryParserItem, DeliveryParserResult } from './types.js';

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const urlRegex = /https?:\/\/\S+/i;
const allKeyPattern = '(?:correo|email|mail|usuario|user|login|cuenta|account|servicio|service|contrasena|clave|password|pass|pwd|perfil|profile|pantalla|pin|url|link|enlace|nota|notas|observacion|observaciones)';

function cleanText(rawText: string) {
  return rawText
    .replace(/Ã±/gi, 'n')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[|*_`~]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\r\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

function labelAlternates(labels: string[]) {
  return labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

function tidyValue(value?: string) {
  if (!value) return undefined;
  const cleaned = value
    .replace(new RegExp(`\\s+${allKeyPattern}\\s*[:=\\-].*$`, 'i'), '')
    .replace(/^[\s:=-]+/, '')
    .replace(/[\s,;]+$/, '')
    .trim();
  return cleaned || undefined;
}

function field(block: string, labels: string[]) {
  const labelPattern = labelAlternates(labels);
  const sameLine = block.match(new RegExp(`(?:^|[\\n\\s;,])(?:${labelPattern})(?=\\s|[:=\\-]|$)\\s*(?:[:=\\-]|es)\\s*([^\\n;]+?)(?=\\s+${allKeyPattern}\\s*(?:[:=\\-]|es)?|$)`, 'i'));
  const sameLineValue = tidyValue(sameLine?.[1]);
  if (sameLineValue) return sameLineValue;

  const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const inline = current.match(new RegExp(`^(?:${labelPattern})(?=\\s|[:=\\-]|$)\\s*(?:(?:[:=\\-]|es)\\s*)?(.+)?$`, 'i'));
    if (!inline) continue;
    const inlineValue = tidyValue(inline[1]);
    if (inlineValue) return inlineValue;
    const next = lines[index + 1];
    if (next && !new RegExp(`^(?:${allKeyPattern})\\s*(?:[:=\\-]|es)?`, 'i').test(next)) return tidyValue(next);
  }
  return undefined;
}

function firstEmail(text: string) {
  return text.match(emailRegex)?.[0];
}

function firstUrl(text: string) {
  return text.match(urlRegex)?.[0];
}

function hasAccessData(text: string) {
  return Boolean(firstEmail(text) || field(text, ['usuario', 'user', 'login']));
}

function hasPasswordData(text: string) {
  return Boolean(field(text, ['contrasena', 'clave', 'password', 'pass', 'pwd']));
}

function splitBlocks(text: string) {
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 2) return [text];
  const blocks: string[] = [];
  let current: string[] = [];
  let currentHasCompleteAccount = false;

  for (const line of lines) {
    const service = deliveryServiceFromText(line);
    const titleLike = Boolean(service) && line.length < 90 && !/(correo|email|mail|usuario\s*:|user\s*:|login\s*:|contrasena|clave|password|pass|pin\s*:)/i.test(line);
    const startsNewAccount = /^(?:cuenta|account|perfil)\s*#?\d+/i.test(line) || (hasAccessData(line) && currentHasCompleteAccount);
    if ((titleLike || startsNewAccount) && current.length) {
      blocks.push(current.join('\n'));
      current = [line];
      currentHasCompleteAccount = hasAccessData(line) && hasPasswordData(line);
    } else {
      current.push(line);
      currentHasCompleteAccount = currentHasCompleteAccount || (hasAccessData(line) && hasPasswordData(current.join('\n')));
    }
  }
  if (current.length) blocks.push(current.join('\n'));
  return blocks;
}

function parseLoose(block: string) {
  const email = firstEmail(block);
  if (email) {
    const tail = block.slice(block.indexOf(email) + email.length);
    const password = field(tail, ['contrasena', 'clave', 'password', 'pass', 'pwd'])
      || tidyValue(tail.trim().split(/\s+/)[0]);
    return { delivered_email: email, delivered_password: password };
  }

  const credentialLine = block
    .split(/\n/)
    .map((line) => line.trim())
    .find((line) => {
      const compact = line.replace(/\s+/g, ' ');
      return /^[a-z0-9._-]{3,}\s+[^:\s]{3,}/i.test(compact)
        && !new RegExp(`^(?:${allKeyPattern})\\b`, 'i').test(compact)
        && !deliveryServiceFromText(compact);
    });
  if (!credentialLine) return {};
  const [user, password] = credentialLine.replace(/\s+/g, ' ').split(' ');
  return { delivered_user: tidyValue(user), delivered_password: tidyValue(password) };
}

function serviceNameForBlock(block: string, previousService?: string) {
  const service = deliveryServiceFromText(block);
  return service?.canonical || previousService || 'Servicio sin identificar';
}

export function parseRawDeliveryMessage(rawText: string): DeliveryParserResult {
  const normalized = cleanText(rawText);
  const warnings: string[] = [];
  let lastService: string | undefined;
  const items: DeliveryParserItem[] = splitBlocks(normalized).map((block) => {
    const serviceName = serviceNameForBlock(block, lastService);
    if (serviceName !== 'Servicio sin identificar') lastService = serviceName;
    const loose = parseLoose(block);
    const delivered_email = field(block, ['correo', 'email', 'mail']) || loose.delivered_email;
    const delivered_user = field(block, ['usuario', 'user', 'login']) || loose.delivered_user;
    const delivered_password = field(block, ['contrasena', 'clave', 'password', 'pass', 'pwd']) || loose.delivered_password;
    const profile_name = field(block, ['perfil', 'profile', 'pantalla']);
    const pin = field(block, ['pin de seguridad', 'pin', 'codigo pin']);
    const iptv_url = field(block, ['url para smarters iptv', 'url iptv', 'url', 'link', 'enlace']) || firstUrl(block);
    const explicitNotes = field(block, ['nota', 'notas', 'observacion', 'observaciones']);
    const notes = [explicitNotes, iptv_url ? `URL IPTV: ${iptv_url}` : undefined].filter(Boolean).join(' | ') || undefined;
    const hasAccess = Boolean((delivered_email || delivered_user) && delivered_password);
    const serviceDetected = serviceName !== 'Servicio sin identificar';
    const confidence = Math.min(100, 35 + (serviceDetected ? 25 : 0) + (hasAccess ? 35 : 0) + (pin || profile_name || iptv_url ? 5 : 0));
    return {
      serviceName,
      delivered_email,
      delivered_user,
      delivered_password,
      profile_name,
      pin,
      iptv_url,
      notes,
      confidence,
      needsReview: !serviceDetected || !hasAccess
    };
  }).filter((item) => item.delivered_email || item.delivered_user || item.delivered_password || item.iptv_url);

  if (!items.length) warnings.push('No se detectaron cuentas en el mensaje.');
  for (const item of items) {
    if (item.needsReview) warnings.push(`${item.serviceName}: requiere revision por datos incompletos o servicio no identificado.`);
  }
  const confidence = items.length ? Math.round(items.reduce((sum, item) => sum + item.confidence, 0) / items.length) : 0;
  return { confidence, items, warnings };
}
