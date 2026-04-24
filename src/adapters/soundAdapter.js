// Sound Adapter
// Uses Web Audio API to generate procedural sound effects
// No external audio files needed - all sounds synthesized in-browser

const SoundAdapter = {
  ctx: null,
  enabled: true,
  volume: 0.5,

  // Initialize audio context (must be called after user interaction)
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  // Toggle sound on/off
  setEnabled(enabled) {
    this.enabled = enabled;
  },

  // Set volume (0-1)
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  },

  // Play a sound if enabled
  play(fn) {
    if (!this.enabled || !this.ctx) return;
    try {
      fn(this.ctx, this.volume);
    } catch (e) {
      console.error('Sound error:', e);
    }
  },

  // Card flip sound - short paper-like noise
  cardFlip() {
    this.play((ctx, vol) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);

      filter.type = 'highpass';
      filter.frequency.value = 600;

      gain.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    });
  },

  // Card draw sound - slightly longer whoosh
  cardDraw() {
    this.play((ctx, vol) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(vol * 0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    });
  },

  // UNO shout - distinctive alert sound
  unoShout() {
    this.play((ctx, vol) => {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C major arpeggio
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.value = freq;

        const start = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(vol * 0.3, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.3);
      });
    });
  },

  // Win celebration - fanfare
  winCelebration() {
    this.play((ctx, vol) => {
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C major chord
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol * 0.25, ctx.currentTime + 0.1 + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 2);
      });
    });
  },

  // Turn notification - subtle ding
  turnNotification() {
    this.play((ctx, vol) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(vol * 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    });
  },

  // Wild card played - magical sound
  wildCard() {
    this.play((ctx, vol) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.5);

      lfo.frequency.value = 10;
      lfoGain.gain.value = 100;

      gain.gain.setValueAtTime(vol * 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(ctx.destination);

      lfo.start(ctx.currentTime);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
      lfo.stop(ctx.currentTime + 0.5);
    });
  },

  // Action card (skip, reverse, draw2) - punchy sound
  actionCard() {
    this.play((ctx, vol) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(vol * 0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    });
  },

  // Timer warning - ticking/beeping
  timerWarning() {
    this.play((ctx, vol) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = 1000;

      gain.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(vol * 0.3, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    });
  },

  // Button click - subtle feedback
  buttonClick() {
    this.play((ctx, vol) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(vol * 0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    });
  },
};

// Export for use
Object.assign(window, { SoundAdapter });
