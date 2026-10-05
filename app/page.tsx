import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Clock3,
  Gauge,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";

const featureCards = [
  {
    title: "Digital queue access",
    description:
      "Students can join the right service queue and monitor live wait times instead of waiting in crowded lines.",
    icon: Ticket,
  },
  {
    title: "Smarter service allocation",
    description:
      "Admins and staff can redistribute staffing and counter availability based on actual queue pressure.",
    icon: BarChart3,
  },
  {
    title: "Live operational visibility",
    description:
      "Every counter and service board updates in near real time to keep students and office staff aligned.",
    icon: Gauge,
  },
];

const steps = [
  "Student joins an available service queue digitally.",
  "The system calculates queue position and estimated waiting duration.",
  "Staff call the next token and complete service faster with clear capacity insight.",
];

const services = ["Accounts", "Certificates", "General Enquiries", "Scholarship", "Bonafide Certificate"];

export default function HomePage() {
  return (
    <div className="landing-shell">
      <header className="landing-header container">
        <div className="brand-wrap">
          <div className="brand-mark">Q</div>
          <div>
            <span className="eyebrow">QueueLess</span>
            <strong>Intelligent queue management</strong>
          </div>
        </div>

        <nav className="header-links" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#simulator">Simulator</a>
          <Link href="/login" className="btn btn--secondary">
            Login
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero container">
          <div className="hero-copy">
            <span className="eyebrow accent">Smart campus operations</span>
            <h1>Reduce unnecessary physical waiting in every student service desk.</h1>
            <p>
              QueueLess helps college administrators manage student demand more efficiently by allowing
              students to join and monitor queues digitally while staff use real-time capacity tools to
              improve service delivery.
            </p>

            <div className="hero-actions">
              <Link href="/login" className="btn btn--primary">
                Student login <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="btn btn--secondary">
                Staff / Admin login
              </Link>
            </div>

            <div className="hero-metrics">
              <div>
                <strong>42%</strong>
                <span>Less crowding</span>
              </div>
              <div>
                <strong>11 min</strong>
                <span>Average wait saved</span>
              </div>
              <div>
                <strong>3 roles</strong>
                <span>Student, staff, admin</span>
              </div>
            </div>
          </div>

          <div className="hero-visual panel-card">
            <div className="visual-header">
              <div>
                <span className="eyebrow">Live service board</span>
                <h2>Accounts desk</h2>
              </div>
              <span className="status-badge success">Open</span>
            </div>

            <div className="queue-preview">
              <div className="queue-row">
                <span>Currently serving</span>
                <strong>A017</strong>
              </div>
              <div className="queue-row">
                <span>People ahead</span>
                <strong>4</strong>
              </div>
              <div className="queue-row">
                <span>Est. waiting</span>
                <strong>14 min</strong>
              </div>
              <div className="queue-row">
                <span>Active counters</span>
                <strong>2</strong>
              </div>
            </div>

            <div className="mini-chart">
              <span style={{ height: "25%" }} />
              <span style={{ height: "48%" }} />
              <span style={{ height: "70%" }} />
              <span style={{ height: "58%" }} />
              <span style={{ height: "85%" }} />
              <span style={{ height: "100%" }} />
            </div>
          </div>
        </section>

        <section className="section container" id="features">
          <div className="section-heading center">
            <span className="eyebrow">Why QueueLess</span>
            <h2>Built for modern campus service operations</h2>
          </div>

          <div className="feature-grid">
            {featureCards.map(({ title, description, icon: Icon }) => (
              <article key={title} className="feature-card panel-card">
                <div className="feature-icon">
                  <Icon size={18} />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section container" id="how-it-works">
          <div className="section-heading center">
            <span className="eyebrow">How it works</span>
            <h2>Simple flow for students and campus staff</h2>
          </div>

          <div className="steps-grid">
            {steps.map((step, index) => (
              <div key={step} className="step-card panel-card">
                <span className="step-number">0{index + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section container" id="simulator">
          <div className="simulator-card panel-card">
            <div className="visual-copy">
              <span className="eyebrow">Queue estimation engine</span>
              <h2>Smart waiting estimates that help students plan before they travel.</h2>
              <p>
                QueueLess calculates an estimated wait time using live demand, average service duration,
                active counters, and a short historical model of queue behaviour. This helps students decide
                whether to wait digitally, arrive later, or use another service window.
              </p>
            </div>

            <div className="simulator-grid">
              <div>
                <Sparkles size={18} />
                <strong>Queue confidence</strong>
                <span>92% model fit</span>
              </div>
              <div>
                <Users size={18} />
                <strong>Active counters</strong>
                <span>2 of 4 open</span>
              </div>
              <div>
                <Clock3 size={18} />
                <strong>Average service</strong>
                <span>6–10 minutes</span>
              </div>
              <div>
                <ShieldCheck size={18} />
                <strong>Protected operations</strong>
                <span>Role-aware access</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer container">
        <div className="brand-wrap">
          <div className="brand-mark">Q</div>
          <div>
            <span className="eyebrow">QueueLess</span>
            <strong>Smart service desk</strong>
          </div>
        </div>

        <div className="footer-links">
          {services.map((service) => (
            <span key={service}>{service}</span>
          ))}
        </div>
      </footer>
    </div>
  );
}
