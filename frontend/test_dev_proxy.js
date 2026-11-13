import { spawn } from 'child_process';
import http from 'http';

function request(port, path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData && { 'Content-Length': Buffer.byteLength(postData) })
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function verify() {
  console.log('--- Step 1: Starting Backend API (port 3000) ---');
  const backend = spawn('node', ['src/server.js'], { cwd: '../backend', stdio: 'inherit', shell: true });

  console.log('--- Step 2: Starting Vite Dev Server (port 5173) ---');
  const vite = spawn('npm', ['run', 'dev'], { cwd: '.', stdio: 'inherit', shell: true });

  // Give processes time to bind ports
  await new Promise((r) => setTimeout(r, 4000));

  try {
    console.log('\n--- Step 3: Probing Vite Frontend Index (port 5173) ---');
    const indexRes = await request(5173, '/');
    console.log('GET http://localhost:5173/ -> HTTP', indexRes.status);
    const hasRoot = typeof indexRes.body === 'string' && indexRes.body.includes('id="root"');
    console.log('HTML contains <div id="root">: ', hasRoot);
    if (!hasRoot) throw new Error('Vite index did not contain root div');

    console.log('\n--- Step 4: Probing /api/medicines via Vite Proxy ---');
    const apiRes = await request(5173, '/api/medicines');
    console.log('GET http://localhost:5173/api/medicines -> HTTP', apiRes.status);
    console.log('Received medicines count via proxy:', apiRes.body?.data?.length);
    if (apiRes.status !== 200 || !apiRes.body?.data) throw new Error('Proxy API call failed');

    console.log('\n--- Step 5: Testing Rejected Sale through Proxy (Expired Batch 2) ---');
    const rejectRes = await request(5173, '/api/stock-movements', 'POST', {
      batch_id: 2,
      type: 'SALE',
      quantity: 1,
      reason: 'UI reject test'
    });
    console.log('POST http://localhost:5173/api/stock-movements -> HTTP', rejectRes.status);
    console.log('Error message returned to UI:', rejectRes.body?.error?.message);
    if (rejectRes.status !== 400) throw new Error('Expected 400 rejection');

    console.log('\n=== PHASE 4 EXIT CHECKS PASSED: UI & VITE PROXY COMMUNICATE CLEANLY WITH API ===');
  } finally {
    vite.kill();
    backend.kill();
  }
}

verify().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
