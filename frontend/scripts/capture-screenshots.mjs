import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
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
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.statusText}`);
  }
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

async function main() {
  console.log('1. Getting JWTs for Admin and Parent...');
  const adminToken = await loginUser('admin@schoolbus.local', 'Admin@12345');
  const parentToken = await loginUser('9876543210', 'Parent@12345');
  console.log('Admin token & Parent token acquired.');

  console.log('2. Spawning Headless Edge...');
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

  console.log('3. Connecting to Page CDP WebSocket...');
  const ws = new WebSocket(pageWsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const cdp = new CDPClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');

  async function capture(url, token, filename, width, height, isMobile = false) {
    console.log(`Capturing ${filename} (${width}x${height})...`);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: isMobile,
      fitWindow: false,
    });

    if (token) {
      // First go to base url to set localStorage
      await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
      await sleep(600);
      await cdp.send('Runtime.evaluate', {
        expression: `localStorage.setItem('accessToken', '${token}');`,
      });
    } else {
      await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
      await sleep(600);
      await cdp.send('Runtime.evaluate', {
        expression: `localStorage.clear();`,
      });
    }

    // Now navigate to target
    await cdp.send('Page.navigate', { url });
    await sleep(2500); // Allow react and data to render

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
    // 1. Login Desktop & Mobile
    await capture('http://localhost:5173/login', null, 'login-desktop.png', 1440, 900, false);
    await capture('http://localhost:5173/login', null, 'login-mobile.png', 390, 844, true);

    // 2. Admin Desktop & Mobile
    await capture('http://localhost:5173/admin', adminToken, 'admin-desktop.png', 1440, 900, false);
    await capture('http://localhost:5173/admin', adminToken, 'admin-mobile.png', 390, 844, true);

    // 3. Parent Desktop & Mobile
    await capture('http://localhost:5173/parent/dashboard', parentToken, 'parent-desktop.png', 1440, 900, false);
    await capture('http://localhost:5173/parent/dashboard', parentToken, 'parent-mobile.png', 390, 844, true);

    console.log('All 6 screenshots captured successfully!');
  } finally {
    ws.close();
    browserProc.kill();
  }
}

main().catch((err) => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
