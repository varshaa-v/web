import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, dashboardPath, getUserContext } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login?error=configuration", request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Unable to complete the Supabase auth callback.", error);
    return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
  }

  const context = await getUserContext();
  return NextResponse.redirect(
    new URL(context ? dashboardPath(context.role) : "/login?error=profile", request.url),
  );
}
