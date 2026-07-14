// api/index.js - Vercel Serverless Function
// For UniFi OS consoles (UDM, UDM Pro, UDM SE, Cloud Key Gen2/G2 Plus, etc.)

// UniFi OS controllers commonly use self-signed certs on the local network.
// This disables TLS verification for THIS function only. If your controller
// is reachable over a trusted path (LAN, VPN, tunnel) this is a standard
// tradeoff for self-hosted UniFi gear. Do not do this for public-internet
// traffic you don't control.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const controllerUrl = process.env.UNIFI_CONTROLLER_URL; // e.g. https://172.16.200.2 or https://your-ddns.example.com
  const username = process.env.UNIFI_USERNAME;
  const password = process.env.UNIFI_PASSWORD;
  const site = process.env.UNIFI_SITE || 'default';

  if (!controllerUrl || !username || !password) {
    return res.status(400).json({
      error: 'Missing environment variables',
      details: 'Require UNIFI_CONTROLLER_URL, UNIFI_USERNAME, UNIFI_PASSWORD in Vercel Environment Variables'
    });
  }

  console.log('🔐 Connecting to UniFi OS Controller:', controllerUrl);
  console.log('👤 Username:', username);
  console.log('📡 Site:', site);

  try {
    // ---- Step 1: Login (UniFi OS path, not /api/login) ----
    const loginResponse = await fetch(`${controllerUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('❌ Login failed:', loginResponse.status, errorText);
      return res.status(401).json({
        error: 'Login failed',
        status: loginResponse.status,
        details: errorText || 'Invalid username or password'
      });
    }

    // ---- Step 2: Collect cookies correctly (don't use .get('set-cookie')) ----
    const setCookieHeaders = typeof loginResponse.headers.getSetCookie === 'function'
      ? loginResponse.headers.getSetCookie()
      : [loginResponse.headers.get('set-cookie')].filter(Boolean);

    const cookieHeader = setCookieHeaders.map(c => c.split(';')[0]).join('; ');

    // CSRF token comes back as a response header on UniFi OS, not in the JSON body
    const csrfToken = loginResponse.headers.get('x-csrf-token') || '';

    console.log('✅ Login successful');

    // ---- Step 3: Determine action ----
    const { action } = req.query;
    if (!action) {
      return res.status(400).json({ error: 'Missing action parameter' });
    }

    // UniFi OS proxies the Network application under /proxy/network
    const base = `${controllerUrl}/proxy/network`;

    let url = '';
    let fetchOptions = {
      headers: {
        'Cookie': cookieHeader,
        'X-CSRF-Token': csrfToken
      }
    };

    if (action === 'devices') {
      url = `${base}/api/s/${site}/stat/device`;
      fetchOptions.method = 'GET';
    } else if (action === 'adopt') {
      const { mac } = req.body || {};
      if (!mac) return res.status(400).json({ error: 'Missing mac parameter' });
      url = `${base}/api/s/${site}/cmd/devmgr`;
      fetchOptions.method = 'POST';
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({ cmd: 'adopt', mac });
    } else if (action === 'set-name') {
      const { mac, name } = req.body || {};
      if (!mac || !name) return res.status(400).json({ error: 'Missing mac or name parameter' });
      url = `${base}/api/s/${site}/cmd/devmgr`;
      fetchOptions.method = 'POST';
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({ cmd: 'set-name', mac, name });
    } else {
      return res.status(400).json({ error: `Invalid action: ${action}` });
    }

    console.log('📡 Fetching:', url);
    const response = await fetch(url, fetchOptions);
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('❌ Non-JSON response:', text.slice(0, 300));
      return res.status(response.status || 502).json({
        error: 'Non-JSON response from controller',
        status: response.status,
        raw: text.slice(0, 500)
      });
    }

    if (!response.ok) {
      console.error('❌ Controller returned error:', response.status, data);
      return res.status(response.status).json(data);
    }

    console.log('✅ Request successful');
    return res.status(200).json(data);
  } catch (error) {
    console.error('❌ UniFi API error:', error);
    return res.status(500).json({
      error: error.message,
      details: 'Failed to connect to UniFi Controller'
    });
  }
}
