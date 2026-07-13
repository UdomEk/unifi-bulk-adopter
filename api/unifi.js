// api/unifi.js - Vercel Serverless Function
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;
  const controllerUrl = process.env.UNIFI_CONTROLLER_URL || 'https://172.16.200.2';
  const username = process.env.UNIFI_USERNAME || 'udomek';
  const password = process.env.UNIFI_PASSWORD || 'Admin@footprints2024';
  const site = process.env.UNIFI_SITE || 'default';

  try {
    // Step 1: Login to UniFi Controller
    const loginResponse = await fetch(`${controllerUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const loginData = await loginResponse.json();

    // Get cookies from response
    const cookies = loginResponse.headers.get('set-cookie');
    const csrfToken = loginData.csrf_token || '';

    // Step 2: Make the actual request
    let url = '';
    let fetchOptions = {
      headers: {
        'Cookie': cookies || '',
        'X-CSRF-Token': csrfToken
      }
    };

    if (action === 'devices') {
      url = `${controllerUrl}/api/s/${site}/stat/device`;
      fetchOptions.method = 'GET';
    } else if (action === 'adopt') {
      const { mac } = req.body;
      url = `${controllerUrl}/api/s/${site}/cmd/devmgr`;
      fetchOptions.method = 'POST';
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({ cmd: 'adopt', mac });
    } else if (action === 'set-name') {
      const { mac, name } = req.body;
      url = `${controllerUrl}/api/s/${site}/cmd/devmgr`;
      fetchOptions.method = 'POST';
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({ cmd: 'set-name', mac, name });
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    return res.status(200).json(data);
  } catch (error) {
    console.error('UniFi API error:', error);
    return res.status(500).json({ 
      error: error.message,
      details: 'Failed to connect to UniFi Controller'
    });
  }
}
