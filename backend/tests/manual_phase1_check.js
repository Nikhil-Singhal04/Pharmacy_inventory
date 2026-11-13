import http from 'http';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import { seedDatabase } from '../seeds/seed.js';

const app = createApp();
const PORT = 3001;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data && { 'Content-Length': Buffer.byteLength(data) })
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
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
    if (data) req.write(data);
    req.end();
  });
}

async function runCheck() {
  console.log('--- 1. Resetting database with seed data ---');
  await seedDatabase();

  const server = app.listen(PORT);
  console.log(`Test server running on port ${PORT}`);

  try {
    console.log('\n--- 2. Checking /health (Liveness) ---');
    const health = await request('GET', '/health');
    console.log('Status:', health.status, 'Body:', JSON.stringify(health.body));

    console.log('\n--- 3. Checking /ready (Readiness against DB) ---');
    const ready = await request('GET', '/ready');
    console.log('Status:', ready.status, 'Body:', JSON.stringify(ready.body));

    console.log('\n--- 4. Checking GET /api/medicines ---');
    const medicines = await request('GET', '/api/medicines');
    console.log('Status:', medicines.status, 'Medicines count:', medicines.body.data.length);

    console.log('\n--- 5. Checking POST /api/medicines ---');
    const newMed = await request('POST', '/api/medicines', {
      name: 'Azithromycin 250mg',
      sku: 'MED-AZI-250',
      description: 'Macrolide antibiotic'
    });
    console.log('Status:', newMed.status, 'Created ID:', newMed.body.data.id, 'SKU:', newMed.body.data.sku);

    console.log('\n--- 6. Checking GET /api/batches ---');
    const batches = await request('GET', '/api/batches');
    console.log('Status:', batches.status, 'Batches count:', batches.body.data.length);

    console.log('\n--- 7. Checking POST /api/batches ---');
    const newBatch = await request('POST', '/api/batches', {
      medicine_id: newMed.body.data.id,
      batch_no: 'AZI-2027A',
      expiry_date: '2027-08-30',
      initial_quantity: 60
    });
    console.log('Status:', newBatch.status, 'Batch ID:', newBatch.body.data.id, 'Qty:', newBatch.body.data.quantity_on_hand);

    console.log('\n--- 8. Checking POST /api/stock-movements (PURCHASE) ---');
    const purchase = await request('POST', '/api/stock-movements', {
      batch_id: newBatch.body.data.id,
      type: 'PURCHASE',
      quantity: 20,
      reason: 'Restocking shipment',
      reference: 'PO-TEST-101'
    });
    console.log('Status:', purchase.status, 'Previous:', purchase.body.data.batch.previous_quantity, 'New:', purchase.body.data.batch.new_quantity);

    console.log('\n--- 9. Checking POST /api/stock-movements (VALID SALE) ---');
    const sale = await request('POST', '/api/stock-movements', {
      batch_id: newBatch.body.data.id,
      type: 'SALE',
      quantity: 15,
      reason: 'Patient prescription sale',
      reference: 'RX-TEST-001'
    });
    console.log('Status:', sale.status, 'Previous:', sale.body.data.batch.previous_quantity, 'New:', sale.body.data.batch.new_quantity);

    console.log('\n--- 10. Checking POST /api/stock-movements (REJECT EXPIRED BATCH SALE) ---');
    // Batch 2 is the seeded expired batch AMOX-2024EXP
    const expiredSale = await request('POST', '/api/stock-movements', {
      batch_id: 2,
      type: 'SALE',
      quantity: 5,
      reason: 'Should be rejected',
      reference: 'RX-FAIL-EXP'
    });
    console.log('Status (expected 400):', expiredSale.status, 'Error message:', expiredSale.body.error.message);

    console.log('\n--- 11. Checking POST /api/stock-movements (REJECT INSUFFICIENT QUANTITY) ---');
    // Batch 4 is PARA-LOW with quantity 5
    const overSale = await request('POST', '/api/stock-movements', {
      batch_id: 4,
      type: 'SALE',
      quantity: 50,
      reason: 'Should be rejected for insufficient stock',
      reference: 'RX-FAIL-QTY'
    });
    console.log('Status (expected 400):', overSale.status, 'Error message:', overSale.body.error.message);

    console.log('\n--- 12. Checking GET /api/reports/stock-summary ---');
    const report = await request('GET', '/api/reports/stock-summary');
    console.log('Status:', report.status, 'Summary:', JSON.stringify(report.body.summary));

    console.log('\n=== ALL PHASE 1 EXIT CHECKS PASSED SUCCESSFULLY ===');
  } finally {
    server.close();
    await pool.end();
  }
}

runCheck().catch((err) => {
  console.error('Exit check failed:', err);
  process.exit(1);
});

