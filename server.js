require('dotenv').config();
const express = require('express');
const { NodeSSH } = require('node-ssh');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const CONTROLLER_INFORM = process.env.CONTROLLER_INFORM || 'http://172.16.200.2:8080/inform';

app.post('/adopt-bulk', async (req, res) => {
  const { ips } = req.body;

  if (!Array.isArray(ips) || ips.length === 0) {
    return res.status(400).json({ error: 'No IPs provided' });
  }

  const results = [];
  const ssh = new NodeSSH();

  for (const ipRaw of ips) {
    const ip = ipRaw.trim();
    if (!ip) continue;

    try {
      await ssh.connect({
        host: ip,
        username: 'ubnt',
        password: 'ubnt',
        timeout: 15000
      });

      await ssh.execCommand(`set-inform ${CONTROLLER_INFORM}`);
      results.push({ ip, success: true });
    } catch (err) {
      results.push({ ip, success: false, error: err.message });
    } finally {
      if (ssh.isConnected()) ssh.dispose();
    }
  }

  res.json({
    total: ips.length,
    successful: results.filter(r => r.success).length,
    results
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
