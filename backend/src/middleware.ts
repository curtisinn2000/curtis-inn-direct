import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { ZodError } from 'zod';
import { config } from './config.js';
import { AppError, forbidden, unauthorized } from './errors.js';
import { pool, type DbClient } from './db.js';

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  roleKeys: string[];
  roleNames: string[];
  permissions: string[];
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

    const user = await loadActiveAdminUser(pool, decoded.sub);
    if (!user) return next(unauthorized());
    req.user = user;
    return next();
  } catch {
    return next(unauthorized());
  }
}

export async function loadActiveAdminUser(db: DbClient, userId: string): Promise<AdminUser | null> {
    const result = await db.query(
      `select u.id, u.email, u.display_name,
         array_agg(distinct ur.role_key order by ur.role_key) as role_keys,
         array_agg(distinct ar.name order by ar.name) as role_names,
         coalesce(array_agg(distinct arp.permission_key order by arp.permission_key)
           filter (where arp.permission_key is not null), '{}') as permissions
       from app_users u
       join user_roles ur on ur.user_id = u.id
       join admin_roles ar on ar.role_key = ur.role_key
       left join admin_role_permissions arp on arp.role_key = ur.role_key
       where u.id = $1 and u.is_active = true
       group by u.id`,
      [userId],
    );

    if (result.rowCount === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      roleKeys: row.role_keys ?? [],
      roleNames: row.role_names ?? [],
      permissions: row.permissions ?? [],
    };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (!req.user.permissions.length) return next(forbidden());
  return next();
}
