import http from 'http';
import { execSync } from 'child_process';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';

const app = createApp();
const PORT = 3002;

function request(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timed out'));
    });
  });
}

async function runFailureDrill() {
  console.log('=== STARTING PHASE 3 OBSERVABILITY & FAILURE DRILL ===\n');

  const server = app.listen(PORT);
  console.log(`Phase 3 test server listening on port ${PORT}`);

  try {
    // 1. Initial State: Both /health and /ready should be 200
    console.log('\n--- Step 1: Normal State Probes ---');
    const health1 = await request('/health');
    console.log('GET /health ->', health1.status, JSON.stringify(health1.body));
    if (health1.status !== 200) throw new Error('Health check failed in normal state');

    const ready1 = await request('/ready');
    console.log('GET /ready  ->', ready1.status, JSON.stringify(ready1.body));
    if (ready1.status !== 200) throw new Error('Ready check failed in normal state');

    // 2. Simulate PostgreSQL Failure by stopping the container
    console.log('\n--- Step 2: Simulating DB Failure (stopping PostgreSQL container) ---');
    execSync('docker stop pharmacy_dev_db', { stdio: 'inherit' });
    console.log('PostgreSQL container stopped.');

    // 3. Probes under Failure: /ready must return 503, /health must return 200
    console.log('\n--- Step 3: Probes Under DB Failure ---');
    const healthDuringFailure = await request('/health');
    console.log('GET /health (liveness without DB) ->', healthDuringFailure.status, JSON.stringify(healthDuringFailure.body));
    if (healthDuringFailure.status !== 200) throw new Error('Health check should remain 200 during DB downtime');

    const readyDuringFailure = await request('/ready');
    console.log('GET /ready  (readiness with DB down) ->', readyDuringFailure.status, JSON.stringify(readyDuringFailure.body));
    if (readyDuringFailure.status !== 503) throw new Error(`Readiness check expected 503 during DB downtime, got ${readyDuringFailure.status}`);

    // 4. Recovery: Start PostgreSQL container
    console.log('\n--- Step 4: Simulating DB Recovery (starting PostgreSQL container) ---');
    execSync('docker start pharmacy_dev_db', { stdio: 'inherit' });
    console.log('PostgreSQL container started.');

    // Wait until PostgreSQL accepts connections
    let recovered = false;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const readyCheck = await request('/ready');
        if (readyCheck.status === 200) {
          console.log(`GET /ready  (after recovery attempt ${i + 1}) -> 200 ${JSON.stringify(readyCheck.body)}`);
          recovered = true;
          break;
        }
      } catch {}
    }

    if (!recovered) throw new Error('Database did not recover within 15 seconds');

    // 5. Check /metrics
    console.log('\n--- Step 5: Verifying Prometheus /metrics ---');
    const metricsRes = await request('/metrics');
    console.log('GET /metrics ->', metricsRes.status, `(Received ${typeof metricsRes.body === 'string' ? metricsRes.body.length : 0} bytes of Prometheus metrics)`);
    if (metricsRes.status !== 200) throw new Error('Metrics endpoint failed');

    console.log('\n=== PHASE 3 EXIT CHECKS PASSED: FAILURE DETECTED AND RECOVERED SUCCESSFULLY ===');
  } finally {
    // Ensure container is running
    try {
      execSync('docker start pharmacy_dev_db', { stdio: 'ignore' });
    } catch {}
    server.close();
    await pool.end();
  }
}

runFailureDrill().catch((err) => {
  console.error('\nExit check failed:', err);
  process.exit(1);
});
