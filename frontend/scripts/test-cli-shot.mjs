import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, unlinkSync } from 'node:fs';

const execFileAsync = promisify(execFile);
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const testImg = 'D:\\School-Bus-Portal\\frontend\\screenshots\\test_cli.png';

if (existsSync(testImg)) unlinkSync(testImg);

console.log('Testing CLI screenshot via child_process.execFile...');
try {
  await execFileAsync(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1440,900',
    `--screenshot=${testImg}`,
    'http://localhost:5173/login',
  ], { timeout: 15000 });
  console.log('Finished. Exists?', existsSync(testImg));
} catch (err) {
  console.error('ExecFile error:', err);
}
