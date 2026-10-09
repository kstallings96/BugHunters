-- bugHunters: one row per play session, plus an append-only event log.
--
-- Every write goes through the app's server routes with the service role key.
-- RLS is enabled with no policies and anon/authenticated have no grants, so
-- the public anon key can neither read nor write anything here.
--
-- sessions holds the only identifying data about a student (first name and
-- last initial). Nothing else in the schema should copy them.

create table public.sessions (
  id                    uuid primary key default gen_random_uuid(),
  first_name            text not null check (char_length(first_name) between 1 and 40),
  last_initial          text not null check (char_length(last_initial) = 1),
  is_test               boolean not null default false,
  form                  text not null check (form in ('A', 'B')),
  condition             text not null check (condition in ('ai_checker', 'no_checker')),
  -- How form and condition were chosen: 'random', 'url' (forced by a
  -- parameter) or 'default'. Forced sessions should not be pooled with
  -- randomized ones when comparing conditions.
  form_assignment       text not null check (form_assignment in ('random', 'url', 'default')),
  condition_assignment  text not null check (condition_assignment in ('random', 'url', 'default')),
  app_version           text not null,
  config_version        text not null,
  started_at            timestamptz not null default now(),
  -- Set by the server when the session_end event arrives.
  ended_at              timestamptz,
  -- Set by the server when a done event reports the hunt hit its time cap.
  hunt_capped           boolean not null default false,
  user_agent            text,
  screen_width          integer,
  screen_height         integer,
  viewport_width        integer,
  viewport_height       integer
);

create index sessions_started_at_idx on public.sessions (started_at);

create table public.events (
  id          bigint generated always as identity primary key,
  -- restrict, not cascade: deleting a session must never silently take its
  -- events with it.
  session_id  uuid not null references public.sessions (id) on delete restrict,
  -- Per-session counter assigned by the client. The unique constraint makes
  -- resending a batch (retry, page-hide beacon, reload) idempotent.
  seq         integer not null check (seq > 0),
  client_ts   timestamptz not null,
  server_ts   timestamptz not null default now(),
  step        text not null,
  event_type  text not null,
  payload     jsonb not null default '{}'::jsonb,
  unique (session_id, seq)
);

create index events_session_ts_idx on public.events (session_id, client_ts);
create index events_type_idx on public.events (event_type);

alter table public.sessions enable row level security;
alter table public.events enable row level security;

revoke all on public.sessions from anon, authenticated;
revoke all on public.events from anon, authenticated;
