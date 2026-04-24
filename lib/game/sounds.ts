"use client";

/**
 * Tiny Web Audio API synthesiser — no audio files needed.
 * All sounds are generated procedurally so they work everywhere without assets.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Resume if browser suspended it (autoplay policy)
  if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(
  freq: number,
  type: OscillatorType,
  gainPeak: number,
  duration: number,
  startDelay = 0,
  freqEnd?: number,
) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  const t = c.currentTime + startDelay;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd !== undefined) osc.frequency.linearRampToValueAtTime(freqEnd, t + duration);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(gainPeak, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export const Sounds = {
  /** Card slap — low thud */
  play() {
    tone(180, "sine", 0.28, 0.08);
    tone(320, "triangle", 0.12, 0.06, 0.01);
  },

  /** Paper whoosh for draw */
  draw() {
    tone(600, "sawtooth", 0.06, 0.12, 0, 200);
  },

  /** Descending blip for skip/reverse */
  skip() {
    tone(520, "square", 0.1, 0.07);
    tone(380, "square", 0.1, 0.07, 0.08);
  },

  /** Rising wild chord */
  wild() {
    tone(440, "sine", 0.15, 0.14);
    tone(554, "sine", 0.12, 0.14, 0.03);
    tone(659, "sine", 0.10, 0.14, 0.07);
  },

  /** UNO shout — punchy ascending pair */
  uno() {
    tone(440, "square", 0.18, 0.09);
    tone(660, "square", 0.22, 0.12, 0.1);
  },

  /** Win fanfare */
  win() {
    [0, 0.1, 0.2, 0.35].forEach((delay, i) => {
      tone([523, 659, 784, 1047][i], "sine", 0.18, 0.18, delay);
    });
  },

  /** Penalty buzz */
  penalty() {
    tone(160, "sawtooth", 0.18, 0.18, 0, 80);
  },
};
