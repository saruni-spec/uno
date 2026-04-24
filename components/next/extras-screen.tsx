"use client";

import { useEffect, useState } from "react";
import {
  createCustomCard,
  ensureSession,
  getHistory,
  getLeaderboard,
  listCustomCards,
} from "../../lib/api/client";
import type { CustomCard, HistoryEntry, LeaderboardEntry } from "../../lib/api/types";

export function ExtrasScreen() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cards, setCards] = useState<CustomCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "Mulligan",
    emoji: "♻️",
    color: "green",
    effect: "Swap up to 3 cards with the deck.",
    trigger: "onPlay",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError("");
      try {
        await ensureSession();
        const [lb, hist, cc] = await Promise.all([getLeaderboard(), getHistory(), listCustomCards()]);
        if (cancelled) return;
        setLeaderboard(lb);
        setHistory(hist);
        setCards(cc);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load extras");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onCreate = async () => {
    try {
      const created = await createCustomCard(form);
      setCards((prev) => [created, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create custom card");
    }
  };

  const topLeaderboard = leaderboard.slice(0, 8);
  const recentHistory = history.slice(0, 8);
  const recentCards = cards.slice(0, 8);
  const triggerLabel =
    form.trigger === "onDraw"
      ? "On draw"
      : form.trigger === "onTurn"
        ? "Start of turn"
        : form.trigger === "onLast"
          ? "Last card"
          : "On play";
  const colorLabel = form.color === "wild" ? "Wild" : `${form.color[0].toUpperCase()}${form.color.slice(1)}`;

  return (
    <div className="page extras-page">
      <div className="section-h extras-head">
        <h2>Extras</h2>
        <span className="chip ok">Phase 4 migrated</span>
      </div>
      {error ? <div className="extras-error">{error}</div> : null}
      <div className="room-grid extras-grid">
        <div className="panel">
          <h3>🏆 Leaderboard</h3>
          {isLoading ? (
            <p className="extras-muted">Loading...</p>
          ) : topLeaderboard.length === 0 ? (
            <p className="extras-muted">No leaderboard data yet.</p>
          ) : (
            topLeaderboard.map((p, i) => (
              <div key={`${p.name}-${i}`} className="lb-row">
                <div className="rank">#{i + 1}</div>
                <div className="player">{p.name}</div>
                <div className="mono">{p.points || 0}</div>
              </div>
            ))
          )}
        </div>
        <div className="panel">
          <h3>📜 Recent Games</h3>
          {isLoading ? (
            <p className="extras-muted">Loading...</p>
          ) : history.length ? (
            recentHistory.map((h, i) => (
              <div key={`${h.id || "g"}-${i}`} className="history-row">
                <div>{h.room || "Room"}</div>
                <div className="history-winner">{h.winner || "Winner"}</div>
              </div>
            ))
          ) : (
            <p className="extras-muted">No game history yet.</p>
          )}
        </div>
      </div>

      <div className="panel extras-creator">
        <h3>🎨 Make a Custom Card</h3>
        <p className="extras-muted extras-intro">
          Create a card idea for your house rules. Approved cards appear below and in future sessions.
        </p>
        <div className="extras-form-grid">
          <div className="field">
            <label htmlFor="card-name">Card name</label>
            <input
              id="card-name"
              aria-label="Custom card name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="card-emoji">Emoji</label>
            <input
              id="card-emoji"
              aria-label="Custom card emoji"
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="card-color">Color</label>
            <select
              id="card-color"
              aria-label="Custom card color"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            >
              <option value="red">Red</option>
              <option value="yellow">Yellow</option>
              <option value="green">Green</option>
              <option value="blue">Blue</option>
              <option value="wild">Wild</option>
            </select>
          </div>
          <div className="field extras-field-wide">
            <label htmlFor="card-effect">Effect text</label>
            <input
              id="card-effect"
              aria-label="Custom card effect"
              value={form.effect}
              onChange={(e) => setForm((f) => ({ ...f, effect: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="card-trigger">Trigger</label>
            <select
              id="card-trigger"
              aria-label="Custom card trigger"
              value={form.trigger}
              onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}
            >
              <option value="onPlay">When played</option>
              <option value="onDraw">When drawn</option>
              <option value="onTurn">Start of turn</option>
              <option value="onLast">As last card</option>
            </select>
          </div>
        </div>
        <div className="extras-preview">
          <span className="chip">Preview</span>
          <div className={`extras-preview-card color-${form.color || "wild"}`}>
            <div className="extras-preview-head">
              <div className="extras-preview-emoji">{form.emoji || "✨"}</div>
              <div className="extras-preview-title-wrap">
                <strong className="extras-preview-title">{form.name || "Untitled card"}</strong>
                <div className="extras-preview-meta">
                  <span className="chip">{colorLabel}</span>
                  <span className="chip">{triggerLabel}</span>
                </div>
              </div>
            </div>
            <span className="extras-preview-effect">{form.effect || "No effect description yet."}</span>
          </div>
        </div>
        <button className="btn primary" onClick={onCreate}>
          Save custom card
        </button>
        <div className="extras-created-list">
          {recentCards.map((c) => (
            <div key={c.id} className="chip">
              {c.emoji} {c.name} - {c.effect}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
