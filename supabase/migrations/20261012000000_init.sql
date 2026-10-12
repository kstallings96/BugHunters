-- bugHunters: edge-case machines.
--
-- Every write goes through the app's server routes with the service role
-- key. RLS is enabled on every table with no policies, and anon/authenticated
-- get no grants: the public anon key can neither read nor write anything.
-- Staff pages read through server routes after checking the email allowlist.
--
-- students is the only table with names. Everything else uses student_id.

create table public.students (
  id            uuid primary key,
  first_name    text not null check (char_length(first_name) between 1 and 40),
  last_initial  text not null check (char_length(last_initial) = 1),
  class_period  text not null check (char_length(class_period) between 1 and 20),
  created_at    timestamptz not null default now()
);

create index students_lookup_idx on public.students (class_period, lower(first_name), upper(last_initial));

create table public.sessions (
  id                uuid primary key,
  -- restrict: removing a student must never silently remove their data.
  student_id        uuid not null references public.students (id) on delete restrict,
  is_test           boolean not null default false,
  -- e.g. {grade,pizza,name}; Name Greeter is always third.
  machine_order     text[] not null,
  order_assignment  text not null check (order_assignment in ('random', 'url')),
  app_version       text not null,
  config_version    text not null,
  started_at        timestamptz not null default now(),
  -- Set by the server when the session_end event arrives.
  ended_at          timestamptz,
  -- Kept current from step_enter events, for the facilitator view.
  current_step      text,
  current_machine   text,
  user_agent        text,
  screen_width      integer,
  screen_height     integer,
  viewport_width    integer,
  viewport_height   integer
);

create index sessions_started_at_idx on public.sessions (started_at);
create index sessions_student_idx on public.sessions (student_id);

create table public.events (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.sessions (id) on delete restrict,
  -- Per-session counter assigned by the client; with the unique constraint,
  -- resending a batch (retry, page-hide beacon, reload) is harmless.
  seq         integer not null check (seq > 0),
  client_ts   timestamptz not null,
  server_ts   timestamptz not null default now(),
  step        text not null,
  machine     text,
  event_type  text not null,
  payload     jsonb not null default '{}'::jsonb,
  unique (session_id, seq)
);

create index events_session_ts_idx on public.events (session_id, client_ts);
create index events_type_idx on public.events (event_type);

-- Facilitator commands ("move to Name Greeter", "move to end"), picked up by
-- students' screens when they poll. A period-wide command has no session_id.
create table public.commands (
  id            bigint generated always as identity primary key,
  session_id    uuid references public.sessions (id) on delete restrict,
  class_period  text,
  command       text not null check (command in ('to_name_greeter', 'to_end')),
  issued_by     text not null,
  issued_at     timestamptz not null default now(),
  check (session_id is not null or class_period is not null)
);

create index commands_issued_at_idx on public.commands (issued_at);

alter table public.students enable row level security;
alter table public.sessions enable row level security;
alter table public.events enable row level security;
alter table public.commands enable row level security;

revoke all on public.students, public.sessions, public.events, public.commands from anon, authenticated;
