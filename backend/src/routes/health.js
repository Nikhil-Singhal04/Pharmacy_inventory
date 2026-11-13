import { Router } from 'express';
import { checkHealth } from '../db.js';
import { register } from '../metrics.js';
import { logger } from '../logger.js';

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
    logger.error({ err }, 'Readiness probe failed: unable to connect to database');
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Prometheus metrics endpoint: /metrics
 * Returns Prometheus-formatted text metrics for scraping
 */
healthRouter.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});
