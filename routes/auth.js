const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password && password === process.env.ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, message: 'Wrong password' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get('/check', (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.loggedIn) });
});

module.exports = router;
