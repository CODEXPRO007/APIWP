require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

const wa = require('./lib/whatsappClient');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 12 },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 4040;
app.listen(PORT, () => {
  console.log(`\n==============================================`);
  console.log(` CortexHost WhatsApp Bridge running`);
  console.log(` Dashboard : http://localhost:${PORT}`);
  console.log(`==============================================\n`);
  wa.init();
});
