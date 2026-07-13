// api/unifi.js - Vercel Serverless Function
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get credentials from environment variables
  const controllerUrl = process.env.UNIFI_CONTROLLER_URL || 'https://172.16.200.2';
  const username = process.env.UNIFI_USERNAME || 'admin';
  const password = process.env.UNIFI_PASSWORD || '';
  const site = process.env.UNIFI_SITE || 'default';

  // Check if password is set
  if (!password || password === '') {
    return res.status(400).json({ 
      error: 'UNIFI_PASSWORD not set in environment variables',
      details: 'Please add UNIFI_PASSWORD to Vercel Environment Variables'
    });
  }

  console.log('🔐 Connecting to UniFi Controller:', controllerUrl);
  console.log('👤 Username:', username);
  console.log('📡 Site:', site);

  try {
    // Step 1: Login to UniFi Controller
    const loginResponse = await fetch(`${controllerUrl}/api/login`, {
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

    const loginData = await loginResponse.json();
    console.log('✅ Login successful');

    // Get cookies from response
    const cookies = loginResponse.headers.get('set-cookie');
    const csrfToken = loginData.csrf_token || '';

    // Step 2: Get action from query
    const { action } = req.query;

    if (!action) {
      return res.status(400).json({ error: 'Missing action parameter' });
    }

    // Step 3: Build the request
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
      if (!mac) {
        return res.status(400).json({ error: 'Missing mac parameter' });
      }
      url = `${controllerUrl}/api/s/${site}/cmd/devmgr`;
      fetchOptions.method = 'POST';
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({ cmd: 'adopt', mac });
    } else if (action === 'set-name') {
      const { mac, name } = req.body;
      if (!mac || !name) {
        return res.status(400).json({ error: 'Missing mac or name parameter' });
      }
      url = `${controllerUrl}/api/s/${site}/cmd/devmgr`;
      fetchOptions.method = 'POST';
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({ cmd: 'set-name', mac, name });
    } else {
      return res.status(400).json({ error: `Invalid action: ${action}` });
    }

    console.log('📡 Fetching:', url);

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

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
