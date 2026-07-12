do $$ begin
  alter type payment_method_t add value if not exists 'stripe_pay_now';
exception when duplicate_object then null; end $$;

alter table payments
  add column if not exists provider text not null default 'legacy',
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_charge_id text;

create index if not exists payments_stripe_checkout_session_idx on payments (stripe_checkout_session_id);
create index if not exists payments_stripe_payment_intent_idx on payments (stripe_payment_intent_id);
