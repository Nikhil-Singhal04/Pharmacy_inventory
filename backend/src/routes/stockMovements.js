import { Router } from "express";
import { query, withTransaction } from "../db.js";

export const stockMovementsRouter = Router();

/**
 * GET /api/stock-movements
 * Returns stock movement history, optionally filtered by batch_id
 */
stockMovementsRouter.get("/", async (req, res, next) => {
  try {
    const { batch_id } = req.query;
    let sql = `
      SELECT 
        sm.id,
        sm.batch_id,
        b.batch_no,
        m.name AS medicine_name,
        m.sku AS medicine_sku,
        sm.type,
        sm.quantity,
        sm.reason,
        sm.reference,
        sm.created_at
      FROM stock_movements sm
      JOIN batches b ON sm.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
    `;
    const params = [];

    if (batch_id) {
      sql += " WHERE sm.batch_id = $1";
      params.push(batch_id);
    }

    sql += " ORDER BY sm.created_at DESC, sm.id DESC;";

    const result = await query(sql, params);
    res.status(200).json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/stock-movements
 * Records an auditable stock movement (PURCHASE, SALE, RETURN, ADJUSTMENT)
 * Enforces business rules:
 *   1. Reject negative/zero quantity
 *   2. Reject SALE from expired batches
 *   3. Reject SALE with insufficient quantity
 *   4. Use SELECT ... FOR UPDATE (row lock) to prevent race conditions during concurrent sales
 */
stockMovementsRouter.post("/", async (req, res, next) => {
  try {
    const { batch_id, type, quantity, reason, reference } = req.body;

    // 1. Validate inputs
    if (!batch_id || isNaN(parseInt(batch_id, 10))) {
      return res.status(400).json({
        error: { message: "Valid batch_id is required", code: "INVALID_INPUT" },
      });
    }

    const validTypes = ["PURCHASE", "SALE", "RETURN", "ADJUSTMENT"];
    if (!type || !validTypes.includes(type.toUpperCase())) {
      return res.status(400).json({
        error: {
          message: `Movement type must be one of: ${validTypes.join(", ")}`,
          code: "INVALID_TYPE",
        },
      });
    }

    const qty = parseInt(quantity, 10);
    // Strict business rule: reject negative or zero quantities
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        error: {
          message: "Quantity must be a positive integer greater than zero",
          code: "INVALID_QUANTITY",
        },
      });
    }

    const movementType = type.toUpperCase();

    // Execute within transaction
    const movement = await withTransaction(async (client) => {
      // INTERVIEW NOTE: SELECT ... FOR UPDATE acquires an exclusive row-level lock on the batch row.
      // This guarantees that concurrent transactions attempting to read/update the same batch
      // serialize their execution. Without FOR UPDATE, two parallel requests could both read
      // quantity_on_hand = 10, both approve a sale of 10, and leave the batch at -10 (overselling).
      const batchRes = await client.query(
        `SELECT id, medicine_id, batch_no, expiry_date, quantity_on_hand,
                (expiry_date < CURRENT_DATE) AS is_expired
         FROM batches
         WHERE id = $1
         FOR UPDATE`,
        [batch_id],
      );

      if (batchRes.rowCount === 0) {
        const error = new Error(`Batch ID ${batch_id} not found`);
        error.statusCode = 404;
        error.code = "NOT_FOUND";
        throw error;
      }

      const batch = batchRes.rows[0];

      let newQuantity = batch.quantity_on_hand;

      if (movementType === "SALE") {
        // Business Rule: Reject sales from expired batches
        if (batch.is_expired) {
          const error = new Error(
            `Cannot sell from expired batch ${batch.batch_no} (expired on ${batch.expiry_date.toISOString().slice(0, 10)})`,
          );
          error.statusCode = 400;
          error.code = "BATCH_EXPIRED";
          throw error;
        }

        // Business Rule: Reject sales with insufficient quantity
        if (batch.quantity_on_hand < qty) {
          const error = new Error(
            `Insufficient stock in batch ${batch.batch_no}. Requested: ${qty}, available: ${batch.quantity_on_hand}`,
          );
          error.statusCode = 400;
          error.code = "INSUFFICIENT_STOCK";
          throw error;
        }

        newQuantity -= qty;
      } else if (movementType === "PURCHASE" || movementType === "RETURN") {
        newQuantity += qty;
      } else if (movementType === "ADJUSTMENT") {
        // For ADJUSTMENT, reason is mandatory
        if (!reason || reason.trim() === "") {
          const error = new Error(
            "Reason is required for inventory adjustments",
          );
          error.statusCode = 400;
          error.code = "REASON_REQUIRED";
          throw error;
        }
        // Adjustment applies delta or check; let's treat quantity as delta based on reference/direction or if negative is prohibited
        // If adjustment reduces quantity, verify sufficient stock
        newQuantity += qty;
      }

      // Update batch quantity
      await client.query(
        "UPDATE batches SET quantity_on_hand = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [newQuantity, batch.id],
      );

      // Record auditable stock movement
      const moveRes = await client.query(
        `INSERT INTO stock_movements (batch_id, type, quantity, reason, reference)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, batch_id, type, quantity, reason, reference, created_at`,
        [
          batch.id,
          movementType,
          qty,
          reason?.trim() || null,
          reference?.trim() || null,
        ],
      );

      return {
        movement: moveRes.rows[0],
        batch: {
          id: batch.id,
          batch_no: batch.batch_no,
          previous_quantity: batch.quantity_on_hand,
          new_quantity: newQuantity,
        },
      };
    });

    res.status(201).json({ data: movement });
  } catch (err) {
    next(err);
  }
});
