"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Clock3, Gauge, ListChecks, ShieldCheck, Ticket } from "lucide-react";
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

type Token = {
  id: string;
  token_number: string;
  status: "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "CANCELLED" | "SKIPPED";
  position_number: number | null;
  estimated_wait_minutes: number | null;
  created_at: string;
  service_id: string;
  service_name: string;
};

type QueueData = {
  services: Service[];
  summary: { service_id: string; waiting_count: number }[];
  tokens: Token[];
};

export default function StudentDashboard({ name }: { name: string }) {
  const [data, setData] = useState<QueueData>({ services: [], summary: [], tokens: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const result = await apiRequest<QueueData>("/api/queue");
      setData(result);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load queue information.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const activeToken = data.tokens.find((token) =>
    ["WAITING", "CALLED", "SERVING"].includes(token.status),
  ) ?? null;
  const history = data.tokens.filter((token) => token !== activeToken).slice(0, 5);
  const summaryByService = useMemo(
    () => new Map(data.summary.map((row) => [row.service_id, row.waiting_count])),
    [data.summary],
  );

  const mutate = async (key: string, url: string, method: string, body: object) => {
    setBusy(key);
    setError("");
    try {
      await apiRequest(url, { method, body: JSON.stringify(body) });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The requested queue action failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <main className="page-shell">
      <DashboardHeader title="Student dashboard" name={name} />

      <section className="page-hero compact">
        <div>
          <span className="eyebrow">Student queue access</span>
          <h1>Join a service queue and track your place in real time.</h1>
        </div>
        <div className="status-badge success"><ShieldCheck size={14} /> Live queue updates enabled</div>
      </section>

      {error && <p role="alert" className="small-note">{error}</p>}
      {!loaded && !error && <p className="small-note">Loading your queue…</p>}

      <section className="stats-grid three-up">
        <article className="stat-card">
          <Ticket size={18} /><span>Active token</span>
          <strong>{activeToken?.token_number ?? "No token"}</strong>
        </article>
        <article className="stat-card">
          <ListChecks size={18} /><span>Queue position</span>
          <strong>{activeToken?.position_number ?? "--"}</strong>
        </article>
        <article className="stat-card">
          <Clock3 size={18} /><span>Estimated wait</span>
          <strong>{activeToken ? `${activeToken.estimated_wait_minutes ?? 0} min` : "--"}</strong>
        </article>
      </section>

      <section className="content-grid two-col">
        <article className="panel-card large">
          <div className="section-heading">
            <h2>Available services</h2>
            <span>{data.services.filter((service) => service.is_active).length} active</span>
          </div>
          <div className="service-list">
            {data.services.map((service) => {
              const ownsThisService = activeToken?.service_id === service.id;
              const canJoin = service.is_active && service.is_accepting_tokens && !activeToken;
              return (
                <div key={service.id} className="service-row">
                  <div>
                    <h3>{service.name}</h3>
                    <p>{service.is_active ? "Open" : "Closed"} · {service.is_accepting_tokens ? "Accepting tokens" : "Paused"}</p>
                  </div>
                  <div className="service-meta">
                    <span>{summaryByService.get(service.id) ?? 0} waiting</span>
                    <span>{Number(service.average_service_minutes)} min avg</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={!canJoin || busy === service.id}
                    onClick={() => void mutate(service.id, "/api/queue", "POST", { serviceId: service.id })}
                  >
                    {ownsThisService ? "Active" : activeToken ? "One active token" : busy === service.id ? "Joining…" : "Join queue"}
                  </button>
                </div>
              );
            })}
            {loaded && data.services.length === 0 && (
              <div className="empty-state"><p>No services are configured yet.</p></div>
            )}
          </div>
        </article>

        <article className="panel-card large">
          <div className="section-heading">
            <h2>Current token</h2>
            <span className="status-badge neutral">{activeToken?.status ?? "NO TOKEN"}</span>
          </div>
          {activeToken ? (
            <div className="token-focus">
              <div className="token-number">{activeToken.token_number}</div>
              <ul className="token-details">
                <li><span>Service</span><strong>{activeToken.service_name}</strong></li>
                <li><span>Position</span><strong>{activeToken.position_number ?? "--"}</strong></li>
                <li><span>People ahead</span><strong>{Math.max(0, (activeToken.position_number ?? 1) - 1)}</strong></li>
                <li><span>Waiting time</span><strong>{activeToken.estimated_wait_minutes ?? 0} min</strong></li>
                <li><span>Joined</span><strong>{new Date(activeToken.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong></li>
              </ul>
              <p className="small-note">Wait times are estimates. Please report to the service desk when your token is called.</p>
              {activeToken.status === "WAITING" && (
                <div className="stacked-actions">
                  <button
                    type="button"
                    className="btn btn--danger"
                    disabled={busy === activeToken.id}
                    onClick={() => void mutate(activeToken.id, "/api/queue", "PATCH", { action: "cancel", tokenId: activeToken.id })}
                  >
                    {busy === activeToken.id ? "Cancelling…" : "Cancel token"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state"><Gauge size={30} /><p>No active token. Choose a service to join a queue.</p></div>
          )}
        </article>
      </section>

      <section className="content-grid two-col">
        <article className="panel-card">
          <div className="section-heading"><h2>Recent queue history</h2><span>Latest activity</span></div>
          <div className="history-list">
            {history.map((token) => (
              <div key={token.id} className="history-item">
                <div className="history-label">
                  <strong>{token.token_number}</strong>
                  <span>{token.service_name} · {new Date(token.created_at).toLocaleString()}</span>
                </div>
                <span className={`status-pill ${token.status.toLowerCase()}`}>{token.status}</span>
              </div>
            ))}
            {history.length === 0 && <p className="small-note">Your completed and cancelled tokens will appear here.</p>}
          </div>
        </article>
        <article className="panel-card">
          <div className="section-heading"><h2>Service guidance</h2><span>Next steps</span></div>
          <div className="tips-list">
            <div><ArrowRightLeft size={16} /><p>When your token is called, proceed to the designated counter and present your student ID.</p></div>
            <div><Gauge size={16} /><p>Keep the token visible and wait for the counter staff to confirm completion.</p></div>
            <div><Clock3 size={16} /><p>Queue time may vary depending on document verification and office workload.</p></div>
          </div>
        </article>
      </section>
      <p className="small-note"><Link href="/login">Account help</Link></p>
    </main>
  );
}
