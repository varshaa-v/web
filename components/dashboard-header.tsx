"use client";

import Link from "next/link";
import { useState } from "react";

export function DashboardHeader({ title, name }: { title: string; name: string }) {
  const [error, setError] = useState("");

  const logout = async () => {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const result = await response.json() as { redirectTo?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to sign out.");
      window.location.assign(result.redirectTo ?? "/login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign out.");
    }
  };

  return (
    <header className="topbar">
      <div className="brand-wrap">
        <div className="brand-mark">Q</div>
        <div>
          <span className="eyebrow">QueueLess</span>
          <strong>{title}{name ? ` · ${name}` : ""}</strong>
        </div>
      </div>
      <nav className="topbar-links" aria-label="Main navigation">
        <Link href="/">Home</Link>
        <button type="button" className="btn btn--ghost" onClick={logout}>Sign out</button>
      </nav>
      {error && <p role="alert" className="small-note">{error}</p>}
    </header>
  );
}
