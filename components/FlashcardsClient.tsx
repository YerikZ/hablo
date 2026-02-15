"use client";

import { useMemo, useState } from "react";

type Card = {
  id: string;
  front: string;
  back: string;
  dueAt: string;
  intervalDays: number;
  ease: number;
};

export function FlashcardsClient({ initialDue, initialAll }: { initialDue: Card[]; initialAll: Card[] }) {
  const [due, setDue] = useState(initialDue);
  const [all, setAll] = useState(initialAll);
  const [showAll, setShowAll] = useState(false);

  const cards = useMemo(() => (showAll ? all : due), [showAll, all, due]);

  async function review(id: string, rating: "again" | "good") {
    const response = await fetch(`/api/flashcards/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating })
    });

    if (!response.ok) return;

    const data = await response.json();
    setAll((prev) => prev.map((c) => (c.id === id ? data.card : c)));
    setDue((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between p-4">
        <h1 className="text-xl font-semibold">Flashcards</h1>
        <button className="btn btn-outline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show due" : "Show all"}
        </button>
      </div>
      {cards.length === 0 ? <div className="card p-4 text-sm text-slate-600">No cards in this view.</div> : null}
      {cards.map((card) => (
        <div key={card.id} className="card p-4">
          <p className="mb-2 text-sm uppercase text-slate-500">Front</p>
          <p className="mb-3 text-lg">{card.front}</p>
          <p className="mb-2 text-sm uppercase text-slate-500">Back</p>
          <p className="mb-4">{card.back}</p>
          <p className="mb-4 text-xs text-slate-500">
            Due: {new Date(card.dueAt).toLocaleString()} · Interval: {card.intervalDays}d · Ease: {card.ease.toFixed(2)}
          </p>
          {!showAll ? (
            <div className="flex gap-2">
              <button className="btn btn-outline" onClick={() => review(card.id, "again")}>Again</button>
              <button className="btn btn-primary" onClick={() => review(card.id, "good")}>Good</button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
