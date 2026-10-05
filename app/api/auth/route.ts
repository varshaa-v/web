import { createSupabaseServerClient, dashboardPath, hasSupabaseConfig, isUserRole } from "@/lib/supabase";

type AuthRequest = {
  mode?: unknown;
  email?: unknown;
  password?: unknown;
  fullName?: unknown;
};

export async function POST(request: Request) {
  if (!hasSupabaseConfig) {
    return Response.json({ error: "Supabase is not configured. Add the project URL and anon key." }, { status: 503 });
  }

  let body: AuthRequest;
  try {
    body = await request.json() as AuthRequest;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (body.mode === "signup") {
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    if (!fullName || fullName.length > 120 || !email || password.length < 8) {
      return Response.json({ error: "Enter your name, a valid email, and a password with at least 8 characters." }, { status: 400 });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (!data.session) {
      return Response.json({
        error: "Account created, but Supabase did not start a session. Turn off email confirmation in Supabase Authentication settings, then sign in.",
      }, { status: 409 });
    }

    return Response.json({ redirectTo: "/student" });
  }

  if (body.mode !== "login" || !email || !password) {
    return Response.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return Response.json({ error: signInError.message }, { status: 401 });
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", signInData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || !isUserRole(profile.role)) {
      await supabase.auth.signOut();
      return Response.json({ error: "This account has no valid QueueLess profile. Ask an administrator to set it up." }, { status: 403 });
    }

    return Response.json({ redirectTo: dashboardPath(profile.role) });
  } catch (error) {
    console.error("Unable to load the signed-in user's profile.", error);
    await supabase.auth.signOut();
    return Response.json({ error: "Your account profile could not be loaded. Please try again." }, { status: 500 });
  }
}
