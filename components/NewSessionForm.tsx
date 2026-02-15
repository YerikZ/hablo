"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const levels = ["A1", "A2", "B1", "B2", "C1"];

export function NewSessionForm() {
  const router = useRouter();
  const [theme, setTheme] = useState("Ordering food in a restaurant");
  const [level, setLevel] = useState("A2");
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [coachMode, setCoachMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme, level, durationMinutes, coachMode })
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Failed to create session");
      setLoading(false);
      return;
    }

    router.push(`/app/session/${data.sessionId}`);
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3 p-4">
      <h2 className="font-semibold">New Session</h2>
      <label className="block text-sm">
        Theme
        <input
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Level
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            {levels.map((entry) => (
              <option key={entry}>{entry}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Duration (min)
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            type="number"
            min={5}
            max={180}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
          />
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={coachMode} onChange={(e) => setCoachMode(e.target.checked)} />
          Coach mode
        </label>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="btn btn-primary" disabled={loading}>
        {loading ? "Creating..." : "Start session"}
      </button>
    </form>
  );
}
