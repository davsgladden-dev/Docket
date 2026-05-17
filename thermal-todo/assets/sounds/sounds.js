// ═══════════════════════════════════════════════════════════
// DOCKET — PROCEDURAL SOUND ENGINE
// All sounds synthesized via Web Audio API. No files needed.
// ═══════════════════════════════════════════════════════════

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.initialized = false;
    }

    // Lazy-init on first user gesture (browser requirement)
    _ensureContext() {
        if (!this.initialized) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    // Helper: create a buffer filled with noise
    _noiseBuffer(duration) {
        const ctx = this.ctx;
        const len = Math.floor(ctx.sampleRate * duration);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buf;
    }

    // ── THERMAL PRINTER ─────────────────────────────────────────
// Replace ONLY the playPrint method in your sounds.js with this.
// Everything else (playTear, playCheck, etc.) stays the same.
//
// Sound design: models the actual thermal printer motion —
//   SWEEP: head moves left→right (high-pitched whine)
//   ADVANCE: paper feeds one line (low mechanical thunk)
//   Repeat for duration of print.
//
    playPrint(duration = 2.1) {
        const ctx = this._ensureContext();
        const now = ctx.currentTime;

        // How many sweep+advance cycles fit in the duration
        // Real thermal printers do roughly 3-5 lines/sec
        const linesPerSec = 4;
        const cycleTime   = 1 / linesPerSec;           // ~0.25s per line
        const sweepTime   = cycleTime * 0.72;           // 72% sweep
        const advanceTime = cycleTime * 0.28;           // 28% paper advance

        const totalCycles = Math.floor(duration / cycleTime);

        // Master gain — fade in/out
        const master = ctx.createGain();
        master.gain.setValueAtTime(0, now);
        master.gain.linearRampToValueAtTime(0.2, now + 0.05);
        master.gain.setValueAtTime(0.2, now + duration - 0.08);
        master.gain.linearRampToValueAtTime(0, now + duration);
        master.connect(ctx.destination);

        for (let i = 0; i < totalCycles; i++) {
            const cycleStart = now + i * cycleTime;

            // ── SWEEP: head moving across the paper ──────────────
            // A short noise burst bandpass-filtered to a tight high-
            // frequency band, panned slightly left→right using gain
            // nodes on L/R channels (stereo not available in mono,
            // so we simulate with pitch glide instead — higher pitch
            // as head accelerates from left, slight drop at right end).
            const sweepLen = Math.floor(ctx.sampleRate * sweepTime);
            const sweepBuf = ctx.createBuffer(1, sweepLen, ctx.sampleRate);
            const sweepData = sweepBuf.getChannelData(0);

            for (let s = 0; s < sweepLen; s++) {
                const t   = s / ctx.sampleRate;
                const pos = t / sweepTime;           // 0→1 across the sweep

                // Envelope: quick ramp up, hold, quick ramp down at edges
                const attack  = Math.min(pos / 0.08, 1);
                const release = Math.min((1 - pos) / 0.08, 1);
                const env     = Math.min(attack, release);

                // The print head buzz — mix of noise and a slight tonal component
                const noise  = (Math.random() * 2 - 1);
                sweepData[s] = noise * env;
            }

            const sweepSrc = ctx.createBufferSource();
            sweepSrc.buffer = sweepBuf;

            // Bandpass the sweep: thermal head characteristic ~3–5kHz
            const sweepBP = ctx.createBiquadFilter();
            sweepBP.type      = 'bandpass';
            sweepBP.frequency.value = 3600;
            sweepBP.Q.value   = 3;

            // High shelf adds the "edge" of the head on paper
            const sweepHS = ctx.createBiquadFilter();
            sweepHS.type      = 'highshelf';
            sweepHS.frequency.value = 6000;
            sweepHS.gain.value      = 4;

            const sweepGain = ctx.createGain();
            sweepGain.gain.value = 0.32;

            sweepSrc.connect(sweepBP);
            sweepBP.connect(sweepHS);
            sweepHS.connect(sweepGain);
            sweepGain.connect(master);
            sweepSrc.start(cycleStart);
            sweepSrc.stop(cycleStart + sweepTime);

            // Pitch glide on the sweep — subtle frequency modulation
            // simulates the head changing direction/speed slightly
            sweepBP.frequency.setValueAtTime(3200, cycleStart);
            sweepBP.frequency.linearRampToValueAtTime(4200, cycleStart + sweepTime * 0.5);
            sweepBP.frequency.linearRampToValueAtTime(3400, cycleStart + sweepTime);

            // ── ADVANCE: paper steps forward one line ─────────────
            // A short low thunk — the stepper motor kicking the paper
            // roller forward by one line height.
            const advStart = cycleStart + sweepTime;

            const advOsc = ctx.createOscillator();
            advOsc.type = 'sine';
            // Short pitch drop — mechanical "clunk" character
            advOsc.frequency.setValueAtTime(220, advStart);
            advOsc.frequency.exponentialRampToValueAtTime(80, advStart + advanceTime);

            const advGain = ctx.createGain();
            advGain.gain.setValueAtTime(0, advStart);
            advGain.gain.linearRampToValueAtTime(0.12, advStart + 0.008);  // fast attack
            advGain.gain.exponentialRampToValueAtTime(0.001, advStart + advanceTime);

            // Add a noise component to the advance for the "paper grip" texture
            const advNoiseLen = Math.floor(ctx.sampleRate * advanceTime);
            const advNoiseBuf = ctx.createBuffer(1, advNoiseLen, ctx.sampleRate);
            const advNoiseData = advNoiseBuf.getChannelData(0);
            for (let s = 0; s < advNoiseLen; s++) {
                const t = s / ctx.sampleRate;
                advNoiseData[s] = (Math.random() * 2 - 1) * Math.exp(-t * 30);
            }

            const advNoiseSrc = ctx.createBufferSource();
            advNoiseSrc.buffer = advNoiseBuf;

            const advNoiseLP = ctx.createBiquadFilter();
            advNoiseLP.type = 'lowpass';
            advNoiseLP.frequency.value = 800;

            const advNoiseGain = ctx.createGain();
            advNoiseGain.gain.value = 0.15;

            advOsc.connect(advGain);
            advGain.connect(master);

            advNoiseSrc.connect(advNoiseLP);
            advNoiseLP.connect(advNoiseGain);
            advNoiseGain.connect(master);

            advOsc.start(advStart);
            advOsc.stop(advStart + advanceTime);
            advNoiseSrc.start(advStart);
            advNoiseSrc.stop(advStart + advanceTime);
        }

        return {
            stop: () => {
                master.gain.cancelScheduledValues(ctx.currentTime);
                master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.06);
            }
        };
    }

    // ── PAPER TEAR ──────────────────────────────────────────
    // Noise burst with crackle, high-pass filtered
    playTear() {
        const ctx = this._ensureContext();
        const now = ctx.currentTime;
        const dur = 0.32;

        const len = Math.floor(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);

        for (let i = 0; i < len; i++) {
            const t = i / ctx.sampleRate;
            // Quick attack → exponential decay with crackle
            const env = t < 0.015 ? (t / 0.015) : Math.exp(-t * 14);
            const crackle = Math.random() > 0.65 ? 1.6 : 1.0;
            data[i] = (Math.random() * 2 - 1) * env * crackle;
        }

        const src = ctx.createBufferSource();
        src.buffer = buf;

        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 2200;

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 5500;
        bp.Q.value = 0.6;

        const gain = ctx.createGain();
        gain.gain.value = 0.28;

        src.connect(hp);
        hp.connect(bp);
        bp.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
        src.stop(now + dur);
    }

    // ── CHECKBOX CHECK ──────────────────────────────────────
    // Quick descending "tick" — satisfying positive feedback
    playCheck() {
        const ctx = this._ensureContext();
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.035);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.13, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    // ── CHECKBOX UNCHECK ────────────────────────────────────
    // Lower pitched "tock" — softer, undo feeling
    playUncheck() {
        const ctx = this._ensureContext();
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.045);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
    }

    // ── CONFETTI CELEBRATION ────────────────────────────────
    // Major chord arpeggio (C-E-G) + shimmer burst
    playConfetti() {
        const ctx = this._ensureContext();
        const now = ctx.currentTime;

        // Ascending "ta-da!" — C5, E5, G5
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, i) => {
            const t = now + i * 0.07;
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.13, t + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.4);
        });

        // Sparkle/shimmer overlay
        const shimDur = 0.45;
        const shimLen = Math.floor(ctx.sampleRate * shimDur);
        const shimBuf = ctx.createBuffer(1, shimLen, ctx.sampleRate);
        const shimData = shimBuf.getChannelData(0);

        for (let i = 0; i < shimLen; i++) {
            const t = i / ctx.sampleRate;
            shimData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 7) * 0.12;
        }

        const shimSrc = ctx.createBufferSource();
        shimSrc.buffer = shimBuf;

        const shimHP = ctx.createBiquadFilter();
        shimHP.type = 'highpass';
        shimHP.frequency.value = 6000;

        const shimGain = ctx.createGain();
        shimGain.gain.value = 0.35;

        shimSrc.connect(shimHP);
        shimHP.connect(shimGain);
        shimGain.connect(ctx.destination);
        shimSrc.start(now);
        shimSrc.stop(now + shimDur);
    }

    // ── PAPER CRUMPLE ───────────────────────────────────────
    // Multiple crinkle bursts layered with crackling texture
    playCrumple() {
        const ctx = this._ensureContext();
        const now = ctx.currentTime;
        const dur = 0.5;

        const len = Math.floor(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);

        for (let i = 0; i < len; i++) {
            const t = i / ctx.sampleRate;

            // Overall fade envelope
            const fade = Math.exp(-t * 3.5);

            // Individual crinkle bursts at staggered times
            const c1 = Math.exp(-((t - 0.03) ** 2) / 0.001);
            const c2 = Math.exp(-((t - 0.08) ** 2) / 0.0015);
            const c3 = Math.exp(-((t - 0.14) ** 2) / 0.002);
            const c4 = Math.exp(-((t - 0.19) ** 2) / 0.001);
            const c5 = Math.exp(-((t - 0.25) ** 2) / 0.0018);
            const c6 = Math.exp(-((t - 0.30) ** 2) / 0.001);
            const c7 = Math.exp(-((t - 0.35) ** 2) / 0.0012);
            const bursts = c1 + c2 + c3 + c4 + c5 + c6 + c7;

            const env = fade * 0.25 + bursts * 0.75;

            // Crackling modulation (random amplitude variation)
            const crackle = Math.random() > 0.4 ? 1.3 : 0.6;
            data[i] = (Math.random() * 2 - 1) * env * crackle * 0.45;
        }

        const src = ctx.createBufferSource();
        src.buffer = buf;

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 3500;
        bp.Q.value = 0.7;

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 7000;

        const gain = ctx.createGain();
        gain.gain.value = 0.3;

        src.connect(bp);
        bp.connect(lp);
        lp.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
        src.stop(now + dur);
    }
}

// Single global instance
const sounds = new SoundEngine();