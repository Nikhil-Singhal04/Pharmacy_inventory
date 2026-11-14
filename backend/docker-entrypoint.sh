#!/bin/sh
set -e

echo "Checking database connectivity and running pending migrations..."
# Run migrations using the container's environment DATABASE_URL
npx node-pg-migrate up

# If SEED_ON_START is enabled, populate synthetic data only if database is empty
if [ "$SEED_ON_START" = "true" ]; then
  COUNT=$(node -e "import('./src/db.js').then(async m => { const r = await m.pool.query('SELECT COUNT(*) FROM medicines'); process.stdout.write(r.rows[0].count.toString()); await m.pool.end(); })" 2>/dev/null || echo "0")
  if [ "$COUNT" = "0" ]; then
    echo "Database is empty: seeding initial synthetic data..."
    node seeds/seed.js
  else
    echo "Database already contains $COUNT medicines: skipping seed to preserve persistent data."
  fi
fi

echo "Database ready. Starting application server..."
exec "$@"
