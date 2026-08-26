import type { PrismaClient } from '@prisma/client';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  normalizeMessageContent
} from 'baileys';
import type { WASocket, WAMessage } from 'baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { createBaileysDatabaseAuthState } from './baileysAuthStore.js';
import type { WhatsAppBridgeConnection, WhatsAppInboundHandler } from './types.js';

let socket: WASocket | null = null;
let connection: WhatsAppBridgeConnection = 'disconnected';
let qrCodeDataUrl: string | null = null;
let lastError: string | null = null;
let initStarted = false;
let inboundHandler: WhatsAppInboundHandler | null = null;
let connectedNumber: string | null = null;
let lastConnectionActivityAt = Date.now();
let lastConnectedAt: Date | null = null;
let nextInitializationAt = 0;
let socketGeneration = 0;
let reconnectAttempts = 0;
let activeAuth: Awaited<ReturnType<typeof createBaileysDatabaseAuthState>> | null = null;
let runtimeEnabled = (() => {
  const value = process.env.WHATSAPP_BRIDGE_ENABLED?.trim().toLowerCase();
  return value !== 'false' && value !== '0' && value !== 'off';
})();

const logger = pino({ level: process.env.WHATSAPP_BAILEYS_LOG_LEVEL || 'silent' });

function isEnabled() {
  return runtimeEnabled && process.env.WHATSAPP_BRIDGE_HARD_DISABLED?.trim().toLowerCase() !== 'true';
}

function retryDelayMs() {
  const base = Number(process.env.WHATSAPP_RECONNECT_DELAY_SECONDS || 20) * 1000;
  const max = Number(process.env.WHATSAPP_RECONNECT_MAX_DELAY_SECONDS || 300) * 1000;
  const exponential = Math.min(base * (2 ** Math.min(reconnectAttempts, 5)), max);
  return exponential + randomBetween(2_000, 12_000);
}

function staleConnectingMs() {
  return Number(process.env.WHATSAPP_STALE_CONNECTING_SECONDS || 120) * 1000;
}

function boundedNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function randomBetween(min: number, max: number) {
  if (max <= min) return min;
  return Math.floor(min + Math.random() * (max - min + 1));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function humanizedSendingEnabled() {
  const value = process.env.WHATSAPP_HUMANIZE_SENDING?.trim().toLowerCase();
  return value !== 'false' && value !== '0' && value !== 'off';
}

function humanizedInitialDelayMs(message: string) {
  const min = boundedNumber(process.env.WHATSAPP_MIN_SEND_DELAY_SECONDS, 7, 0, 120) * 1000;
  const max = boundedNumber(process.env.WHATSAPP_MAX_SEND_DELAY_SECONDS, 18, 0, 180) * 1000;
  const lengthDelay = Math.min(message.length * 18, 8_000);
  return randomBetween(Math.min(min, max), Math.max(min, max)) + lengthDelay;
}

function humanizedTypingDelayMs(message: string) {
  const perCharacter = boundedNumber(process.env.WHATSAPP_TYPING_MS_PER_CHARACTER, 45, 5, 250);
  const min = boundedNumber(process.env.WHATSAPP_MIN_TYPING_SECONDS, 5, 0, 120) * 1000;
  const max = boundedNumber(process.env.WHATSAPP_MAX_TYPING_SECONDS, 28, 1, 240) * 1000;
  const calculated = message.length * perCharacter + randomBetween(700, 2_500);
  return Math.min(Math.max(calculated, min), max);
}

function sanitizeError(error: unknown) {
  if (!(error instanceof Error)) return 'Error desconocido';
  return error.message.replace(/\+?\d{7,15}/g, '[redacted]').slice(0, 220);
}

function disconnectStatusCode(error: unknown) {
  const candidate = error as {
    output?: { statusCode?: number };
    data?: { statusCode?: number };
    statusCode?: number;
  } | undefined;
  return candidate?.output?.statusCode || candidate?.data?.statusCode || candidate?.statusCode;
}

function normalizeRecipientNumber(recipient: string) {
  const digits = recipient.replace(/[^\d]/g, '');
  if (!digits) throw new Error('Numero de WhatsApp invalido.');
  if (digits.length === 10 && digits.startsWith('3')) return `57${digits}`;
  return digits;
}

function normalizeOptionalNumber(recipient?: string | null) {
  const normalizedJid = jidNormalizedUser(recipient || '');
  const digits = normalizedJid.split('@')[0]?.split(':')[0]?.replace(/[^\d]/g, '') || '';
  return digits || null;
}

function extractMessageText(message: WAMessage) {
  const content = normalizeMessageContent(message.message);
  return (
    content?.conversation
    || content?.extendedTextMessage?.text
    || content?.imageMessage?.caption
    || content?.videoMessage?.caption
    || content?.documentMessage?.caption
    || content?.buttonsResponseMessage?.selectedDisplayText
    || content?.listResponseMessage?.title
    || ''
  ).trim();
}

function scheduleReconnect(statusCode?: number) {
  if (!isEnabled() || statusCode === DisconnectReason.loggedOut) return;
  nextInitializationAt =
    statusCode === DisconnectReason.restartRequired
      ? 0
      : Date.now() + retryDelayMs();
}

function endSocketQuietly(currentSocket: WASocket | null, reason: string) {
  const end = (currentSocket as unknown as { end?: (error?: Error) => void } | null)?.end;
  if (typeof end === 'function') {
    try {
      end.call(currentSocket, new Error(reason));
    } catch {
      // Baileys may already have closed the socket.
    }
  }
}

function resetStaleConnectingSocket(reason: string) {
  const currentSocket = socket;
  ++socketGeneration;
  socket = null;
  activeAuth = null;
  initStarted = false;
  qrCodeDataUrl = null;
  connectedNumber = null;
  connection = 'disconnected';
  lastError = reason;
  nextInitializationAt = 0;
  reconnectAttempts += 1;
  lastConnectionActivityAt = Date.now();
  endSocketQuietly(currentSocket, reason);
}

export function setWhatsAppInboundHandler(handler: WhatsAppInboundHandler | null) {
  inboundHandler = handler;
}

export function enableWhatsAppClient() {
  runtimeEnabled = true;
  nextInitializationAt = 0;
  if (connection === 'disabled') connection = 'disconnected';
}

export function disableWhatsAppClient() {
  runtimeEnabled = false;
  connection = 'disabled';
}

export async function initializeWhatsAppClient(prisma: PrismaClient) {
  if (!isEnabled()) {
    connection = 'disabled';
    return;
  }
  if ((initStarted || socket) && connection === 'connecting' && Date.now() - lastConnectionActivityAt > staleConnectingMs()) {
    resetStaleConnectingSocket('Reconectando WhatsApp automaticamente: la vinculacion quedo sin respuesta.');
  }
  if (Date.now() < nextInitializationAt || initStarted || socket) return;

  initStarted = true;
  connection = 'connecting';
  lastConnectionActivityAt = Date.now();
  lastError = null;
  const generation = ++socketGeneration;

  try {
    const auth = await createBaileysDatabaseAuthState(prisma);
    activeAuth = auth;
    const { version } = await fetchLatestBaileysVersion();
    const currentSocket = makeWASocket({
      auth: auth.state,
      version,
      logger,
      browser: Browsers.windows('Centro Digital'),
      connectTimeoutMs: Number(process.env.WHATSAPP_CONNECT_TIMEOUT_SECONDS || 60) * 1000,
      defaultQueryTimeoutMs: Number(process.env.WHATSAPP_QUERY_TIMEOUT_SECONDS || 60) * 1000,
      keepAliveIntervalMs: Number(process.env.WHATSAPP_KEEPALIVE_SECONDS || 20) * 1000,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      generateHighQualityLinkPreview: false,
      emitOwnEvents: false,
      qrTimeout: 60_000
    });
    socket = currentSocket;

    currentSocket.ev.on('creds.update', () => {
      void auth.saveCreds().catch((error: unknown) => {
        lastError = `No se pudo guardar la sesion: ${sanitizeError(error)}`;
      });
    });

    currentSocket.ev.on('connection.update', (update) => {
      if (generation !== socketGeneration) return;
      lastConnectionActivityAt = Date.now();

      if (update.qr) {
        connection = 'connecting';
        lastError = null;
        void QRCode.toDataURL(update.qr, { width: 360, margin: 2 })
          .then((dataUrl) => {
            if (generation === socketGeneration) qrCodeDataUrl = dataUrl;
          })
          .catch((error: unknown) => {
            lastError = `No se pudo generar el QR: ${sanitizeError(error)}`;
          });
      }

      if (update.connection === 'open') {
        connection = 'connected';
        qrCodeDataUrl = null;
        connectedNumber = normalizeOptionalNumber(currentSocket.user?.id);
        lastConnectedAt = new Date();
        nextInitializationAt = 0;
        reconnectAttempts = 0;
        lastError = null;
        initStarted = false;
        return;
      }

      if (update.connection === 'close') {
        const statusCode = disconnectStatusCode(update.lastDisconnect?.error);
        socket = null;
        initStarted = false;
        qrCodeDataUrl = null;
        connectedNumber = null;

        if (statusCode === DisconnectReason.loggedOut) {
          connection = 'disconnected';
          lastError = 'La sesion fue cerrada desde WhatsApp. Inicia una nueva vinculacion.';
          void auth.clear().catch(() => undefined);
          activeAuth = null;
          return;
        }

        connection = statusCode === DisconnectReason.restartRequired ? 'connecting' : 'disconnected';
        lastError =
          statusCode === DisconnectReason.restartRequired
            ? null
            : `${sanitizeError(update.lastDisconnect?.error)}${statusCode ? ` (codigo ${statusCode})` : ''}`;
        reconnectAttempts += 1;
        scheduleReconnect(statusCode);
      }
    });

    currentSocket.ev.on('messages.upsert', ({ messages, type }) => {
      if (!inboundHandler || process.env.WHATSAPP_INBOUND_ENABLED !== 'true' || type !== 'notify') return;
      for (const message of messages) {
        const body = extractMessageText(message);
        const from = message.key.remoteJid || '';
        if (!body || message.key.fromMe) continue;
        if (from.endsWith('@g.us') && process.env.WHATSAPP_PROCESS_GROUPS !== 'true') continue;
        void inboundHandler({
          whatsappMessageId: message.key.id || undefined,
          from,
          body,
          raw: {
            id: message.key.id,
            from,
            participant: message.key.participant,
            timestamp: message.messageTimestamp,
            pushName: message.pushName
          }
        }).catch(() => undefined);
      }
    });
  } catch (error) {
    socket = null;
    activeAuth = null;
    initStarted = false;
    connection = 'disconnected';
    connectedNumber = null;
    qrCodeDataUrl = null;
    lastError = sanitizeError(error);
    reconnectAttempts += 1;
    nextInitializationAt = Date.now() + retryDelayMs();
    lastConnectionActivityAt = Date.now();
  }
}

export async function sendWhatsAppMessage(recipient: string, message: string) {
  if (!isEnabled()) throw new Error('WhatsApp Bridge desactivado.');
  if (connection !== 'connected' || !socket) throw new Error('WhatsApp no esta conectado.');

  const phone = normalizeRecipientNumber(recipient);
  const matches = await socket.onWhatsApp(phone);
  const destination = matches?.find((match) => match.exists)?.jid;
  if (!destination) throw new Error('El numero no existe en WhatsApp o debe incluir codigo de pais.');

  if (humanizedSendingEnabled()) {
    await sleep(humanizedInitialDelayMs(message));
    await socket.presenceSubscribe(destination).catch(() => undefined);
    await socket.sendPresenceUpdate('composing', destination).catch(() => undefined);
    await sleep(humanizedTypingDelayMs(message));
    await socket.sendPresenceUpdate('paused', destination).catch(() => undefined);
    await sleep(randomBetween(900, 2_800));
  }

  await socket.sendMessage(destination, { text: message });
}

export async function disconnectWhatsAppClient() {
  const currentSocket = socket;
  const auth = activeAuth;
  ++socketGeneration;
  socket = null;
  activeAuth = null;
  initStarted = false;
  qrCodeDataUrl = null;
  connectedNumber = null;
  lastConnectedAt = null;
  nextInitializationAt = 0;

  await currentSocket?.logout().catch(() => undefined);
  await auth?.clear().catch(() => undefined);
  connection = isEnabled() ? 'disconnected' : 'disabled';
}

export function getWhatsAppRuntimeStatus() {
  return {
    enabled: isEnabled(),
    mode: 'baileys',
    connection,
    connectedNumber,
    lastConnectedAt: lastConnectedAt?.toISOString() || null,
    qrPending: Boolean(qrCodeDataUrl),
    qr: qrCodeDataUrl,
    lastError
  };
}
