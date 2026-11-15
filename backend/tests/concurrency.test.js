import request from "supertest";
import { createApp } from "../src/app.js";
import { pool, query } from "../src/db.js";

const app = createApp();

describe("Phase 2 — Concurrency & Race Condition Prevention Tests", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("should prevent overselling during 20 concurrent sales on a batch with stock = 10", async () => {
    const timestamp = Date.now();
    const testSku = `MED-CONCUR-${timestamp}`;
    const testBatchNo = `BATCH-CONCUR-${timestamp}`;

    // 1. Create a dedicated medicine for this concurrency test
    const medRes = await query(
      `INSERT INTO medicines (name, sku, description)
       VALUES ('Concurrency Test Drug', $1, 'Drug used to test high-concurrency sales')
       RETURNING id;`,
      [testSku],
    );
    const medicineId = medRes.rows[0].id;

    // 2. Create a batch with EXACTLY 10 items in stock
    const batchRes = await query(
      `INSERT INTO batches (medicine_id, batch_no, expiry_date, quantity_on_hand)
       VALUES ($1, $2, '2030-01-01', 10)
       RETURNING id;`,
      [medicineId, testBatchNo],
    );
    const batchId = batchRes.rows[0].id;

    // INTERVIEW NOTE ON CONCURRENCY / ROW LOCKING:
    // Without 'SELECT ... FOR UPDATE' in the transaction, all 20 threads could read quantity_on_hand = 10
    // simultaneously before any transaction commits, resulting in 20 successful sales and an illegal
    // negative stock of -10.
    //
    // By using 'SELECT ... FOR UPDATE', PostgreSQL places an exclusive row-level lock on the batch row.
    // Each concurrent transaction must wait in line. The first 10 transactions decrement the stock from 10 to 0.
    // The 11th through 20th transactions acquire the lock after stock has reached 0, see quantity = 0,
    // fail the 'quantity_on_hand < requested' check, rollback, and return HTTP 400.

    // 3. Fire 20 parallel sale requests of quantity 1 simultaneously
    const totalRequests = 20;
    const requests = Array.from({ length: totalRequests }, (_, i) =>
      request(app)
        .post("/api/stock-movements")
        .send({
          batch_id: batchId,
          type: "SALE",
          quantity: 1,
          reason: `Concurrent sale attempt #${i + 1}`,
          reference: `CONCUR-TX-${i + 1}`,
        }),
    );

    const responses = await Promise.all(requests);

    // 4. Separate successes (HTTP 201) and rejections (HTTP 400)
    const successfulSales = responses.filter((r) => r.status === 201);
    const rejectedSales = responses.filter((r) => r.status === 400);

    // 5. Strict Assertions: Exactly 10 succeed, exactly 10 fail
    expect(successfulSales.length).toBe(10);
    expect(rejectedSales.length).toBe(10);

    // All rejected requests must cite INSUFFICIENT_STOCK
    for (const res of rejectedSales) {
      expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
    }

    // 6. Database Verification: Stock must be exactly 0, never negative
    const finalBatch = await query(
      "SELECT quantity_on_hand FROM batches WHERE id = $1",
      [batchId],
    );
    expect(finalBatch.rows[0].quantity_on_hand).toBe(0);

    // 7. Audit Trail Verification: Exactly 10 movement records exist for this batch
    const movements = await query(
      "SELECT COUNT(*)::int AS count FROM stock_movements WHERE batch_id = $1 AND type = 'SALE'",
      [batchId],
    );
    expect(movements.rows[0].count).toBe(10);
  });
});
