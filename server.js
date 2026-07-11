const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');

const app = express();
// Forms aur JSON data dono accept karne ke liye middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let isClientReady = false;
let pairingCode = null;

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

client.on('qr', (qr) => {
    isClientReady = false;
    console.log('Engine ready. Waiting for Phone Number or QR input...');
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
            <p style="color:#9ca3af; font-size:15px; margin-top:0;">Single Phone User Jugaad: Bina QR code ke direct link karein</p>
            
            <form action="/request-code" method="POST" style="margin-top:20px; background:#111827; padding:25px; display:inline-block; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.5); border:1px solid #1f2937; text-align:left; max-width:400px; width:100%; box-sizing:border-box;">
                <label style="display:block; margin-bottom:8px; color:#9ca3af; font-size:14px; font-weight:bold;">WhatsApp Number (Country Code ke sath daalein):</label>
                <input type="text" name="phone" placeholder="91XXXXXXXXXX" required style="width:100%; padding:12px; border-radius:6px; border:1px solid #374151; background:#1f2937; color:#fff; font-size:16px; margin-bottom:15px; box-sizing:border-box;">
                <button type="submit" style="width:100%; background:#00d2ff; color:#000; border:none; padding:12px; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer; transition: 0.2s;">Linking Code Request Karein</button>
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

// Route: Request Linking Code dynamically via WhatsApp Web internal API
app.post('/request-code', async (req, res) => {
    const targetPhone = req.body.phone;
    
    if (!targetPhone) {
        return res.send('Phone number missing. <a href="/">Back to Home</a>');
    }

    try {
        let cleanPhone = targetPhone.replace(/[^0-9]/g, '');
        
        // Agar browser instance taiyar hai toh pairing code mangao
        if (client.pupPage) {
            pairingCode = await client.requestPairingCode(cleanPhone);
            console.log(`Pairing code generated for ${cleanPhone}: ${pairingCode}`);
            res.redirect('/');
        } else {
            res.send(`
                <div style="font-family:sans-serif; text-align:center; padding-top:50px; background:#0b0f19; color:#fff; height:100vh;">
                    <h2>🔄 Engine initializing...</h2>
                    <p>System abhi reload ho raha hai, kripya 10 seconds baad peeche jakar try karein.</p>
                    <a href="/" style="color:#00d2ff; text-decoration:none; font-weight:bold;">[ Back to Home ]</a>
                </div>
            `);
        }
    } catch (err) {
        res.send('Error generating code: ' + err.message + '. <a href="/">Go Back</a>');
    }
});

app.get('/status-check', (req, res) => {
    res.json({ ready: isClientReady });
});

// Endpoint called by WHMCS Hooks
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

app.listen(PORT, () => console.log(`CortexHost Free Web Gateway operational on port ${PORT}`));
client.initialize();
