"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type Role = "student" | "staff" | "admin";

const demoAccounts: Record<Role, { email: string; password: string; name: string }> = {
  student: {
    email: "student@queueless.demo",
    password: "Student123!",
    name: "Aanya Verma",
  },
  staff: {
    email: "staff@queueless.demo",
    password: "Staff123!",
    name: "Rohan Mehta",
  },
  admin: {
    email: "admin@queueless.demo",
    password: "Admin123!",
    name: "Nisha Kapoor",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>("student");
  const [email, setEmail] = useState(demoAccounts.student.email);
  const [password, setPassword] = useState(demoAccounts.student.password);

  const handleRoleChange = (role: Role) => {
    setSelectedRole(role);
    setEmail(demoAccounts[role].email);
    setPassword(demoAccounts[role].password);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (email.trim() && password.trim()) {
      const dashboardMap: Record<Role, string> = {
        student: "/student",
        staff: "/staff",
        admin: "/admin",
      };

      router.push(dashboardMap[selectedRole]);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <div className="brand-mark">Q</div>
          <div>
            <span className="eyebrow">QueueLess</span>
            <h1>Welcome back</h1>
          </div>
        </div>

        <div className="role-switcher" aria-label="Choose a user role">
          {(["student", "staff", "admin"] as Role[]).map((role) => (
            <button
              key={role}
              type="button"
              className={`role-pill ${selectedRole === role ? "is-active" : ""}`}
              onClick={() => handleRoleChange(role)}
            >
              {role === "student" && <UserRound size={14} />}
              {role === "staff" && <BriefcaseBusiness size={14} />}
              {role === "admin" && <ShieldCheck size={14} />}
              {role}
            </button>
          ))}
        </div>

        <div className="auth-card">
          <div className="auth-card__header">
            <p className="eyebrow">{selectedRole.toUpperCase()} ACCESS</p>
            <h2>{demoAccounts[selectedRole].name}</h2>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@college.edu"
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
            </label>

            <button type="submit" className="btn btn--primary btn--block">
              Sign in <ArrowRight size={16} />
            </button>
          </form>

          <div className="demo-box">
            <div className="demo-label">
              <LockKeyhole size={14} />
              Demo credentials
            </div>
            <div className="demo-meta">
              <span>{demoAccounts[selectedRole].email}</span>
              <span>{demoAccounts[selectedRole].password}</span>
            </div>
          </div>

          <div className="auth-links">
            <Link href="/">Back to home</Link>
            <Link href="/student">Student view</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
