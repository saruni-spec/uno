"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ensureSession,
  getRoomState,
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
  const [config, setConfig] = useState<InitGameConfig>(FALLBACK_CONFIG);
  const [game, setGame] = useState<GameState | null>(null);
  const [toasts, setToasts] = useState<string[]>([]);
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [syncStatus, setSyncStatus] = useState<"local" | "connecting" | "live">("local");

  useEffect(() => {
    const shouldUseBackend = BACKEND_ENABLED && isUuid(roomId);
    const loaded = loadRoomConfig(roomId) || { ...FALLBACK_CONFIG, roomId };
    const saved = loadActiveMatch(roomId);
    const nextScores: Record<string, number> = {};
    loaded.players.forEach((p) => {
      nextScores[p.id] = 0;
    });
    setScores(nextScores);
    setConfig(loaded);
    if (!shouldUseBackend) {
      setSyncStatus("local");
      setGame(saved?.status === "active" ? saved.gameState : Engine.initGame(loaded));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        const remote = (await getRoomState(roomId)) as GameState | null;
        if (cancelled) return;
        if (remote) {
          setGame(remote);
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
  }, [roomId]);

  useEffect(() => {
    if (!game) return;
    saveActiveMatch(roomId, game);
  }, [roomId, game]);

  const meIndex = useMemo(
    () => game?.players.findIndex((p) => p.id === "me") ?? 0,
    [game?.players],
  );
  const me = game?.players[meIndex] || null;
  const current = game?.players[game.currentPlayerIndex];

  const pushToast = (text: string) => {
    setToasts((prev) => [text, ...prev].slice(0, 3));
  };

  const advanceTurn = (state: GameState) => {
    return {
      ...state,
      currentPlayerIndex: Engine.nextPlayerIndex(
        state.currentPlayerIndex,
        state.players.length,
        state.direction,
      ),
    };
  };

  const settleWinner = (state: GameState, winnerId: string) => {
    const points = state.players
      .filter((p) => p.id !== winnerId)
      .reduce((sum, p) => sum + Engine.calculateScore(p.hand), 0);
    setScores((prev) => ({ ...prev, [winnerId]: (prev[winnerId] || 0) + points }));
    pushToast(`${state.players.find((p) => p.id === winnerId)?.name || "Player"} won the hand (+${points})`);
    return { ...state, phase: "finished" as const, winner: winnerId };
  };

  const onPlay = async (card: EngineCard) => {
    if (!game || !current || current.id !== "me" || game.phase !== "playing") return;
    if (backendActive) {
      try {
        const moveResult = await submitMove(roomId, {
          type: "play",
          playerId: current.id,
          cardId: card.id,
          chosenColor:
            card.color === "wild"
              ? bestWildColor(game.players[game.currentPlayerIndex].hand)
              : undefined,
        });
        setGame(moveResult.gameState as GameState);
      } catch (error: any) {
        pushToast(error?.message || "Move failed");
      }
      return;
    }

    const player = game.players[game.currentPlayerIndex];
    const cardIndex = player.hand.findIndex((c) => c.id === card.id);
    if (cardIndex < 0) return;

    const pendingDraw = Number(game.pendingDraw || 0);
    if (pendingDraw > 0 && !(game.rules.stack && (card.value === "draw2" || card.value === "wild4"))) return;
    if (!Engine.canPlay(card, game.topCard, game.currentColor, game.rules) && pendingDraw <= 0) return;

    const nextPlayers = game.players.map((p, i) =>
      i === game.currentPlayerIndex ? { ...p, hand: p.hand.filter((c) => c.id !== card.id) } : p,
    );

    let nextState: GameState = {
      ...game,
      players: nextPlayers,
      discardPile: [...game.discardPile, game.topCard],
      topCard: card,
      currentColor: card.color === "wild" ? bestWildColor(nextPlayers[game.currentPlayerIndex].hand) : card.color,
    };
    nextState = Engine.applyCardEffect(nextState, card);
    const winner = Engine.checkWinner(nextState, player.id);
    if (winner.isWinner) {
      setGame(settleWinner(nextState, player.id));
      return;
    }
    setGame(advanceTurn(nextState));
  };

  const onDraw = async () => {
    if (!game || !current || current.id !== "me" || game.phase !== "playing") return;
    if (backendActive) {
      try {
        const moveResult = await submitMove(roomId, {
          type: "draw",
          playerId: current.id,
        });
        setGame(moveResult.gameState as GameState);
      } catch (error: any) {
        pushToast(error?.message || "Draw failed");
      }
      return;
    }

    const drawCount = Number(game.pendingDraw || 0) > 0 ? Number(game.pendingDraw) : 1;
    const drawn = Engine.drawMultiple(game.deck, drawCount, game.discardPile);
    const nextPlayers = game.players.map((p, i) =>
      i === game.currentPlayerIndex ? { ...p, hand: [...p.hand, ...drawn.drawnCards] } : p,
    );
    let nextState: GameState = {
      ...game,
      players: nextPlayers,
      deck: drawn.newDeck,
      discardPile: drawn.newDiscardPile,
      pendingDraw: game.pendingDraw ? 0 : game.pendingDraw,
    };
    pushToast(
      drawCount > 1
        ? `You drew ${drawCount} cards and lost your turn`
        : game.rules.drawPlay
          ? "You drew a card"
          : "You drew and passed",
    );
    if (!game.rules.drawPlay || drawCount > 1) {
      nextState = advanceTurn(nextState);
    }
    setGame(nextState);
  };

  const nextRound = () => {
    setRound((r) => r + 1);
    setGame(Engine.initGame(config));
  };

  useEffect(() => {
    if (!game || game.phase !== "playing" || backendActive) return;
    const player = game.players[game.currentPlayerIndex];
    if (!player?.isBot) return;
    let cancelled = false;
    (async () => {
      const move = await BotAdapter.takeTurn(game, player.id);
      if (!move || cancelled) return;
      if (move.action === "draw") {
        const count = Number(game.pendingDraw || 0) || 1;
        const drawn = Engine.drawMultiple(game.deck, count, game.discardPile);
        const nextPlayers = game.players.map((p, i) =>
          i === game.currentPlayerIndex ? { ...p, hand: [...p.hand, ...drawn.drawnCards] } : p,
        );
        pushToast(`${player.name} drew ${count} card${count > 1 ? "s" : ""}`);
        setGame(
          advanceTurn({
            ...game,
            players: nextPlayers,
            deck: drawn.newDeck,
            discardPile: drawn.newDiscardPile,
            pendingDraw: 0,
          }),
        );
        return;
      }
      const botCard = player.hand.find((c) => c.id === move.cardId);
      if (!botCard) return;
      const nextPlayers = game.players.map((p, i) =>
        i === game.currentPlayerIndex ? { ...p, hand: p.hand.filter((c) => c.id !== botCard.id) } : p,
      );
      let nextState: GameState = {
        ...game,
        players: nextPlayers,
        discardPile: [...game.discardPile, game.topCard],
        topCard: botCard,
        currentColor: botCard.color === "wild" ? move.chosenColor || "red" : botCard.color,
      };
      nextState = Engine.applyCardEffect(nextState, botCard);
      const winner = Engine.checkWinner(nextState, player.id);
      if (winner.isWinner) {
        setGame(settleWinner(nextState, player.id));
        return;
      }
      setGame(advanceTurn(nextState));
    })();
    return () => {
      cancelled = true;
    };
  }, [game]);

  if (!game || !me || !current) return null;

  return (
    <div className="table-wrap">
      <div className="table-top-chrome">
        <Link className="btn ghost sm" href="/lobby">
          ← Leave
        </Link>
        <span className="chip live">Room {roomId}</span>
        <span className="chip">Round {round}</span>
        <span className="chip">{backendActive ? `sync:${syncStatus}` : "sync:local"}</span>
        <span className="chip">{current.id === "me" ? "Your turn" : `${current.name}'s turn`}</span>
      </div>
      <div className="felt">
        <div className="felt-bg felt-neon" />
        <div className="felt-inner">
          <div className="opponents">
            {game.players
              .filter((p) => p.id !== "me")
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
                  disabled={current.id !== "me"}
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
              <span className="chip">Score: {scores.me || 0}</span>
            </div>
            <div className="hand">
              {me.hand.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onPlay(c)}
                  className="card-button"
                  disabled={current.id !== "me" || game.phase !== "playing"}
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
