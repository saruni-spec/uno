"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  buildRoomInviteUrl,
  createRoom,
  deleteRoom,
  ensureSession,
  getRoom,
  isTabScopedInviteSession,
  joinRoom,
} from "../../lib/api/client";
import { BACKEND_ENABLED } from "../../lib/api/config";
import { saveRoomConfig } from "../../lib/game/session";
import type { InitGameConfig } from "../../lib/engine";
import type { RoomSummary } from "../../lib/api/types";

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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("Saturday Night Chaos");
  const [mode, setMode] = useState<"solo" | "teams" | "shared-hand">("teams");
  const [players, setPlayers] = useState<PlayerDraft[]>([
    { id: "me", name: "You", av: "🦊", bg: "#ff3c7a", team: "A" },
  ]);

  const [rules, setRules] = useState<RoomRules>(DEFAULT_RULES);
  const [roomMemberCount, setRoomMemberCount] = useState<number | null>(null);
  const [serverRoom, setServerRoom] = useState<RoomSummary | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [guestTab, setGuestTab] = useState(false);

  useEffect(() => {
    setGuestTab(typeof window !== "undefined" && isTabScopedInviteSession());
  }, []);

  useEffect(() => {
    if (!BACKEND_ENABLED || isNew || !isUuid(roomId)) return;
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        try {
          await joinRoom(roomId, { team: "A" });
        } catch {
          /* already a member or transient join error */
        }
        const room = await getRoom(roomId);
        if (!cancelled) {
          setServerRoom(room);
          const n = room.players?.length ?? room.playerCount ?? 0;
          setRoomMemberCount(typeof n === "number" ? n : 0);
        }
      } catch {
        if (!cancelled) {
          setRoomMemberCount(null);
          setServerRoom(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, isNew]);

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
      let roomSnapshot: Awaited<ReturnType<typeof getRoom>> | null = null;
      if (BACKEND_ENABLED && !isNew && isUuid(roomId)) {
        await ensureSession();
        try {
          await joinRoom(roomId, { team: "A" });
        } catch {
          /* ignore */
        }
        roomSnapshot = await getRoom(roomId);
        const memberCount = roomSnapshot.players?.length ?? roomSnapshot.playerCount ?? 0;
        if (memberCount < 2) {
          setError(
            "This room needs at least 2 members. Share the invite link (with ?join=1) or add a bot, then try again.",
          );
          setSaving(false);
          return;
        }
      } else if (players.length < 2) {
        setError("Add at least one opponent before starting.");
        setSaving(false);
        return;
      }
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
          try {
            await joinRoom(roomId, { team: "A" });
          } catch {
            /* ignore */
          }
        }
      } else if (isNew) {
        effectiveRoomId = `local-${Date.now()}`;
      }

      const draftByName = new Map(players.map((p) => [p.name.trim().toLowerCase(), p]));
      const playersForSave =
        roomSnapshot?.players?.length && roomSnapshot.players.every((rp) => rp.id)
          ? roomSnapshot.players.map((rp) => {
              const name = rp.name || "Player";
              const draft = draftByName.get(name.trim().toLowerCase());
              return {
                id: rp.id as string,
                name,
                av: rp.av,
                bg: rp.bg,
                team: mode === "solo" ? null : rp.team ?? null,
                isBot: Boolean(draft?.isBot),
                difficulty: draft?.difficulty,
              };
            })
          : players.map((p, i) => ({
              id: p.id || `p${i + 1}`,
              name: p.name,
              av: p.av,
              bg: p.bg,
              team: mode === "solo" ? null : p.team,
              isBot: p.isBot,
              difficulty: p.difficulty,
            }));

      const config: InitGameConfig = {
        roomId: effectiveRoomId,
        mode,
        handSize: 7,
        targetScore: 500,
        rules,
        players: playersForSave,
      };
      saveRoomConfig(effectiveRoomId, config);
      router.push(`/game/${effectiveRoomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start room");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRoom = async () => {
    setCreating(true);
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
          av: p.av,
          bg: p.bg,
          team: mode === "solo" ? null : p.team,
          isBot: p.isBot,
          difficulty: p.difficulty,
        })),
      };
      saveRoomConfig(effectiveRoomId, config);

      if (isNew) {
        router.push(`/room/${effectiveRoomId}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create room");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGame = async () => {
    if (isNew || !BACKEND_ENABLED || !isUuid(roomId)) return;
    setSaving(true);
    setError("");
    try {
      await ensureSession();
      try {
        await joinRoom(roomId, { team: "A" });
      } catch {
        /* ignore */
      }
      router.push(`/game/${roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
    } finally {
      setSaving(false);
    }
  };

  const primaryReady =
    isNew || !BACKEND_ENABLED || !isUuid(roomId) || serverRoom !== null;
  const primaryLabel = !primaryReady
    ? "Loading…"
    : saving
      ? serverRoom?.isHost === false
        ? "Joining…"
        : "Starting…"
      : serverRoom?.isHost === false
        ? "Join game"
        : "Start game";

  const handleDeleteRoom = async () => {
    if (isNew || !BACKEND_ENABLED) return;
    const ok = window.confirm("Delete this room? This removes current room/game state.");
    if (!ok) return;
    setDeleting(true);
    setError("");
    try {
      await ensureSession();
      await deleteRoom(roomId);
      router.push("/lobby");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete room");
    } finally {
      setDeleting(false);
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
          <span className="chip room-chip-truncate" title={isNew ? "New room" : roomId}>
            {isNew ? "New room" : `Room ${roomId.slice(0, 8)}…${roomId.slice(-4)}`}
          </span>
        </div>

        {guestTab ? (
          <p className="chip" style={{ marginBottom: 12, display: "inline-block" }}>
            Guest session (invite link) — you are a separate player from other tabs on this device.
          </p>
        ) : null}

        {!isNew && BACKEND_ENABLED && isUuid(roomId) ? (
          <div className="panel" style={{ marginBottom: 16, padding: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <span className="chip">
                {roomMemberCount != null ? `${roomMemberCount} in room` : "Loading room…"}
              </span>
              <button
                type="button"
                className="btn ghost sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(buildRoomInviteUrl(roomId));
                    setInviteCopied(true);
                    window.setTimeout(() => setInviteCopied(false), 2000);
                  } catch {
                    setError("Could not copy invite link — copy the URL manually.");
                  }
                }}
              >
                {inviteCopied ? "Copied!" : "Copy invite link"}
              </button>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--ink-dim)" }}>
              Send this link so friends join as their own user. Same browser? The link must include{" "}
              <code>?join=1</code> (added automatically when you copy).
            </p>
          </div>
        ) : null}

        <div className="room-setup-grid">
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
                    <div className="rr-desc">
                      {mode === "solo" ? (p.isBot ? "AI opponent" : "You") : `Team ${p.team}`}
                    </div>
                  </div>
                  <div className="rr-actions">
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
                    {p.id !== "me" && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        aria-label={`Remove ${p.name}`}
                        onClick={() =>
                          setPlayers((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        ✕
                      </button>
                    )}
                  </div>
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
        <div className="room-setup-actions">
          {isNew ? (
            <button className="btn ghost" disabled={creating || saving} onClick={handleCreateRoom}>
              {creating ? "Creating..." : "Create Room"}
            </button>
          ) : null}
          <button
            className="btn primary"
            disabled={saving || !primaryReady || (creating && isNew)}
            onClick={serverRoom?.isHost === false ? handleJoinGame : handleStart}
          >
            {primaryLabel}
          </button>
          {!isNew && BACKEND_ENABLED && serverRoom?.isHost === true ? (
            <button className="btn ghost" disabled={deleting} onClick={handleDeleteRoom}>
              {deleting ? "Deleting..." : "Delete Room"}
            </button>
          ) : null}
          <Link className="btn ghost" href="/lobby">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
