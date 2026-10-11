// Sound effects, all made on the fly with the Web Audio API: there are no
// sound files. Noise shaped by filters makes the wind, rain, fire, splashes
// and explosions; simple tones make birdsong, crickets, chimes and the
// creatures' voices. Sounds are panned left or right to match where they
// happen in the world.

import * as El from './elements.js';

const MAX_VOICES = 48; // one-shot sounds playing at once, at most

// What each creature sounds like. f0 → f1: pitch glide (Hz), dur: seconds,
// formant: the filter that gives the voice its vowel, vib: [rate, depth] wobble,
// n: how many times it repeats (barks, clucks), gap: seconds between repeats.
const VOICES = {
  human:   { type: 'sawtooth', f0: 230, f1: 150, dur: 0.22, formant: 820, gain: 0.16 },
  zombie:  { type: 'sawtooth', f0: 115, f1: 82, dur: 0.75, formant: 520, vib: [5, 7], gain: 0.2 },
  robot:   { type: 'square', f0: 460, f1: 230, dur: 0.12, n: 2, gap: 0.14, formant: 1400, gain: 0.08 },
  dog:     { type: 'sawtooth', f0: 540, f1: 310, dur: 0.11, n: 2, gap: 0.17, formant: 1100, gain: 0.12 },
  cat:     { type: 'sawtooth', f0: 720, f1: 470, dur: 0.45, formant: 1500, vib: [6, 22], gain: 0.12 },
  sheep:   { type: 'sawtooth', f0: 340, f1: 300, dur: 0.6, formant: 950, vib: [9, 20], gain: 0.15 },
  chicken: { type: 'square', f0: 980, f1: 720, dur: 0.07, n: 3, gap: 0.1, formant: 1700, gain: 0.07 },
  bird:    { type: 'sine', f0: 3200, f1: 4300, dur: 0.07, n: 2, gap: 0.09, gain: 0.07 },
  frog:    { type: 'square', f0: 170, f1: 140, dur: 0.2, formant: 650, vib: [32, 40], gain: 0.1 },
  fish:    { type: 'sine', f0: 320, f1: 950, dur: 0.08, gain: 0.08 },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.voices = 0;
    this.t = 0;          // seconds of game time heard so far
    this.next = { bird: 2, cricket: 0, owl: 12, idle: 1, loops: 0, brush: 0 };
    this.lastAt = {};    // when each kind of rate-limited sound last played
    this.heard = new WeakMap(); // when each creature last made a sound
  }

  // Browsers only allow sound after the player clicks or presses a key, so
  // the sound system starts on the first one.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.on && !document.hidden) this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) this.attach(new AC());
  }

  // Set up the mixer, the noise and the loops that play all the time.
  attach(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.on ? 1 : 0;
    // A compressor keeps big moments (a chain of explosions) from clipping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    // Two seconds each of white noise (hiss) and brown noise (rumble).
    const n = ctx.sampleRate * 2;
    this.white = ctx.createBuffer(1, n, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, n, ctx.sampleRate);
    const w = this.white.getChannelData(0), b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      w[i] = Math.random() * 2 - 1;
      last = (last + 0.02 * w[i]) / 1.02;
      b[i] = last * 3.5;
    }
    this.wind = this.loop(this.brown, 'lowpass', 420, 0.6);
    this.rain = this.loop(this.white, 'bandpass', 2800, 0.5);
    this.roar = this.loop(this.brown, 'lowpass', 650, 0.8);
    this.gust = this.loop(this.white, 'bandpass', 700, 0.9);
  }

  setOn(on) {
    this.on = on;
    if (!this.ctx) return;
    if (on) { if (!document.hidden) this.ctx.resume(); }
    this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  // Quiet while the tab is hidden.
  setHidden(hidden) {
    if (!this.ctx) return;
    if (hidden) this.ctx.suspend(); else if (this.on) this.ctx.resume();
  }

  // ----- building blocks -----

  // A looping noise through a filter, starting silent.
  loop(buffer, type, freq, q) {
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buffer; src.loop = true;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(0, Math.random() * 1.5);
    return { g, f };
  }

  // Where a one-shot goes: through a left-right panner, if the browser has one.
  out(pan) {
    if (!pan || !this.ctx.createStereoPanner) return this.master;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(this.master);
    return p;
  }

  ready() { return this.ctx && this.on && this.ctx.state === 'running' && this.voices < MAX_VOICES; }

  // At most one of `key` every `gap` seconds.
  limit(key, gap) {
    const now = this.ctx.currentTime;
    if (now - (this.lastAt[key] ?? -1e9) < gap) return false;
    this.lastAt[key] = now;
    return true;
  }

  envelope(param, t, attack, peak, dur) {
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  track(node, end) {
    this.voices++;
    node.onended = () => { this.voices--; };
    node.stop(end + 0.05);
  }

  // A burst of filtered noise. f0 → f1: the filter sweeps across the burst.
  noise({ dur, type = 'bandpass', f0, f1 = f0, q = 1, gain, attack = 0.004, pan = 0, when = 0, brown = false }) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = brown ? this.brown : this.white;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.envelope(g.gain, t, attack, gain, dur);
    src.connect(f); f.connect(g); g.connect(this.out(pan));
    src.start(t, Math.random() * 1.5);
    this.track(src, t + dur);
  }

  // A tone gliding from f0 to f1, optionally through a vowel-like filter and
  // with a wobble.
  tone({ type = 'sine', f0, f1 = f0, dur, gain, attack = 0.005, pan = 0, when = 0, formant = 0, vib = null }) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = vib[0]; lg.gain.value = vib[1];
      l.connect(lg); lg.connect(o.frequency);
      l.start(t); l.stop(t + dur + 0.05);
    }
    // A vowel filter takes away most of the sound, so it gets a boost.
    this.envelope(g.gain, t, attack, formant ? gain * 2.6 : gain, dur);
    let node = o;
    if (formant) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = formant; f.Q.value = 2.2;
      o.connect(f); node = f;
    }
    node.connect(g); g.connect(this.out(pan));
    o.start(t);
    this.track(o, t + dur);
  }

  // ----- one-shot effects -----

  boom(r, pan) {
    if (!this.ready() || !this.limit('boom', 0.07)) return;
    const s = Math.min(1, 0.45 + r / 22);
    this.tone({ f0: 95, f1: 32, dur: 0.6 + r * 0.03, gain: 1.35 * s, attack: 0.004, pan });
    this.noise({ type: 'lowpass', f0: 1600, f1: 90, dur: 0.7 + r * 0.06, gain: 1.2 * s, brown: true, pan });
    this.noise({ type: 'highpass', f0: 2500, dur: 0.12, gain: 0.375 * s, pan });
    // Debris pattering down afterwards.
    for (let k = 0; k < 5; k++) this.noise({ type: 'bandpass', f0: 1800 + Math.random() * 2000, q: 3, dur: 0.04, gain: 0.075 * s, pan, when: 0.25 + Math.random() * 0.6 });
  }

  thunder(pan) {
    if (!this.ready() || !this.limit('thunder', 0.3)) return;
    this.noise({ type: 'highpass', f0: 1800, dur: 0.1, gain: 0.63, pan });
    this.noise({ type: 'bandpass', f0: 3200, f1: 900, q: 0.7, dur: 0.25, gain: 0.42, pan });
    // The rumble rolls on in a few waves.
    for (let k = 0; k < 3; k++)
      this.noise({ type: 'lowpass', f0: 520 - k * 120, f1: 60, dur: 1.4 + k * 0.6, gain: 0.77 - k * 0.12, attack: 0.08, brown: true, pan: pan * 0.5, when: 0.12 + k * 0.45 + Math.random() * 0.2 });
  }

  splash(pan) {
    if (!this.ready() || !this.limit('splash', 0.08)) return;
    const f = 380 + Math.random() * 300;
    this.tone({ f0: f, f1: f * 2.2, dur: 0.09, gain: 0.175, pan });
    this.noise({ type: 'bandpass', f0: 1400, f1: 500, q: 1.2, dur: 0.16, gain: 0.2, pan });
  }

  firework(pan) {
    if (!this.ready() || !this.limit('firework', 0.05)) return;
    this.noise({ type: 'highpass', f0: 900, dur: 0.18, gain: 0.35, pan });
    this.tone({ f0: 160, f1: 50, dur: 0.25, gain: 0.3, pan });
    for (let k = 0; k < 12; k++) this.noise({ type: 'highpass', f0: 4000, dur: 0.025, gain: 0.08 + Math.random() * 0.06, pan: pan + (Math.random() - 0.5) * 0.3, when: 0.15 + Math.random() * 0.8 });
  }

  whoosh(pan) {
    if (!this.ready()) return;
    this.noise({ type: 'bandpass', f0: 3200, f1: 260, q: 1.4, dur: 0.95, gain: 0.22, attack: 0.5, pan });
  }

  thud(pan, size = 1) {
    if (!this.ready() || !this.limit('thud', 0.06)) return;
    this.tone({ f0: 130, f1: 50, dur: 0.14, gain: 0.45 * size, pan });
    this.noise({ type: 'lowpass', f0: 500, dur: 0.07, gain: 0.27 * size, pan });
  }

  // A rising chime for a new discovery.
  chime() {
    if (!this.ready()) return;
    [1046.5, 1318.5, 1568, 2093].forEach((f, k) => {
      this.tone({ type: 'triangle', f0: f, dur: 0.6, gain: 0.08, when: k * 0.08, attack: 0.01 });
      this.tone({ f0: f * 2, dur: 0.35, gain: 0.025, when: k * 0.08, attack: 0.01 });
    });
  }

  // A soft tick for buttons.
  click() {
    if (!this.ready() || !this.limit('click', 0.03)) return;
    this.tone({ type: 'triangle', f0: 1700, f1: 1300, dur: 0.035, gain: 0.08 });
  }

  // A creature's voice. how: 'idle', 'hurt' or 'die'.
  voice(c, how, pan) {
    if (!this.ready()) return;
    const v = VOICES[c.kind];
    if (!v) return;
    const now = this.ctx.currentTime;
    if (how !== 'die' && now - (this.heard.get(c) ?? -1e9) < (how === 'hurt' ? 0.45 : 2)) return;
    this.heard.set(c, now);
    const die = how === 'die', hurt = how === 'hurt';
    const up = hurt ? 1.18 : 1, wobble = 0.92 + Math.random() * 0.16;
    const n = die ? 1 : v.n || 1;
    for (let k = 0; k < n; k++) {
      this.tone({
        type: v.type, f0: v.f0 * up * wobble, f1: v.f1 * up * wobble * (die ? 0.6 : 1),
        dur: v.dur * (die ? 2 : 1), gain: v.gain * (how === 'idle' ? 0.6 : 1), formant: v.formant, vib: v.vib,
        pan, when: k * (v.gap || 0), attack: 0.02,
      });
    }
  }

  // Little sounds while painting, by what is being painted.
  brush(kind, pan) {
    if (!this.ready() || this.t < this.next.brush) return;
    this.next.brush = this.t + 0.075 + Math.random() * 0.04;
    const r = Math.random();
    switch (kind) {
      case 'powder': this.noise({ type: 'bandpass', f0: 3000 + r * 1500, q: 0.8, dur: 0.07, gain: 0.175, pan }); break;
      case 'liquid': { const f = 320 + r * 260; this.tone({ f0: f, f1: f * 1.8, dur: 0.07, gain: 0.21, pan }); break; }
      case 'gas': this.noise({ type: 'bandpass', f0: 1400, q: 0.6, dur: 0.12, gain: 0.105, pan }); break;
      case 'fire': this.noise({ type: 'bandpass', f0: 800, f1: 1900, q: 0.8, dur: 0.15, gain: 0.21, pan }); break;
      case 'life': this.noise({ type: 'bandpass', f0: 2200 + r * 800, q: 2, dur: 0.05, gain: 0.14, pan }); break;
      case 'erase': this.noise({ type: 'bandpass', f0: 650, f1: 300, q: 1, dur: 0.08, gain: 0.14, pan }); break;
      case 'heat': this.noise({ type: 'highpass', f0: 4200, dur: 0.1, gain: 0.123, pan }); break;
      case 'cool': this.tone({ f0: 2600 + r * 600, f1: 3200, dur: 0.05, gain: 0.07, pan }); this.noise({ type: 'highpass', f0: 6500, dur: 0.05, gain: 0.105, pan }); break;
      case 'wind': this.noise({ type: 'bandpass', f0: 500, f1: 900, q: 0.8, dur: 0.25, gain: 0.245, pan }); break;
      default: this.noise({ type: 'lowpass', f0: 900, dur: 0.04, gain: 0.21, pan }); this.tone({ f0: 190 + r * 60, dur: 0.04, gain: 0.088, pan });
    }
  }

  // ----- the forest around you -----

  birdsong() {
    const pan = Math.random() * 1.6 - 0.8, base = 2400 + Math.random() * 1800, notes = 2 + ((Math.random() * 4) | 0);
    const rising = Math.random() < 0.5;
    for (let k = 0; k < notes; k++) {
      const f = base * (1 + (rising ? k : notes - k) * 0.06);
      this.tone({ f0: f, f1: f * (1.15 + Math.random() * 0.25), dur: 0.06 + Math.random() * 0.05, gain: 0.038, pan, when: k * (0.09 + Math.random() * 0.05), attack: 0.01 });
    }
  }

  crickets() {
    const pan = Math.random() * 1.4 - 0.7, f = 4300 + Math.random() * 500;
    for (let k = 0; k < 3; k++) this.tone({ f0: f, dur: 0.035, gain: 0.018, pan, when: k * 0.055, attack: 0.004 });
  }

  owl() {
    const pan = Math.random() * 1.2 - 0.6;
    this.tone({ f0: 390, f1: 350, dur: 0.4, gain: 0.04, pan, attack: 0.08 });
    this.tone({ f0: 370, f1: 320, dur: 0.6, gain: 0.035, pan, when: 0.55, attack: 0.1 });
  }

  // ----- every frame -----

  // Events the world posted this frame (explosions, splashes, lightning,
  // creatures getting hurt). W turns world x into left-right pan.
  events(fx, W) {
    if (!this.ready() || !fx.length) return;
    const pan = x => (x / W) * 1.6 - 0.8;
    let blast = null, bursts = 0;
    for (const e of fx) {
      if (e.k === 'blast') { if (!blast || e.r > blast.r) blast = e; }
      else if (e.k === 'burst') { if (bursts++ < 3) this.firework(pan(e.x)); }
      else if (e.k === 'splash') this.splash(pan(e.x));
      else if (e.k === 'bolt') this.thunder(pan(e.x));
      else if (e.k === 'hurt') { this.voice(e.c, 'hurt', pan(e.x)); if (e.jolt > 6) this.thud(pan(e.x), Math.min(1.5, e.jolt / 20)); }
      else if (e.k === 'die') this.voice(e.c, 'die', pan(e.x));
    }
    if (blast) this.boom(blast.r, pan(blast.x));
  }

  // Loops and the forest ambience. s: { dt, night, weather, paused, fire,
  // lava, creatures, W }.
  update(s) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const dt = s.dt, now = this.ctx.currentTime;
    this.t += dt;
    const live = !s.paused;
    // Ease the loops toward their levels ten times a second.
    if (this.t >= this.next.loops) {
      this.next.loops = this.t + 0.1;
      const w = s.weather, storm = w === 'storm';
      const gust = 0.5 + 0.3 * Math.sin(this.t * 0.17) + 0.2 * Math.sin(this.t * 0.43 + 1);
      this.wind.g.gain.setTargetAtTime(0.05 + 0.04 * gust + (storm ? 0.14 : w === 'snow' ? 0.04 : 0), now, 0.4);
      this.wind.f.frequency.setTargetAtTime(300 + 260 * gust + (storm ? 200 : 0), now, 0.5);
      const rain = !live ? 0 : storm ? 0.17 : w === 'rain' || w === 'acid' ? 0.11 : w === 'hail' ? 0.04 : 0;
      this.rain.g.gain.setTargetAtTime(rain, now, 0.6);
      this.roar.g.gain.setTargetAtTime(live ? Math.min(0.24, s.fire / 450) : 0, now, 0.3);
      this.gust.g.gain.setTargetAtTime(s.blowing ? 0.07 : 0, now, 0.15);
    }
    if (!this.on) return;
    if (live) {
      // Fire crackles, lava bubbles, hail clatters.
      if (Math.random() < Math.min(30, s.fire / 6) * dt && this.voices < MAX_VOICES - 8)
        this.noise({ type: 'highpass', f0: 2500 + Math.random() * 3000, dur: 0.012 + Math.random() * 0.02, gain: 0.04 + Math.random() * 0.08, pan: Math.random() * 1.2 - 0.6 });
      if (Math.random() < Math.min(4, s.lava / 90) * dt) {
        const f = 70 + Math.random() * 90;
        this.tone({ f0: f, f1: f * 2.4, dur: 0.12, gain: 0.12, pan: Math.random() * 1.2 - 0.6 });
      }
      if (s.weather === 'hail' && Math.random() < 14 * dt)
        this.noise({ type: 'bandpass', f0: 3000 + Math.random() * 2500, q: 4, dur: 0.02, gain: 0.05, pan: Math.random() * 1.6 - 0.8 });
    }
    // Birds by day in fair weather, crickets and the odd owl at night.
    const fair = s.weather === 'clear' || s.weather === 'snow';
    if (this.t >= this.next.bird) {
      this.next.bird = this.t + 3 + Math.random() * 8;
      if (s.night < 0.4 && fair) this.birdsong();
    }
    if (this.t >= this.next.cricket) {
      this.next.cricket = this.t + 0.7 + Math.random() * 1.1;
      if (s.night > 0.55 && s.weather !== 'storm') this.crickets();
    }
    if (this.t >= this.next.owl) {
      this.next.owl = this.t + 18 + Math.random() * 25;
      if (s.night > 0.7 && fair) this.owl();
    }
    // Now and then a creature makes a noise of its own.
    if (live && this.t >= this.next.idle) {
      this.next.idle = this.t + 1.2;
      const alive = s.creatures.filter(c => c.alive && c.kind !== 'fish');
      if (alive.length && Math.random() < 0.18) {
        const c = alive[(Math.random() * alive.length) | 0];
        this.voice(c, 'idle', (c.px[0] / s.W) * 1.6 - 0.8);
      }
    }
  }
}

// Which brush sound an element makes.
export function brushKind(t) {
  if (t === El.FIRE || t === El.NAPALM || t === El.TORCH) return 'fire';
  const e = El.ELEMENTS[t];
  if (e && e.cat === 'life') return 'life';
  const st = El.STATE[t];
  return st === El.POWDER ? 'powder' : st === El.LIQUID ? 'liquid' : st === El.GAS ? 'gas' : 'solid';
}
