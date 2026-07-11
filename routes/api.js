const express = require('express');
const router = express.Router();
const wa = require('../lib/whatsappClient');
const { logMessage, getLogs } = require('../lib/db');

// Middleware: protect WHMCS -> Bridge calls with a shared secret key
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.API_SECRET) {
    return res.status(401).json({ success: false, message: 'Invalid or missing API key' });
  }
  next();
}

// Middleware: protect dashboard-only endpoints with session login
function requireSession(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  return res.status(401).json({ success: false, message: 'Not logged in' });
}

// ---- Used by WHMCS addon module ----
router.post('/send', requireApiKey, async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ success: false, message: 'to and message are required' });
  }
  try {
    await wa.sendMessage(to, message, process.env.DEFAULT_COUNTRY_CODE);
    return res.json({ success: true, message: 'Message sent' });
  } catch (err) {
    logMessage({ to, message, status: 'FAILED', error: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/status', requireApiKey, (req, res) => {
  const s = wa.getState();
  res.json({ success: true, status: s.status, linkedNumber: s.linkedNumber });
});

// ---- Used by the dashboard UI (session-protected) ----
router.get('/dashboard/status', requireSession, (req, res) => {
  res.json({ success: true, ...wa.getState() });
});

router.get('/dashboard/logs', requireSession, (req, res) => {
  res.json({ success: true, logs: getLogs(150) });
});

router.post('/dashboard/pair', requireSession, async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ success: false, message: 'phoneNumber required' });
  try {
    const code = await wa.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
    res.json({ success: true, code });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/dashboard/logout', requireSession, async (req, res) => {
  try {
    await wa.logout();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/dashboard/test-message', requireSession, async (req, res) => {
  const { to, message } = req.body;
  try {
    await wa.sendMessage(to, message || 'CortexHost WhatsApp Notifier test message ✅', process.env.DEFAULT_COUNTRY_CODE);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
            
