import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'D:\\School-Bus-Portal\\frontend\\.browser-data';

mkdirSync(profileDir, { recursive: true });

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('Launching browser process...');
  const browserProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { detached: false });

  browserProc.on('error', (err) => {
    console.error('Browser spawn error:', err);
  });

  // Wait for remote debugging port to open
  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      const data = await res.json();
      wsUrl = data.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch {
      // waiting
    }
  }

  if (!wsUrl) {
    console.error('Failed to get webSocketDebuggerUrl from browser on port 9222');
    browserProc.kill();
    return;
  }

  console.log('Connected to browser CDP:', wsUrl);
  browserProc.kill();
  console.log('Test successful');
}

run();
