import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { config } from '../config.js';
import { asyncHandler, requireAuth } from '../middleware.js';
import { loginSchema } from '../schemas.js';
import { unauthorized } from '../errors.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await pool.query(
    `select u.id, u.email, u.password_hash, u.display_name, array_agg(ur.role::text order by ur.role::text) as roles
     from app_users u
     join user_roles ur on ur.user_id = u.id
     where lower(u.email) = lower($1) and u.is_active = true
     group by u.id`,
    [input.email],
  );

  if (!result.rowCount) throw unauthorized('Invalid email or password.');
  const user = result.rows[0];
  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) throw unauthorized('Invalid email or password.');

  const token = jwt.sign({ sub: user.id, roles: user.roles }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      roles: user.roles,
    },
  });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));
