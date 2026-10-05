import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export type UserRole = "student" | "staff" | "admin";

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
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}

export async function getCurrentUserRole(): Promise<UserRole | null> {
  if (!hasSupabaseConfig) {
    return null;
  }

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return null;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    return profile?.role ?? "student";
  } catch {
    return null;
  }
}

export async function requireRole(allowedRoles: UserRole[]) {
  const role = await getCurrentUserRole();

  if (!role || !allowedRoles.includes(role)) {
    return false;
  }

  return true;
}
