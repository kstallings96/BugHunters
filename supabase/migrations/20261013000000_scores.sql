-- Leaderboard: one row per session. Nicknames only (made from fixed word
-- lists), never names. Written and read by the server with the service role;
-- like every other table, the public anon key gets no access at all.

create table public.scores (
  session_id   uuid primary key references public.sessions(id),
  nickname     text not null,
  bugs         integer not null check (bugs >= 0),
  class_period text not null,
  day          date not null,
  is_test      boolean not null default false,
  updated_at   timestamptz not null default now()
);

create index scores_board on public.scores (class_period, day);

alter table public.scores enable row level security;
revoke all on public.scores from anon, authenticated;
