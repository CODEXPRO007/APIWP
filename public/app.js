const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  return res.json();
}

// ---------- LOGIN ----------
document.getElementById('loginBtn').addEventListener('click', async () => {
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if (data.success) {
    showDashboard();
  } else {
    errorEl.textContent = data.message || 'Login failed';
  }
});

document.getElementById('logoutSessionBtn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  location.reload();
});

async function checkSession() {
  const data = await api('/api/auth/check');
  if (data.loggedIn) showDashboard();
}

function showDashboard() {
  loginScreen.style.display = 'none';
  dashboardScreen.style.display = 'block';
  document.getElementById('bridgeUrlValue').textContent = window.location.origin;
  pollStatus();
  loadLogs();
  setInterval(pollStatus, 3500);
  setInterval(loadLogs, 6000);
}

// ---------- TABS ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-qr').style.display = btn.dataset.tab === 'qr' ? 'block' : 'none';
    document.getElementById('tab-phone').style.display = btn.dataset.tab === 'phone' ? 'block' : 'none';
  });
});

// ---------- STATUS / QR ----------
async function pollStatus() {
  const data = await api('/api/dashboard/status');
  if (!data.success) return;

  const pill = document.getElementById('statusPill');
  const dotLabel = { READY: 'Connected', AUTHENTICATED: 'Authenticating…', QR_READY: 'Scan QR', PAIRING: 'Pairing…', DISCONNECTED: 'Disconnected' };
  pill.className = 'status-pill ' + (data.status === 'READY' ? 'status-connected' : data.status === 'DISCONNECTED' ? 'status-disconnected' : 'status-pending');
  pill.innerHTML = `<span class="dot"></span> ${dotLabel[data.status] || data.status}`;

  const qrImg = document.getElementById('qrImage');
  const qrPlaceholder = document.getElementById('qrPlaceholder');
  if (data.qrDataUrl) {
    qrImg.src = data.qrDataUrl;
    qrImg.style.display = 'block';
    qrPlaceholder.style.display = 'none';
  } else if (data.status !== 'READY') {
    qrImg.style.display = 'none';
    qrPlaceholder.style.display = 'block';
    qrPlaceholder.textContent = data.status === 'AUTHENTICATED' ? 'Authenticating…' : 'Waiting for QR…';
  } else {
    qrImg.style.display = 'none';
    qrPlaceholder.style.display = 'block';
    qrPlaceholder.textContent = 'Connected ✔';
  }

  document.getElementById('linkedNumberValue').textContent = data.linkedNumber || '—';

  if (data.pairingCode) {
    const box = document.getElementById('pairingCodeBox');
    box.style.display = 'block';
    box.textContent = data.pairingCode;
  }
}

// ---------- PAIRING ----------
document.getElementById('pairBtn').addEventListener('click', async () => {
  const phoneNumber = document.getElementById('phoneInput').value.trim();
  if (!phoneNumber) return;
  const data = await api('/api/dashboard/pair', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  });
  if (data.success) {
    const box = document.getElementById('pairingCodeBox');
    box.style.display = 'block';
    box.textContent = data.code;
  } else {
    alert(data.message || 'Failed to generate pairing code');
  }
});

// ---------- RESET ----------
document.getElementById('resetBtn').addEventListener('click', async () => {
  if (!confirm('This will log out the linked WhatsApp session. Continue?')) return;
  await api('/api/dashboard/logout', { method: 'POST' });
  pollStatus();
});

// ---------- TEST MESSAGE ----------
document.getElementById('testSendBtn').addEventListener('click', async () => {
  const to = document.getElementById('testTo').value.trim();
  const message = document.getElementById('testMsg').value.trim();
  const resultEl = document.getElementById('testResult');
  resultEl.style.color = '';
  resultEl.textContent = 'Sending…';
  const data = await api('/api/dashboard/test-message', {
    method: 'POST',
    body: JSON.stringify({ to, message }),
  });
  if (data.success) {
    resultEl.textContent = '✔ Sent successfully';
    loadLogs();
  } else {
    resultEl.textContent = '✖ ' + (data.message || 'Failed');
  }
});

// ---------- LOGS ----------
async function loadLogs() {
  const data = await api('/api/dashboard/logs');
  if (!data.success) return;
  const term = document.getElementById('logTerminal');
  if (!data.logs.length) {
    term.innerHTML = '<div class="muted small">No messages yet.</div>';
    return;
  }
  term.innerHTML = data.logs
    .map(
      (l) => `<div class="log-line">
        <span class="muted">${l.created_at}</span>
        <span class="log-status-${l.status}">[${l.status}]</span>
        <span>${l.recipient}</span>
      </div>`
    )
    .join('');
}

checkSession();
    
