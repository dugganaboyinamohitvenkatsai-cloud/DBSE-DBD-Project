import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = 'D:\\School-Bus-Portal\\frontend\\screenshots';
const artifactDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\8d25a028-b10e-4c91-aad2-d3373717f6ce\\screenshots';

mkdirSync(outputDir, { recursive: true });
mkdirSync(artifactDir, { recursive: true });

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

async function capture(url, filename, width, height) {
  const filePath = path.join(outputDir, filename);
  const artifactPath = path.join(artifactDir, filename);
  console.log(`Capturing ${filename} (${width}x${height}) -> ${url}`);

  await execFileAsync(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--incognito',
    '--disk-cache-size=1',
    `--window-size=${width},${height}`,
    '--virtual-time-budget=4500',
    `--screenshot=${filePath}`,
    url,
  ], { timeout: 25000 });

  if (existsSync(filePath)) {
    copyFileSync(filePath, artifactPath);
    console.log(`Success: ${filename}`);
  } else {
    console.error(`Failed to generate ${filename}`);
  }
}

async function run() {
  console.log('Fetching JWT tokens...');
  const adminToken = await loginUser('admin@schoolbus.local', 'Admin@12345');
  const parentToken = await loginUser('9876543210', 'Parent@12345');
  console.log('Tokens received.');

  // 1. Login Desktop & Mobile
  await capture('http://localhost:5173/login', 'login-desktop.png', 1440, 900);
  await capture('http://localhost:5173/login', 'login-mobile.png', 390, 844);

  // 2. Admin Desktop & Mobile
  await capture(`http://localhost:5173/admin?auth_token=${adminToken}`, 'admin-desktop.png', 1440, 900);
  await capture(`http://localhost:5173/admin?auth_token=${adminToken}`, 'admin-mobile.png', 390, 844);

  // 3. Parent Desktop & Mobile
  await capture(`http://localhost:5173/parent/dashboard?auth_token=${parentToken}`, 'parent-desktop.png', 1440, 900);
  await capture(`http://localhost:5173/parent/dashboard?auth_token=${parentToken}`, 'parent-mobile.png', 390, 844);

  console.log('All 6 screenshots captured and copied to artifact directory!');
}

run().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
