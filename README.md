# QueueLess

QueueLess is a role-based queue management app for college administrative offices. Students can join and track service queues, staff can call and serve tokens for assigned counters, and admins can manage services, counters, and staff assignments.

## Stack

- Next.js App Router, TypeScript, and React
- Supabase Auth and PostgreSQL with Row Level Security
- Vercel deployment

## Run locally

1. Install the dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and set the Supabase values described below.
3. Start the app:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`.

## Supabase setup

1. Create a Supabase project.
2. In **Project Settings → API**, copy the project URL and the publishable/anon key. Put them in `.env.local`:
   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_OR_ANON_KEY
   ```
   This app does not need a service-role key. Never expose one to the browser or add it as a `NEXT_PUBLIC_` variable.
3. In **Authentication → Providers → Email** (or the email settings under **Authentication → Sign In / Providers**), enable Email and turn off **Confirm email**. This lets new students register and sign in immediately without verifying their email. If you already registered an unconfirmed account, confirm it in **Authentication → Users** or remove it and register again after disabling confirmation.
4. In the Supabase **SQL Editor**, run `supabase/schema.sql`. It creates the tables, RLS policies, profile creation trigger, queue RPCs, and starter services/counters. It also creates student profiles for existing email-based Auth users that do not have a profile yet.
5. Register a student through the app. New Auth users automatically get a `student` profile.
6. To provision staff and the first admin:
   - Create each account in **Authentication → Users** (or register it through the app).
   - In the SQL Editor, promote those users by email. Replace the example addresses:
     ```sql
     update public.profiles set role = 'staff'
     where email = 'staff@your-college.edu';

     update public.profiles set role = 'admin'
     where email = 'admin@your-college.edu';
     ```
   - Sign in with the admin account, then use **Staff assignments** on the admin dashboard to grant staff service/counter access.

The dashboard data and queue actions require the schema to be installed. Until the project URL/key and schema are configured, the app will show setup or connection errors rather than demo queue data.

## Deploy to Vercel

1. Push the repository to GitHub and import it into Vercel. Keep the root directory at the repository root; use the default Next.js build settings (`npm run build`).
2. Add these environment variables in **Project Settings → Environment Variables** for Production (and Preview/Development if those environments will be used):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Set the Supabase site URL to the production domain in **Authentication → URL Configuration**. Email callback redirect URLs are not needed when **Confirm email** is off.
4. Redeploy after changing environment variables. `NEXT_PUBLIC_` values are incorporated during the build.

## Security model

- Supabase Auth sessions are refreshed through the Next.js `proxy.ts` handler.
- Server-rendered dashboard pages and API handlers verify the authenticated user and profile role.
- RLS limits profile, queue, assignment, and audit access by role.
- Security-definer database functions validate the caller before queue creation, cancellation, staff actions, and counter changes.
- Public frontend configuration uses only the Supabase project URL and publishable/anon key; privileged actions do not use a service-role key.
