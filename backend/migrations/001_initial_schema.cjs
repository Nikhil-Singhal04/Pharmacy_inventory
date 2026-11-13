/**
 * Migration 001: Initial schema for Pharmacy Inventory API
 * Creates medicines, batches, and stock_movements tables with strict constraints
 */
exports.up = (pgm) => {
  // 1. Medicines Table
  pgm.createTable('medicines', {
    id: 'id',
    name: { type: 'varchar(255)', notNull: true },
    sku: { type: 'varchar(100)', notNull: true, unique: true },
    description: { type: 'text' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // 2. Batches Table
  pgm.createTable(
    'batches',
    {
      id: 'id',
      medicine_id: {
        type: 'integer',
        notNull: true,
        references: 'medicines',
        onDelete: 'RESTRICT'
      },
      batch_no: { type: 'varchar(100)', notNull: true },
      expiry_date: { type: 'date', notNull: true },
      quantity_on_hand: {
        type: 'integer',
        notNull: true,
        check: 'quantity_on_hand >= 0'
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('current_timestamp')
      },
      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('current_timestamp')
      }
    },
    {
      constraints: {
        unique: ['medicine_id', 'batch_no']
      }
    }
  );

  // Index on batch expiry date and medicine_id for fast lookups
  pgm.createIndex('batches', ['medicine_id']);
  pgm.createIndex('batches', ['expiry_date']);

  // 3. Stock Movements Table
  pgm.createTable('stock_movements', {
    id: 'id',
    batch_id: {
      type: 'integer',
      notNull: true,
      references: 'batches',
      onDelete: 'RESTRICT'
    },
    type: {
      type: 'varchar(20)',
      notNull: true,
      check: "type IN ('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT')"
    },
    quantity: {
      type: 'integer',
      notNull: true,
      check: 'quantity > 0'
    },
    reason: { type: 'text' },
    reference: { type: 'varchar(255)' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Index on stock movements for batch auditing and history lookups
  pgm.createIndex('stock_movements', ['batch_id']);
  pgm.createIndex('stock_movements', ['created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('stock_movements');
  pgm.dropTable('batches');
  pgm.dropTable('medicines');
};

