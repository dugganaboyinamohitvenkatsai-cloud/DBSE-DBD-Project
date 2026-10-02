import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return next(new ApiError(401, 'Authentication is required.'));
  try {
    req.auth = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    next(new ApiError(401, 'Your session is invalid or expired.'));
  }
}

export const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.auth.role)
    ? next()
    : next(new ApiError(403, 'You do not have permission to perform this action.'));
