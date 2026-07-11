const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let isClientReady = false;
let pairingCode = null;

const PORT = process.env.PORT || 3000;

// --- RENDER ENVIRONMENT DYNAMIC CHROMIUM FINDER ---
let chromePath = null;

// Render default cache paths check logic
const potentialPaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/opt/render/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome',
    '/opt/render/.cache/puppeteer'
];

for (const p of potentialPaths) {
    if (p && fs.existsSync(p) && fs.lstatSync(p).isFile()) {
        chromePath = p;
        break;
    }
}

console.log(chromePath ? `Using detected Chrome binary at: ${chromePath}` : 'Chrome path not forced, relying on default puppeteer resolver.');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        // Force path if explicitly found on Render storage
        ...(chromePath && { executablePath: chromePath }),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ]
    }
});

client.on('qr', (qr) => {
    isClientReady = false;
    console.log('Engine initialized successfully. Web UI ready for connection.');
});

client.on('ready', () => {
    pairingCode = null;
    isClientReady = true;
    console.log('WhatsApp Client is fully Authenticated & Ready! 🚀');
});

client.on('disconnected', (reason) => {
    isClientReady = false;
    pairingCode = null;
    console.log('WhatsApp Client disconnected:', reason);
    client.initialize();
});

// Main Dashboard Web UI
app.get('/', (req, res) => {
    if (isClientReady) {
        return res.send(`
            <div style="font-family:sans-serif; text-align:center; padding-top:50px; background:#0b0f19; color:#fff; height:100vh; margin:0;">
                <h1 style="color:#10b981;">⚡ CortexHost WhatsApp Gateway Status</h1>
                <p style="font-size:18px; color:#9ca3af;">Status: <b style="color:#10b981;">CONNECTED & ACTIVE</b></p>
                <p>Aapka premium gateway perfectly live chal raha hai aur messages deliver karne ke liye taiyar hai.</p>
            </div>
        `);
    }

    let codeHtml = '';
    if (pairingCode) {
        codeHtml = `
            <div style="margin-top:25px; padding:20px; background:#1e293b; border-radius:8px; display:inline-block; border:2px solid #3b82f6; max-width:90%;">
                <p style="font-size:16px; margin:0 0 10px 0; color:#cbd5e1;">Aapka Linking Code niche hai.<br>Apne phone ke WhatsApp notification par click karein aur yeh code daalein:</p>
                <h2 style="font-size:36px; color:#3b82f6; letter-spacing:6px; margin:10px 0; font-family:monospace; font-weight:bold;">${pairingCode}</h2>
            </div>
        `;
    }

    res.send(`
        <div style="font-family:sans-serif; text-align:center; padding-top:40px; background:#0b0f19; color:#fff; min-height:100vh; margin:0; padding-left:15px; padding-right:15px; box-sizing:border-box;">
            <h1 style="color:#00d2ff; margin-bottom:5px;">📱 Link CortexHost WhatsApp Gateway</h1>
            <p style="color:#9ca3af; font-size:15px; margin-top:0;">Bina QR code ke direct phone number se link karein</p>
            
            <form action="/request-code" method="POST" style="margin-top:20px; background:#111827; padding:25px; display:inline-block; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.5); border:1px solid #1f2937; text-align:left; max-width:400px; width:100%; box-sizing:border-box;">
                <label style="display:block; margin-bottom:8px; color:#9ca3af; font-size:14px; font-weight:bold;">WhatsApp Number (Country Code ke sath daalein):</label>
                <input type="text" name="phone" placeholder="91XXXXXXXXXX" required style="width:100%; padding:12px; border-radius:6px; border:1px solid #374151; background:#1f2937; color:#fff; font-size:16px; margin-bottom:15px; box-sizing:border-box;">
                <button type="submit" style="width:100%; background:#00d2ff; color:#000; border:none; padding:12px; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer;">Linking Code Request Karein</button>
            </form>
            
            <br>
            ${codeHtml}
            
            <p style="color:#f59e0b; margin-top:30px; font-size:14px;">⚠️ Code enter karne ke baad, yeh page automatic dashboard mein badal jayega.</p>
            <script>
                setInterval(() => {
                    fetch('/status-check').then(r => r.json()).then(d => {
                        if(d.ready) location.reload();
                    })
                }, 3000);
            </script>
        </div>
    `);
});

app.post('/request-code', async (req, res) => {
    const targetPhone = req.body.phone;
    if (!targetPhone) return res.send('Phone number missing. <a href="/">Back</a>');

    try {
        let cleanPhone = targetPhone.replace(/[^0-9]/g, '');
        if (client.pupPage) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            pairingCode = await client.requestPairingCode(cleanPhone);
            res.redirect('/');
        } else {
            res.send('Engine initializing, please wait 15 seconds and refresh. <a href="/">Back</a>');
        }
    } catch (err) {
        res.send('Error generating code: ' + err.message + '. <a href="/">Go Back</a>');
    }
});

app.get('/status-check', (req, res) => {
    res.json({ ready: isClientReady });
});

app.post('/send-sms', async (req, res) => {
    const { phone, message } = req.body;

    if (!isClientReady) return res.status(503).json({ success: false, error: "Gateway not authenticated." });
    if (!phone || !message) return res.status(400).json({ success: false, error: "Missing parameters." });

    try {
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        const formattedPhone = `${cleanPhone}@c.us`;

        await client.sendMessage(formattedPhone, message);
        return res.json({ success: true, message: "Dispatched safely." });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`CortexHost Free Web Gateway operational on port ${PORT}`));
client.initialize();
