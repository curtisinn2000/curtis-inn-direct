import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import type { DbClient } from '../db.js';
import { config, mailConfigured } from '../config.js';
import { AppError, badRequest, configurationError, conflict, notFound } from '../errors.js';
import { audit } from '../transformers.js';

export const predefinedRoleKeys = ['owner', 'manager', 'front_desk'] as const;
export type PredefinedRoleKey = typeof predefinedRoleKeys[number];

const secretIds = {
  emailPassword: () => config.GMAIL_SMTP_PASS_SECRET_ID,
  stripeSecretKey: () => config.STRIPE_SECRET_KEY_SECRET_ID,
  stripeWebhookSecret: () => config.STRIPE_WEBHOOK_SECRET_SECRET_ID,
};

export function maskedSecret(configured: boolean) {
  return configured ? '••••••••' : '';
}

export async function ensureNotFinalOwner(db: DbClient, userId: string) {
  const target = await db.query(
    `select 1
     from user_roles ur
     join app_users u on u.id = ur.user_id
     where ur.user_id = $1 and ur.role_key = 'owner'
       and u.is_active = true and u.password_hash is not null`,
    [userId],
  );
  if (!target.rowCount) return;
  const owners = await db.query(
    `select u.id
     from app_users u
     join user_roles ur on ur.user_id = u.id and ur.role_key = 'owner'
     where u.is_active = true and u.password_hash is not null
     for update of u`,
  );
  if ((owners.rowCount ?? owners.rows.length) <= 1) {
    throw conflict('final_owner_required', 'The final active Owner cannot be deactivated or assigned another role.');
  }
}

export async function createInvitation(
  db: DbClient,
  input: { email: string; displayName: string; roleKey: PredefinedRoleKey },
  actorId: string,
) {
  const existing = await db.query(`select id, is_active, password_hash from app_users where lower(email) = lower($1)`, [input.email]);
  if (existing.rowCount && (existing.rows[0].is_active || existing.rows[0].password_hash)) {
    throw conflict('admin_user_exists', 'An account already exists for this email address.');
  }

  const user = existing.rowCount
    ? await db.query(
      `update app_users set display_name = $2, invited_at = now(), invited_by = $3, updated_at = now() where id = $1 returning id, email`,
      [existing.rows[0].id, input.displayName, actorId],
    )
    : await db.query(
      `insert into app_users(email, password_hash, display_name, is_active, invited_at, invited_by)
       values (lower($1), null, $2, false, now(), $3) returning id, email`,
      [input.email, input.displayName, actorId],
    );

  await db.query(`delete from user_roles where user_id = $1`, [user.rows[0].id]);
  await db.query(
    `insert into user_roles(user_id, role, role_key) values ($1, $2::app_role, $3)`,
    [user.rows[0].id, input.roleKey === 'front_desk' ? 'staff' : 'admin', input.roleKey],
  );
  await db.query(
    `update admin_invitations set revoked_at = now()
     where user_id = $1 and accepted_at is null and revoked_at is null`,
    [user.rows[0].id],
  );
  return issueInvitation(db, String(user.rows[0].id), String(user.rows[0].email), input.displayName, input.roleKey, actorId);
}

export async function resendInvitation(db: DbClient, userId: string, actorId: string) {
  const user = await db.query(
    `select u.id, u.email, u.display_name, u.is_active, u.password_hash, ur.role_key
     from app_users u join user_roles ur on ur.user_id = u.id where u.id = $1`,
    [userId],
  );
  if (!user.rowCount) throw notFound('admin_user_not_found', 'Admin account was not found.');
  if (user.rows[0].is_active || user.rows[0].password_hash) {
    throw badRequest('invitation_not_pending', 'Only pending invitations can be resent.');
  }
  await db.query(
    `update admin_invitations set revoked_at = now()
     where user_id = $1 and accepted_at is null and revoked_at is null`,
    [userId],
  );
  return issueInvitation(
    db,
    userId,
    String(user.rows[0].email),
    String(user.rows[0].display_name),
    user.rows[0].role_key as PredefinedRoleKey,
    actorId,
  );
}

async function issueInvitation(
  db: DbClient,
  userId: string,
  email: string,
  displayName: string,
  roleKey: PredefinedRoleKey,
  actorId: string,
) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const invitation = await db.query(
    `insert into admin_invitations(user_id, token_hash, expires_at, created_by)
     values ($1, $2, now() + interval '72 hours', $3)
     returning id, expires_at`,
    [userId, tokenHash, actorId],
  );
  const invitationUrl = `${config.PUBLIC_SITE_URL}/admin/invite/${encodeURIComponent(token)}`;
  await audit(db, {
    actorId,
    entity: 'app_user',
    entityId: userId,
    action: 'invitation_created',
    after: { email, roleKey, expiresAt: invitation.rows[0].expires_at },
  });
  try {
    await sendInvitationEmail({ email, displayName, roleKey, invitationUrl, expiresAt: invitation.rows[0].expires_at });
    await db.query(`update admin_invitations set sent_at = now(), send_error = null where id = $1`, [invitation.rows[0].id]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email delivery failed.';
    await db.query(`update admin_invitations set send_error = $2 where id = $1`, [invitation.rows[0].id, message.slice(0, 500)]);
    await audit(db, {
      actorId,
      entity: 'app_user',
      entityId: userId,
      action: 'invitation_email_failed',
      after: { email, roleKey },
    });
    throw new AppError(502, 'invitation_email_failed', 'The account was created, but the invitation email could not be sent. Use Resend Invitation after checking email configuration.');
  }
  return { userId, expiresAt: invitation.rows[0].expires_at };
}

async function sendInvitationEmail(input: {
  email: string;
  displayName: string;
  roleKey: PredefinedRoleKey;
  invitationUrl: string;
  expiresAt: Date | string;
}) {
  if (!mailConfigured) throw configurationError('Email is not configured.');
  const transport = nodemailer.createTransport({
    host: config.GMAIL_SMTP_HOST,
    port: config.GMAIL_SMTP_PORT,
    secure: config.GMAIL_SMTP_PORT === 465,
    auth: { user: config.GMAIL_SMTP_USER, pass: config.GMAIL_SMTP_PASS },
  });
  const roleName = input.roleKey === 'front_desk' ? 'Front Desk' : input.roleKey[0].toUpperCase() + input.roleKey.slice(1);
  await transport.sendMail({
    from: config.MAIL_FROM,
    to: input.email,
    subject: 'You are invited to the Curtis Inn admin portal',
    text: `Hello ${input.displayName},\n\nYou were invited as ${roleName}. Create your password within 72 hours:\n${input.invitationUrl}\n\nIf you did not expect this invitation, ignore this email.`,
    html: `<p>Hello ${escapeHtml(input.displayName)},</p><p>You were invited to the Curtis Inn admin portal as <strong>${escapeHtml(roleName)}</strong>.</p><p><a href="${escapeHtml(input.invitationUrl)}">Create your password</a></p><p>This invitation expires in 72 hours. If you did not expect it, ignore this email.</p>`,
  });
}

export async function replaceIntegrationSecrets(provider: 'email' | 'stripe', values: Record<string, string>) {
  if (!config.GCP_PROJECT_ID) throw configurationError('GCP_PROJECT_ID is required for Secret Manager updates.');
  const updates: Array<{ field: string; secretId: string; value: string }> = [];
  if (provider === 'email' && values.smtpPassword) {
    updates.push({ field: 'smtpPassword', secretId: secretIds.emailPassword(), value: values.smtpPassword });
  }
  if (provider === 'stripe' && values.secretKey) {
    updates.push({ field: 'secretKey', secretId: secretIds.stripeSecretKey(), value: values.secretKey });
  }
  if (provider === 'stripe' && values.webhookSecret) {
    updates.push({ field: 'webhookSecret', secretId: secretIds.stripeWebhookSecret(), value: values.webhookSecret });
  }
  if (!updates.length) return [];
  const missing = updates.find(update => !update.secretId);
  if (missing) throw configurationError(`Secret Manager ID is not configured for ${missing.field}.`);
  const client = new SecretManagerServiceClient();
  for (const update of updates) {
    await client.addSecretVersion({
      parent: `projects/${config.GCP_PROJECT_ID}/secrets/${update.secretId}`,
      payload: { data: Buffer.from(update.value, 'utf8') },
    });
  }
  return updates.map(update => update.field);
}

export async function testEmailConnection(recipient: string) {
  if (!mailConfigured) throw configurationError('Email is not configured in the running Cloud Run revision.');
  const transport = nodemailer.createTransport({
    host: config.GMAIL_SMTP_HOST,
    port: config.GMAIL_SMTP_PORT,
    secure: config.GMAIL_SMTP_PORT === 465,
    auth: { user: config.GMAIL_SMTP_USER, pass: config.GMAIL_SMTP_PASS },
  });
  await transport.verify();
  await transport.sendMail({
    from: config.MAIL_FROM,
    to: recipient,
    subject: 'Curtis Inn email connection test',
    text: 'The Curtis Inn admin email integration is working.',
  });
}

export async function changeOwnPassword(db: DbClient, userId: string, currentPassword: string, newPassword: string) {
  const user = await db.query(`select password_hash from app_users where id = $1 and is_active = true`, [userId]);
  if (!user.rowCount || !user.rows[0].password_hash || !await bcrypt.compare(currentPassword, user.rows[0].password_hash)) {
    throw badRequest('current_password_invalid', 'Current password is incorrect.');
  }
  await db.query(`update app_users set password_hash = $2, updated_at = now() where id = $1`, [userId, await bcrypt.hash(newPassword, 12)]);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}
