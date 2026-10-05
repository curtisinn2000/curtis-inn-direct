alter table app_users alter column password_hash drop not null;
alter table app_users add column if not exists last_login_at timestamptz;
alter table app_users add column if not exists invited_at timestamptz;
alter table app_users add column if not exists invited_by uuid references app_users(id);

create table if not exists admin_roles (
  role_key text primary key,
  name text not null unique,
  description text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_permissions (
  permission_key text primary key,
  name text not null,
  description text not null default ''
);

create table if not exists admin_role_permissions (
  role_key text not null references admin_roles(role_key) on delete cascade,
  permission_key text not null references admin_permissions(permission_key) on delete cascade,
  primary key (role_key, permission_key)
);

insert into admin_roles(role_key, name, description, is_system) values
  ('owner', 'Owner', 'Full system access.', true),
  ('manager', 'Manager', 'Hotel operations without user or integration management.', true),
  ('front_desk', 'Front Desk', 'Reservations, availability, guest lookup and stay operations.', true)
on conflict (role_key) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  updated_at = now();

insert into admin_permissions(permission_key, name, description) values
  ('dashboard.read', 'View dashboard', 'View operational and revenue summaries.'),
  ('reservations.read', 'View reservations', 'View reservations and guest details.'),
  ('reservations.manage', 'Manage reservations', 'Update reservation and stay status.'),
  ('availability.read', 'View availability', 'View room availability.'),
  ('availability.manage', 'Manage availability', 'Update inventory and stop-sell controls.'),
  ('rooms.read', 'View rooms', 'View room types.'),
  ('rooms.manage', 'Manage rooms', 'Create, edit, hide and archive room types.'),
  ('rates.read', 'View rates', 'View rate configuration.'),
  ('rates.manage', 'Manage rates', 'Set and clear rates.'),
  ('payments.read', 'View payments', 'View payment records.'),
  ('content.read', 'View content', 'View website content management.'),
  ('content.manage', 'Manage content', 'Create, edit and remove website content.'),
  ('reports.read', 'View reports', 'View hotel reports.'),
  ('profile.manage', 'Manage own profile', 'Update the signed-in account profile.'),
  ('users.manage', 'Manage users and access', 'Invite, assign roles and activate accounts.'),
  ('policies.read', 'View hotel policies', 'View operational hotel policies.'),
  ('policies.manage', 'Manage hotel policies', 'Update operational hotel policies.'),
  ('integrations.read', 'View integrations', 'View masked integration status.'),
  ('integrations.manage', 'Manage integrations', 'Replace secrets and test integrations.'),
  ('audit.read', 'View audit log', 'View administrative audit events.')
on conflict (permission_key) do update set
  name = excluded.name,
  description = excluded.description;

insert into admin_role_permissions(role_key, permission_key)
select 'owner', permission_key from admin_permissions
on conflict do nothing;

insert into admin_role_permissions(role_key, permission_key) values
  ('manager', 'dashboard.read'),
  ('manager', 'reservations.read'),
  ('manager', 'reservations.manage'),
  ('manager', 'availability.read'),
  ('manager', 'availability.manage'),
  ('manager', 'rooms.read'),
  ('manager', 'rooms.manage'),
  ('manager', 'rates.read'),
  ('manager', 'rates.manage'),
  ('manager', 'payments.read'),
  ('manager', 'content.read'),
  ('manager', 'content.manage'),
  ('manager', 'reports.read'),
  ('manager', 'profile.manage'),
  ('manager', 'policies.read'),
  ('manager', 'policies.manage'),
  ('front_desk', 'reservations.read'),
  ('front_desk', 'reservations.manage'),
  ('front_desk', 'availability.read'),
  ('front_desk', 'availability.manage'),
  ('front_desk', 'profile.manage')
on conflict do nothing;

alter table user_roles add column if not exists role_key text references admin_roles(role_key);
update user_roles set role_key = case when role::text = 'admin' then 'owner' else 'front_desk' end
where role_key is null;
alter table user_roles alter column role_key set not null;
create unique index if not exists user_roles_user_role_key_uq on user_roles(user_id, role_key);

create table if not exists admin_invitations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  sent_at timestamptz,
  send_error text,
  created_by uuid not null references app_users(id),
  created_at timestamptz not null default now()
);
create index if not exists admin_invitations_user_idx on admin_invitations(user_id, created_at desc);

create table if not exists hotel_policy_settings (
  singleton_key boolean primary key default true check (singleton_key),
  check_in_time text not null default '3:00 PM',
  check_out_time text not null default '11:00 AM',
  minimum_check_in_age int not null default 21 check (minimum_check_in_age between 18 and 99),
  cancellation_window_hours int not null default 48 check (cancellation_window_hours between 0 and 8760),
  cancellation_rule text not null default 'Cancellations within the cancellation window may be charged one night.',
  no_show_policy text not null default 'No-shows may be charged the full reservation amount.',
  deposit_policy text not null default 'Full payment is collected when booking online.',
  smoking_policy text not null default 'This is a non-smoking property.',
  pet_policy text not null default 'Pets are not permitted.',
  incidentals_policy text not null default 'A valid payment card may be required at check-in for incidentals.',
  accepted_payments text[] not null default array['Visa','Mastercard','American Express','Discover'],
  early_check_in_policy text not null default 'Early check-in is subject to availability and may incur a fee.',
  late_checkout_policy text not null default 'Late checkout is subject to availability and may incur a fee.',
  guest_facing_notes text not null default '',
  updated_by uuid references app_users(id),
  updated_at timestamptz not null default now()
);
insert into hotel_policy_settings(singleton_key) values (true) on conflict do nothing;

create table if not exists integration_metadata (
  integration_key text primary key check (integration_key in ('email','stripe')),
  safe_config jsonb not null default '{}'::jsonb,
  configured boolean not null default false,
  last_test_status text check (last_test_status is null or last_test_status in ('success','failed')),
  last_tested_at timestamptz,
  last_test_error text,
  updated_by uuid references app_users(id),
  updated_at timestamptz not null default now()
);
insert into integration_metadata(integration_key) values ('email'), ('stripe') on conflict do nothing;
