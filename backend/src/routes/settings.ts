import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { asyncHandler } from '../middleware.js';
import { permissions, requirePermission } from '../access.js';
import { audit } from '../transformers.js';
import { badRequest, notFound } from '../errors.js';
import { config, mailConfigured, stripeConfigured } from '../config.js';
import { getStripeClient } from '../services/stripe.js';
import { policyFromRow } from '../services/policies.js';
import {
  changeOwnPassword,
  createInvitation,
  ensureNotFinalOwner,
  maskedSecret,
  predefinedRoleKeys,
  replaceIntegrationSecrets,
  resendInvitation,
  testEmailConnection,
} from '../services/adminSettings.js';

export const settingsRouter = Router();

const roleKeySchema = z.enum(predefinedRoleKeys);
const invitationSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(320),
  roleKey: roleKeySchema,
});
const profileSchema = z.object({ displayName: z.string().trim().min(2).max(100) });
const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});
const policySchema = z.object({
  checkInTime: z.string().trim().min(1).max(30),
  checkOutTime: z.string().trim().min(1).max(30),
  minimumCheckInAge: z.coerce.number().int().min(18).max(99),
  cancellationWindowHours: z.coerce.number().int().min(0).max(8760),
  cancellationRule: z.string().trim().min(1).max(1000),
  noShowPolicy: z.string().trim().min(1).max(1000),
  depositPolicy: z.string().trim().min(1).max(1000),
  smokingPolicy: z.string().trim().min(1).max(1000),
  petPolicy: z.string().trim().min(1).max(1000),
  incidentalsPolicy: z.string().trim().min(1).max(1000),
  acceptedPayments: z.array(z.string().trim().min(1).max(50)).min(1).max(20),
  earlyCheckInPolicy: z.string().trim().min(1).max(1000),
  lateCheckoutPolicy: z.string().trim().min(1).max(1000),
  guestFacingNotes: z.string().trim().max(3000),
});
const emailIntegrationSchema = z.object({
  smtpHost: z.string().trim().min(1).max(255).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().trim().email().max(320).optional(),
  mailFrom: z.string().trim().email().max(320).optional(),
  hotelNotificationsEmail: z.string().trim().email().max(320).optional(),
  smtpPassword: z.string().min(8).max(1000).optional(),
});
const stripeIntegrationSchema = z.object({
  mode: z.enum(['test', 'live']).optional(),
  secretKey: z.string().min(8).max(1000).optional(),
  webhookSecret: z.string().min(8).max(1000).optional(),
});

settingsRouter.get('/profile', requirePermission(permissions.profileManage), asyncHandler(async (req, res) => {
  const result = await pool.query(
    `select u.id, u.email, u.display_name, u.last_login_at,
       array_agg(ar.name order by ar.name) as role_names
     from app_users u
     join user_roles ur on ur.user_id = u.id
     join admin_roles ar on ar.role_key = ur.role_key
     where u.id = $1 group by u.id`,
    [req.user!.id],
  );
  res.json({
    id: result.rows[0].id,
    email: result.rows[0].email,
    displayName: result.rows[0].display_name,
    roleNames: result.rows[0].role_names,
    lastLoginAt: result.rows[0].last_login_at,
  });
}));

settingsRouter.put('/profile', requirePermission(permissions.profileManage), asyncHandler(async (req, res) => {
  const input = profileSchema.parse(req.body);
  await pool.query(`update app_users set display_name = $2, updated_at = now() where id = $1`, [req.user!.id, input.displayName]);
  await audit(pool, { actorId: req.user!.id, entity: 'app_user', entityId: req.user!.id, action: 'profile_update', after: { displayName: input.displayName } });
  res.json({ ok: true, displayName: input.displayName });
}));

settingsRouter.put('/profile/password', requirePermission(permissions.profileManage), asyncHandler(async (req, res) => {
  const input = passwordSchema.parse(req.body);
  await changeOwnPassword(pool, req.user!.id, input.currentPassword, input.newPassword);
  await audit(pool, { actorId: req.user!.id, entity: 'app_user', entityId: req.user!.id, action: 'password_changed' });
  res.json({ ok: true });
}));

settingsRouter.get('/roles', requirePermission(permissions.usersManage), asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `select ar.role_key, ar.name, ar.description,
       coalesce(array_agg(arp.permission_key order by arp.permission_key)
         filter (where arp.permission_key is not null), '{}') as permissions
     from admin_roles ar
     left join admin_role_permissions arp on arp.role_key = ar.role_key
     where ar.is_system = true
     group by ar.role_key order by case ar.role_key when 'owner' then 1 when 'manager' then 2 else 3 end`,
  );
  res.json(result.rows.map(row => ({
    key: row.role_key,
    name: row.name,
    description: row.description,
    permissions: row.permissions,
  })));
}));

settingsRouter.get('/users', requirePermission(permissions.usersManage), asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `select u.id, u.email, u.display_name, u.is_active, u.last_login_at, u.invited_at,
       ur.role_key, ar.name as role_name,
       exists(select 1 from admin_invitations i where i.user_id = u.id and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()) as invitation_pending
     from app_users u
     join user_roles ur on ur.user_id = u.id
     join admin_roles ar on ar.role_key = ur.role_key
     order by case ur.role_key when 'owner' then 1 when 'manager' then 2 else 3 end, lower(u.display_name), lower(u.email)`,
  );
  res.json(result.rows.map(row => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    roleKey: row.role_key,
    roleName: row.role_name,
    isActive: row.is_active,
    invitationPending: row.invitation_pending,
    lastLoginAt: row.last_login_at,
    invitedAt: row.invited_at,
  })));
}));

settingsRouter.post('/users/invitations', requirePermission(permissions.usersManage), asyncHandler(async (req, res) => {
  const input = invitationSchema.parse(req.body);
  const invitation = await createInvitation(pool, input, req.user!.id);
  await audit(pool, { actorId: req.user!.id, entity: 'app_user', entityId: invitation.userId, action: 'invitation_sent', after: { email: input.email, roleKey: input.roleKey, expiresAt: invitation.expiresAt } });
  res.status(201).json({ ok: true, ...invitation });
}));

settingsRouter.post('/users/:id/resend-invitation', requirePermission(permissions.usersManage), asyncHandler(async (req, res) => {
  const userId = z.string().uuid().parse(req.params.id);
  const invitation = await resendInvitation(pool, userId, req.user!.id);
  await audit(pool, { actorId: req.user!.id, entity: 'app_user', entityId: userId, action: 'invitation_resent', after: { expiresAt: invitation.expiresAt } });
  res.json({ ok: true, ...invitation });
}));

settingsRouter.patch('/users/:id/role', requirePermission(permissions.usersManage), asyncHandler(async (req, res) => {
  const userId = z.string().uuid().parse(req.params.id);
  const input = z.object({ roleKey: roleKeySchema }).parse(req.body);
  await withTransaction(async client => {
    const user = await client.query(`select id from app_users where id = $1 for update`, [userId]);
    if (!user.rowCount) throw notFound('admin_user_not_found', 'Admin account was not found.');
    if (input.roleKey !== 'owner') await ensureNotFinalOwner(client, userId);
    const before = await client.query(`select role_key from user_roles where user_id = $1`, [userId]);
    await client.query(`delete from user_roles where user_id = $1`, [userId]);
    await client.query(
      `insert into user_roles(user_id, role, role_key) values ($1, $2::app_role, $3)`,
      [userId, input.roleKey === 'front_desk' ? 'staff' : 'admin', input.roleKey],
    );
    await audit(client, { actorId: req.user!.id, entity: 'app_user', entityId: userId, action: 'role_changed', before: { roleKey: before.rows[0]?.role_key }, after: input });
  });
  res.json({ ok: true });
}));

settingsRouter.patch('/users/:id/status', requirePermission(permissions.usersManage), asyncHandler(async (req, res) => {
  const userId = z.string().uuid().parse(req.params.id);
  const input = z.object({ isActive: z.boolean() }).parse(req.body);
  if (userId === req.user!.id && !input.isActive) throw badRequest('self_deactivation_blocked', 'You cannot deactivate your own account.');
  await withTransaction(async client => {
    const user = await client.query(`select id, is_active, password_hash from app_users where id = $1 for update`, [userId]);
    if (!user.rowCount) throw notFound('admin_user_not_found', 'Admin account was not found.');
    if (input.isActive && !user.rows[0].password_hash) throw badRequest('invitation_not_accepted', 'This user must accept the invitation before activation.');
    if (!input.isActive) await ensureNotFinalOwner(client, userId);
    await client.query(`update app_users set is_active = $2, updated_at = now() where id = $1`, [userId, input.isActive]);
    await audit(client, { actorId: req.user!.id, entity: 'app_user', entityId: userId, action: input.isActive ? 'reactivated' : 'deactivated' });
  });
  res.json({ ok: true });
}));

settingsRouter.get('/policies', requirePermission(permissions.policiesRead), asyncHandler(async (_req, res) => {
  const result = await pool.query(`select * from hotel_policy_settings where singleton_key = true`);
  res.json(policyFromRow(result.rows[0]));
}));

settingsRouter.put('/policies', requirePermission(permissions.policiesManage), asyncHandler(async (req, res) => {
  const input = policySchema.parse(req.body);
  const result = await pool.query(
    `update hotel_policy_settings set
       check_in_time=$1, check_out_time=$2, minimum_check_in_age=$3, cancellation_window_hours=$4,
       cancellation_rule=$5, no_show_policy=$6, deposit_policy=$7, smoking_policy=$8, pet_policy=$9,
       incidentals_policy=$10, accepted_payments=$11, early_check_in_policy=$12, late_checkout_policy=$13,
       guest_facing_notes=$14, updated_by=$15, updated_at=now()
     where singleton_key = true returning *`,
    [input.checkInTime, input.checkOutTime, input.minimumCheckInAge, input.cancellationWindowHours,
      input.cancellationRule, input.noShowPolicy, input.depositPolicy, input.smokingPolicy, input.petPolicy,
      input.incidentalsPolicy, input.acceptedPayments, input.earlyCheckInPolicy, input.lateCheckoutPolicy,
      input.guestFacingNotes, req.user!.id],
  );
  await audit(pool, { actorId: req.user!.id, entity: 'hotel_policy_settings', entityId: 'default', action: 'update', after: input });
  res.json(policyFromRow(result.rows[0]));
}));

settingsRouter.get('/integrations', requirePermission(permissions.integrationsRead), asyncHandler(async (_req, res) => {
  const result = await pool.query(`select * from integration_metadata order by integration_key`);
  const rows = new Map(result.rows.map(row => [row.integration_key, row]));
  const email = rows.get('email');
  const stripe = rows.get('stripe');
  res.json({
    email: integrationView(email, mailConfigured, {
      smtpHost: email?.safe_config?.smtpHost ?? config.GMAIL_SMTP_HOST,
      smtpPort: email?.safe_config?.smtpPort ?? config.GMAIL_SMTP_PORT,
      smtpUser: email?.safe_config?.smtpUser ?? config.GMAIL_SMTP_USER,
      mailFrom: email?.safe_config?.mailFrom ?? config.MAIL_FROM,
      hotelNotificationsEmail: email?.safe_config?.hotelNotificationsEmail ?? config.HOTEL_NOTIFICATIONS_EMAIL,
      smtpPassword: maskedSecret(mailConfigured || Boolean(email?.configured)),
    }),
    stripe: integrationView(stripe, stripeConfigured, {
      mode: stripe?.safe_config?.mode ?? config.STRIPE_ENV,
      webhookEndpoint: '/api/stripe/webhook',
      secretKey: maskedSecret(stripeConfigured || Boolean(stripe?.configured)),
      webhookSecret: maskedSecret(stripeConfigured || Boolean(stripe?.configured)),
    }),
  });
}));

settingsRouter.put('/integrations/email', requirePermission(permissions.integrationsManage), asyncHandler(async (req, res) => {
  const input = emailIntegrationSchema.parse(req.body);
  const replaced = await replaceIntegrationSecrets('email', { smtpPassword: input.smtpPassword ?? '' });
  const safeConfig = Object.fromEntries(Object.entries(input).filter(([key, value]) => key !== 'smtpPassword' && value !== undefined));
  await saveIntegrationMetadata('email', safeConfig, replaced.length > 0 || mailConfigured, req.user!.id);
  await audit(pool, { actorId: req.user!.id, entity: 'integration', entityId: 'email', action: 'update', after: { fieldsUpdated: Object.keys(safeConfig), secretsReplaced: replaced } });
  res.json({
    ok: true,
    configured: replaced.length > 0 || mailConfigured,
    secretMask: '••••••••',
    message: replaced.length
      ? 'Email secret saved. Deploy a new Cloud Run revision before testing the replacement.'
      : 'Email integration metadata saved.',
  });
}));

settingsRouter.put('/integrations/stripe', requirePermission(permissions.integrationsManage), asyncHandler(async (req, res) => {
  const input = stripeIntegrationSchema.parse(req.body);
  const replaced = await replaceIntegrationSecrets('stripe', { secretKey: input.secretKey ?? '', webhookSecret: input.webhookSecret ?? '' });
  const safeConfig = input.mode ? { mode: input.mode } : {};
  await saveIntegrationMetadata('stripe', safeConfig, replaced.length > 0 || stripeConfigured, req.user!.id);
  await audit(pool, { actorId: req.user!.id, entity: 'integration', entityId: 'stripe', action: 'update', after: { fieldsUpdated: Object.keys(safeConfig), secretsReplaced: replaced } });
  res.json({
    ok: true,
    configured: replaced.length > 0 || stripeConfigured,
    secretMask: '••••••••',
    message: replaced.length
      ? 'Stripe secrets saved. Deploy a new Cloud Run revision before testing the replacements.'
      : 'Stripe integration metadata saved.',
  });
}));

settingsRouter.post('/integrations/email/test', requirePermission(permissions.integrationsManage), asyncHandler(async (req, res) => {
  await runIntegrationTest('email', req.user!.id, async () => testEmailConnection(req.user!.email));
  res.json({ ok: true, message: `Test email sent to ${req.user!.email}.` });
}));

settingsRouter.post('/integrations/stripe/test', requirePermission(permissions.integrationsManage), asyncHandler(async (req, res) => {
  await runIntegrationTest('stripe', req.user!.id, async () => { await getStripeClient().balance.retrieve(); });
  res.json({ ok: true, message: 'Stripe connection verified.' });
}));

type IntegrationMetadataRow = {
  configured?: boolean;
  safe_config?: Record<string, string | number>;
  updated_at?: string | Date;
  last_test_status?: 'success' | 'failed' | null;
  last_tested_at?: string | Date | null;
  last_test_error?: string | null;
};

function integrationView(row: IntegrationMetadataRow | undefined, runtimeConfigured: boolean, fields: Record<string, unknown>) {
  return {
    configured: runtimeConfigured || Boolean(row?.configured),
    lastUpdatedAt: row?.updated_at ?? null,
    lastTestStatus: row?.last_test_status ?? null,
    lastTestedAt: row?.last_tested_at ?? null,
    lastTestError: row?.last_test_error ?? null,
    fields,
  };
}

async function saveIntegrationMetadata(key: 'email' | 'stripe', safeConfig: Record<string, unknown>, configured: boolean, actorId: string) {
  await pool.query(
    `insert into integration_metadata(integration_key, safe_config, configured, updated_by, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (integration_key) do update set
       safe_config = integration_metadata.safe_config || excluded.safe_config,
       configured = integration_metadata.configured or excluded.configured,
       updated_by = excluded.updated_by,
       updated_at = now()`,
    [key, JSON.stringify(safeConfig), configured, actorId],
  );
}

async function runIntegrationTest(key: 'email' | 'stripe', actorId: string, test: () => Promise<void>) {
  try {
    await test();
    await pool.query(`update integration_metadata set last_test_status='success', last_tested_at=now(), last_test_error=null where integration_key=$1`, [key]);
    await audit(pool, { actorId, entity: 'integration', entityId: key, action: 'test_success' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection test failed.';
    await pool.query(`update integration_metadata set last_test_status='failed', last_tested_at=now(), last_test_error=$2 where integration_key=$1`, [key, message.slice(0, 500)]);
    await audit(pool, { actorId, entity: 'integration', entityId: key, action: 'test_failed' });
    throw error;
  }
}

