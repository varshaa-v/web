"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleSlash, Clock3, Play, RefreshCcw, UserRound } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { apiRequest } from "@/lib/client-api";

type QueueItem = {
  id: string;
  token_number: string;
  service_id: string;
  service_name: string;
  counter_name: string | null;
  status: "WAITING" | "CALLED" | "SERVING";
  position_number: number | null;
  estimated_wait_minutes: number | null;
};
type Assignment = {
  id: string;
  service_id: string;
  counter_id: string | null;
  service_name: string;
  counter_name: string | null;
  is_open: boolean;
};
type QueueData = {
  tokens: QueueItem[];
  assignments: Assignment[];
  stats: { completedToday: number; skippedToday: number };
};

export default function StaffDashboard({ name }: { name: string }) {
  const [data, setData] = useState<QueueData>({ tokens: [], assignments: [], stats: { completedToday: 0, skippedToday: 0 } });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await apiRequest<QueueData>("/api/queue");
      setData(result);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the staff queue.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 9000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const activeServices = useMemo(() => new Set(data.assignments.map((assignment) => assignment.service_id)), [data.assignments]);
  const queue = data.tokens.filter((token) => activeServices.has(token.service_id));
  const waitingCount = queue.filter((item) => item.status === "WAITING").length;
  const activeServing = queue.find((item) => item.status === "SERVING");
  const currentAssignment = data.assignments.find((assignment) => assignment.counter_id);

  const mutate = async (key: string, body: object) => {
    setBusy(key);
    setError("");
    try {
      await apiRequest("/api/queue", { method: "PATCH", body: JSON.stringify(body) });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The requested queue action failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <main className="page-shell">
      <DashboardHeader title="Staff operations" name={name} />

      <section className="page-hero compact">
        <div>
          <span className="eyebrow">Assigned counter</span>
          <h1>{currentAssignment
            ? `${currentAssignment.counter_name ?? "Assigned service"} · ${currentAssignment.service_name}`
            : "No counter assignment"}</h1>
          <p>{data.assignments.map((assignment) => assignment.service_name).filter((value, index, all) => all.indexOf(value) === index).join(", ") || "Ask an administrator to assign your account to a service."}</p>
        </div>
        {currentAssignment?.counter_id && (
          <button
            type="button"
            className="btn btn--secondary"
            disabled={busy === currentAssignment.counter_id}
            onClick={() => void mutate(currentAssignment.counter_id!, {
              action: "counter",
              counterId: currentAssignment.counter_id,
              isOpen: !currentAssignment.is_open,
            })}
          >
            {currentAssignment.is_open ? <Clock3 size={16} /> : <Play size={16} />}
            {currentAssignment.is_open ? "Pause counter" : "Open counter"}
          </button>
        )}
      </section>

      {error && <p role="alert" className="small-note">{error}</p>}
      {!loaded && !error && <p className="small-note">Loading assigned queues…</p>}

      <section className="stats-grid four-up">
        <article className="stat-card"><UserRound size={18} /><span>Currently serving</span><strong>{activeServing?.token_number ?? "--"}</strong></article>
        <article className="stat-card"><Clock3 size={18} /><span>Waiting count</span><strong>{waitingCount}</strong></article>
        <article className="stat-card"><RefreshCcw size={18} /><span>Counter status</span><strong>{currentAssignment ? (currentAssignment.is_open ? "Open" : "Paused") : "--"}</strong></article>
        <article className="stat-card"><CheckCircle2 size={18} /><span>Completed today</span><strong>{data.stats.completedToday}</strong></article>
      </section>

      <section className="content-grid two-col">
        <article className="panel-card large">
          <div className="section-heading"><h2>Assigned queues</h2><span>{waitingCount} waiting</span></div>
          <div className="queue-list">
            {queue.map((item) => (
              <div key={item.id} className="queue-item">
                <div className="queue-badge">{item.token_number}</div>
                <div>
                  <strong>{item.service_name}</strong>
                  <p>{item.status} · position {item.position_number ?? "--"}</p>
                </div>
                <div className="queue-actions">
                  {item.status === "WAITING" && (
                    <button type="button" className="btn btn--primary" disabled={busy === item.id} onClick={() => void mutate(item.id, { action: "call", tokenId: item.id })}>Call</button>
                  )}
                  {item.status === "CALLED" && (
                    <>
                      <button type="button" className="btn btn--secondary" disabled={busy === item.id} onClick={() => void mutate(item.id, { action: "start", tokenId: item.id })}>Start service</button>
                      <button type="button" className="btn btn--ghost" disabled={busy === item.id} onClick={() => void mutate(item.id, { action: "recall", tokenId: item.id })}>Recall</button>
                    </>
                  )}
                  {item.status === "SERVING" && (
                    <>
                      <button type="button" className="btn btn--secondary" disabled={busy === item.id} onClick={() => void mutate(item.id, { action: "complete", tokenId: item.id })}>Complete</button>
                      <button type="button" className="btn btn--ghost" disabled={busy === item.id} onClick={() => void mutate(item.id, { action: "skip", tokenId: item.id })}>Skip</button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {loaded && queue.length === 0 && (
              <div className="empty-state"><p>No active tokens in your assigned queues.</p></div>
            )}
          </div>
        </article>

        <article className="panel-card large">
          <div className="section-heading"><h2>Service summary</h2><span>Today</span></div>
          <div className="mini-stats">
            <div><span>Assigned services</span><strong>{activeServices.size}</strong></div>
            <div><span>Skipped tickets</span><strong>{data.stats.skippedToday}</strong></div>
            <div><span>Open counters</span><strong>{data.assignments.filter((assignment) => assignment.counter_id && assignment.is_open).length}</strong></div>
          </div>
          <div className="tips-list compact">
            <div><CircleSlash size={16} /><p>Skip a token only when the student does not respond or is unavailable.</p></div>
            <div><RefreshCcw size={16} /><p>Queue actions are saved and reflected in the shared service queue.</p></div>
          </div>
        </article>
      </section>
    </main>
  );
}
