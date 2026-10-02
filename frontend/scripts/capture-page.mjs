import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = 'D:\\School-Bus-Portal\\frontend\\.browser-capture-profile';
const outputDir = 'D:\\School-Bus-Portal\\frontend\\screenshots';
const artifactDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\8d25a028-b10e-4c91-aad2-d3373717f6ce\\screenshots';

mkdirSync(profileDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });
mkdirSync(artifactDir, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loginUser(email, password) {
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}`);
  const data = await res.json();
  return data.token;
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function run() {
  const targetPage = process.argv[2] || 'students';
  console.log(`Starting CDP capture for page: ${targetPage}`);

  const adminToken = await loginUser('admin@schoolbus.local', 'Admin@12345');
  const parentToken = await loginUser('9876543210', 'Parent@12345');
  const driverToken = await loginUser('rajesh.driver@schoolbus.local', 'Driver@12345');

  console.log('Spawning Headless Edge...');
  const browserProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    'about:blank',
  ], { detached: false });

  browserProc.on('error', (err) => console.error('Browser error:', err));

  let pageWsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try {
      const listRes = await fetch('http://127.0.0.1:9222/json/list');
      const list = await listRes.json();
      if (list && list.length > 0 && list[0].webSocketDebuggerUrl) {
        pageWsUrl = list[0].webSocketDebuggerUrl;
        break;
      }
    } catch {
      // wait
    }
  }

  if (!pageWsUrl) {
    console.error('Could not connect to target page WebSocket');
    browserProc.kill();
    process.exit(1);
  }

  const ws = new WebSocket(pageWsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const cdp = new CDPClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');

  async function capture(url, token, filename, width, height, isMobile = false) {
    console.log(`Capturing ${filename} (${width}x${height}, mobile=${isMobile})...`);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile,
      fitWindow: false,
    });

    if (token) {
      await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
      await sleep(400);
      await cdp.send('Runtime.evaluate', {
        expression: `localStorage.setItem('accessToken', '${token}');`,
      });
    } else {
      await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
      await sleep(400);
      await cdp.send('Runtime.evaluate', {
        expression: `localStorage.clear();`,
      });
    }

    await cdp.send('Page.navigate', { url });
    await sleep(2500);

    const screenshotData = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });

    const buffer = Buffer.from(screenshotData.data, 'base64');
    const localFilePath = path.join(outputDir, filename);
    const artifactFilePath = path.join(artifactDir, filename);

    writeFileSync(localFilePath, buffer);
    writeFileSync(artifactFilePath, buffer);
    console.log(`Saved: ${localFilePath}`);
  }

  try {
    if (targetPage === 'students' || targetPage === 'all') {
      await capture('http://localhost:5173/admin/students', adminToken, 'admin-students-desktop.png', 1440, 900, false);
      await capture('http://localhost:5173/admin/students', adminToken, 'admin-students-mobile.png', 390, 844, true);
    }
    if (targetPage === 'parents' || targetPage === 'all') {
      await capture('http://localhost:5173/admin/parents', adminToken, 'admin-parents-desktop.png', 1440, 900, false);
      await capture('http://localhost:5173/admin/parents', adminToken, 'admin-parents-mobile.png', 390, 844, true);
    }
    if (targetPage === 'drivers' || targetPage === 'all') {
      await capture('http://localhost:5173/admin/drivers', adminToken, 'admin-drivers-desktop.png', 1440, 900, false);
      await capture('http://localhost:5173/admin/drivers', adminToken, 'admin-drivers-mobile.png', 390, 844, true);
    }
    if (targetPage === 'buses' || targetPage === 'all') {
      await capture('http://localhost:5173/admin/buses', adminToken, 'admin-buses-desktop.png', 1440, 900, false);
      await capture('http://localhost:5173/admin/buses', adminToken, 'admin-buses-mobile.png', 390, 844, true);
    }
    if (targetPage === 'routes' || targetPage === 'all') {
      await capture('http://localhost:5173/admin/routes', adminToken, 'admin-routes-desktop.png', 1440, 900, false);
      await capture('http://localhost:5173/admin/routes', adminToken, 'admin-routes-mobile.png', 390, 844, true);
    }
    if (targetPage === 'trips' || targetPage === 'all') {
      await capture('http://localhost:5173/admin/trips', adminToken, 'admin-trips-desktop.png', 1440, 900, false);
      await capture('http://localhost:5173/admin/trips', adminToken, 'admin-trips-mobile.png', 390, 844, true);
    }
    if (targetPage === 'notifications' || targetPage === 'all') {
      await capture('http://localhost:5173/parent/notifications', parentToken, 'parent-notifications-desktop.png', 1440, 900, false);
      await capture('http://localhost:5173/parent/notifications', parentToken, 'parent-notifications-mobile.png', 390, 844, true);
    }
    if (targetPage === 'driver-trips' || targetPage === 'all') {
      await capture('http://localhost:5173/driver/trips', driverToken, 'driver-trips-desktop.png', 1440, 900, false);
      await capture('http://localhost:5173/driver/trips', driverToken, 'driver-trips-mobile.png', 390, 844, true);
    }

    console.log(`Finished CDP capture for: ${targetPage}`);
  } finally {
    ws.close();
    browserProc.kill();
  }
}

run().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
