-- Students sign in with the student code on their card instead of a class period.
alter table public.students add column if not exists student_code text;
alter table public.students alter column class_period drop not null;
create index if not exists students_code_idx on public.students (student_code, lower(first_name), upper(last_initial));
alter table public.scores alter column class_period drop not null;
