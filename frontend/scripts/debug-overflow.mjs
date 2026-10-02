import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function loginUser(email, password) {
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data.token;
}

async function debugOverflow() {
  const adminToken = await loginUser('admin@schoolbus.local', 'Admin@12345');
  const url = `http://localhost:5173/admin/students?auth_token=${adminToken}`;

  // Let's run Edge with remote debugging and evaluate overflow elements
  // We can write an inline script or inspect document.body.scrollWidth
  console.log('Testing overflow...');
}

debugOverflow();
