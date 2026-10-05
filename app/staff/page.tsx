"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleSlash, Clock3, Play, RefreshCcw, UserRound } from "lucide-react";

type QueueItem = {
  id: number;
  token: string;
  service: string;
  status: "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED";
  queuePosition: number;
};

const defaultQueue: QueueItem[] = [
  { id: 1, token: "A015", service: "Accounts", status: "WAITING", queuePosition: 1 },
  { id: 2, token: "A016", service: "Accounts", status: "WAITING", queuePosition: 2 },
  { id: 3, token: "A017", service: "Accounts", status: "CALLED", queuePosition: 3 },
  { id: 4, token: "C004", service: "Certificates", status: "WAITING", queuePosition: 1 },
  { id: 5, token: "S011", service: "Scholarship", status: "SERVING", queuePosition: 1 },
];

export default function StaffDashboardPage() {
  const [queue, setQueue] = useState<QueueItem[]>(defaultQueue);
  const [assignedCounter, setAssignedCounter] = useState("Counter 1 · Accounts");
  const [intakePaused, setIntakePaused] = useState(false);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const response = await fetch("/api/queue");
        const payload = await response.json();

        if (payload?.services) {
          const queueItems = payload.services.flatMap((service: { name: string; waiting: number; currentlyServing: string }, index: number) => [
            { id: index * 10 + 1, token: service.currentlyServing, service: service.name, status: "SERVING", queuePosition: 1 },
            { id: index * 10 + 2, token: `${service.name.substring(0, 1).toUpperCase()}${String(service.waiting + 1).padStart(3, "0")}`, service: service.name, status: "WAITING", queuePosition: service.waiting + 1 },
          ]);
          setAssignedCounter(`Counter 1 · ${payload.services[0]?.name ?? "Accounts"}`);
          setQueue(queueItems.slice(0, 5));
        }
      } catch {
        setAssignedCounter("Counter 1 · Accounts");
        setQueue(defaultQueue);
      }
    };

    fetchQueue();
    const interval = window.setInterval(fetchQueue, 9000);
    return () => window.clearInterval(interval);
  }, []);

  const activeServing = useMemo(() => queue.find((item) => item.status === "SERVING"), [queue]);
  const waitingCount = queue.filter((item) => item.status === "WAITING").length;

  const advanceQueue = () => {
    setQueue((current) => {
      const nextWaiting = current.find((item) => item.status === "WAITING");
      if (!nextWaiting) {
        return current;
      }

      return current.map((item) =>
        item.id === nextWaiting.id
          ? { ...item, status: "SERVING", queuePosition: 1 }
          : item.status === "SERVING"
            ? { ...item, status: "COMPLETED" }
            : item,
      );
    });
  };

  const completeCurrent = () => {
    setQueue((current) =>
      current.map((item) =>
        item.status === "SERVING" ? { ...item, status: "COMPLETED" } : item,
      ),
    );
  };

  const skipCurrent = () => {
    setQueue((current) =>
      current.map((item) =>
        item.status === "SERVING" ? { ...item, status: "SKIPPED" } : item,
      ),
    );
  };

  const recallToken = () => {
    setQueue((current) =>
      current.map((item) =>
        item.status === "CALLED" ? { ...item, status: "SERVING" } : item,
      ),
    );
  };

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">Q</div>
          <div>
            <span className="eyebrow">QueueLess</span>
            <strong>Staff operations</strong>
          </div>
        </div>

        <nav className="topbar-links">
          <Link href="/">Home</Link>
          <Link href="/login">Logout</Link>
        </nav>
      </header>

      <section className="page-hero compact">
        <div>
          <span className="eyebrow">Assigned counter</span>
          <h1>{assignedCounter}</h1>
        </div>
        <button type="button" className="btn btn--secondary" onClick={() => setIntakePaused((value) => !value)}>
          {intakePaused ? <Play size={16} /> : <Clock3 size={16} />}
          {intakePaused ? "Resume intake" : "Pause intake"}
        </button>
      </section>

      <section className="stats-grid four-up">
        <article className="stat-card">
          <UserRound size={18} />
          <span>Currently serving</span>
          <strong>{activeServing?.token ?? "--"}</strong>
        </article>
        <article className="stat-card">
          <Clock3 size={18} />
          <span>Waiting count</span>
          <strong>{waitingCount}</strong>
        </article>
        <article className="stat-card">
          <RefreshCcw size={18} />
          <span>Intake status</span>
          <strong>{intakePaused ? "Paused" : "Open"}</strong>
        </article>
        <article className="stat-card">
          <CheckCircle2 size={18} />
          <span>Completed</span>
          <strong>{queue.filter((item) => item.status === "COMPLETED").length}</strong>
        </article>
      </section>

      <section className="content-grid two-col">
        <article className="panel-card large">
          <div className="section-heading">
            <h2>Waiting queue</h2>
            <span>{waitingCount} waiting</span>
          </div>

          <div className="queue-list">
            {queue.map((item) => (
              <div key={item.id} className="queue-item">
                <div className="queue-badge">{item.token}</div>
                <div>
                  <strong>{item.service}</strong>
                  <p>{item.status}</p>
                </div>
                <div className="queue-actions">
                  {item.status === "WAITING" && (
                    <button type="button" className="btn btn--primary" onClick={advanceQueue}>Call</button>
                  )}
                  {item.status === "SERVING" && (
                    <>
                      <button type="button" className="btn btn--secondary" onClick={completeCurrent}>Complete</button>
                      <button type="button" className="btn btn--ghost" onClick={skipCurrent}>Skip</button>
                    </>
                  )}
                  {item.status === "CALLED" && (
                    <button type="button" className="btn btn--secondary" onClick={recallToken}>Recall</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card large">
          <div className="section-heading">
            <h2>Service summary</h2>
            <span>Today</span>
          </div>

          <div className="mini-stats">
            <div>
              <span>Average service time</span>
              <strong>6 mins</strong>
            </div>
            <div>
              <span>Skipped tickets</span>
              <strong>{queue.filter((item) => item.status === "SKIPPED").length}</strong>
            </div>
            <div>
              <span>Turnaround</span>
              <strong>92%</strong>
            </div>
          </div>

          <div className="tips-list compact">
            <div>
              <CircleSlash size={16} />
              <p>Use the skip function only when the student did not respond or was unavailable.</p>
            </div>
            <div>
              <RefreshCcw size={16} />
              <p>Pause intake only for short operational reasons to prevent mismatched queue counts.</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
