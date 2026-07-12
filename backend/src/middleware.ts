import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { ZodError } from 'zod';
import { config } from './config.js';
import { AppError, forbidden, unauthorized } from './errors.js';
import { pool } from './db.js';

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AdminUser;
    }
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const path = firstIssue?.path?.length ? `${firstIssue.path.join('.')}: ` : '';
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: firstIssue ? `${path}${firstIssue.message}` : 'Invalid request.',
        details: error.flatten(),
      },
    });
  }

  if (error instanceof multer.MulterError) {
    const isSizeError = error.code === 'LIMIT_FILE_SIZE';
    return res.status(400).json({
      error: {
        code: isSizeError ? 'file_too_large' : 'upload_error',
        message: isSizeError ? 'Images must be 5 MB or smaller.' : error.message,
      },
    });
  }

  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  console.error(error);
  return res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong.',
    },
  });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) return next(unauthorized());

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { sub?: string };
    if (!decoded.sub) return next(unauthorized());

    const result = await pool.query(
      `select u.id, u.email, u.display_name, array_agg(ur.role::text order by ur.role::text) as roles
       from app_users u
       join user_roles ur on ur.user_id = u.id
       where u.id = $1 and u.is_active = true
       group by u.id`,
      [decoded.sub],
    );

    if (result.rowCount === 0) return next(unauthorized());
    const row = result.rows[0];
    req.user = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      roles: row.roles ?? [],
    };
    return next();
  } catch {
    return next(unauthorized());
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (!req.user.roles.includes('admin')) return next(forbidden());
  return next();
}
