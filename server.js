require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.post('/adopt-bulk', async (req, res) => {
  const { ips } = req.body;

  // Fake successful response for testing
  const results = ips.map(ip => ({
    ip: ip.trim(),
    success: true,
    message: "Test mode - no real SSH"
  }));

  res.json({
    total: ips.length,
    successful: ips.length,
    results
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Test Server running on http://localhost:${PORT}`));
