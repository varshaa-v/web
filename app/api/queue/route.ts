import { createSupabaseServerClient, getUserContext, hasSupabaseConfig } from "@/lib/supabase";

type QueueMutation = {
  action?: unknown;
  tokenId?: unknown;
  serviceId?: unknown;
  counterId?: unknown;
  isOpen?: unknown;
};

function databaseFailure(error: unknown, message: string) {
  console.error(message, error);
  return Response.json({ error: message }, { status: 500 });
}

async function getContext() {
  try {
    return { context: await getUserContext(), error: null };
  } catch (error) {
    return { context: null, error };
  }
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function GET() {
  if (!hasSupabaseConfig) {
    return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  }
  const { context, error: contextError } = await getContext();
  if (contextError) return databaseFailure(contextError, "Unable to verify your account.");
  if (!context) return Response.json({ error: "Sign in to view queue information." }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  const [
    { data: services, error: servicesError },
    { data: summary, error: summaryError },
  ] = await Promise.all([
    supabase.from("services")
      .select("id, name, description, average_service_minutes, is_active, is_accepting_tokens")
      .order("name"),
    supabase.rpc("get_queue_summary"),
  ]);
  if (servicesError) return databaseFailure(servicesError, "Unable to load services.");
  if (summaryError) return databaseFailure(summaryError, "Unable to load queue totals.");

  if (context.role === "student") {
    const { data: tokens, error: tokenError } = await supabase
      .from("queue_tokens")
      .select("id, token_number, status, position_number, estimated_wait_minutes, created_at, service_id, services(name)")
      .eq("student_id", context.user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (tokenError) return databaseFailure(tokenError, "Unable to load your queue history.");
    return Response.json({
      services: services ?? [],
      summary: summary ?? [],
      tokens: (tokens ?? []).map((token) => ({
        id: token.id,
        token_number: token.token_number,
        status: token.status,
        position_number: token.position_number,
        estimated_wait_minutes: token.estimated_wait_minutes,
        created_at: token.created_at,
        service_id: token.service_id,
        service_name: firstRelation(token.services)?.name ?? "Service",
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const [
    { data: tokens, error: tokenError },
    { count: completedToday, error: completedError },
    { count: skippedToday, error: skippedError },
  ] = await Promise.all([
    supabase
    .from("queue_tokens")
    .select("id, token_number, status, position_number, estimated_wait_minutes, created_at, service_id, services(name), counters(counter_name)")
    .in("status", ["WAITING", "CALLED", "SERVING"])
    .order("created_at", { ascending: true }),
    supabase.from("queue_tokens").select("id", { count: "exact", head: true })
      .eq("status", "COMPLETED").gte("completed_at", todayIso),
    supabase.from("queue_tokens").select("id", { count: "exact", head: true })
      .eq("status", "SKIPPED").gte("skipped_at", todayIso),
  ]);
  if (tokenError) return databaseFailure(tokenError, "Unable to load the staff queue.");
  if (completedError) return databaseFailure(completedError, "Unable to load today's completed queue count.");
  if (skippedError) return databaseFailure(skippedError, "Unable to load today's skipped queue count.");
  const { data: assignments, error: assignmentError } = await supabase
    .from("staff_assignments")
    .select("id, service_id, counter_id, services(name), counters(counter_name, is_open)")
    .eq("staff_id", context.user.id)
    .eq("is_active", true);
  if (assignmentError) return databaseFailure(assignmentError, "Unable to load staff assignments.");

  return Response.json({
    services: services ?? [],
    summary: summary ?? [],
    tokens: (tokens ?? []).map((token) => ({
      id: token.id,
      token_number: token.token_number,
      status: token.status,
      position_number: token.position_number,
      estimated_wait_minutes: token.estimated_wait_minutes,
      created_at: token.created_at,
      service_id: token.service_id,
      service_name: firstRelation(token.services)?.name ?? "Service",
      counter_name: firstRelation(token.counters)?.counter_name ?? null,
    })),
    assignments: (assignments ?? []).map((assignment) => ({
      id: assignment.id,
      service_id: assignment.service_id,
      counter_id: assignment.counter_id,
      service_name: firstRelation(assignment.services)?.name ?? "Service",
      counter_name: firstRelation(assignment.counters)?.counter_name ?? null,
      is_open: firstRelation(assignment.counters)?.is_open ?? false,
    })),
    stats: { completedToday: completedToday ?? 0, skippedToday: skippedToday ?? 0 },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!hasSupabaseConfig) return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  const { context, error: contextError } = await getContext();
  if (contextError) return databaseFailure(contextError, "Unable to verify your account.");
  if (!context) return Response.json({ error: "Sign in before joining a queue." }, { status: 401 });
  if (context.role !== "student") {
    return Response.json({ error: "Only student accounts can join a queue." }, { status: 403 });
  }
  let body: QueueMutation;
  try {
    body = await request.json() as QueueMutation;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body.serviceId !== "string") {
    return Response.json({ error: "Choose a valid service." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data, error } = await supabase.rpc("join_queue", { p_service_id: body.serviceId });
  if (error) {
    const conflict = /already have an active/i.test(error.message);
    return Response.json(
      { error: conflict ? "You already have an active token. Cancel it before joining another queue." : error.message },
      { status: conflict ? 409 : 400 },
    );
  }
  return Response.json({ token: data?.[0] ?? null }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!hasSupabaseConfig) return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  const { context, error: contextError } = await getContext();
  if (contextError) return databaseFailure(contextError, "Unable to verify your account.");
  if (!context) return Response.json({ error: "Sign in to manage queue tokens." }, { status: 401 });
  let body: QueueMutation;
  try {
    body = await request.json() as QueueMutation;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  if (body.action === "counter") {
    if (context.role !== "staff" || typeof body.counterId !== "string" || typeof body.isOpen !== "boolean") {
      return Response.json({ error: "Only assigned staff can change an assigned counter's status." }, { status: 403 });
    }
    const { error } = await supabase.rpc("set_staff_counter_open", {
      p_counter_id: body.counterId,
      p_is_open: body.isOpen,
    });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }
  if (typeof body.tokenId !== "string" || typeof body.action !== "string") {
    return Response.json({ error: "A valid token and action are required." }, { status: 400 });
  }
  if (body.action === "cancel") {
    if (context.role !== "student") {
      return Response.json({ error: "Only students can cancel their own tokens." }, { status: 403 });
    }
    const { error } = await supabase.rpc("cancel_queue_token", { p_token_id: body.tokenId });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }

  if (!["staff", "admin"].includes(context.role)) {
    return Response.json({ error: "Only staff and admins can manage queue tokens." }, { status: 403 });
  }
  if (!["call", "start", "recall", "complete", "skip"].includes(body.action)) {
    return Response.json({ error: "Unsupported queue action." }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("manage_queue_token", {
    p_token_id: body.tokenId,
    p_action: body.action,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ status: data });
}
