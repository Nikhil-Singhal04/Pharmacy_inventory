import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  databaseUrl:
    process.env.DATABASE_URL ||
    `postgres://${process.env.POSTGRES_USER || 'pharmacy_user'}:${process.env.POSTGRES_PASSWORD || 'pharmacy_password'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'pharmacy_db'}`
};

