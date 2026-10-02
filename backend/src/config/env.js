import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const envFilePath = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: envFilePath, override: true });

const required = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER'];

export function validateEnvironment() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'school_bus_portal',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? ''
  }
};
