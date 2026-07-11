const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
app.use(express.json());

let latestQrData = null;
let isClientReady = false;

// Cloud Platform (Render/Koyeb) compatibility port configuration
const PORT = process.env.PORT || 3000;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// Capture QR Code data
client.on('qr', (qr) => {
    latestQrData = qr;
    isClientReady = false;
    console.log('New QR Code generated. View it via the Web UI.');
});

client.on('ready', () => {
    latestQrData = null;
    isClientReady = true;
    console.log('WhatsApp Client is fully Authenticated & Ready! 🚀');
});

client.on('disconnected', (reason) => {
    isClientReady = false;
    console.log('WhatsApp Client disconnected:', reason);
    client.initialize();
});

// UI Route: Open this in browser to scan QR Code easily
app.get('/', (req, res) => {
    if (isClientReady) {
        return res.send(`
            <div style="font-family:sans-serif; text-align:center; padding-top:50px; background:#0b0f19; color:#fff; height:100vh;">
                <h1 style="color:#10b981;">⚡ CortexHost WhatsApp Gateway Status</h1>
                <p style="font-size:18px; color:#9ca3af;">Status: <b style="color:#10b981;">CONNECTED & ACTIVE</b></p>
                <p>Aapka gateway perfectly live chal raha hai aur messages deliver karne ke liye taiyar hai.</p>
            </div>
        `);
    }

    if (!latestQrData) {
        return res.send(`
            <div style="font-family:sans-serif; text-align:center; padding-top:50px; background:#0b0f19; color:#fff; height:100vh;">
                <h1>🔄 Starting WhatsApp Engine...</h1>
                <p style="color:#9ca3af;">System initialize ho raha hai. Please 10-15 seconds baad page ko refresh karein.</p>
                <script>setTimeout(() => { location.reload(); }, 5000);</script>
            </div>
        `);
    }

    // Convert string data to HTML Image tag dynamically
    qrcode.toDataURL(latestQrData, (err, url) => {
        if (err) return res.send('Error rendering QR Code');
        res.send(`
            <div style="font-family:sans-serif; text-align:center; padding-top:40px; background:#0b0f19; color:#fff; min-height:100vh;">
                <h1 style="color:#00d2ff;">📱 Link CortexHost WhatsApp Gateway</h1>
                <p style="color:#9ca3af; font-size:16px;">Apne WhatsApp app se niche diye gaye QR code ko scan karein:</p>
                <div style="background:#fff; padding:20px; display:inline-block; border-radius:12px; margin-top:20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                    <img src="${url}" style="width:250px; height:250px;" />
                </div>
                <p style="color:#f59e0b; margin-top:20px; font-weight:bold;">⚠️ Scan hone ke baad yeh page automatic status page mein badal jayega.</p>
                <script>setInterval(() => { fetch('/status-check').then(r => r.json()).then(d => { if(d.ready) location.reload(); }) }, 3000);</script>
            </div>
        `);
    });
});

// internal checker route for dynamic reload
app.get('/status-check', (req, res) => {
    res.json({ ready: isClientReady });
});

// Core WHMCS API Processing Link Method
app.post('/send-sms', async (req, res) => {
    const { phone, message } = req.body;

    if (!isClientReady) {
        return res.status(503).json({ success: false, error: "WhatsApp Gateway is not authenticated yet." });
    }

    if (!phone || !message) {
        return res.status(400).json({ success: false, error: "Phone number or message parameter is missing." });
    }

    try {
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        const formattedPhone = `${cleanPhone}@c.us`;

        await client.sendMessage(formattedPhone, message);
        return res.json({ success: true, message: "Notification dispatched successfully." });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Boot Application Hook
app.listen(PORT, () => console.log(`CortexHost Free Web Gateway operational on port ${PORT}`));
client.initialize();
