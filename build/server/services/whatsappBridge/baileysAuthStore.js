import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BufferJSON, initAuthCreds, proto } from 'baileys';
export const BAILEYS_CREDS_SETTING = 'whatsapp_baileys_creds_v1';
export const BAILEYS_KEYS_SETTING = 'whatsapp_baileys_keys_v1';
const SESSION_FILE_NAME = 'baileys-session-v1.json';
function encryptionKey() {
    const secret = process.env.APP_ENCRYPTION_KEY;
    if (!secret)
        throw new Error('APP_ENCRYPTION_KEY es requerido para proteger la sesion de WhatsApp.');
    return crypto.createHash('sha256').update(secret).digest();
}
function encrypt(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}
function decrypt(value) {
    const [ivRaw, tagRaw, dataRaw] = value.split('.');
    if (!ivRaw || !tagRaw || !dataRaw)
        throw new Error('La sesion cifrada de WhatsApp no tiene un formato valido.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));
    return Buffer.concat([
        decipher.update(Buffer.from(dataRaw, 'base64')),
        decipher.final()
    ]).toString('utf8');
}
function serialize(value) {
    return JSON.stringify(value, BufferJSON.replacer);
}
function deserialize(value) {
    return JSON.parse(value, BufferJSON.reviver);
}
function hostingerDomainRoot() {
    const normalizedCwd = process.cwd();
    for (const marker of [
        `${path.sep}hbuilds${path.sep}versions${path.sep}`,
        `${path.sep}public_html${path.sep}.builds${path.sep}`
    ]) {
        const markerIndex = normalizedCwd.indexOf(marker);
        if (markerIndex > 0)
            return normalizedCwd.slice(0, markerIndex);
    }
    return '';
}
function sessionDirectory() {
    const configuredPath = process.env.WHATSAPP_SESSION_PATH || './.whatsapp-session';
    if (path.isAbsolute(configuredPath))
        return configuredPath;
    const stableDomainRoot = process.env.NODE_ENV === 'production' ? hostingerDomainRoot() : '';
    return path.resolve(stableDomainRoot || process.cwd(), configuredPath);
}
function sessionFilePath() {
    return path.join(sessionDirectory(), SESSION_FILE_NAME);
}
async function readFileSnapshot() {
    try {
        const raw = await fs.readFile(sessionFilePath(), 'utf8');
        const file = JSON.parse(raw);
        if (!file?.data)
            return null;
        return deserialize(decrypt(file.data));
    }
    catch (error) {
        const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
        if (code === 'ENOENT')
            return null;
        throw error;
    }
}
async function saveFileSnapshot(snapshot) {
    await fs.mkdir(sessionDirectory(), { recursive: true });
    const payload = {
        version: 1,
        data: encrypt(serialize(snapshot))
    };
    await fs.writeFile(sessionFilePath(), JSON.stringify(payload), { mode: 0o600 });
}
async function readEncryptedSetting(prisma, key) {
    const setting = await prisma.appSetting.findUnique({ where: { key } });
    if (!setting?.value)
        return null;
    return deserialize(decrypt(setting.value));
}
async function readLegacyDatabaseSnapshot(prisma) {
    const creds = await readEncryptedSetting(prisma, BAILEYS_CREDS_SETTING);
    const keys = await readEncryptedSetting(prisma, BAILEYS_KEYS_SETTING);
    if (!creds && !keys)
        return null;
    return {
        creds: creds || initAuthCreds(),
        keys: keys || {}
    };
}
export async function createBaileysDatabaseAuthState(prisma) {
    let creds;
    let keySnapshot;
    try {
        const fileSnapshot = await readFileSnapshot();
        const snapshot = fileSnapshot || await readLegacyDatabaseSnapshot(prisma);
        creds = snapshot?.creds || initAuthCreds();
        keySnapshot = snapshot?.keys || {};
        if (!fileSnapshot && snapshot)
            await saveFileSnapshot(snapshot);
    }
    catch (_error) {
        creds = initAuthCreds();
        keySnapshot = {};
    }
    let writeQueue = Promise.resolve();
    const queueWrite = (task) => {
        writeQueue = writeQueue.then(task, task);
        return writeQueue;
    };
    const state = {
        creds,
        keys: {
            get: async (type, ids) => {
                const values = {};
                for (const id of ids) {
                    let value = keySnapshot[type]?.[id];
                    if (type === 'app-state-sync-key' && value) {
                        value = proto.Message.AppStateSyncKeyData.fromObject(value);
                    }
                    if (value)
                        values[id] = value;
                }
                return values;
            },
            set: async (data) => {
                for (const [category, entries] of Object.entries(data)) {
                    if (!entries)
                        continue;
                    keySnapshot[category] ||= {};
                    for (const [id, value] of Object.entries(entries)) {
                        if (value === null || value === undefined) {
                            delete keySnapshot[category][id];
                        }
                        else {
                            keySnapshot[category][id] = value;
                        }
                    }
                    if (!Object.keys(keySnapshot[category]).length)
                        delete keySnapshot[category];
                }
                await queueWrite(() => saveFileSnapshot({ creds: state.creds, keys: keySnapshot }));
            }
        }
    };
    return {
        state,
        saveCreds: () => queueWrite(() => saveFileSnapshot({ creds: state.creds, keys: keySnapshot })),
        clear: async () => {
            await writeQueue.catch(() => undefined);
            await fs.rm(sessionFilePath(), { force: true }).catch(() => undefined);
        }
    };
}
