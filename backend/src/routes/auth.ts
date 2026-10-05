import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { config } from '../config.js';
import { asyncHandler, requireAuth } from '../middleware.js';
import { loginSchema } from '../schemas.js';
import { unauthorized } from '../errors.js';
import crypto from 'node:crypto';
import { z } from 'zod';
import { audit } from '../transformers.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await pool.query(
    `select u.id, u.email, u.password_hash, u.display_name,
       array_agg(distinct ur.role_key order by ur.role_key) as role_keys,
       array_agg(distinct ar.name order by ar.name) as role_names,
       coalesce(array_agg(distinct arp.permission_key order by arp.permission_key)
         filter (where arp.permission_key is not null), '{}') as permissions
     from app_users u
     join user_roles ur on ur.user_id = u.id
     join admin_roles ar on ar.role_key = ur.role_key
     left join admin_role_permissions arp on arp.role_key = ur.role_key
     where lower(u.email) = lower($1) and u.is_active = true
     group by u.id`,
    [input.email],
  );

  if (!result.rowCount) throw unauthorized('Invalid email or password.');
  const user = result.rows[0];
  const valid = user.password_hash && await bcrypt.compare(input.password, user.password_hash);
  if (!valid) throw unauthorized('Invalid email or password.');

  await pool.query(`update app_users set last_login_at = now(), updated_at = now() where id = $1`, [user.id]);

  const token = jwt.sign({ sub: user.id }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      roleKeys: user.role_keys,
      roleNames: user.role_names,
      permissions: user.permissions,
    },
  });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));

const invitationLookupSchema = z.object({ token: z.string().min(32).max(512) });
const invitationAcceptSchema = invitationLookupSchema.extend({
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(200),
});

function invitationHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

authRouter.post('/invitations/inspect', asyncHandler(async (req, res) => {
  const input = invitationLookupSchema.parse(req.body);
  const result = await pool.query(
    `select u.email, u.display_name, ar.name as role_name, i.expires_at
     from admin_invitations i
     join app_users u on u.id = i.user_id
     join user_roles ur on ur.user_id = u.id
     join admin_roles ar on ar.role_key = ur.role_key
     where i.token_hash = $1 and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()`,
    [invitationHash(input.token)],
  );
  if (!result.rowCount) throw unauthorized('This invitation is invalid or has expired.');
  res.json({
    email: result.rows[0].email,
    displayName: result.rows[0].display_name,
    roleName: result.rows[0].role_name,
    expiresAt: result.rows[0].expires_at,
  });
}));

authRouter.post('/invitations/accept', asyncHandler(async (req, res) => {
  const input = invitationAcceptSchema.parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const invitation = await client.query(
      `select i.id, i.user_id
       from admin_invitations i
       where i.token_hash = $1 and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
       for update`,
      [invitationHash(input.token)],
    );
    if (!invitation.rowCount) throw unauthorized('This invitation is invalid or has expired.');
    const passwordHash = await bcrypt.hash(input.password, 12);
    await client.query(
      `update app_users set display_name = $2, password_hash = $3, is_active = true, updated_at = now() where id = $1`,
      [invitation.rows[0].user_id, input.displayName, passwordHash],
    );
    await client.query(`update admin_invitations set accepted_at = now() where id = $1`, [invitation.rows[0].id]);
    await audit(client, {
      actorId: invitation.rows[0].user_id,
      entity: 'app_user',
      entityId: invitation.rows[0].user_id,
      action: 'invitation_accepted',
    });
    await client.query('commit');
    res.json({ ok: true });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}));
