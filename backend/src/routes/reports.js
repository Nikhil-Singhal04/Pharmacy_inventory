import { Router } from 'express';
import { query } from '../db.js';

export const reportsRouter = Router();

/**
 * GET /api/reports/stock-summary
 * Aggregates medicine inventory metrics, highlighting active stock, expired stock, and low stock
 */
reportsRouter.get('/stock-summary', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        m.id AS medicine_id,
        m.name AS medicine_name,
        m.sku AS medicine_sku,
        COALESCE(SUM(b.quantity_on_hand), 0)::INTEGER AS total_quantity,
        COALESCE(SUM(CASE WHEN b.expiry_date >= CURRENT_DATE THEN b.quantity_on_hand ELSE 0 END), 0)::INTEGER AS active_quantity,
        COALESCE(SUM(CASE WHEN b.expiry_date < CURRENT_DATE THEN b.quantity_on_hand ELSE 0 END), 0)::INTEGER AS expired_quantity,
        COUNT(b.id)::INTEGER AS total_batches,
        COUNT(CASE WHEN b.expiry_date >= CURRENT_DATE THEN 1 END)::INTEGER AS active_batches,
        COUNT(CASE WHEN b.expiry_date < CURRENT_DATE THEN 1 END)::INTEGER AS expired_batches,
        COUNT(CASE WHEN b.quantity_on_hand <= 10 AND b.expiry_date >= CURRENT_DATE THEN 1 END)::INTEGER AS low_stock_batches
      FROM medicines m
      LEFT JOIN batches b ON m.id = b.medicine_id
      GROUP BY m.id
      ORDER BY m.name ASC;
    `);

    const totals = result.rows.reduce(
      (acc, row) => ({
        totalMedicines: acc.totalMedicines + 1,
        totalStock: acc.totalStock + row.total_quantity,
        activeStock: acc.activeStock + row.active_quantity,
        expiredStock: acc.expiredStock + row.expired_quantity,
        expiredBatches: acc.expiredBatches + row.expired_batches,
        lowStockBatches: acc.lowStockBatches + row.low_stock_batches
      }),
      {
        totalMedicines: 0,
        totalStock: 0,
        activeStock: 0,
        expiredStock: 0,
        expiredBatches: 0,
        lowStockBatches: 0
      }
    );

    res.status(200).json({
      summary: totals,
      medicines: result.rows
    });
  } catch (err) {
    next(err);
  }
});

