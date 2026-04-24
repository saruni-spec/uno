"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ensureSession, createRoom, joinRoom } from "../../lib/api/client";
import { BACKEND_ENABLED } from "../../lib/api/config";
import { saveRoomConfig } from "../../lib/game/session";
import type { InitGameConfig } from "../../lib/engine";

type PlayerDraft = {
  id: string;
  name: string;
  av: string;
  bg: string;
  team: string;
  isBot?: boolean;
  difficulty?: "easy" | "normal" | "hard";
};

type RoomRules = {
  stack: boolean;
  sevenZero: boolean;
  jumpIn: boolean;
  challenge: boolean;
  drawPlay: boolean;
  noMercy: boolean;
  points: boolean;
  noSpecialFinish: boolean;
};

const DEFAULT_RULES: RoomRules = {
  stack: true,
  sevenZero: true,
  jumpIn: false,
  challenge: true,
  drawPlay: false,
  noMercy: true,
  points: true,
  noSpecialFinish: true,
};

const RULE_LABELS: Array<{ id: keyof RoomRules; label: string; hint: string }> = [
  { id: "stack", label: "Stack +2/+4", hint: "Allow chaining draw penalties." },
  { id: "sevenZero", label: "7-0 rule", hint: "7 swaps hands, 0 rotates hands." },
  { id: "jumpIn", label: "Jump-in", hint: "Play identical card out of turn." },
  { id: "challenge", label: "Challenge wild +4", hint: "Challenge illegal wild +4 plays." },
  { id: "drawPlay", label: "Draw to play", hint: "Play immediately after drawing." },
  { id: "noMercy", label: "No mercy", hint: "Keep pressure with aggressive penalties." },
  { id: "points", label: "Score mode", hint: "Track points across hands." },
  { id: "noSpecialFinish", label: "No special finish", hint: "Can't win on action/wild card." },
];

export function RoomSetupScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const isNew = roomId === "new";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("Saturday Night Chaos");
  const [mode, setMode] = useState<"solo" | "teams" | "shared-hand">("teams");
  const [players, setPlayers] = useState<PlayerDraft[]>([
    { id: "me", name: "You", av: "🦊", bg: "#ff3c7a", team: "A" },
    {
      id: `ai-${Date.now()}`,
      name: "Bot 1",
      av: "🤖",
      bg: "#7b5cff",
      team: "B",
      isBot: true,
      difficulty: "normal",
    },
  ]);

  const [rules, setRules] = useState<RoomRules>(DEFAULT_RULES);

  const addBot = (difficulty: "easy" | "normal" | "hard") => {
    setPlayers((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}-${prev.length}`,
        name: `${difficulty[0].toUpperCase()}${difficulty.slice(1)} Bot ${prev.length}`,
        av: difficulty === "hard" ? "🧠" : difficulty === "easy" ? "🎲" : "🤖",
        bg: difficulty === "hard" ? "#ff3c7a" : difficulty === "easy" ? "#3ddcc8" : "#7b5cff",
        team: prev.length % 2 === 0 ? "A" : "B",
        isBot: true,
        difficulty,
      },
    ]);
  };

  const handleStart = async () => {
    setSaving(true);
    setError("");
    try {
      let effectiveRoomId = roomId;
      if (BACKEND_ENABLED) {
        await ensureSession();
        if (isNew) {
          const created = await createRoom({
            name,
            mode,
            icon: "🎉",
            felt: "neon",
            maxPlayers: 8,
            rules: Object.entries(rules).map(([id, on]) => ({ id, on })),
            players,
          });
          effectiveRoomId = created.id;
        } else {
          await joinRoom(roomId, { team: "A" });
        }
      } else if (isNew) {
        effectiveRoomId = `local-${Date.now()}`;
      }

      const config: InitGameConfig = {
        roomId: effectiveRoomId,
        mode,
        handSize: 7,
        targetScore: 500,
        rules,
        players: players.map((p, i) => ({
          id: p.id || `p${i + 1}`,
          name: p.name,
          team: mode === "solo" ? null : p.team,
          isBot: p.isBot,
          difficulty: p.difficulty,
        })),
      };
      saveRoomConfig(effectiveRoomId, config);
      router.push(`/game/${effectiveRoomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start room");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="panel">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Link className="btn ghost sm" href="/lobby">
            ← Back
          </Link>
          <h2 className="display" style={{ margin: 0 }}>
            Room Setup
          </h2>
          <span className="chip">{isNew ? "New room" : `Room ${roomId}`}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div className="field">
              <label>Room name</label>
              <input aria-label="Room name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>Mode</label>
              <select
                aria-label="Game mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="solo">Solo</option>
                <option value="teams">Teams</option>
                <option value="shared-hand">Shared hand</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn ghost sm" onClick={() => addBot("easy")}>
                + Easy AI
              </button>
              <button className="btn ghost sm" onClick={() => addBot("normal")}>
                + Normal AI
              </button>
              <button className="btn ghost sm" onClick={() => addBot("hard")}>
                + Hard AI
              </button>
            </div>
          </div>

          <div>
            <h3 style={{ marginTop: 0 }}>Players</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {players.map((p, idx) => (
                <div key={p.id} className="rule-row on">
                  <div className="rr-meta">
                    <div className="rr-title">
                      {p.av} {p.name}{" "}
                      {p.isBot ? <span className="chip">{p.difficulty}</span> : null}
                    </div>
                    <div className="rr-desc">Team {mode === "solo" ? "-" : p.team}</div>
                  </div>
                  {mode !== "solo" && (
                    <select
                      aria-label={`Team for ${p.name}`}
                      value={p.team}
                      onChange={(e) =>
                        setPlayers((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, team: e.target.value } : x)),
                        )
                      }
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="panel mt-12">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <h3 style={{ margin: 0 }}>House Rules</h3>
            <Link className="btn ghost sm" href="/extras">
              Custom cards →
            </Link>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {RULE_LABELS.map((rule) => (
              <label key={rule.id} className={`rule-row ${rules[rule.id] ? "on" : ""}`}>
                <div className="rr-meta">
                  <div className="rr-title">{rule.label}</div>
                  <div className="rr-desc">{rule.hint}</div>
                </div>
                <input
                  aria-label={`Toggle ${rule.label}`}
                  type="checkbox"
                  checked={rules[rule.id]}
                  onChange={(e) =>
                    setRules((prev) => ({
                      ...prev,
                      [rule.id]: e.target.checked,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>

        {error ? <div style={{ marginTop: 12, color: "#ff8aa4" }}>{error}</div> : null}
        <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
          <button className="btn primary" disabled={saving} onClick={handleStart}>
            {saving ? "Starting..." : "Start Game"}
          </button>
          <Link className="btn ghost" href="/lobby">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
