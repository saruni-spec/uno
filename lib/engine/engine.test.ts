import { describe, expect, it } from "vitest";
import { Engine } from "./index";

describe("Engine Phase 1 parity", () => {
  it("creates standard 108-card deck", () => {
    const deck = Engine.createDeck();
    expect(deck).toHaveLength(108);
  });

  it("drawMultiple reshuffles discard when deck is empty", () => {
    const draw = Engine.drawMultiple([], 3, [
      { id: "d1", color: "red", value: "1" },
      { id: "d2", color: "blue", value: "2" },
      { id: "d3", color: "green", value: "3" },
    ]);
    expect(draw.drawnCards).toHaveLength(3);
    expect(draw.shortBy).toBe(0);
  });

  it("initGame always picks a valid top card", () => {
    const state = Engine.initGame({
      roomId: "r1",
      players: [
        { id: "p1", name: "P1" },
        { id: "p2", name: "P2" },
      ],
      handSize: 7,
      rules: { drawPlay: false },
      mode: "solo",
    });
    expect(state.topCard).toBeDefined();
    expect(state.currentColor).toBeDefined();
    expect(state.players[0].hand.length).toBe(7);
  });

  it("scores action and wild cards correctly", () => {
    const score = Engine.calculateScore([
      { id: "a", color: "red", value: "skip" },
      { id: "b", color: "wild", value: "wild4" },
      { id: "c", color: "yellow", value: "9" },
    ]);
    expect(score).toBe(79);
  });
});
