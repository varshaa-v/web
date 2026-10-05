"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, BriefcaseBusiness, ShieldCheck, UserRound } from "lucide-react";

type AuthResult = {
  error?: string;
  redirectTo?: string | null;
  needsEmailConfirmation?: boolean;
};

function LoginForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(
    searchParams.get("error") === "profile"
      ? "Your account exists, but an administrator needs to finish setting up its profile."
      : searchParams.get("error") === "configuration"
        ? "Supabase is not configured yet. Add its URL and anon key to the app environment."
        : searchParams.get("error")
          ? "The email confirmation link is invalid or expired. Please try signing in or register again."
          : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, fullName, email, password }),
      });
      const result = await response.json() as AuthResult;

      if (!response.ok) {
        setMessage(result.error ?? "Authentication failed. Please try again.");
      } else if (result.needsEmailConfirmation) {
        setMessage("Account created. Check your email to confirm your address, then sign in.");
        setMode("login");
        setPassword("");
      } else if (result.redirectTo) {
        window.location.assign(result.redirectTo);
      }

    } catch {
      setMessage("Could not reach the app server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <div className="brand-mark">Q</div>
          <div>
            <span className="eyebrow">QueueLess</span>
            <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          </div>
        </div>

        <div className="role-switcher" aria-label="Account access">
          <span className={`role-pill ${mode === "login" ? "is-active" : ""}`}>
            <ShieldCheck size={14} /> Sign in
          </span>
          <button
            type="button"
            className={`role-pill ${mode === "signup" ? "is-active" : ""}`}
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setMessage("");
            }}
          >
            <UserRound size={14} /> Student registration
          </button>
        </div>

        <div className="auth-card">
          <div className="auth-card__header">
            <p className="eyebrow">{mode === "login" ? "SECURE ACCESS" : "STUDENT ACCESS"}</p>
            <h2>{mode === "login" ? "Sign in to your account" : "Join the queue online"}</h2>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === "signup" && (
              <label>
                <span>Full name</span>
                <input
                  required
                  autoComplete="name"
                  maxLength={120}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your full name"
                />
              </label>
            )}
            <label>
              <span>Email</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@college.edu"
              />
            </label>

            <label>
              <span>Password</span>
              <input
                required
                type="password"
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </label>

            {message && <p role="status" className="small-note">{message}</p>}

            <button type="submit" className="btn btn--primary btn--block" disabled={isSubmitting}>
              {isSubmitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create student account"}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="demo-box">
            <div className="demo-label">
              <BriefcaseBusiness size={14} />
              Staff and admin accounts
            </div>
            <div className="demo-meta">
              <span>Created by your Supabase project administrator</span>
              <span>Access is granted by the profile role</span>
            </div>
          </div>

          <div className="auth-links">
            <Link href="/">Back to home</Link>
            <Link href="/student">Student dashboard</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-shell"><p>Loading sign in…</p></main>}>
      <LoginForm />
    </Suspense>
  );
}
