alter table payments
  add column if not exists stripe_receipt_url text;

do $$
begin
  create type notification_channel as enum ('email', 'sms');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type notification_status as enum ('pending', 'sent', 'failed', 'skipped');
exception when duplicate_object then null;
end $$;

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  channel notification_channel not null,
  template_type text not null,
  recipient text not null,
  subject text,
  body_preview text not null default '',
  status notification_status not null default 'pending',
  provider_message_id text,
  error_text text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reservation_id, channel, template_type)
);

create index if not exists notification_deliveries_reservation_idx
  on notification_deliveries (reservation_id, created_at desc);

create index if not exists notification_deliveries_status_idx
  on notification_deliveries (status, created_at desc);
