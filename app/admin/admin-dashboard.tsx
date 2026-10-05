"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, CircleAlert, Download, Plus, Settings2 } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { apiRequest } from "@/lib/client-api";

type Service = {
  id: string;
  name: string;
  description: string | null;
  average_service_minutes: number;
  is_active: boolean;
  is_accepting_tokens: boolean;
};
type Counter = {
  id: string;
  service_id: string;
  counter_name: string;
  counter_number: number;
  is_active: boolean;
  is_open: boolean;
  service_name: string;
};
type Staff = { id: string; full_name: string; email: string };
type Assignment = {
  id: string;
  staff_id: string;
  service_id: string;
  counter_id: string | null;
  staff_name: string;
  staff_email: string;
  service_name: string;
  counter_name: string;
};
type AuditEntry = {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  actor_name: string;
};
type ReportRow = {
  token_number: string;
  status: string;
  estimated_wait_minutes: number | null;
  created_at: string;
  service_name: string;
};
type AdminData = {
  services: Service[];
  counters: Counter[];
  staff: Staff[];
  assignments: Assignment[];
  auditLog: AuditEntry[];
  report: ReportRow[];
  stats: { completedToday: number; skippedToday: number; averageWait: number };
};

const emptyData: AdminData = {
  services: [],
  counters: [],
  staff: [],
  assignments: [],
  auditLog: [],
  report: [],
  stats: { completedToday: 0, skippedToday: 0, averageWait: 0 },
};

export default function AdminDashboard({ name }: { name: string }) {
  const [data, setData] = useState(emptyData);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [averageMinutes, setAverageMinutes] = useState("8");
  const [counterName, setCounterName] = useState("");
  const [counterServiceId, setCounterServiceId] = useState("");
  const [assignmentStaffId, setAssignmentStaffId] = useState("");
  const [assignmentServiceId, setAssignmentServiceId] = useState("");
  const [assignmentCounterId, setAssignmentCounterId] = useState("");

  const refresh = useCallback(async () => {
    try {
      setData(await apiRequest<AdminData>("/api/admin"));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load admin data.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const countersForAssignment = useMemo(
    () => data.counters.filter((counter) => counter.service_id === assignmentServiceId && counter.is_active),
    [data.counters, assignmentServiceId],
  );

  const submit = async (key: string, url: string, method: string, body: object) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await apiRequest(url, { method, body: JSON.stringify(body) });
      setNotice("Changes saved.");
      await refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save changes.");
      return false;
    } finally {
      setBusy("");
    }
  };

  const createService = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = await submit("service", "/api/admin", "POST", {
      resource: "service",
      name: serviceName,
      description: serviceDescription,
      averageServiceMinutes: Number(averageMinutes),
    });
    if (saved) {
      setServiceName("");
      setServiceDescription("");
    }
  };

  const createCounter = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = await submit("counter", "/api/admin", "POST", {
      resource: "counter",
      serviceId: counterServiceId,
      counterName,
    });
    if (saved) setCounterName("");
  };

  const assignStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submit("assignment", "/api/admin", "POST", {
      resource: "assignment",
      staffId: assignmentStaffId,
      serviceId: assignmentServiceId,
      counterId: assignmentCounterId || null,
    });
  };

  const toggle = (resource: "service" | "counter", id: string, field: string, value: boolean) => {
    void submit(`${resource}-${id}`, "/api/admin", "PATCH", { resource, id, [field]: value });
  };

  const exportReport = () => {
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["Token", "Service", "Status", "Estimated wait (minutes)", "Created at"],
      ...data.report.map((item) => [
        item.token_number,
        item.service_name,
        item.status,
        item.estimated_wait_minutes ?? "",
        new Date(item.created_at).toISOString(),
      ]),
    ];
    const csv = rows.map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `queueless-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="page-shell">
      <DashboardHeader title="Admin control centre" name={name} />

      <section className="page-hero compact">
        <div>
          <span className="eyebrow">Operations overview</span>
          <h1>Manage services, counters, staffing, and queue health.</h1>
        </div>
        <button type="button" className="btn btn--primary" onClick={exportReport} disabled={!data.report.length}>
          <Download size={14} /> Export today&apos;s report
        </button>
      </section>

      {error && <p role="alert" className="small-note">{error}</p>}
      {notice && <p role="status" className="small-note">{notice}</p>}
      {!loaded && !error && <p className="small-note">Loading admin dashboard…</p>}

      <section className="stats-grid four-up">
        <article className="stat-card"><CheckCircle2 size={18} /><span>Completed today</span><strong>{data.stats.completedToday}</strong></article>
        <article className="stat-card"><BarChart3 size={18} /><span>Average estimated wait</span><strong>{data.stats.averageWait} min</strong></article>
        <article className="stat-card"><CircleAlert size={18} /><span>Skipped today</span><strong>{data.stats.skippedToday}</strong></article>
        <article className="stat-card"><Settings2 size={18} /><span>Open counters</span><strong>{data.counters.filter((counter) => counter.is_active && counter.is_open).length}/{data.counters.filter((counter) => counter.is_active).length}</strong></article>
      </section>

      <section className="content-grid two-col">
        <article className="panel-card large">
          <div className="section-heading"><h2>Service administration</h2><span>Queue settings</span></div>
          <div className="table-list">
            {data.services.map((service) => (
              <div key={service.id} className="table-row">
                <div>
                  <strong>{service.name}</strong>
                  <span>{Number(service.average_service_minutes)} min average · {service.is_active ? "Active" : "Closed"}</span>
                </div>
                <button type="button" className="btn btn--secondary" disabled={busy === `service-${service.id}`} onClick={() => toggle("service", service.id, "is_accepting_tokens", !service.is_accepting_tokens)}>
                  {service.is_accepting_tokens ? "Pause tokens" : "Resume tokens"}
                </button>
                <button type="button" className="btn btn--ghost" disabled={busy === `service-${service.id}`} onClick={() => toggle("service", service.id, "is_active", !service.is_active)}>
                  {service.is_active ? "Close" : "Open"}
                </button>
              </div>
            ))}
            {loaded && data.services.length === 0 && <p className="small-note">No services are configured.</p>}
          </div>
        </article>

        <article className="panel-card large">
          <div className="section-heading"><h2>Counter management</h2><span>Service availability</span></div>
          <div className="table-list">
            {data.counters.map((counter) => (
              <div key={counter.id} className="table-row">
                <div>
                  <strong>{counter.counter_name}</strong>
                  <span>{counter.service_name} · {counter.is_active ? "Active" : "Disabled"}</span>
                </div>
                <span className={`status-badge ${counter.is_open ? "success" : "neutral"}`}>{counter.is_open ? "Open" : "Closed"}</span>
                <button type="button" className="btn btn--ghost" disabled={busy === `counter-${counter.id}`} onClick={() => toggle("counter", counter.id, "is_open", !counter.is_open)}>
                  {counter.is_open ? "Close" : "Open"}
                </button>
              </div>
            ))}
            {loaded && data.counters.length === 0 && <p className="small-note">Add a counter before staff can serve a queue.</p>}
          </div>
        </article>
      </section>

      <section className="content-grid two-col">
        <article className="panel-card">
          <div className="section-heading"><h2>Add a service</h2><span>Queue catalogue</span></div>
          <form className="auth-form" onSubmit={(event) => void createService(event)}>
            <label><span>Service name</span><input required maxLength={100} value={serviceName} onChange={(event) => setServiceName(event.target.value)} /></label>
            <label><span>Description</span><input maxLength={300} value={serviceDescription} onChange={(event) => setServiceDescription(event.target.value)} /></label>
            <label><span>Average minutes per student</span><input required type="number" min="1" max="999" step="0.5" value={averageMinutes} onChange={(event) => setAverageMinutes(event.target.value)} /></label>
            <button type="submit" className="btn btn--primary" disabled={busy === "service"}><Plus size={14} />Add service</button>
          </form>
        </article>

        <article className="panel-card">
          <div className="section-heading"><h2>Add a counter</h2><span>Service station</span></div>
          <form className="auth-form" onSubmit={(event) => void createCounter(event)}>
            <label>
              <span>Service</span>
              <select required value={counterServiceId} onChange={(event) => setCounterServiceId(event.target.value)}>
                <option value="">Choose service</option>
                {data.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </label>
            <label><span>Counter name</span><input required maxLength={80} value={counterName} onChange={(event) => setCounterName(event.target.value)} placeholder="Counter 2" /></label>
            <button type="submit" className="btn btn--primary" disabled={busy === "counter" || !counterServiceId}><Plus size={14} />Add counter</button>
          </form>
        </article>
      </section>

      <section className="content-grid two-col">
        <article className="panel-card">
          <div className="section-heading"><h2>Staff assignments</h2><span>Service access</span></div>
          <form className="auth-form" onSubmit={(event) => void assignStaff(event)}>
            <label>
              <span>Staff account</span>
              <select required value={assignmentStaffId} onChange={(event) => setAssignmentStaffId(event.target.value)}>
                <option value="">Choose staff account</option>
                {data.staff.map((staff) => <option key={staff.id} value={staff.id}>{staff.full_name} · {staff.email}</option>)}
              </select>
            </label>
            <label>
              <span>Service</span>
              <select required value={assignmentServiceId} onChange={(event) => { setAssignmentServiceId(event.target.value); setAssignmentCounterId(""); }}>
                <option value="">Choose service</option>
                {data.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </label>
            <label>
              <span>Counter (optional)</span>
              <select value={assignmentCounterId} onChange={(event) => setAssignmentCounterId(event.target.value)}>
                <option value="">Any counter for this service</option>
                {countersForAssignment.map((counter) => <option key={counter.id} value={counter.id}>{counter.counter_name}</option>)}
              </select>
            </label>
            <button type="submit" className="btn btn--primary" disabled={busy === "assignment" || !data.staff.length}>Assign staff</button>
            {!data.staff.length && <p className="small-note">Create a staff Auth user and profile in Supabase first.</p>}
          </form>
          <div className="table-list">
            {data.assignments.map((assignment) => (
              <div key={assignment.id} className="table-row">
                <div><strong>{assignment.staff_name}</strong><span>{assignment.service_name} · {assignment.counter_name}</span></div>
                <button type="button" className="btn btn--ghost" disabled={busy === assignment.id} onClick={() => void submit(assignment.id, "/api/admin", "DELETE", { resource: "assignment", id: assignment.id })}>Remove</button>
              </div>
            ))}
            {loaded && data.assignments.length === 0 && <p className="small-note">No staff assignments yet.</p>}
          </div>
        </article>

        <article className="panel-card">
          <div className="section-heading"><h2>Audit log</h2><span>Recent saved actions</span></div>
          <div className="audit-list">
            {data.auditLog.map((entry) => (
              <div key={entry.id} className="history-item">
                <Settings2 size={14} />
                <span>{entry.action} · {entry.actor_name} · {new Date(entry.created_at).toLocaleString()}</span>
              </div>
            ))}
            {loaded && data.auditLog.length === 0 && <p className="small-note">Queue and service changes will appear here.</p>}
          </div>
        </article>
      </section>
    </main>
  );
}
