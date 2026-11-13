import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db.js';
import { seedDatabase } from '../seeds/seed.js';

const app = createApp();

describe('Phase 2 — Business Rules & Domain Integrity Tests', () => {
  beforeAll(async () => {
    // Re-seed before running test suite
    await seedDatabase();
  });

  afterAll(async () => {
    // Clean up DB pool connection
    await pool.end();
  });

  describe('Rule 1: Negative and Invalid Quantity Rejections', () => {
    it('should reject a sale with zero quantity', async () => {
      const res = await request(app)
        .post('/api/stock-movements')
        .send({
          batch_id: 1,
          type: 'SALE',
          quantity: 0
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_QUANTITY');
    });

    it('should reject a movement with negative quantity', async () => {
      const res = await request(app)
        .post('/api/stock-movements')
        .send({
          batch_id: 1,
          type: 'PURCHASE',
          quantity: -10
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_QUANTITY');
    });

    it('should reject non-numeric quantity', async () => {
      const res = await request(app)
        .post('/api/stock-movements')
        .send({
          batch_id: 1,
          type: 'SALE',
          quantity: 'not-a-number'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_QUANTITY');
    });
  });

  describe('Rule 2: Batch and Movement Type Validation', () => {
    it('should return 404 when batch does not exist', async () => {
      const res = await request(app)
        .post('/api/stock-movements')
        .send({
          batch_id: 99999,
          type: 'SALE',
          quantity: 5
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject invalid movement type', async () => {
      const res = await request(app)
        .post('/api/stock-movements')
        .send({
          batch_id: 1,
          type: 'INVALID_TYPE',
          quantity: 5
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TYPE');
    });
  });

  describe('Rule 3 (Acceptance A1): Reject Sales from Expired Batches', () => {
    it('should reject sale from expired batch and keep stock strictly unchanged', async () => {
      // Batch 2 is seeded as AMOX-2024EXP (expired on 2024-01-15)
      const beforeBatch = await query('SELECT quantity_on_hand FROM batches WHERE id = 2');
      const initialStock = beforeBatch.rows[0].quantity_on_hand;

      const beforeMovements = await query(
        'SELECT COUNT(*)::int AS count FROM stock_movements WHERE batch_id = 2'
      );
      const initialMovementsCount = beforeMovements.rows[0].count;

      const res = await request(app)
        .post('/api/stock-movements')
        .send({
          batch_id: 2,
          type: 'SALE',
          quantity: 5,
          reason: 'Attempted sale of expired drug'
        });

      // 1. Verify HTTP status and error code
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BATCH_EXPIRED');

      // 2. CRITICAL ACCEPTANCE CHECK: Verify stock is completely unchanged
      const afterBatch = await query('SELECT quantity_on_hand FROM batches WHERE id = 2');
      expect(afterBatch.rows[0].quantity_on_hand).toBe(initialStock);

      // 3. Verify no phantom movement row was inserted
      const afterMovements = await query(
        'SELECT COUNT(*)::int AS count FROM stock_movements WHERE batch_id = 2'
      );
      expect(afterMovements.rows[0].count).toBe(initialMovementsCount);
    });
  });

  describe('Rule 4 (Acceptance A1): Reject Sales with Insufficient Quantity', () => {
    it('should reject sale exceeding available batch stock and leave stock unchanged', async () => {
      // Batch 4 is seeded as PARA-LOW (unexpired, quantity = 5)
      const beforeBatch = await query('SELECT quantity_on_hand FROM batches WHERE id = 4');
      const currentStock = beforeBatch.rows[0].quantity_on_hand;
      expect(currentStock).toBe(5);

      const beforeMovements = await query(
        'SELECT COUNT(*)::int AS count FROM stock_movements WHERE batch_id = 4'
      );
      const initialMovementsCount = beforeMovements.rows[0].count;

      // Attempt to sell 15 (available is only 5)
      const res = await request(app)
        .post('/api/stock-movements')
        .send({
          batch_id: 4,
          type: 'SALE',
          quantity: 15,
          reason: 'Excess sale attempt'
        });

      // 1. Verify HTTP rejection
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');

      // 2. CRITICAL ACCEPTANCE CHECK: Stock unchanged on failure
      const afterBatch = await query('SELECT quantity_on_hand FROM batches WHERE id = 4');
      expect(afterBatch.rows[0].quantity_on_hand).toBe(5);

      // 3. Verify no movement row recorded
      const afterMovements = await query(
        'SELECT COUNT(*)::int AS count FROM stock_movements WHERE batch_id = 4'
      );
      expect(afterMovements.rows[0].count).toBe(initialMovementsCount);
    });
  });

  describe('Rule 5: Valid Movements and Full Audit Logging', () => {
    it('should successfully execute a valid sale and record audit movement', async () => {
      // Batch 1 is AMOX-2027A (valid, 100 on hand)
      const beforeBatch = await query('SELECT quantity_on_hand FROM batches WHERE id = 1');
      const initialStock = beforeBatch.rows[0].quantity_on_hand;

      const res = await request(app)
        .post('/api/stock-movements')
        .send({
          batch_id: 1,
          type: 'SALE',
          quantity: 10,
          reason: 'Valid prescription sale',
          reference: 'RX-TEST-123'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.batch.new_quantity).toBe(initialStock - 10);

      // Verify DB persistence
      const afterBatch = await query('SELECT quantity_on_hand FROM batches WHERE id = 1');
      expect(afterBatch.rows[0].quantity_on_hand).toBe(initialStock - 10);

      // Verify audit row
      const moveRes = await query(
        'SELECT * FROM stock_movements WHERE id = $1',
        [res.body.data.movement.id]
      );
      expect(moveRes.rows[0].type).toBe('SALE');
      expect(moveRes.rows[0].quantity).toBe(10);
      expect(moveRes.rows[0].reference).toBe('RX-TEST-123');
    });

    it('should successfully record a PURCHASE movement and increment stock', async () => {
      const beforeBatch = await query('SELECT quantity_on_hand FROM batches WHERE id = 1');
      const initialStock = beforeBatch.rows[0].quantity_on_hand;

      const res = await request(app)
        .post('/api/stock-movements')
        .send({
          batch_id: 1,
          type: 'PURCHASE',
          quantity: 25,
          reason: 'Supplier restock shipment',
          reference: 'PO-RESTOCK-999'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.batch.new_quantity).toBe(initialStock + 25);
    });

    it('should successfully record a RETURN movement and increment stock', async () => {
      const beforeBatch = await query('SELECT quantity_on_hand FROM batches WHERE id = 1');
      const initialStock = beforeBatch.rows[0].quantity_on_hand;

      const res = await request(app)
        .post('/api/stock-movements')
        .send({
          batch_id: 1,
          type: 'RETURN',
          quantity: 2,
          reason: 'Customer return unopened pack',
          reference: 'RET-001'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.batch.new_quantity).toBe(initialStock + 2);
    });

    it('should require reason for ADJUSTMENT movement', async () => {
      const res = await request(app)
        .post('/api/stock-movements')
        .send({
          batch_id: 1,
          type: 'ADJUSTMENT',
          quantity: 5
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('REASON_REQUIRED');
    });
  });

  describe('Rule 6: Schema Integrity and Unique Constraints', () => {
    it('should reject creating a medicine with duplicate SKU', async () => {
      const res = await request(app)
        .post('/api/medicines')
        .send({
          name: 'Amoxicillin Generic',
          sku: 'MED-AMOX-500', // Already seeded
          description: 'Duplicate SKU test'
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_SKU');
    });

    it('should reject creating duplicate batch_no for same medicine', async () => {
      const res = await request(app)
        .post('/api/batches')
        .send({
          medicine_id: 1,
          batch_no: 'AMOX-2027A', // Already exists for medicine 1
          expiry_date: '2028-12-31',
          initial_quantity: 50
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_BATCH');
    });
  });
});

