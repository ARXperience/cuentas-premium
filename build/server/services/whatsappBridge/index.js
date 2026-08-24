import { enqueueWhatsAppMessage, getWhatsAppOutboxCounts, processWhatsAppOutbox, retryFailedWhatsAppMessages, shouldPollWhatsAppOutbox } from './queue.js';
import { disableWhatsAppClient, disconnectWhatsAppClient, enableWhatsAppClient, getWhatsAppRuntimeStatus, initializeWhatsAppClient, setWhatsAppInboundHandler } from './baileysClient.js';
let workerStarted = false;
let activePrisma = null;
let activeAddMovement = null;
let activeFailureHandler;
function workerIntervalMs() {
    return Number(process.env.WHATSAPP_WORKER_INTERVAL_SECONDS || (process.env.NODE_ENV === 'production' ? 30 : 5)) * 1000;
}
export async function queueWhatsAppNotification(prisma, input) {
    return enqueueWhatsAppMessage(prisma, input);
}
export async function getWhatsAppBridgeStatus(prisma) {
    const runtime = getWhatsAppRuntimeStatus();
    const counts = await getWhatsAppOutboxCounts(prisma);
    return {
        enabled: runtime.enabled,
        mode: runtime.mode,
        connection: runtime.connection,
        connectedNumber: runtime.connectedNumber,
        qrPending: runtime.qrPending,
        lastError: runtime.lastError,
        ...counts
    };
}
export function getWhatsAppBridgeRuntimeStatus() {
    return getWhatsAppRuntimeStatus();
}
export function getWhatsAppBridgeQr() {
    return getWhatsAppRuntimeStatus().qr;
}
export async function retryFailedWhatsAppOutbox(prisma) {
    await retryFailedWhatsAppMessages(prisma);
}
export async function disconnectWhatsAppBridge() {
    await disconnectWhatsAppClient();
    disableWhatsAppClient();
}
export function enableWhatsAppBridge() {
    enableWhatsAppClient();
}
export async function startWhatsAppBridgeWorker(prisma, addMovement, inboundHandler, onFinalFailure) {
    activePrisma = prisma;
    activeAddMovement = addMovement;
    activeFailureHandler = onFinalFailure;
    if (inboundHandler)
        setWhatsAppInboundHandler(inboundHandler);
    if (!workerStarted) {
        workerStarted = true;
        windowlessInterval(async () => {
            await runWhatsAppBridgeTick();
        }, workerIntervalMs());
    }
    await runWhatsAppBridgeTick(true);
}
export async function wakeWhatsAppBridgeWorker() {
    await runWhatsAppBridgeTick(true);
}
async function runWhatsAppBridgeTick(force = false) {
    if (!activePrisma || !activeAddMovement)
        return;
    await initializeWhatsAppClient(activePrisma);
    if (!force && !shouldPollWhatsAppOutbox())
        return;
    await processWhatsAppOutbox(activePrisma, activeAddMovement, activeFailureHandler);
}
function windowlessInterval(task, ms) {
    let running = false;
    setInterval(() => {
        if (running)
            return;
        running = true;
        task()
            .catch(() => null)
            .finally(() => {
            running = false;
        });
    }, ms);
}
