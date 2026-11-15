import { Router } from "express";
import { query, withTransaction } from "../db.js";

export const batchesRouter = Router();

/**
 * GET /api/batches
 * Lists all batches with associated medicine details and computed expiry status
 */
batchesRouter.get("/", async (req, res, next) => {
  try {
    const { medicine_id } = req.query;
    let sql = `
      SELECT 
        b.id,
        b.medicine_id,
        m.name AS medicine_name,
        m.sku AS medicine_sku,
        b.batch_no,
        TO_CHAR(b.expiry_date, 'YYYY-MM-DD') AS expiry_date,
        b.quantity_on_hand,
        (b.expiry_date < CURRENT_DATE) AS is_expired,
        (b.quantity_on_hand <= 10) AS is_low_stock,
        b.created_at
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
    `;
    const params = [];

    if (medicine_id) {
      sql += " WHERE b.medicine_id = $1";
      params.push(medicine_id);
    }

    sql += " ORDER BY b.expiry_date ASC, b.id ASC;";

    const result = await query(sql, params);
    res.status(200).json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/batches
 * Creates a new batch and logs an initial PURCHASE stock movement in the same transaction
 */
batchesRouter.post("/", async (req, res, next) => {
  try {
    const {
      medicine_id,
      batch_no,
      expiry_date,
      initial_quantity = 0,
    } = req.body;

    if (!medicine_id || isNaN(parseInt(medicine_id, 10))) {
      return res.status(400).json({
        error: {
          message: "Valid medicine_id is required",
          code: "INVALID_INPUT",
        },
      });
    }

    if (!batch_no || typeof batch_no !== "string" || batch_no.trim() === "") {
      return res.status(400).json({
        error: { message: "batch_no is required", code: "INVALID_INPUT" },
      });
    }

    if (!expiry_date || isNaN(Date.parse(expiry_date))) {
      return res.status(400).json({
        error: {
          message: "Valid expiry_date (YYYY-MM-DD) is required",
          code: "INVALID_INPUT",
        },
      });
    }

    const qty = parseInt(initial_quantity, 10);
    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({
        error: {
          message: "initial_quantity must be a non-negative integer",
          code: "INVALID_INPUT",
        },
      });
    }

    const cleanBatchNo = batch_no.trim().toUpperCase();

    // Verify medicine exists
    const medCheck = await query("SELECT id FROM medicines WHERE id = $1", [
      medicine_id,
    ]);
    if (medCheck.rowCount === 0) {
      return res.status(404).json({
        error: {
          message: `Medicine ID ${medicine_id} not found`,
          code: "NOT_FOUND",
        },
      });
    }

    // Check unique (medicine_id, batch_no)
    const batchCheck = await query(
      "SELECT id FROM batches WHERE medicine_id = $1 AND batch_no = $2",
      [medicine_id, cleanBatchNo],
    );
    if (batchCheck.rowCount > 0) {
      return res.status(409).json({
        error: {
          message: `Batch '${cleanBatchNo}' already exists for this medicine`,
          code: "DUPLICATE_BATCH",
        },
      });
    }

    const newBatch = await withTransaction(async (client) => {
      // 1. Insert Batch
      const bRes = await client.query(
        `INSERT INTO batches (medicine_id, batch_no, expiry_date, quantity_on_hand)
         VALUES ($1, $2, $3, $4)
         RETURNING id, medicine_id, batch_no, TO_CHAR(expiry_date, 'YYYY-MM-DD') AS expiry_date, quantity_on_hand, created_at`,
        [medicine_id, cleanBatchNo, expiry_date, qty],
      );

      const batch = bRes.rows[0];

      // 2. If initial quantity > 0, record audit trail movement
      if (qty > 0) {
        await client.query(
          `INSERT INTO stock_movements (batch_id, type, quantity, reason, reference)
           VALUES ($1, 'PURCHASE', $2, 'Initial stock entry', $3)`,
          [batch.id, qty, `INIT-${cleanBatchNo}`],
        );
      }

      return batch;
    });

    res.status(201).json({ data: newBatch });
  } catch (err) {
    next(err);
  }
});
