"use client";

import Link from "next/link";
import { useState } from "react";
import { BarChart3, CheckCircle2, CircleAlert, Download, Plus, Settings2, ShieldCheck } from "lucide-react";

type ServiceRow = {
  id: string;
  name: string;
  accepting: boolean;
  active: boolean;
  avgMinutes: number;
};

type CounterRow = {
  id: string;
  name: string;
  service: string;
  open: boolean;
};

const initialServices: ServiceRow[] = [
  { id: "s1", name: "Accounts", accepting: true, active: true, avgMinutes: 6 },
  { id: "s2", name: "Certificates", accepting: true, active: true, avgMinutes: 8 },
  { id: "s3", name: "General Enquiries", accepting: false, active: true, avgMinutes: 5 },
  { id: "s4", name: "Scholarship", accepting: true, active: true, avgMinutes: 10 },
];

const initialCounters: CounterRow[] = [
  { id: "c1", name: "Counter 1", service: "Accounts", open: true },
  { id: "c2", name: "Counter 2", service: "Certificates", open: true },
  { id: "c3", name: "Counter 3", service: "Scholarship", open: false },
];

export default function AdminDashboardPage() {
  const [services, setServices] = useState<ServiceRow[]>(initialServices);
  const [counters, setCounters] = useState<CounterRow[]>(initialCounters);
  const [auditLog, setAuditLog] = useState([
    "Accounts queue opened for the morning shift.",
    "Staff assignment updated for Counter 2.",
    "Scholarship service paused for one minute to rebalance staffing.",
  ]);

  const toggleService = (id: string) => {
    setServices((current) =>
      current.map((service) =>
        service.id === id ? { ...service, accepting: !service.accepting } : service,
      ),
    );
    setAuditLog((current) => ["Service intake toggled from the admin dashboard.", ...current].slice(0, 5));
  };

  const toggleCounter = (id: string) => {
    setCounters((current) =>
      current.map((counter) =>
        counter.id === id ? { ...counter, open: !counter.open } : counter,
      ),
    );
    setAuditLog((current) => ["Counter availability updated in the admin queue board.", ...current].slice(0, 5));
  };

  const exportReport = () => {
    setAuditLog((current) => ["Queue report exported to CSV with filtered service and date history.", ...current].slice(0, 5));
  };

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">Q</div>
          <div>
            <span className="eyebrow">QueueLess</span>
            <strong>Admin control centre</strong>
          </div>
        </div>

        <nav className="topbar-links">
          <Link href="/">Home</Link>
          <Link href="/login">Logout</Link>
        </nav>
      </header>

      <section className="page-hero compact">
        <div>
          <span className="eyebrow">Operations overview</span>
          <h1>Manage services, counters, staffing, and queue health.</h1>
        </div>
        <div className="action-group">
          <button type="button" className="btn btn--secondary">
            <Plus size={14} />
            Add service
          </button>
          <button type="button" className="btn btn--primary" onClick={exportReport}>
            <Download size={14} />
            Export report
          </button>
        </div>
      </section>

      <section className="stats-grid four-up">
        <article className="stat-card">
          <CheckCircle2 size={18} />
          <span>Completed today</span>
          <strong>142</strong>
        </article>
        <article className="stat-card">
          <BarChart3 size={18} />
          <span>Avg wait time</span>
          <strong>11 min</strong>
        </article>
        <article className="stat-card">
          <CircleAlert size={18} />
          <span>Missed tokens</span>
          <strong>8</strong>
        </article>
        <article className="stat-card">
          <ShieldCheck size={18} />
          <span>Service uptime</span>
          <strong>96%</strong>
        </article>
      </section>

      <section className="content-grid two-col">
        <article className="panel-card large">
          <div className="section-heading">
            <h2>Service administration</h2>
            <span>Queue settings</span>
          </div>
          <div className="table-list">
            {services.map((service) => (
              <div key={service.id} className="table-row">
                <div>
                  <strong>{service.name}</strong>
                  <span>{service.avgMinutes} min avg</span>
                </div>
                <span className={`status-badge ${service.active ? "success" : "neutral"}`}>
                  {service.active ? "Active" : "Closed"}
                </span>
                <button type="button" className="btn btn--secondary" onClick={() => toggleService(service.id)}>
                  {service.accepting ? "Pause tokens" : "Resume tokens"}
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card large">
          <div className="section-heading">
            <h2>Counter management</h2>
            <span>Assigned staffing</span>
          </div>

          <div className="table-list">
            {counters.map((counter) => (
              <div key={counter.id} className="table-row">
                <div>
                  <strong>{counter.name}</strong>
                  <span>{counter.service}</span>
                </div>
                <span className={`status-badge ${counter.open ? "success" : "neutral"}`}>
                  {counter.open ? "Open" : "Closed"}
                </span>
                <button type="button" className="btn btn--ghost" onClick={() => toggleCounter(counter.id)}>
                  {counter.open ? "Close" : "Open"}
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid two-col">
        <article className="panel-card">
          <div className="section-heading">
            <h2>Recommendation engine</h2>
            <span>Live advice</span>
          </div>
          <ul className="tips-list">
            <li>Adjust Accounts staffing before 11:00 AM to reduce wait spikes.</li>
            <li>Keep General Enquiries open during the peak registration window.</li>
            <li>Use scholarship intake data to rebalance staff attention during afternoon surges.</li>
          </ul>
        </article>

        <article className="panel-card">
          <div className="section-heading">
            <h2>Audit log</h2>
            <span>Protected actions</span>
          </div>
          <div className="audit-list">
            {auditLog.map((entry, index) => (
              <div key={`${entry}-${index}`} className="history-item">
                <Settings2 size={14} />
                <span>{entry}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
