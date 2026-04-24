"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BACKEND_ENABLED } from "../../lib/api/config";
import { ensureSession, listRooms } from "../../lib/api/client";
import type { RoomSummary } from "../../lib/api/types";
import { listActiveMatches } from "../../lib/game/match-state";
import { Card, Sticker } from "./primitives";

export function LobbyScreen() {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [activeMatches, setActiveMatches] = useState<
    Array<{ roomId: string; updatedAt: number; round: number }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setActiveMatches(
      listActiveMatches().map((m) => ({
        roomId: m.roomId,
        updatedAt: m.updatedAt,
        round: m.round,
      })),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!BACKEND_ENABLED) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError("");
      try {
        await ensureSession();
        const next = await listRooms();
        if (!cancelled) setRooms(next);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load rooms");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const liveCount = useMemo(
    () => rooms.filter((r) => r.status === "playing").length,
    [rooms],
  );

  return (
    <div className="page">
      <div className="lobby-hero">
        <div>
          <div className="hero-chip-row">
            <span className="chip live">{liveCount} live games</span>
            <span className="chip">{rooms.length} rooms</span>
          </div>
          <h1 className="hero-title">
            <span className="shout">Noni&apos;s</span>
            <br />
            <span className="bang">Card House</span>
          </h1>
          <p className="hero-sub">
            Phase 3 is wired: typed API client + session bootstrap + backend-backed room list.
          </p>
          <div className="hero-cta">
            <Link className="btn primary" href="/room/new">
              🎉 Create Room
            </Link>
            <Link className="btn ghost" href="/extras">
              📊 Extras
            </Link>
          </div>
          {!BACKEND_ENABLED && (
            <p className="hero-note">
              Backend integration is disabled (`NEXT_PUBLIC_USE_BACKEND_DATA=false`).
            </p>
          )}
          {!!error && (
            <p className="hero-note error">Failed to load rooms: {error}</p>
          )}
        </div>
        <div className="hero-deck">
          <Sticker className="yel sticker-a">
            Typed API Client
          </Sticker>
          <Sticker className="pink sticker-b">
            Session Bootstrap
          </Sticker>
          <Sticker className="green sticker-c">
            Live Rooms
          </Sticker>
          <div className="hero-card-pos hero-card-1">
            <Card color="red" value="7" size="lg" />
          </div>
          <div className="hero-card-pos hero-card-2">
            <Card color="yellow" value="skip" size="lg" />
          </div>
          <div className="hero-card-pos hero-card-3">
            <Card color="wild" value="wild4" size="lg" />
          </div>
        </div>
      </div>

      <div className="section-h">
        <h2>🏠 Your rooms</h2>
      </div>
      <div className="room-grid">
        {activeMatches.map((match) => (
          <Link key={`resume-${match.roomId}`} href={`/game/${match.roomId}`} className="room-card">
            <div className="rc-inner">
              <div className="rc-head">
                <div className="rc-icon rc-icon-resume">
                  ▶
                </div>
                <div className="rc-flex-fill">
                  <div className="rc-name">Resume match</div>
                  <div className="rc-host">
                    Room {match.roomId} · Round {match.round}
                  </div>
                </div>
              </div>
              <div className="rc-meta">
                <span className="chip ok">In progress</span>
                <span className="chip">
                  Updated {Math.max(1, Math.floor((Date.now() - match.updatedAt) / 60000))}m ago
                </span>
              </div>
            </div>
          </Link>
        ))}
        {isLoading && <div className="panel">Loading rooms...</div>}
        {!isLoading && rooms.length === 0 && <div className="panel">No active rooms yet.</div>}
        {!isLoading &&
          rooms.map((room) => (
            <Link
              key={room.id}
              href={`/room/${room.id}`}
              className="room-card room-card-link"
            >
              <div className="rc-inner">
                <div className="rc-head">
                  <div className="rc-icon rc-icon-room">
                    {room.icon || "🎉"}
                  </div>
                  <div className="rc-flex-fill">
                    <div className="rc-name">{room.name}</div>
                    <div className="rc-host">
                      <span>{room.hostAvatar || "🦊"}</span> Hosted by {room.host || "Host"}
                    </div>
                  </div>
                </div>
                <div className="rc-meta">
                  <span className="chip">
                    {room.mode === "teams" ? "👥 Teams" : "🧍 Solo"}
                  </span>
                  <span className="chip">📜 {room.activeRules || 0} rules</span>
                  {room.status === "playing" ? (
                    <span className="chip live">LIVE</span>
                  ) : (
                    <span className="chip ok">Waiting</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}
