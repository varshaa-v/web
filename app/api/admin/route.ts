import { createSupabaseServerClient, getUserContext, hasSupabaseConfig } from "@/lib/supabase";

function failure(error: unknown, message: string) {
  console.error(message, error);
  return Response.json({ error: message }, { status: 500 });
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function authorizeAdmin() {
  if (!hasSupabaseConfig) {
    return { response: Response.json({ error: "Supabase is not configured." }, { status: 503 }) };
  }
  try {
    const context = await getUserContext();
    if (!context) return { response: Response.json({ error: "Sign in to continue." }, { status: 401 }) };
    if (context.role !== "admin") return { response: Response.json({ error: "Admin access is required." }, { status: 403 }) };
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { response: Response.json({ error: "Supabase is not configured." }, { status: 503 }) };
    return { context, supabase, response: null };
  } catch (error) {
    return { response: failure(error, "Unable to verify admin access.") };
  }
}

export async function GET() {
  if (!hasSupabaseConfig) return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  const auth = await authorizeAdmin();
  if (auth.response) return auth.response;
  const { supabase } = auth;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const [
    servicesResult,
    countersResult,
    staffResult,
    assignmentsResult,
    auditResult,
    completedCountResult,
    skippedCountResult,
    reportResult,
  ] = await Promise.all([
    supabase.from("services").select("id, name, description, average_service_minutes, is_active, is_accepting_tokens").order("name"),
    supabase.from("counters").select("id, service_id, counter_name, counter_number, is_active, is_open, services(name)").order("counter_number"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "staff").order("full_name"),
    supabase.from("staff_assignments").select("id, staff_id, service_id, counter_id, is_active, profiles(full_name, email), services(name), counters(counter_name)").eq("is_active", true),
    supabase.from("audit_logs").select("id, action, entity_type, entity_id, details, created_at, profiles(full_name)").order("created_at", { ascending: false }).limit(20),
    supabase.from("queue_tokens").select("id", { count: "exact", head: true }).eq("status", "COMPLETED").gte("completed_at", todayIso),
    supabase.from("queue_tokens").select("id", { count: "exact", head: true }).eq("status", "SKIPPED").gte("skipped_at", todayIso),
    supabase.from("queue_tokens").select("token_number, status, estimated_wait_minutes, created_at, completed_at, services(name)").gte("created_at", todayIso).order("created_at", { ascending: false }).limit(5000),
  ]);

  const failed = [
    servicesResult.error,
    countersResult.error,
    staffResult.error,
    assignmentsResult.error,
    auditResult.error,
    completedCountResult.error,
    skippedCountResult.error,
    reportResult.error,
  ].find(Boolean);
  if (failed) return failure(failed, "Unable to load admin dashboard data.");

  const completedWaits = (reportResult.data ?? [])
    .filter((token) => token.status === "COMPLETED" && token.estimated_wait_minutes !== null)
    .map((token) => Number(token.estimated_wait_minutes));
  const averageWait = completedWaits.length
    ? Math.round(completedWaits.reduce((total, wait) => total + wait, 0) / completedWaits.length)
    : 0;

  return Response.json({
    services: servicesResult.data ?? [],
    counters: (countersResult.data ?? []).map((counter) => ({
      id: counter.id,
      service_id: counter.service_id,
      counter_name: counter.counter_name,
      counter_number: counter.counter_number,
      is_active: counter.is_active,
      is_open: counter.is_open,
      service_name: firstRelation(counter.services)?.name ?? "Service",
    })),
    staff: staffResult.data ?? [],
    assignments: (assignmentsResult.data ?? []).map((assignment) => ({
      id: assignment.id,
      staff_id: assignment.staff_id,
      service_id: assignment.service_id,
      counter_id: assignment.counter_id,
      staff_name: firstRelation(assignment.profiles)?.full_name ?? "Staff member",
      staff_email: firstRelation(assignment.profiles)?.email ?? "",
      service_name: firstRelation(assignment.services)?.name ?? "Service",
      counter_name: firstRelation(assignment.counters)?.counter_name ?? "All counters",
    })),
    auditLog: (auditResult.data ?? []).map((entry) => ({
      id: entry.id,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      details: entry.details,
      created_at: entry.created_at,
      actor_name: firstRelation(entry.profiles)?.full_name ?? "System",
    })),
    report: (reportResult.data ?? []).map((token) => ({
      token_number: token.token_number,
      status: token.status,
      estimated_wait_minutes: token.estimated_wait_minutes,
      created_at: token.created_at,
      completed_at: token.completed_at,
      service_name: firstRelation(token.services)?.name ?? "Service",
    })),
    stats: {
      completedToday: completedCountResult.count ?? 0,
      skippedToday: skippedCountResult.count ?? 0,
      averageWait,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin();
  if (auth.response) return auth.response;
  const { supabase } = auth;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (body.resource === "service") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const average = Number(body.averageServiceMinutes);
    if (!name || name.length > 100 || !Number.isFinite(average) || average <= 0 || average > 999) {
      return Response.json({ error: "Enter a service name and a positive average service time." }, { status: 400 });
    }
    const { data: existing, error: lookupError } = await supabase.from("services").select("id").ilike("name", name).limit(1);
    if (lookupError) return failure(lookupError, "Unable to check for an existing service.");
    if (existing?.length) return Response.json({ error: "A service with this name already exists." }, { status: 409 });

    const { error } = await supabase.from("services").insert({
      name,
      description: description || null,
      average_service_minutes: average,
      is_active: true,
      is_accepting_tokens: true,
    });
    if (error) return failure(error, "Unable to create the service.");
    return Response.json({ ok: true }, { status: 201 });
  }

  if (body.resource === "counter") {
    const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
    const counterName = typeof body.counterName === "string" ? body.counterName.trim() : "";
    if (!serviceId || !counterName || counterName.length > 80) {
      return Response.json({ error: "Choose a service and enter a counter name." }, { status: 400 });
    }
    const { data: lastCounter, error: counterLookupError } = await supabase
      .from("counters")
      .select("counter_number")
      .eq("service_id", serviceId)
      .order("counter_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (counterLookupError) return failure(counterLookupError, "Unable to check the service counters.");
    const { error } = await supabase.from("counters").insert({
      service_id: serviceId,
      counter_name: counterName,
      counter_number: (lastCounter?.counter_number ?? 0) + 1,
    });
    if (error) return failure(error, "Unable to add the counter.");
    return Response.json({ ok: true }, { status: 201 });
  }

  if (body.resource === "assignment") {
    const staffId = typeof body.staffId === "string" ? body.staffId : "";
    const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
    const counterId = typeof body.counterId === "string" && body.counterId ? body.counterId : null;
    if (!staffId || !serviceId) {
      return Response.json({ error: "Choose a staff member and service." }, { status: 400 });
    }
    const { data: staff, error: staffError } = await supabase.from("profiles").select("id").eq("id", staffId).eq("role", "staff").maybeSingle();
    if (staffError) return failure(staffError, "Unable to verify the selected staff member.");
    if (!staff) return Response.json({ error: "The selected account is not a staff user." }, { status: 400 });
    if (counterId) {
      const { data: counter, error: counterError } = await supabase.from("counters").select("id, service_id").eq("id", counterId).maybeSingle();
      if (counterError) return failure(counterError, "Unable to verify the selected counter.");
      if (!counter || counter.service_id !== serviceId) {
        return Response.json({ error: "Choose a counter belonging to the selected service." }, { status: 400 });
      }
    }
    const { data: currentAssignment, error: assignmentLookupError } = await supabase
      .from("staff_assignments")
      .select("id")
      .eq("staff_id", staffId)
      .eq("service_id", serviceId)
      .eq("is_active", true)
      .limit(1);
    if (assignmentLookupError) return failure(assignmentLookupError, "Unable to check existing staff assignments.");
    if (currentAssignment?.length) {
      return Response.json({ error: "This staff member already has an active assignment for that service." }, { status: 409 });
    }
    const { error } = await supabase.from("staff_assignments").insert({
      staff_id: staffId,
      service_id: serviceId,
      counter_id: counterId,
      is_active: true,
    });
    if (error) {
      if (error.code === "23505") return Response.json({ error: "This staff assignment already exists." }, { status: 409 });
      return failure(error, "Unable to create the staff assignment.");
    }
    return Response.json({ ok: true }, { status: 201 });
  }

  return Response.json({ error: "Unsupported admin resource." }, { status: 400 });
}

export async function PATCH(request: Request) {
  const auth = await authorizeAdmin();
  if (auth.response) return auth.response;
  const { supabase } = auth;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body.id !== "string") return Response.json({ error: "A valid record ID is required." }, { status: 400 });

  if (body.resource === "service") {
    const update: Record<string, unknown> = {};
    if (typeof body.is_active === "boolean") update.is_active = body.is_active;
    if (typeof body.is_accepting_tokens === "boolean") update.is_accepting_tokens = body.is_accepting_tokens;
    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
    if (typeof body.average_service_minutes === "number" && body.average_service_minutes > 0) {
      update.average_service_minutes = body.average_service_minutes;
    }
    if (Object.keys(update).length === 0) return Response.json({ error: "No valid service settings were supplied." }, { status: 400 });
    const { error } = await supabase.from("services").update(update).eq("id", body.id);
    if (error) return failure(error, "Unable to update the service.");
    return Response.json({ ok: true });
  }

  if (body.resource === "counter") {
    const update: Record<string, unknown> = {};
    if (typeof body.is_open === "boolean") update.is_open = body.is_open;
    if (typeof body.is_active === "boolean") update.is_active = body.is_active;
    if (Object.keys(update).length === 0) return Response.json({ error: "No valid counter settings were supplied." }, { status: 400 });
    const { error } = await supabase.from("counters").update(update).eq("id", body.id);
    if (error) return failure(error, "Unable to update the counter.");
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unsupported admin resource." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const auth = await authorizeAdmin();
  if (auth.response) return auth.response;
  const { supabase } = auth;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (body.resource !== "assignment" || typeof body.id !== "string") {
    return Response.json({ error: "A valid staff assignment is required." }, { status: 400 });
  }
  const { error } = await supabase.from("staff_assignments").delete().eq("id", body.id);
  if (error) return failure(error, "Unable to remove the staff assignment.");
  return Response.json({ ok: true });
}
