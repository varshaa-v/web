"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Clock3, Gauge, ListChecks, ShieldCheck, Ticket } from "lucide-react";

type QueueStatus = "WAITING" | "CALLED" | "SERVING" | "COMPLETED";

type ServiceCard = {
  id: string;
  name: string;
  active: boolean;
  accepting: boolean;
  averageServiceMinutes: number;
  waiting: number;
};

type TokenState = {
  ticketNumber: string;
  service: string;
  position: number;
  estimatedWait: number;
  peopleAhead: number;
  avgService: number;
  countersOpen: number;
  status: QueueStatus;
  counter: string;
};

const defaultServices: ServiceCard[] = [
  { id: "accounts", name: "Accounts", active: true, accepting: true, averageServiceMinutes: 6, waiting: 4 },
  { id: "certificates", name: "Certificates", active: true, accepting: true, averageServiceMinutes: 8, waiting: 2 },
  { id: "enquiries", name: "General Enquiries", active: true, accepting: false, averageServiceMinutes: 5, waiting: 1 },
  { id: "scholarship", name: "Scholarship", active: true, accepting: true, averageServiceMinutes: 10, waiting: 5 },
  { id: "bonafide", name: "Bonafide Certificate", active: false, accepting: false, averageServiceMinutes: 7, waiting: 0 },
];

export default function StudentDashboardPage() {
  const ticketCounterRef = useRef(1);
  const [services, setServices] = useState<ServiceCard[]>(defaultServices);
  const [activeToken, setActiveToken] = useState<TokenState | null>({
    ticketNumber: "A017",
    service: "Accounts",
    position: 3,
    estimatedWait: 14,
    peopleAhead: 2,
    avgService: 6,
    countersOpen: 2,
    status: "WAITING",
    counter: "Counter 1",
  });

  useEffect(() => {
    const fetchQueueData = async () => {
      try {
        const response = await fetch("/api/queue");
        const payload = await response.json();

        if (payload?.services) {
          setServices(payload.services);
        }
      } catch {
        setServices(defaultServices);
      }
    };

    fetchQueueData();
    const timer = window.setInterval(fetchQueueData, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    if (!activeToken) {
      return {
        queuePosition: "--",
        estimatedTime: "--",
        currentlyServing: "--",
        peopleAhead: 0,
      };
    }

    return {
      queuePosition: `${activeToken.position}`,
      estimatedTime: `${activeToken.estimatedWait} min`,
      currentlyServing: activeToken.ticketNumber,
      peopleAhead: activeToken.peopleAhead,
    };
  }, [activeToken]);

  const joinQueue = (service: ServiceCard) => {
    if (!service.active || !service.accepting) {
      return;
    }

    if (activeToken && activeToken.service === service.name) {
      return;
    }

    const prefixMap: Record<string, string> = {
      accounts: "A",
      certificates: "C",
      enquiries: "G",
      scholarship: "S",
      bonafide: "B",
    };

    const prefix = prefixMap[service.id] ?? "A";
    const ticketNumber = `${prefix}${String((ticketCounterRef.current % 900) + 100)}`;
    ticketCounterRef.current += 1;

    setActiveToken({
      ticketNumber,
      service: service.name,
      position: Math.max(1, service.waiting + 1),
      estimatedWait: Math.max(5, service.averageServiceMinutes * 2),
      peopleAhead: service.waiting,
      avgService: service.averageServiceMinutes,
      countersOpen: 2,
      status: "WAITING",
      counter: service.name === "Accounts" ? "Counter 1" : "Counter 2",
    });
  };

  const cancelToken = () => {
    setActiveToken((current) =>
      current ? { ...current, status: "COMPLETED", position: 0, estimatedWait: 0 } : null,
    );
  };

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">Q</div>
          <div>
            <span className="eyebrow">QueueLess</span>
            <strong>Student dashboard</strong>
          </div>
        </div>

        <nav className="topbar-links">
          <Link href="/">Home</Link>
          <Link href="/login">Logout</Link>
        </nav>
      </header>

      <section className="page-hero compact">
        <div>
          <span className="eyebrow">Student queue access</span>
          <h1>Join a service queue and track your place in real time.</h1>
        </div>
        <div className="status-badge success">
          <ShieldCheck size={14} />
          Live queue updates enabled
        </div>
      </section>

      <section className="stats-grid three-up">
        <article className="stat-card">
          <Ticket size={18} />
          <span>Active token</span>
          <strong>{activeToken?.ticketNumber ?? "No token"}</strong>
        </article>
        <article className="stat-card">
          <ListChecks size={18} />
          <span>Queue position</span>
          <strong>{stats.queuePosition}</strong>
        </article>
        <article className="stat-card">
          <Clock3 size={18} />
          <span>Estimated wait</span>
          <strong>{stats.estimatedTime}</strong>
        </article>
      </section>

      <section className="content-grid two-col">
        <article className="panel-card large">
          <div className="section-heading">
            <h2>Available services</h2>
            <span>{services.filter((service) => service.active).length} active</span>
          </div>

          <div className="service-list">
            {services.map((service) => (
              <div key={service.id} className="service-row">
                <div>
                  <h3>{service.name}</h3>
                  <p>
                    {service.active ? "Open" : "Closed"} · {service.accepting ? "Accepting tokens" : "Paused"}
                  </p>
                </div>
                <div className="service-meta">
                  <span>{service.waiting} waiting</span>
                  <span>{service.averageServiceMinutes} min avg</span>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={!service.active || !service.accepting || !!(activeToken && activeToken.service === service.name)}
                  onClick={() => joinQueue(service)}
                >
                  {activeToken && activeToken.service === service.name ? "Active" : "Join queue"}
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card large">
          <div className="section-heading">
            <h2>Current token</h2>
            <span className="status-badge neutral">{activeToken?.status ?? "NO TOKEN"}</span>
          </div>

          {activeToken ? (
            <div className="token-focus">
              <div className="token-number">{activeToken.ticketNumber}</div>
              <ul className="token-details">
                <li>
                  <span>Service</span>
                  <strong>{activeToken.service}</strong>
                </li>
                <li>
                  <span>Position</span>
                  <strong>{activeToken.position}</strong>
                </li>
                <li>
                  <span>People ahead</span>
                  <strong>{activeToken.peopleAhead}</strong>
                </li>
                <li>
                  <span>Waiting time</span>
                  <strong>{activeToken.estimatedWait} min</strong>
                </li>
                <li>
                  <span>Average service</span>
                  <strong>{activeToken.avgService} min</strong>
                </li>
                <li>
                  <span>Counter</span>
                  <strong>{activeToken.counter}</strong>
                </li>
              </ul>

              <p className="small-note">
                This waiting time is an estimate and not a guarantee. Please report to the service desk when your token is called.
              </p>

              <div className="stacked-actions">
                <button type="button" className="btn btn--danger" onClick={cancelToken}>
                  Cancel token
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <Gauge size={30} />
              <p>No active queue token. Choose a service to start.</p>
            </div>
          )}
        </article>
      </section>

      <section className="content-grid two-col">
        <article className="panel-card">
          <div className="section-heading">
            <h2>Recent queue history</h2>
            <span>Today</span>
          </div>
          <div className="history-list">
            {[
              { status: "Completed", label: "A010", detail: "Accounts · 12:15 PM" },
              { status: "Called", label: "C003", detail: "Certificates · 12:20 PM" },
              { status: "Cancelled", label: "S007", detail: "Scholarship · 12:08 PM" },
            ].map((item) => (
              <div key={item.label} className="history-item">
                <div className="history-label">
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
                <span className={`status-pill ${item.status.toLowerCase()}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="section-heading">
            <h2>Service guidance</h2>
            <span>Next steps</span>
          </div>
          <div className="tips-list">
            <div>
              <ArrowRightLeft size={16} />
              <p>When your token is called, proceed to the designated counter and present your student ID.</p>
            </div>
            <div>
              <Gauge size={16} />
              <p>Please keep the token visible and wait for the counter staff to confirm completion.</p>
            </div>
            <div>
              <Clock3 size={16} />
              <p>Queue time may vary depending on document verification and peak office workload.</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
