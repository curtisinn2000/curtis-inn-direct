create table if not exists confirmation_sequences (
  confirmation_date date primary key,
  last_value bigint not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now()
);
