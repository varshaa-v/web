import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Unable to sign out.", error);
      return Response.json({ error: "Unable to sign out. Please try again." }, { status: 500 });
    }
  }

  return Response.json({ redirectTo: "/login" });
}
