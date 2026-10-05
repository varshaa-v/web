# QueueLess — Intelligent Queue Management System

QueueLess is a Next.js + TypeScript academic project for managing student queues in a college administrative office. It focuses on digital queue registration, service monitoring, staff workflows, and queue analytics. The app is designed to run locally in VS Code and deploy directly to Vercel.

## Features

- Student queue registration and tracking
- Staff counter management and queue calling workflow
- Admin dashboard with service and counter controls
- Purple/black premium UI theme
- Supabase Auth, PostgreSQL database, and RLS integration
- Queue simulation and reporting tools
- Responsive desktop, tablet, and mobile layout

## Tech stack

- Next.js App Router
- TypeScript
- React
- Supabase PostgreSQL and Auth
- Vercel deployment
- CSS for custom visual design

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the example environment file:
   ```bash
   copy .env.example .env.local
   ```
3. Update values in `.env.local` with your Supabase credentials.
4. Run the project:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000`

## Supabase setup

1. Create a new Supabase project.
2. In the SQL editor, run the contents of `supabase/schema.sql`.
3. Enable `Email` authentication in Supabase Auth.
4. Add these environment variables in your app settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL`

## Seed users and demo accounts

Use Supabase Auth to create demo users. Suggested roles:

- Student: `student@queueless.demo` / `Student123!`
- Staff: `staff@queueless.demo` / `Staff123!`
- Admin: `admin@queueless.demo` / `Admin123!`

Then insert matching rows into `profiles` with the correct role:

```sql
insert into profiles (id, full_name, email, role, student_id, department)
values
  ('<auth-user-id-for-student>', 'Aanya Verma', 'student@queueless.demo', 'student', 'CS2023001', 'Computer Science'),
  ('<auth-user-id-for-staff>', 'Rohan Mehta', 'staff@queueless.demo', 'staff', null, 'Administration'),
  ('<auth-user-id-for-admin>', 'Nisha Kapoor', 'admin@queueless.demo', 'admin', null, 'Office Administration');
```

## Supabase RLS notes

The provided SQL config includes Row Level Security policies for student, staff, and admin roles. Do not expose service-role keys in the browser. Use server-side logic or Supabase Edge Functions for privileged operations.

## Deployment on Vercel

1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Add the same environment variables used in `.env.local`.
4. Set the root directory to the repository root.
5. Deploy the app.

## Project structure

- `app/` – App Router pages and API routes
- `lib/` – Supabase helper utilities
- `supabase/` – SQL schema and seed definitions
- `public/` – Static assets

## Academic explanation

This project demonstrates queue optimization for college administrative services by reducing unnecessary physical waiting. Students can join a digital queue, monitor their token progress, and receive estimated wait time. Staff can more efficiently manage counters and service capacity. Admins can optimize staffing and monitor performance analytics.

## Important security guidelines

- Do not reveal the service role key in frontend code.
- Validate the authenticated user and role on the server before performing privileged actions.
- Use RLS policies to prevent cross-role data access.
- Never trust client-side queue position or role values for critical queue operations.
