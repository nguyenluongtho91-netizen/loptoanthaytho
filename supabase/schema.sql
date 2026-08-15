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
  insert into public.profiles (id, email, name, role)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 
    'TEACHER'
  );
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
  date_of_birth date,
  password     text,
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
  teacher_id       uuid references profiles(id) on delete set null,
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
create policy "auth read students"   on students   for select using (true);
create policy "auth read classes"    on classes    for select using (true);
create policy "auth read enrollments" on enrollments for select using (true);
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

-- ============================================================
-- ── LMS Tables (Bổ sung cho Thi cử & Học tập) ────────────────
-- ============================================================

-- ── Exams ───────────────────────────────────────────────────
create table if not exists exams (
  id         uuid default uuid_generate_v4() primary key,
  title      text not null,
  data       jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- ── Exam Rooms ──────────────────────────────────────────────
create table if not exists exam_rooms (
  id         uuid default uuid_generate_v4() primary key,
  code       text unique not null,
  exam_id    uuid references exams(id) on delete cascade,
  class_id   uuid references classes(id) on delete set null,
  teacher_id uuid references profiles(id) on delete set null,
  status     text default 'waiting' check (status in ('waiting', 'active', 'closed')),
  time_limit integer default 60,
  settings   jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ── Exam Submissions ────────────────────────────────────────
create table if not exists exam_submissions (
  id                  uuid default uuid_generate_v4() primary key,
  room_id             uuid references exam_rooms(id) on delete cascade,
  student_id          uuid references students(id) on delete cascade,
  status              text default 'in_progress' check (status in ('in_progress', 'submitted')),
  answers             jsonb default '{}'::jsonb,
  score               numeric default 0,
  score_breakdown     jsonb default '{}'::jsonb,
  duration            integer default 0,
  tab_switches        integer default 0,
  tab_switch_warnings jsonb default '[]'::jsonb,
  submitted_at        timestamptz,
  created_at          timestamptz default now(),
  unique(room_id, student_id)
);

-- ── Courses ─────────────────────────────────────────────────
create table if not exists courses (
  id                 uuid default uuid_generate_v4() primary key,
  title              text not null,
  description        text,
  teacher_id         uuid references profiles(id) on delete set null,
  is_published       boolean default false,
  assigned_class_ids text[] default array[]::text[],
  created_at         timestamptz default now()
);

-- ── Chapters ────────────────────────────────────────────────
create table if not exists chapters (
  id          uuid default uuid_generate_v4() primary key,
  course_id   uuid references courses(id) on delete cascade,
  title       text not null,
  order_index integer default 1,
  created_at  timestamptz default now()
);

-- ── Lessons ─────────────────────────────────────────────────
create table if not exists lessons (
  id                    uuid default uuid_generate_v4() primary key,
  chapter_id            uuid references chapters(id) on delete cascade,
  title                 text not null,
  order_index           integer default 1,
  video_url             text,
  pdf_list              jsonb default '[]'::jsonb,
  pdf_url               text,
  exam_ids              jsonb default '[]'::jsonb,
  exam_id               text,
  interactive_questions jsonb default '[]'::jsonb,
  created_at            timestamptz default now()
);

-- ── Student Progress ────────────────────────────────────────
create table if not exists student_progress (
  student_id    uuid references students(id) on delete cascade,
  lesson_id     uuid references lessons(id) on delete cascade,
  is_passed     boolean default false,
  highest_score numeric default 0,
  created_at    timestamptz default now(),
  primary key (student_id, lesson_id)
);

-- ── RLS for LMS Tables ──────────────────────────────────────
alter table exams enable row level security;
alter table exam_rooms enable row level security;
alter table exam_submissions enable row level security;
alter table courses enable row level security;
alter table chapters enable row level security;
alter table lessons enable row level security;
alter table student_progress enable row level security;

-- Policies for Exams
create policy "Allow read exams" on exams for select using (true);
create policy "Allow write exams" on exams for all using (auth.role() = 'authenticated');

-- Policies for Exam Rooms
create policy "Allow read exam_rooms" on exam_rooms for select using (true);
create policy "Allow write exam_rooms" on exam_rooms for all using (auth.role() = 'authenticated');

-- Policies for Exam Submissions (Học sinh ẩn danh hoặc đăng nhập đều nộp được bài)
create policy "Allow read exam_submissions" on exam_submissions for select using (true);
create policy "Allow insert exam_submissions" on exam_submissions for insert with check (true);
create policy "Allow update exam_submissions" on exam_submissions for update using (true);

-- Policies for Courses
create policy "Allow read courses" on courses for select using (true);
create policy "Allow write courses" on courses for all using (auth.role() = 'authenticated');

-- Policies for Chapters
create policy "Allow read chapters" on chapters for select using (true);
create policy "Allow write chapters" on chapters for all using (auth.role() = 'authenticated');

-- Policies for Lessons
create policy "Allow read lessons" on lessons for select using (true);
create policy "Allow write lessons" on lessons for all using (auth.role() = 'authenticated');

-- Policies for Student Progress
create policy "Allow read student_progress" on student_progress for select using (true);
create policy "Allow write student_progress" on student_progress for all using (true);

