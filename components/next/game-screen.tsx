"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureSession,
  getRoom,
  getRoomState,
  joinRoom,
  readStoredUser,
  submitMove,
  subscribeRoomState,
} from "../../lib/api/client";
import { BACKEND_ENABLED } from "../../lib/api/config";
import { BotAdapter } from "../../lib/bot/adapter";
import { Engine, type Card as EngineCard, type GameState, type InitGameConfig } from "../../lib/engine";
import { loadActiveMatch, saveActiveMatch } from "../../lib/game/match-state";
import { loadRoomConfig } from "../../lib/game/session";
import { Card, Confetti } from "./primitives";

const FALLBACK_CONFIG: InitGameConfig = {
  roomId: "demo-room",
  mode: "solo",
  targetScore: 500,
  handSize: 7,
  rules: { stack: true, drawPlay: false, sevenZero: true, noSpecialFinish: true },
  players: [
    { id: "me", name: "You", isBot: false, team: null },
    { id: "ai-1", name: "Bot", isBot: true, difficulty: "normal", team: null },
  ],
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function bestWildColor(hand: EngineCard[]): "red" | "yellow" | "green" | "blue" {
  const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
  hand.forEach((c) => {
    if (c.color !== "wild") counts[c.color] += 1;
  });
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "red") as
    | "red"
    | "yellow"
    | "green"
    | "blue";
}

export function GameScreen({ roomId }: { roomId: string }) {
  const backendActive = BACKEND_ENABLED && isUuid(roomId);
  // meId is "me" for local games; resolved to a real UUID in backend mode.
  const [meId, setMeId] = useState<string>(() => readStoredUser()?.id || "me");
  const [config, setConfig] = useState<InitGameConfig>(FALLBACK_CONFIG);
  const [game, setGame] = useState<GameState | null>(null);
  const [toasts, setToasts] = useState<string[]>([]);
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [syncStatus, setSyncStatus] = useState<"local" | "connecting" | "live">("local");
  const [waitingForHost, setWaitingForHost] = useState(false);
  // Stable ref for latest game state so bot effect never reads stale values.
  const gameRef = useRef<GameState | null>(null);
  // True when room has only one human (rest are bots). All game logic runs
  // locally in this mode; backend is used only for persistence (fire-and-forget).
  // Solo-vs-bots only: exactly one human in saved config and at least one bot.
  // Empty config (invitee with no localStorage) must stay false so multiplayer polling works.
  const isBotMatch = useMemo(() => {
    if (!config.players.length) return false;
    const humans = config.players.filter((p) => !p.isBot).length;
    const bots = config.players.filter((p) => p.isBot).length;
    return humans === 1 && bots >= 1;
  }, [config.players]);

  useEffect(() => {
    const shouldUseBackend = BACKEND_ENABLED && isUuid(roomId);
    const fromDisk = loadRoomConfig(roomId);
    const loaded: InitGameConfig =
      fromDisk ||
      ({
        roomId,
        mode: "solo",
        handSize: 7,
        targetScore: 500,
        rules: FALLBACK_CONFIG.rules,
        players: [],
      } as InitGameConfig);
    const saved = loadActiveMatch(roomId);
    const nextScores: Record<string, number> = {};
    loaded.players.forEach((p) => {
      nextScores[p.id] = 0;
    });
    setScores(nextScores);
    setConfig(loaded);
    if (!shouldUseBackend) {
      setSyncStatus("local");
      setMeId("me");
      setGame(saved?.status === "active" ? saved.gameState : Engine.initGame(loaded));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const session = await ensureSession();
        if (!cancelled) setMeId(session.id);
        try {
          await joinRoom(roomId, { team: "A" });
        } catch {
          /* already a member or join race */
        }
        const remote = (await getRoomState(roomId)) as GameState | null;
        if (cancelled) return;
        if (remote) {
          setGame(remote);
          return;
        }
        let isHostPlayer = true;
        try {
          const roomInfo = await getRoom(roomId);
          isHostPlayer = Boolean(roomInfo.isHost);
        } catch {
          /* if room fetch fails, fall through and try host init */
        }
        if (!isHostPlayer) {
          setWaitingForHost(true);
          return;
        }
        const seeded = Engine.initGame(loaded);
        const moveResult = await submitMove(roomId, {
          type: "init",
          playerId: "me",
          roomConfig: loaded,
        });
        if (!cancelled) {
          setGame((moveResult.gameState as GameState) || seeded);
        }
      } catch {
        if (!cancelled) {
          setGame(saved?.status === "active" ? saved.gameState : Engine.initGame(loaded));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    const shouldUseBackend = BACKEND_ENABLED && isUuid(roomId);
    if (!shouldUseBackend) {
      setSyncStatus("local");
      return;
    }
    // Bot matches run entirely client-side; no polling needed and it causes
    // jitter by overwriting locally-applied bot moves with stale server state.
    if (isBotMatch) {
      setSyncStatus("local");
      return;
    }
    const off = subscribeRoomState(
      roomId,
      (next) => {
        if (next) setGame(next as GameState);
      },
      (status) => {
        if (status === "connected") setSyncStatus("live");
        else if (status === "connecting") setSyncStatus("connecting");
      },
    );
    return off;
  }, [roomId, isBotMatch]);

  useEffect(() => {
    if (!waitingForHost || !BACKEND_ENABLED || !isUuid(roomId)) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = (await getRoomState(roomId)) as GameState | null;
        if (cancelled || !next) return;
        setGame(next);
        setWaitingForHost(false);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(tick, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [waitingForHost, roomId]);

  useEffect(() => {
    if (!game) return;
    gameRef.current = game;
    saveActiveMatch(roomId, game);
  }, [roomId, game]);

  const meIndex = useMemo(() => {
    if (!game) return -1;
    const idx = game.players.findIndex((p) => p.id === meId);
    // Fall back to index 0 only for local games where meId might not match yet.
    return idx >= 0 ? idx : backendActive ? -1 : 0;
  }, [game, meId, backendActive]);
  const me = meIndex >= 0 ? (game?.players[meIndex] ?? null) : null;
  const current = game?.players[game.currentPlayerIndex];

  const pushToast = useCallback((text: string) => {
    setToasts((prev) => [text, ...prev].slice(0, 3));
  }, []);

  const advanceTurn = useCallback((state: GameState) => {
    return {
      ...state,
      currentPlayerIndex: Engine.nextPlayerIndex(
        state.currentPlayerIndex,
        state.players.length,
        state.direction,
      ),
    };
  }, []);

  const settleWinner = useCallback((state: GameState, winnerId: string) => {
    const points = state.players
      .filter((p) => p.id !== winnerId)
      .reduce((sum, p) => sum + Engine.calculateScore(p.hand), 0);
    setScores((prev) => ({ ...prev, [winnerId]: (prev[winnerId] || 0) + points }));
    pushToast(`${state.players.find((p) => p.id === winnerId)?.name || "Player"} won the hand (+${points})`);
    return { ...state, phase: "finished" as const, winner: winnerId };
  }, [pushToast]);

  // Shared local move application — used by both bot-match and pure-local modes.
  const applyPlayLocally = useCallback((state: GameState, card: EngineCard, playerId: string): GameState | null => {
    const playerIdx = state.players.findIndex((p) => p.id === playerId);
    if (playerIdx < 0) return null;
    const pendingDraw = Number(state.pendingDraw || 0);
    if (pendingDraw > 0 && !(state.rules.stack && (card.value === "draw2" || card.value === "wild4"))) return null;
    if (!Engine.canPlay(card, state.topCard, state.currentColor, state.rules) && pendingDraw <= 0) return null;
    const nextPlayers = state.players.map((p, i) =>
      i === playerIdx ? { ...p, hand: p.hand.filter((c) => c.id !== card.id) } : p,
    );
    let next: GameState = {
      ...state,
      players: nextPlayers,
      discardPile: [...state.discardPile, state.topCard],
      topCard: card,
      currentColor: card.color === "wild" ? bestWildColor(nextPlayers[playerIdx].hand) : card.color,
    };
    next = Engine.applyCardEffect(next, card);
    return next;
  }, []);

  const applyDrawLocally = useCallback((state: GameState): { next: GameState; count: number } => {
    const drawCount = Number(state.pendingDraw || 0) > 0 ? Number(state.pendingDraw) : 1;
    const drawn = Engine.drawMultiple(state.deck, drawCount, state.discardPile);
    const nextPlayers = state.players.map((p, i) =>
      i === state.currentPlayerIndex ? { ...p, hand: [...p.hand, ...drawn.drawnCards] } : p,
    );
    let next: GameState = { ...state, players: nextPlayers, deck: drawn.newDeck, discardPile: drawn.newDiscardPile, pendingDraw: 0 };
    if (!state.rules.drawPlay || drawCount > 1) next = advanceTurn(next);
    return { next, count: drawCount };
  }, [advanceTurn]);

  const onPlay = (card: EngineCard) => {
    if (!game || !current || current.id !== meId || game.phase !== "playing") return;

    // Always apply locally first — instant feedback for the player.
    const nextState = applyPlayLocally(game, card, current.id);
    if (!nextState) return;

    const winner = Engine.checkWinner(nextState, current.id);
    const finalState = winner.isWinner ? settleWinner(nextState, current.id) : advanceTurn(nextState);
    setGame(finalState);

    // Persist to backend in background (bot match or regular backend).
    if (backendActive) {
      submitMove(roomId, {
        type: "play",
        playerId: current.id,
        cardId: card.id,
        chosenColor: card.color === "wild" ? bestWildColor(game.players[game.currentPlayerIndex].hand) : undefined,
        gameState: finalState,
      }).catch((err: any) => pushToast(err?.message || "Sync failed"));
    }
  };

  const onDraw = () => {
    if (!game || !current || current.id !== meId || game.phase !== "playing") return;

    const { next: nextState, count: drawCount } = applyDrawLocally(game);
    pushToast(
      drawCount > 1
        ? `You drew ${drawCount} cards and lost your turn`
        : game.rules.drawPlay
          ? "You drew a card"
          : "You drew and passed",
    );
    setGame(nextState);

    // Persist to backend in background.
    if (backendActive) {
      submitMove(roomId, {
        type: "draw",
        playerId: current.id,
        gameState: nextState,
      }).catch((err: any) => pushToast(err?.message || "Sync failed"));
    }
  };

  const nextRound = () => {
    setRound((r) => r + 1);
    setGame(Engine.initGame(config));
  };

  useEffect(() => {
    if (!game || game.phase !== "playing") return;
    const player = game.players[game.currentPlayerIndex];
    if (!player?.isBot) return;
    let cancelled = false;
    (async () => {
      // Small thinking delay so bot turns feel natural, not instant.
      await new Promise((res) => setTimeout(res, 600));
      if (cancelled) return;
      const move = await BotAdapter.takeTurn(game, player.id);
      if (!move || cancelled) return;
      // Re-read latest state from ref to avoid stale closure overwriting a
      // concurrent update (e.g. human move processed while bot was thinking).
      const latest = gameRef.current;
      if (!latest || latest.phase !== "playing") return;
      const latestPlayer = latest.players[latest.currentPlayerIndex];
      if (!latestPlayer || latestPlayer.id !== player.id) return;

      let nextState: GameState;

      if (move.action === "draw") {
        const count = Number(latest.pendingDraw || 0) || 1;
        const drawn = Engine.drawMultiple(latest.deck, count, latest.discardPile);
        const nextPlayers = latest.players.map((p, i) =>
          i === latest.currentPlayerIndex ? { ...p, hand: [...p.hand, ...drawn.drawnCards] } : p,
        );
        pushToast(`${player.name} drew ${count} card${count > 1 ? "s" : ""}`);
        nextState = advanceTurn({
          ...latest,
          players: nextPlayers,
          deck: drawn.newDeck,
          discardPile: drawn.newDiscardPile,
          pendingDraw: 0,
        });
      } else {
        const botCard = latestPlayer.hand.find((c) => c.id === move.cardId);
        if (!botCard) return;
        const nextPlayers = latest.players.map((p, i) =>
          i === latest.currentPlayerIndex ? { ...p, hand: p.hand.filter((c) => c.id !== botCard.id) } : p,
        );
        nextState = {
          ...latest,
          players: nextPlayers,
          discardPile: [...latest.discardPile, latest.topCard],
          topCard: botCard,
          currentColor: botCard.color === "wild" ? move.chosenColor || "red" : botCard.color,
        };
        nextState = Engine.applyCardEffect(nextState, botCard);
        const winner = Engine.checkWinner(nextState, player.id);
        if (winner.isWinner) {
          setGame(settleWinner(nextState, player.id));
          // Persist final state to backend if active.
          if (backendActive) {
            submitMove(roomId, {
              type: "play",
              playerId: player.id,
              cardId: botCard.id,
              chosenColor: move.chosenColor,
              gameState: settleWinner(nextState, player.id),
            }).catch(() => undefined);
          }
          return;
        }
        nextState = advanceTurn(nextState);
      }

      setGame(nextState);

      // In backend mode, persist the bot's move as a background side-effect.
      if (backendActive) {
        if (move.action === "draw") {
          submitMove(roomId, {
            type: "draw",
            playerId: player.id,
            gameState: nextState,
          }).catch(() => undefined);
        } else {
          submitMove(roomId, {
            type: "play",
            playerId: player.id,
            cardId: move.cardId,
            chosenColor: move.chosenColor,
            gameState: nextState,
          }).catch(() => undefined);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [game, backendActive, roomId, advanceTurn, settleWinner, pushToast]);

  if (waitingForHost) {
    return (
      <div className="table-wrap wait-host-wrap">
        <div className="wait-host-card">
          <h2 className="display wait-host-title">Waiting for host</h2>
          <p className="wait-host-copy">The table opens as soon as the host starts the match.</p>
          <p className="chip wait-host-room" title={roomId}>
            Room {roomId.slice(0, 8)}…{roomId.slice(-4)}
          </p>
          <Link className="btn primary" href="/lobby">
            Back to lobby
          </Link>
        </div>
      </div>
    );
  }

  if (!game || !current) return null;

  const rawTurnLabel = current.id === meId ? "Your turn" : `${current.name}'s turn`;
  const turnLabel = rawTurnLabel.length > 20 ? `${rawTurnLabel.slice(0, 18)}…` : rawTurnLabel;

  return (
    <div className="table-wrap">
      <div className="table-top-chrome">
        <Link className="btn ghost sm" href="/lobby">
          ← Leave
        </Link>
        <span className="chip live room-chip-truncate" title={roomId}>
          Room {roomId.slice(0, 8)}…{roomId.slice(-4)}
        </span>
        <span className="chip">Round {round}</span>
        <span className="chip">{backendActive ? `sync:${syncStatus}` : "sync:local"}</span>
        <span className="chip turn-chip" title={current.id === meId ? "Your turn" : `${current.name}'s turn`}>
          {turnLabel}
        </span>
      </div>
      <div className="felt">
        <div className="felt-bg felt-neon" />
        <div className="felt-inner">
          <div className="opponents">
            {game.players
              .filter((p) => p.id !== meId)
              .map((p) => (
                <div key={p.id} className="opponent">
                  <div className="op-cards-count">{p.hand.length}</div>
                  <div className="op-hand">
                    {Array.from({ length: Math.min(5, p.hand.length) }).map((_, i) => (
                      <Card key={i} back size="sm" />
                    ))}
                  </div>
                  <div className="op-name-tag">{p.name}</div>
                </div>
              ))}
          </div>
          <div className="play-area">
            <div className="centered-col">
              <div className="chip">Draw pile ({game.deck.length})</div>
              <div className="deck-stack-wrap">
                <button
                  className="deck-stack"
                  onClick={onDraw}
                  disabled={current.id !== meId}
                  aria-label="Draw card"
                  title="Draw card"
                >
                  <Card back size="lg" />
                  <Card back size="lg" />
                  <Card back size="lg" />
                </button>
              </div>
            </div>
            <div className="direction-indicator">{game.direction === "cw" ? "↻" : "↺"}</div>
            <div className="centered-col">
              <div className="chip">
                Discard
                {game.pendingDraw ? ` · +${game.pendingDraw}` : ""}
              </div>
              <Card color={game.topCard.color} value={game.topCard.value} size="lg" />
            </div>
          </div>
          <div className="player-area">
            <div className="player-bar">
              <span className="chip ok">{game.phase === "finished" ? "Hand finished" : "Play a card or draw"}</span>
              <span className="chip">Score: {scores[meId] || 0}</span>
            </div>
            <div className="hand">
              {(me?.hand ?? []).map((c) => (
                <button
                  key={c.id}
                  onClick={() => onPlay(c)}
                  className="card-button"
                  disabled={current.id !== meId || game.phase !== "playing"}
                  aria-label={`Play ${c.color} ${c.value}`}
                  title={`Play ${c.color} ${c.value}`}
                >
                  <Card color={c.color} value={c.value} />
                </button>
              ))}
            </div>
            {game.phase === "finished" ? (
              <div className="mt-12">
                <button className="btn primary" onClick={nextRound}>
                  Next hand
                </button>
              </div>
            ) : null}
            <div className="toast-stack">
              {toasts.map((t, i) => (
                <div key={`${t}-${i}`} className="chip">
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {game.phase === "finished" ? <Confetti /> : null}
    </div>
  );
}
