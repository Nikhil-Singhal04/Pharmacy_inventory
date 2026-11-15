import { Router } from "express";
import { query } from "../db.js";

export const medicinesRouter = Router();

/**
 * GET /api/medicines
 * Lists all medicines with total on-hand quantity and active batch count
 */
medicinesRouter.get("/", async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        m.id,
        m.name,
        m.sku,
        m.description,
        m.created_at,
        COALESCE(SUM(b.quantity_on_hand), 0)::INTEGER AS total_quantity,
        COUNT(b.id)::INTEGER AS total_batches,
        COUNT(CASE WHEN b.expiry_date >= CURRENT_DATE THEN 1 END)::INTEGER AS active_batches,
        COUNT(CASE WHEN b.expiry_date < CURRENT_DATE THEN 1 END)::INTEGER AS expired_batches
      FROM medicines m
      LEFT JOIN batches b ON m.id = b.medicine_id
      GROUP BY m.id
      ORDER BY m.name ASC;
    `);

    res.status(200).json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/medicines
 * Creates a new medicine. Enforces unique SKU and required name.
 */
medicinesRouter.post("/", async (req, res, next) => {
  try {
    const { name, sku, description } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({
        error: { message: "Medicine name is required", code: "INVALID_INPUT" },
      });
    }

    if (!sku || typeof sku !== "string" || sku.trim() === "") {
      return res.status(400).json({
        error: { message: "Medicine SKU is required", code: "INVALID_INPUT" },
      });
    }

    const cleanSku = sku.trim().toUpperCase();

    // Check SKU uniqueness
    const existing = await query("SELECT id FROM medicines WHERE sku = $1", [
      cleanSku,
    ]);
    if (existing.rowCount > 0) {
      return res.status(409).json({
        error: {
          message: `Medicine with SKU '${cleanSku}' already exists`,
          code: "DUPLICATE_SKU",
        },
      });
    }

    const result = await query(
      `INSERT INTO medicines (name, sku, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, sku, description, created_at`,
      [name.trim(), cleanSku, description?.trim() || null],
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});
