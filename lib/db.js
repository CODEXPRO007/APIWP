const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'bridge.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient TEXT,
  message TEXT,
  status TEXT,
  wa_id TEXT,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

function logMessage({ to, message, status, wa_id = null, error = null }) {
  const stmt = db.prepare(
    `INSERT INTO logs (recipient, message, status, wa_id, error) VALUES (?, ?, ?, ?, ?)`
  );
  stmt.run(to, message, status, wa_id, error);
}

function getLogs(limit = 100) {
  return db
    .prepare(`SELECT * FROM logs ORDER BY id DESC LIMIT ?`)
    .all(limit);
}

module.exports = { logMessage, getLogs };
