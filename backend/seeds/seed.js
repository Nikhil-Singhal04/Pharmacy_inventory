import { pool, withTransaction } from '../src/db.js';
import { logger } from '../src/logger.js';

export const seedDatabase = async () => {
  logger.info('Starting database seed...');

  await withTransaction(async (client) => {
    // Clean up existing data in reverse foreign key order
    await client.query('DELETE FROM stock_movements');
    await client.query('DELETE FROM batches');
    await client.query('DELETE FROM medicines');

    // Reset sequences for clean predictable IDs
    await client.query('ALTER SEQUENCE medicines_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE batches_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE stock_movements_id_seq RESTART WITH 1');

    // 1. Insert Medicines
    const medRes = await client.query(`
      INSERT INTO medicines (name, sku, description) VALUES
        ('Amoxicillin 500mg', 'MED-AMOX-500', 'Broad-spectrum penicillin antibiotic capsules'),
        ('Paracetamol 650mg', 'MED-PARA-650', 'Analgesic and antipyretic tablets for pain and fever relief'),
        ('Ibuprofen 400mg', 'MED-IBU-400', 'Nonsteroidal anti-inflammatory drug (NSAID)')
      RETURNING id, name, sku;
    `);

    const [amox, para, ibu] = medRes.rows;

    // 2. Insert Batches (including an expired batch and a low-stock batch)
    // Note: Past date for expired batch, future dates for active batches
    const batchRes = await client.query(`
      INSERT INTO batches (medicine_id, batch_no, expiry_date, quantity_on_hand) VALUES
        (${amox.id}, 'AMOX-2027A', '2028-12-31', 100),
        (${amox.id}, 'AMOX-2024EXP', '2024-01-15', 50),
        (${para.id}, 'PARA-2027B', '2027-10-31', 150),
        (${para.id}, 'PARA-LOW', '2027-06-30', 5),
        (${ibu.id}, 'IBU-2027C', '2028-05-15', 75)
      RETURNING id, batch_no, quantity_on_hand;
    `);

    // 3. Create initial PURCHASE stock movements for complete audit trail
    for (const batch of batchRes.rows) {
      await client.query(`
        INSERT INTO stock_movements (batch_id, type, quantity, reason, reference)
        VALUES (${batch.id}, 'PURCHASE', ${batch.quantity_on_hand}, 'Initial stock receipt', 'PO-SEED-${batch.batch_no}')
      `);
    }

    logger.info(
      {
        medicinesCount: medRes.rowCount,
        batchesCount: batchRes.rowCount,
        movementsCount: batchRes.rowCount
      },
      'Database seeded successfully'
    );
  });
};

// Execute if run directly from CLI
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      console.log('Seed completed successfully.');
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seed failed:', err);
      await pool.end();
      process.exit(1);
    });
}
