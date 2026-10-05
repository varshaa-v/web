create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('student', 'staff', 'admin');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.token_status as enum ('WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'CANCELLED', 'SKIPPED');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.user_role not null default 'student',
  student_id text,
  phone text,
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
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

create table if not exists public.counters (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  counter_name text not null,
  counter_number integer not null,
  is_active boolean not null default true,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, counter_number),
  constraint chk_counter_number check (counter_number > 0)
);

create table if not exists public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  counter_id uuid references public.counters (id) on delete set null,
  assigned_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (staff_id, service_id, counter_id)
);

create table if not exists public.queue_tokens (
  id uuid primary key default gen_random_uuid(),
  token_number text not null,
  service_id uuid not null references public.services (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete set null,
  counter_id uuid references public.counters (id) on delete set null,
  status public.token_status not null default 'WAITING',
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

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.simulation_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  arrival_rate numeric(4,2) not null default 12,
  service_rate numeric(4,2) not null default 9,
  service_time_minutes numeric(4,1) not null default 8,
  demand_pattern text not null default 'steady',
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_arrival_rate check (arrival_rate > 0),
  constraint chk_service_rate check (service_rate > 0)
);

create table if not exists public.simulation_results (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.simulation_scenarios (id) on delete cascade,
  run_label text not null,
  avg_wait_minutes numeric(5,2) not null default 0,
  avg_service_minutes numeric(5,2) not null default 0,
  throughput numeric(5,2) not null default 0,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop view if exists public.active_queue_view;

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_counters_service on public.counters (service_id);
create index if not exists idx_staff_assignments_staff on public.staff_assignments (staff_id);
create index if not exists idx_staff_assignments_service on public.staff_assignments (service_id);
create index if not exists idx_queue_service_status on public.queue_tokens (service_id, status, created_at);
create index if not exists idx_queue_student on public.queue_tokens (student_id, status);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id, created_at desc);
create unique index if not exists idx_queue_one_active_token_per_student
  on public.queue_tokens (student_id)
  where student_id is not null and status in ('WAITING', 'CALLED', 'SERVING');

do $$
begin
  if not exists (
    select 1 from public.services group by lower(name) having count(*) > 1
  ) then
    create unique index if not exists idx_services_name_ci on public.services (lower(name));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from public.staff_assignments
    where is_active
    group by staff_id, service_id
    having count(*) > 1
  ) then
    create unique index if not exists idx_staff_one_active_assignment_per_service
      on public.staff_assignments (staff_id, service_id)
      where is_active;
  end if;
end $$;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name, email, role)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1)),
  u.email,
  'student'
from auth.users u
where u.email is not null
on conflict (id) do nothing;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.update_updated_at();
drop trigger if exists services_updated_at on public.services;
create trigger services_updated_at before update on public.services
for each row execute function public.update_updated_at();
drop trigger if exists counters_updated_at on public.counters;
create trigger counters_updated_at before update on public.counters
for each row execute function public.update_updated_at();
drop trigger if exists simulation_scenarios_updated_at on public.simulation_scenarios;
create trigger simulation_scenarios_updated_at before update on public.simulation_scenarios
for each row execute function public.update_updated_at();

create or replace function public.write_queue_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (
      (select auth.uid()),
      'Queue token ' || lower(new.status::text),
      'queue_token',
      new.id,
      jsonb_build_object('from', old.status, 'to', new.status, 'token', new.token_number)
    );
  end if;
  return new;
end;
$$;

create or replace function public.write_service_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active is distinct from new.is_active
    or old.is_accepting_tokens is distinct from new.is_accepting_tokens
    or old.name is distinct from new.name then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (
      (select auth.uid()),
      'Service settings updated',
      'service',
      new.id,
      jsonb_build_object('service', new.name)
    );
  end if;
  return new;
end;
$$;

create or replace function public.write_counter_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_open is distinct from new.is_open or old.is_active is distinct from new.is_active then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (
      (select auth.uid()),
      'Counter settings updated',
      'counter',
      new.id,
      jsonb_build_object('counter', new.counter_name)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists queue_tokens_audit on public.queue_tokens;
create trigger queue_tokens_audit after update on public.queue_tokens
for each row execute function public.write_queue_audit_log();
drop trigger if exists services_audit on public.services;
create trigger services_audit after update on public.services
for each row execute function public.write_service_audit_log();
drop trigger if exists counters_audit on public.counters;
create trigger counters_audit after update on public.counters
for each row execute function public.write_counter_audit_log();

create or replace function public.get_queue_summary()
returns table (
  service_id uuid,
  waiting_count bigint,
  currently_serving text,
  counters_open bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    count(distinct q.id) filter (where q.status = 'WAITING'),
    (select serving.token_number
     from public.queue_tokens serving
     where serving.service_id = s.id and serving.status = 'SERVING'
     order by serving.serving_at nulls last, serving.created_at
     limit 1),
    count(distinct c.id) filter (where c.is_active and c.is_open)
  from public.services s
  left join public.queue_tokens q
    on q.service_id = s.id and q.status in ('WAITING', 'CALLED', 'SERVING')
  left join public.counters c on c.service_id = s.id
  where s.is_active
  group by s.id;
$$;

create or replace function public.refresh_queue_positions(p_service_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with positions as (
    select
      q.id,
      row_number() over (
        order by
          case q.status when 'SERVING' then 0 when 'CALLED' then 1 else 2 end,
          q.created_at,
          q.id
      )::integer as position,
      s.average_service_minutes
    from public.queue_tokens q
    join public.services s on s.id = q.service_id
    where q.service_id = p_service_id
      and q.status in ('WAITING', 'CALLED', 'SERVING')
  )
  update public.queue_tokens q
  set position_number = positions.position,
      estimated_wait_minutes = greatest(
        0,
        round((positions.position - 1) * positions.average_service_minutes)::integer
      )
  from positions
  where q.id = positions.id;
$$;

create or replace function public.refresh_queue_positions_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_queue_positions(new.service_id);
  return new;
end;
$$;

drop trigger if exists queue_positions_after_insert on public.queue_tokens;
create trigger queue_positions_after_insert
after insert on public.queue_tokens
for each row execute function public.refresh_queue_positions_after_change();
drop trigger if exists queue_positions_after_status_change on public.queue_tokens;
create trigger queue_positions_after_status_change
after update of status on public.queue_tokens
for each row when (old.status is distinct from new.status)
execute function public.refresh_queue_positions_after_change();

create or replace function public.join_queue(p_service_id uuid)
returns table (
  token_id uuid,
  token_number text,
  position_number integer,
  estimated_wait_minutes integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_service public.services%rowtype;
  v_sequence bigint;
  v_position integer;
  v_token_number text;
  v_token_id uuid;
  v_wait integer;
begin
  if v_user_id is null or public.current_user_role() is distinct from 'student' then
    raise exception 'Only signed-in students can join a queue.';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id
  for update;

  if not found or not v_service.is_active or not v_service.is_accepting_tokens then
    raise exception 'This service is not accepting queue tokens.';
  end if;

  if exists (
    select 1 from public.queue_tokens q
    where q.student_id = v_user_id and q.status in ('WAITING', 'CALLED', 'SERVING')
  ) then
    raise exception 'You already have an active queue token.';
  end if;

  select count(*) + 1 into v_position
  from public.queue_tokens q
  where q.service_id = p_service_id and q.status in ('WAITING', 'CALLED', 'SERVING');

  select coalesce(max(substring(q.token_number from '[0-9]+$')::bigint), 0) + 1
  into v_sequence
  from public.queue_tokens q
  where q.service_id = p_service_id;

  v_token_number :=
    left(regexp_replace(upper(v_service.name), '[^A-Z]', '', 'g'), 1)
    || lpad(v_sequence::text, 3, '0');
  v_wait := greatest(0, round((v_position - 1) * v_service.average_service_minutes)::integer);

  insert into public.queue_tokens (
    token_number, service_id, student_id, status, position_number, estimated_wait_minutes
  )
  values (v_token_number, p_service_id, v_user_id, 'WAITING', v_position, v_wait)
  returning id into v_token_id;

  return query select v_token_id, v_token_number, v_position, v_wait;
end;
$$;

create or replace function public.cancel_queue_token(p_token_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.queue_tokens q
  set status = 'CANCELLED', cancelled_at = now()
  where q.id = p_token_id
    and q.student_id = (select auth.uid())
    and q.status = 'WAITING';

  if not found then
    raise exception 'Only your waiting token can be cancelled.';
  end if;
  return true;
end;
$$;

create or replace function public.manage_queue_token(p_token_id uuid, p_action text)
returns public.token_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_token public.queue_tokens%rowtype;
  v_new_status public.token_status;
  v_counter_id uuid;
begin
  if v_role is null or v_role not in ('staff', 'admin') then
    raise exception 'Only staff and admins can manage queue tokens.';
  end if;

  select * into v_token
  from public.queue_tokens q
  where q.id = p_token_id
  for update;
  if not found then
    raise exception 'Queue token not found.';
  end if;

  if v_role = 'staff' then
    select sa.counter_id into v_counter_id
    from public.staff_assignments sa
    where sa.staff_id = (select auth.uid())
      and sa.service_id = v_token.service_id
      and sa.is_active
    order by sa.assigned_at
    limit 1;
    if not found then
      raise exception 'You are not assigned to this service.';
    end if;
  end if;

  if p_action = 'call' and v_token.status = 'WAITING' then
    v_new_status := 'CALLED';
    update public.queue_tokens q
    set status = v_new_status, called_at = now(),
        counter_id = coalesce(v_counter_id, q.counter_id)
    where q.id = p_token_id;
  elsif p_action = 'start' and v_token.status = 'CALLED' then
    if exists (
      select 1 from public.queue_tokens q
      where q.service_id = v_token.service_id
        and q.status = 'SERVING'
        and q.id <> p_token_id
        and (
          (v_role = 'staff' and (v_counter_id is null or q.counter_id is not distinct from v_counter_id))
          or (v_role = 'admin' and (v_token.counter_id is null or q.counter_id is not distinct from v_token.counter_id))
        )
    ) then
      raise exception 'A token is already being served at this counter.';
    end if;
    v_new_status := 'SERVING';
    update public.queue_tokens q
    set status = v_new_status, serving_at = now()
    where q.id = p_token_id;
  elsif p_action = 'recall' and v_token.status = 'CALLED' then
    update public.queue_tokens q set called_at = now() where q.id = p_token_id;
    return v_token.status;
  elsif p_action = 'complete' and v_token.status = 'SERVING' then
    v_new_status := 'COMPLETED';
    update public.queue_tokens q set status = v_new_status, completed_at = now()
    where q.id = p_token_id;
  elsif p_action = 'skip' and v_token.status = 'SERVING' then
    v_new_status := 'SKIPPED';
    update public.queue_tokens q set status = v_new_status, skipped_at = now()
    where q.id = p_token_id;
  else
    raise exception 'That action is not valid for this token status.';
  end if;

  return v_new_status;
end;
$$;

create or replace function public.set_staff_counter_open(p_counter_id uuid, p_is_open boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() is distinct from 'staff' then
    raise exception 'Only staff can change their assigned counter status.';
  end if;
  update public.counters c
  set is_open = p_is_open
  where c.id = p_counter_id
    and exists (
      select 1 from public.staff_assignments sa
      where sa.counter_id = c.id
        and sa.staff_id = (select auth.uid())
        and sa.is_active
    );
  if not found then
    raise exception 'You are not assigned to this counter.';
  end if;
  return true;
end;
$$;

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.counters enable row level security;
alter table public.staff_assignments enable row level security;
alter table public.queue_tokens enable row level security;
alter table public.audit_logs enable row level security;
alter table public.simulation_scenarios enable row level security;
alter table public.simulation_results enable row level security;

drop policy if exists "Profiles are viewable by their owner or admin" on public.profiles;
create policy "Profiles are viewable by their owner or admin" on public.profiles
for select to authenticated using (id = (select auth.uid()) or (select public.current_user_role()) = 'admin');
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()) and role = (select public.current_user_role()));
drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles" on public.profiles
for all to authenticated using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

drop policy if exists "Authenticated users can read services" on public.services;
drop policy if exists "Public read for active service catalog" on public.services;
create policy "Authenticated users can read services" on public.services
for select to authenticated using (true);
drop policy if exists "Admins manage services" on public.services;
create policy "Admins manage services" on public.services
for all to authenticated using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

drop policy if exists "Assigned staff and admins can see counters" on public.counters;
create policy "Assigned staff and admins can see counters" on public.counters
for select to authenticated using (
  (select public.current_user_role()) = 'admin'
  or exists (
    select 1 from public.staff_assignments sa
    where sa.counter_id = counters.id and sa.staff_id = (select auth.uid()) and sa.is_active
  )
);
drop policy if exists "Admins manage counters" on public.counters;
create policy "Admins manage counters" on public.counters
for all to authenticated using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

drop policy if exists "Staff can read own assignments" on public.staff_assignments;
create policy "Staff can read own assignments" on public.staff_assignments
for select to authenticated using (
  staff_id = (select auth.uid()) or (select public.current_user_role()) = 'admin'
);
drop policy if exists "Admins manage assignments" on public.staff_assignments;
create policy "Admins manage assignments" on public.staff_assignments
for all to authenticated using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

drop policy if exists "Users can read authorized queue tokens" on public.queue_tokens;
drop policy if exists "Students can access own queue tokens" on public.queue_tokens;
drop policy if exists "Staff manage assigned service queues" on public.queue_tokens;
drop policy if exists "Students can insert their own tokens" on public.queue_tokens;
create policy "Users can read authorized queue tokens" on public.queue_tokens
for select to authenticated using (
  student_id = (select auth.uid())
  or (select public.current_user_role()) = 'admin'
  or (
    (select public.current_user_role()) = 'staff'
    and exists (
      select 1 from public.staff_assignments sa
      where sa.staff_id = (select auth.uid())
        and sa.service_id = queue_tokens.service_id
        and sa.is_active
    )
  )
);
drop policy if exists "Admins manage queue tokens" on public.queue_tokens;
create policy "Admins manage queue tokens" on public.queue_tokens
for all to authenticated using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

drop policy if exists "Admins read audit logs" on public.audit_logs;
drop policy if exists "Admins manage audit logs" on public.audit_logs;
create policy "Admins read audit logs" on public.audit_logs
for select to authenticated using ((select public.current_user_role()) = 'admin');
drop policy if exists "Public read of active simulation scenarios" on public.simulation_scenarios;
create policy "Public read of active simulation scenarios" on public.simulation_scenarios
for select to authenticated using (is_active);
drop policy if exists "Admins manage simulation scenarios" on public.simulation_scenarios;
create policy "Admins manage simulation scenarios" on public.simulation_scenarios
for all to authenticated using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');
drop policy if exists "Admins read simulation results" on public.simulation_results;
drop policy if exists "Admins manage simulation results" on public.simulation_results;
create policy "Admins manage simulation results" on public.simulation_results
for all to authenticated using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.get_queue_summary() from public, anon;
revoke all on function public.refresh_queue_positions(uuid) from public, anon;
grant execute on function public.get_queue_summary() to authenticated;
grant execute on function public.current_user_role() to authenticated;
revoke all on function public.join_queue(uuid) from public, anon;
revoke all on function public.cancel_queue_token(uuid) from public, anon;
revoke all on function public.manage_queue_token(uuid, text) from public, anon;
grant execute on function public.join_queue(uuid) to authenticated;
grant execute on function public.cancel_queue_token(uuid) to authenticated;
grant execute on function public.manage_queue_token(uuid, text) to authenticated;
revoke all on function public.set_staff_counter_open(uuid, boolean) from public, anon;
grant execute on function public.set_staff_counter_open(uuid, boolean) to authenticated;

insert into public.services (name, description, average_service_minutes, is_active, is_accepting_tokens)
select seed.name, seed.description, seed.average_service_minutes, seed.is_active, seed.is_accepting_tokens
from (values
  ('Accounts', 'Fee, payment, and student ledger support', 6::numeric, true, true),
  ('Certificates', 'Degree and transcript certificate requests', 8::numeric, true, true),
  ('General Enquiries', 'General information and office guidance', 5::numeric, true, true),
  ('Scholarship', 'Scholarship and financial aid assistance', 10::numeric, true, true),
  ('Bonafide Certificate', 'ID and bonafide certificate issuance', 7::numeric, true, false)
) as seed(name, description, average_service_minutes, is_active, is_accepting_tokens)
where not exists (select 1 from public.services existing where lower(existing.name) = lower(seed.name));

insert into public.counters (service_id, counter_name, counter_number, is_active, is_open)
select s.id, 'Counter 1', 1, true, true
from public.services s
where not exists (
  select 1 from public.counters c where c.service_id = s.id and c.counter_number = 1
);

insert into public.simulation_scenarios (name, description, arrival_rate, service_rate, service_time_minutes, demand_pattern, is_active)
select 'Morning peak', 'High-demand morning registration scenario', 18, 12, 9.0, 'peak', true
where not exists (select 1 from public.simulation_scenarios where name = 'Morning peak');
insert into public.simulation_scenarios (name, description, arrival_rate, service_rate, service_time_minutes, demand_pattern, is_active)
select 'Steady state', 'Consistent office workflow during the day', 12, 9, 8.0, 'steady', true
where not exists (select 1 from public.simulation_scenarios where name = 'Steady state');
insert into public.simulation_scenarios (name, description, arrival_rate, service_rate, service_time_minutes, demand_pattern, is_active)
select 'Evening low load', 'Short afternoon queue with reduced student demand', 7, 6, 6.5, 'low', false
where not exists (select 1 from public.simulation_scenarios where name = 'Evening low load');
