import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

export type UserRole = "student" | "staff" | "admin";
export function isUserRole(role: unknown): role is UserRole {
  return role === "student" || role === "staff" || role === "admin";
}

export type UserContext = {
  user: User;
  role: UserRole;
  fullName: string;
};

export const hasSupabaseConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export function createSupabaseBrowserClient() {
  if (!hasSupabaseConfig) {
    return null;
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function createSupabaseServerClient() {
  if (!hasSupabaseConfig) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Server components cannot write cookies; proxy.ts refreshes sessions on requests.
            }
          }
        },
      },
    },
  );
}

export async function getUserContext(): Promise<UserContext | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }
  if (!user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }
  if (!profile || !isUserRole(profile.role)) {
    return null;
  }

  return {
    user,
    role: profile.role,
    fullName: profile.full_name,
  };
}

export function dashboardPath(role: UserRole) {
  return `/${role}`;
}
