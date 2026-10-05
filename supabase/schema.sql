create extension if not exists pgcrypto;

create type user_role as enum ('student', 'staff', 'admin');
create type token_status as enum ('WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'CANCELLED', 'SKIPPED');

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role user_role not null default 'student',
  student_id text,
  phone text,
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on profiles (role);
create index if not exists idx_profiles_email on profiles (email);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  average_service_minutes numeric(4,1) not null default 8,
  is_active boolean not null default true,
  is_accepting_tokens boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_average_service_minutes check (average_service_minutes > 0)
);

create index if not exists idx_services_active on services (is_active, is_accepting_tokens);

create table if not exists counters (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services (id) on delete cascade,
  counter_name text not null,
  counter_number integer not null,
  is_active boolean not null default true,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, counter_number),
  constraint chk_counter_number check (counter_number > 0)
);

create index if not exists idx_counters_service on counters (service_id);

create table if not exists staff_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id) on delete cascade,
  service_id uuid not null references services (id) on delete cascade,
  counter_id uuid references counters (id) on delete set null,
  assigned_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (staff_id, service_id, counter_id)
);

create index if not exists idx_staff_assignments_staff on staff_assignments (staff_id);
create index if not exists idx_staff_assignments_service on staff_assignments (service_id);

create table if not exists queue_tokens (
  id uuid primary key default gen_random_uuid(),
  token_number text not null,
  service_id uuid not null references services (id) on delete cascade,
  student_id uuid references profiles (id) on delete set null,
  counter_id uuid references counters (id) on delete set null,
  status token_status not null default 'WAITING',
  position_number integer,
  estimated_wait_minutes integer,
  created_at timestamptz not null default now(),
  called_at timestamptz,
  serving_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  skipped_at timestamptz,
  skip_reason text,
  unique (token_number, service_id),
  constraint chk_position check (position_number is null or position_number > 0),
  constraint chk_estimated_wait check (estimated_wait_minutes is null or estimated_wait_minutes >= 0)
);

create index if not exists idx_queue_service_status on queue_tokens (service_id, status, created_at);
create index if not exists idx_queue_student on queue_tokens (student_id, status);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity on audit_logs (entity_type, entity_id, created_at desc);

create table if not exists simulation_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  arrival_rate numeric(4,2) not null default 12,
  service_rate numeric(4,2) not null default 9,
  service_time_minutes numeric(4,1) not null default 8,
  demand_pattern text not null default 'steady',
  is_active boolean not null default true,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_arrival_rate check (arrival_rate > 0),
  constraint chk_service_rate check (service_rate > 0)
);

create table if not exists simulation_results (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references simulation_scenarios (id) on delete cascade,
  run_label text not null,
  avg_wait_minutes numeric(5,2) not null default 0,
  avg_service_minutes numeric(5,2) not null default 0,
  throughput numeric(5,2) not null default 0,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
before update on profiles
for each row execute function public.update_updated_at();

create trigger services_updated_at
before update on services
for each row execute function public.update_updated_at();

create trigger counters_updated_at
before update on counters
for each row execute function public.update_updated_at();

create trigger simulation_scenarios_updated_at
before update on simulation_scenarios
for each row execute function public.update_updated_at();

alter table profiles enable row level security;
alter table services enable row level security;
alter table counters enable row level security;
alter table staff_assignments enable row level security;
alter table queue_tokens enable row level security;
alter table audit_logs enable row level security;
alter table simulation_scenarios enable row level security;
alter table simulation_results enable row level security;

create policy "Profiles are viewable by their owner or admin" on profiles
for select using (
  auth.uid() = id or exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Users can update their own profile" on profiles
for update using (auth.uid() = id);

create policy "Admins can manage profiles" on profiles
for all using (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Public read for active service catalog" on services
for select using (is_active = true);

create policy "Admins manage services" on services
for all using (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Assigned staff and admins can see counters" on counters
for select using (
  is_active = true and (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    ) or exists (
      select 1 from staff_assignments sa
      join profiles pr on pr.id = sa.staff_id
      where sa.counter_id = counters.id and sa.is_active = true and pr.id = auth.uid()
    )
  )
);

create policy "Admins manage counters" on counters
for all using (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Staff can read own assignments" on staff_assignments
for select using (
  staff_id = auth.uid() or exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins manage assignments" on staff_assignments
for all using (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Students can access own queue tokens" on queue_tokens
for select using (student_id = auth.uid() or exists (
  select 1 from profiles p where p.id = auth.uid() and p.role in ('staff', 'admin')
));

create policy "Staff manage assigned service queues" on queue_tokens
for update using (
  exists (
    select 1 from staff_assignments sa
    join profiles pr on pr.id = sa.staff_id
    where sa.service_id = queue_tokens.service_id and sa.is_active = true and pr.id = auth.uid()
  ) or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "Students can insert their own tokens" on queue_tokens
for insert with check (
  student_id = auth.uid() and status = 'WAITING'
);

create policy "Admins manage queue tokens" on queue_tokens
for all using (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins read audit logs" on audit_logs
for select using (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins manage audit logs" on audit_logs
for insert with check (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Public read of active simulation scenarios" on simulation_scenarios
for select using (is_active = true);

create policy "Admins manage simulation scenarios" on simulation_scenarios
for all using (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins read simulation results" on simulation_results
for select using (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins manage simulation results" on simulation_results
for all using (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create or replace view public.active_queue_view as
select
  qt.id,
  qt.token_number,
  s.name as service_name,
  qt.status,
  qt.position_number,
  qt.estimated_wait_minutes,
  qt.created_at
from queue_tokens qt
join services s on s.id = qt.service_id
where qt.status in ('WAITING', 'CALLED', 'SERVING');

insert into services (name, description, average_service_minutes, is_active, is_accepting_tokens)
values
  ('Accounts', 'Fee, payment, and student ledger support', 6, true, true),
  ('Certificates', 'Degree and transcript certificate requests', 8, true, true),
  ('General Enquiries', 'General information and office guidance', 5, true, true),
  ('Scholarship', 'Scholarship and financial aid assistance', 10, true, true),
  ('Bonafide Certificate', 'ID and bonafide certificate issuance', 7, true, false)
on conflict do nothing;

insert into simulation_scenarios (name, description, arrival_rate, service_rate, service_time_minutes, demand_pattern, is_active)
values
  ('Morning peak', 'High-demand morning registration scenario', 18, 12, 9.0, 'peak', true),
  ('Steady state', 'Consistent office workflow during the day', 12, 9, 8.0, 'steady', true),
  ('Evening low load', 'Short afternoon queue with reduced student demand', 7, 6, 6.5, 'low', false)
on conflict do nothing;
