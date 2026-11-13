import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { httpLogger } from './logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { medicinesRouter } from './routes/medicines.js';
import { batchesRouter } from './routes/batches.js';
import { stockMovementsRouter } from './routes/stockMovements.js';
import { reportsRouter } from './routes/reports.js';

export const createApp = () => {
  const app = express();

  // Security Headers
  app.use(helmet());

  // Cross-Origin Resource Sharing
  app.use(cors());

  // Rate Limiter: 100 requests per 1 minute window
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        message: 'Too many requests, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    }
  });
  app.use('/api', limiter);

  // Body parser
  app.use(express.json());

  // Structured HTTP access logging
  app.use(httpLogger);

  // Health and Readiness checks (mounted at root)
  app.use('/', healthRouter);

  // API Domain routes
  app.use('/api/medicines', medicinesRouter);
  app.use('/api/batches', batchesRouter);
  app.use('/api/stock-movements', stockMovementsRouter);
  app.use('/api/reports', reportsRouter);

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      error: {
        message: `Route ${req.method} ${req.originalUrl} not found`,
        code: 'NOT_FOUND'
      }
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};

