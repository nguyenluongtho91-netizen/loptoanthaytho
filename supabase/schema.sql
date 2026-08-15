-- ============================================================
-- EduCenter – Supabase Schema
-- Paste vào: Supabase Dashboard → SQL Editor → Run
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── Profiles (gắn với auth.users) ──────────────────────────
create table if not exists profiles (
  id       uuid references auth.users primary key,
  email    text unique not null,
  name     text,
  role     text check (role in ('ADMIN','TEACHER','TA')) default 'TEACHER',
  active   boolean default true,
  created_at timestamptz default now()
);

-- Tự tạo profile khi user đăng ký
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'name', 'TEACHER');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Students ────────────────────────────────────────────────
create table if not exists students (
  id           uuid default uuid_generate_v4() primary key,
  student_code text unique not null,
  full_name    text not null,
  parent_name  text,
  parent_phone text,
  zalo         text,
  email        text,
  school       text,
  grade        text,
  address      text,
  note         text,
  status       text default 'active',
  created_at   timestamptz default now()
);

-- ── Classes ─────────────────────────────────────────────────
create table if not exists classes (
  id               uuid default uuid_generate_v4() primary key,
  class_name       text not null,
  subject          text default 'Toán',
  grade            text,
  fee_per_session  numeric default 0,
  planned_sessions integer default 0,
  start_date       date,
  max_students     integer default 30,
  room             text,
  school           text,
  schedule         text,
  note             text,
  status           text default 'active',
  created_at       timestamptz default now()
);

-- ── Teacher–Class mapping ───────────────────────────────────
create table if not exists teacher_classes (
  id            uuid default uuid_generate_v4() primary key,
  teacher_id    uuid references profiles(id) on delete cascade,
  class_id      uuid references classes(id) on delete cascade,
  assigned_date date default current_date,
  status        text default 'active',
  unique(teacher_id, class_id)
);

-- ── Enrollments ─────────────────────────────────────────────
create table if not exists enrollments (
  id          uuid default uuid_generate_v4() primary key,
  student_id  uuid references students(id) on delete cascade,
  class_id    uuid references classes(id) on delete cascade,
  enroll_date date default current_date,
  status      text default 'active',
  note        text,
  unique(student_id, class_id)
);

-- ── Attendance ──────────────────────────────────────────────
create table if not exists attendance (
  id         uuid default uuid_generate_v4() primary key,
  date       date not null,
  class_id   uuid references classes(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  present    boolean default false,
  late       boolean default false,
  note       text,
  by_user    uuid references profiles(id),
  created_at timestamptz default now(),
  unique(date, class_id, student_id)
);

-- ── Payments ────────────────────────────────────────────────
create table if not exists payments (
  id         uuid default uuid_generate_v4() primary key,
  date       date default current_date,
  student_id uuid references students(id) on delete cascade,
  class_id   uuid references classes(id) on delete cascade,
  amount     numeric not null,
  method     text default 'cash',
  note       text,
  by_user    uuid references profiles(id),
  created_at timestamptz default now()
);

-- ── Email Logs ──────────────────────────────────────────────
create table if not exists email_logs (
  id              uuid default uuid_generate_v4() primary key,
  type            text, -- 'tuition' | 'attendance' | 'payment_confirm'
  recipient_email text,
  student_id      uuid references students(id),
  class_id        uuid references classes(id),
  subject         text,
  status          text, -- 'sent' | 'failed'
  error_msg       text,
  by_user         uuid references profiles(id),
  created_at      timestamptz default now()
);

-- ── Row Level Security ──────────────────────────────────────
alter table profiles   enable row level security;
alter table students   enable row level security;
alter table classes    enable row level security;
alter table enrollments enable row level security;
alter table attendance enable row level security;
alter table payments   enable row level security;
alter table email_logs enable row level security;
alter table teacher_classes enable row level security;

-- All authenticated users can read
create policy "auth read profiles"   on profiles   for select using (auth.role() = 'authenticated');
create policy "auth read students"   on students   for select using (auth.role() = 'authenticated');
create policy "auth read classes"    on classes    for select using (auth.role() = 'authenticated');
create policy "auth read enrollments" on enrollments for select using (auth.role() = 'authenticated');
create policy "auth read attendance" on attendance  for select using (auth.role() = 'authenticated');
create policy "auth read payments"   on payments    for select using (auth.role() = 'authenticated');
create policy "auth read email_logs" on email_logs  for select using (auth.role() = 'authenticated');
create policy "auth read tc"         on teacher_classes for select using (auth.role() = 'authenticated');

-- All authenticated users can write (role-based access enforced in app layer)
create policy "auth write students"  on students   for all using (auth.role() = 'authenticated');
create policy "auth write classes"   on classes    for all using (auth.role() = 'authenticated');
create policy "auth write enrollments" on enrollments for all using (auth.role() = 'authenticated');
create policy "auth write attendance" on attendance for all using (auth.role() = 'authenticated');
create policy "auth write payments"  on payments   for all using (auth.role() = 'authenticated');
create policy "auth write email_logs" on email_logs for all using (auth.role() = 'authenticated');
create policy "auth write tc"        on teacher_classes for all using (auth.role() = 'authenticated');
create policy "auth write profiles"  on profiles   for update using (auth.uid() = id);

-- ── Sample data ─────────────────────────────────────────────
-- Thêm admin thủ công sau khi tạo tài khoản:
-- UPDATE profiles SET role = 'ADMIN' WHERE email = 'admin@example.com';

-- ── Tuition Notifications ────────────────────────────────────────────────────
create table if not exists tuition_notifications (
  id          uuid default uuid_generate_v4() primary key,
  student_id  uuid references students(id) on delete cascade,
  class_id    uuid references classes(id) on delete cascade,
  course_name text not null,
  amount      numeric not null,
  is_paid     boolean default false,
  created_at  timestamptz default now(),
  unique(student_id, class_id, course_name)
);

alter table tuition_notifications enable row level security;

create policy "Allow read tuition_notifications" on tuition_notifications
  for select using (true);

create policy "Allow write tuition_notifications" on tuition_notifications
  for all using (auth.role() = 'authenticated');
