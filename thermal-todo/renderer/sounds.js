// ═══════════════════════════════════════════════════════════
// THERMAL TODO — PROCEDURAL SOUND ENGINE
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

    // ── THERMAL PRINTER ─────────────────────────────────────
    // Three layers: stepper motor clicks + low hum + print head noise
    playPrint(duration = 2.1) {
        const ctx = this._ensureContext();
        const now = ctx.currentTime;

        // Master gain (fade in/out)
        const master = ctx.createGain();
        master.gain.setValueAtTime(0, now);
        master.gain.linearRampToValueAtTime(0.18, now + 0.06);
        master.gain.setValueAtTime(0.18, now + duration - 0.12);
        master.gain.linearRampToValueAtTime(0, now + duration);
        master.connect(ctx.destination);

        // ── Layer 1: Stepper motor clicks (dominant) ──────────
        const stepsPerSec = 14;
        const samplesPerStep = Math.floor(ctx.sampleRate / stepsPerSec);
        const stepLen = Math.floor(ctx.sampleRate * duration);
        const stepBuf = ctx.createBuffer(1, stepLen, ctx.sampleRate);
        const stepData = stepBuf.getChannelData(0);

        for (let i = 0; i < stepLen; i++) {
            const posInStep = (i % samplesPerStep) / samplesPerStep;
            // Sharp burst at start of each step, then silence
            const env = posInStep < 0.12 ? (1 - posInStep / 0.12) : 0;
            stepData[i] = (Math.random() * 2 - 1) * env;
        }

        const stepSrc = ctx.createBufferSource();
        stepSrc.buffer = stepBuf;

        const stepBP = ctx.createBiquadFilter();
        stepBP.type = 'bandpass';
        stepBP.frequency.value = 1100;
        stepBP.Q.value = 1.8;

        const stepGain = ctx.createGain();
        stepGain.gain.value = 0.7;

        stepSrc.connect(stepBP);
        stepBP.connect(stepGain);
        stepGain.connect(master);
        stepSrc.start(now);
        stepSrc.stop(now + duration);

        // ── Layer 2: Low mechanical hum ───────────────────────
        const hum = ctx.createOscillator();
        hum.type = 'sawtooth';
        hum.frequency.value = 115;

        const humLP = ctx.createBiquadFilter();
        humLP.type = 'lowpass';
        humLP.frequency.value = 280;

        const humGain = ctx.createGain();
        humGain.gain.value = 0.09;

        hum.connect(humLP);
        humLP.connect(humGain);
        humGain.connect(master);
        hum.start(now);
        hum.stop(now + duration);

        // ── Layer 3: High-freq print head whine ───────────────
        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = this._noiseBuffer(duration);

        const noiseBP = ctx.createBiquadFilter();
        noiseBP.type = 'bandpass';
        noiseBP.frequency.value = 4200;
        noiseBP.Q.value = 3;

        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.035;

        noiseSrc.connect(noiseBP);
        noiseBP.connect(noiseGain);
        noiseGain.connect(master);
        noiseSrc.start(now);
        noiseSrc.stop(now + duration);

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
}

// Single global instance
const sounds = new SoundEngine();