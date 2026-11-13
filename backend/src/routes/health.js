import { Router } from 'express';
import { checkHealth } from '../db.js';

export const healthRouter = Router();

/**
 * Liveness probe: /health
 * Returns 200 as long as the Express process is running. DB check is omitted deliberately.
 */
healthRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Readiness probe: /ready
 * Executes `SELECT 1` against PostgreSQL. Returns 503 if DB is unreachable.
 */
healthRouter.get('/ready', async (req, res) => {
  try {
    await checkHealth();
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

