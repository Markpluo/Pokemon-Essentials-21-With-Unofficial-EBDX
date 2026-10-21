-- Copper & Current online: first schema (architecture §4.4, online-ops.md).
-- Run once in the Supabase SQL editor (or psql). The game server connects with the database
-- connection string, which bypasses row level security; RLS is switched on with no policies
-- so the public anon key used by the browser can never read or write these tables.

create table if not exists accounts (
  id            uuid primary key,              -- auth.users.id from Supabase Auth
  email         text not null,
  trainer_name  text not null,
  birth_year    int  not null,
  role          text not null default 'player' check (role in ('player', 'admin')),
  invited_by    uuid references accounts(id) on delete set null,
  created_at    timestamptz not null default now(),
  muted_until   timestamptz,
  banned        boolean not null default false
);
create unique index if not exists accounts_trainer_name on accounts (lower(trainer_name));

create table if not exists invites (
  code        text primary key,
  created_by  uuid references accounts(id) on delete set null,
  created_at  timestamptz not null default now(),
  used_by     uuid references accounts(id) on delete set null,
  used_at     timestamptz
);

-- One online character per account in v1. The save is the same SaveData JSON that solo uses.
create table if not exists characters (
  account_id  uuid primary key references accounts(id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists trades (
  id     bigint generated always as identity primary key,
  a      uuid,                       -- kept as plain ids so deleting an account keeps others' history
  b      uuid,
  a_mon  jsonb not null,
  b_mon  jsonb not null,
  at     timestamptz not null default now()
);

create table if not exists blocks (
  account_id  uuid not null references accounts(id) on delete cascade,
  blocked_id  uuid not null references accounts(id) on delete cascade,
  primary key (account_id, blocked_id)
);

create table if not exists reports (
  id        bigint generated always as identity primary key,
  reporter  uuid,
  reported  uuid,
  reason    text not null,
  chat      jsonb not null default '[]',
  at        timestamptz not null default now(),
  handled   boolean not null default false
);

-- Chat is kept 90 days (online-ops.md §4): delete older rows with the job at the bottom.
create table if not exists chat_log (
  id          bigint generated always as identity primary key,
  account_id  uuid,
  channel     text not null,
  text        text not null,
  at          timestamptz not null default now()
);
create index if not exists chat_log_at on chat_log (at);

create table if not exists audit_log (
  id      bigint generated always as identity primary key,
  actor   uuid,
  action  text not null,
  target  uuid,
  detail  jsonb not null default '{}',
  at      timestamptz not null default now()
);

alter table accounts   enable row level security;
alter table invites    enable row level security;
alter table characters enable row level security;
alter table trades     enable row level security;
alter table blocks     enable row level security;
alter table reports    enable row level security;
alter table chat_log   enable row level security;
alter table audit_log  enable row level security;

-- Optional, needs the pg_cron extension (Database > Extensions in Supabase):
-- select cron.schedule('chat-retention', '0 3 * * *', $$delete from chat_log where at < now() - interval '90 days'$$);
