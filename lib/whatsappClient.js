/**
 * CortexHost WhatsApp Bridge
 * Wraps whatsapp-web.js so WHMCS can send notifications through a normal
 * WhatsApp Web session (linked via QR code OR phone pairing code) instead
 * of the paid/official WhatsApp Business API.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { logMessage } = require('./db');

const state = {
  status: 'DISCONNECTED', // DISCONNECTED | QR_READY | PAIRING | AUTHENTICATED | READY
  qrDataUrl: null,
  pairingCode: null,
  linkedNumber: null,
  lastError: null,
};

let client = null;

function buildClient() {
  client = new Client({
    authStrategy: new LocalAuth({ clientId: 'cortexhost-notifier' }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    },
  });

  client.on('qr', async (qr) => {
    state.status = 'QR_READY';
    state.qrDataUrl = await qrcode.toDataURL(qr);
    state.lastError = null;
    console.log('[WA] New QR code generated. Scan it from the dashboard.');
  });

  client.on('authenticated', () => {
    state.status = 'AUTHENTICATED';
    state.qrDataUrl = null;
    state.pairingCode = null;
    console.log('[WA] Authenticated.');
  });

  client.on('ready', () => {
    state.status = 'READY';
    state.qrDataUrl = null;
    state.pairingCode = null;
    try {
      state.linkedNumber = client.info?.wid?.user || null;
    } catch (e) {
      state.linkedNumber = null;
    }
    console.log('[WA] Client is ready. Linked number:', state.linkedNumber);
  });

  client.on('auth_failure', (msg) => {
    state.status = 'DISCONNECTED';
    state.lastError = 'Auth failure: ' + msg;
    console.error('[WA] Auth failure:', msg);
  });

  client.on('disconnected', (reason) => {
    state.status = 'DISCONNECTED';
    state.qrDataUrl = null;
    state.pairingCode = null;
    state.linkedNumber = null;
    state.lastError = 'Disconnected: ' + reason;
    console.error('[WA] Disconnected:', reason);
  });

  return client;
}

function init() {
  buildClient();
  client.initialize();
}

/**
 * Request a phone-number pairing code instead of scanning a QR.
 * Call this right after init(), before the QR event settles, or after
 * a fresh logout/reset. Returns the pairing code string.
 */
async function requestPairingCode(phoneNumberWithCountryCode) {
  if (!client) throw new Error('Client not initialized');
  state.status = 'PAIRING';
  const code = await client.requestPairingCode(phoneNumberWithCountryCode);
  state.pairingCode = code;
  return code;
}

async function logout() {
  try {
    if (client) {
      await client.logout();
      await client.destroy();
    }
  } catch (e) {
    console.error('[WA] Error during logout:', e.message);
  }
  state.status = 'DISCONNECTED';
  state.qrDataUrl = null;
  state.pairingCode = null;
  state.linkedNumber = null;
  buildClient();
  client.initialize();
}

function formatNumber(rawNumber, defaultCountryCode) {
  let n = String(rawNumber).replace(/[^0-9]/g, '');
  if (n.length <= 10 && defaultCountryCode) {
    n = defaultCountryCode + n;
  }
  return n + '@c.us';
}

async function sendMessage(rawNumber, message, defaultCountryCode) {
  if (!client || state.status !== 'READY') {
    throw new Error('WhatsApp session is not connected yet');
  }
  const chatId = formatNumber(rawNumber, defaultCountryCode);
  const result = await client.sendMessage(chatId, message);
  logMessage({ to: rawNumber, message, status: 'SENT', wa_id: result?.id?.id || null });
  return result;
}

function getState() {
  return { ...state };
}

module.exports = {
  init,
  requestPairingCode,
  logout,
  sendMessage,
  getState,
};
