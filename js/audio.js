// Nook — the sound of the room (Web Audio API).
//
//   loop source ─▶ sound gain ─┐
//   one-shot ─▶ gain ─▶ pan ─▶─┘ (through its parent, so it follows the
//                              │  parent's volume and fade-out)
//                              ▼
//                         master gain ─▶ speakers
//   chime ─▶ gain ───────────▶─┘
//
// Nothing is created before a user gesture (autoplay rules): unlock() must be
// called from inside a click/key handler. Every level change is a ramp
// (setTargetAtTime), so there is never a click or a pop.

const ONE_SHOTS = { rain: 'page', cafe: 'clink', fire: 'logpop' };   // parent → layer
const SHOT_LEVEL = { page: 0.4, clink: 0.5, logpop: 0.65 };          // relative to parent
const SHOT_EVERY = [20, 90];                                         // seconds, random
const FADE = 0.35;   // time constant for on/off (≈ 1 s to settle)
const GLIDE = 0.05;  // time constant for slider moves
const CHIME_LEVEL = 0.9;
const STOP_AFTER_MS = 4000; // stop a silent loop's source to save CPU

export async function loadManifest(url = 'sounds/manifest.json') {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 5000);
  try {
    const response = await fetch(url, { signal: abort.signal, cache: 'no-cache' });
    if (!response.ok) return {};
    const data = await response.json();
    return data && typeof data.sounds === 'object' ? data.sounds : {};
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

// Opus where it decodes, AAC everywhere else (older Safari).
function preferredFormats() {
  const probe = document.createElement('audio');
  const opus = probe.canPlayType('audio/ogg; codecs="opus"');
  return opus ? ['ogg', 'm4a'] : ['m4a', 'ogg'];
}

// Volume sliders feel even when the gain follows a curve, not a line.
const perceptual = vol => vol * vol;

function rampTo(param, value, timeConstant, ctx) {
  const now = ctx.currentTime;
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(now);
  } else {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
  }
  param.setTargetAtTime(value, now, timeConstant);
}

export function createAudio({ onUnavailable = () => {} } = {}) {
  let manifest = {};
  let ctx = null;
  let master = null;
  let muted = false;
  const formats = preferredFormats();
  const buffers = new Map();   // name → Promise<AudioBuffer>
  const channels = new Map();  // loop name → { gain, source, on, vol, stopTimer, shotTimer }

  const has = name => Boolean(manifest[name]);

  function unlock() {
    if (!ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return false;
      ctx = new Context({ latencyHint: 'playback' });
      // iOS: play through the silent switch, like a music app would.
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      rampTo(master.gain, muted ? 0 : 1, 0.2, ctx);
      // Apply anything that was switched on before the manifest or context existed.
      for (const name of channels.keys()) apply(name, true);
      prefetch();
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return true;
  }

  function prefetch() {
    if (!ctx) return;
    // Sounds that are on first, then the rest, without blocking anything.
    const names = Object.keys(manifest).sort((a, b) =>
      Number(Boolean(channels.get(b)?.on)) - Number(Boolean(channels.get(a)?.on)));
    for (const name of names) load(name).catch(() => {});
  }

  function load(name) {
    if (!buffers.has(name)) {
      const attempt = (async () => {
        let lastError;
        for (const ext of formats) {
          try {
            const response = await fetch(`sounds/${name}.${ext}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await ctx.decodeAudioData(await response.arrayBuffer());
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      })();
      attempt.catch(() => {
        buffers.delete(name);
        onUnavailable(name);
      });
      buffers.set(name, attempt);
    }
    return buffers.get(name);
  }

  function channel(name) {
    if (!channels.has(name)) channels.set(name, { gain: null, source: null, on: false, vol: 0, stopTimer: 0, shotTimer: 0 });
    return channels.get(name);
  }

  function setSound(name, { on, vol }) {
    const ch = channel(name);
    const switched = ch.on !== on;
    ch.on = on;
    ch.vol = vol;
    apply(name, switched);
  }

  function apply(name, switched) {
    const ch = channel(name);
    if (!ctx || !has(name)) return;
    if (!ch.gain) {
      ch.gain = ctx.createGain();
      ch.gain.gain.value = 0;
      ch.gain.connect(master);
    }
    clearTimeout(ch.stopTimer);

    if (ch.on) {
      if (ch.source) rampTo(ch.gain.gain, perceptual(ch.vol), switched ? FADE : GLIDE, ctx);
      else startLoop(name);
      scheduleShot(name);
    } else {
      rampTo(ch.gain.gain, 0, FADE, ctx);
      clearTimeout(ch.shotTimer);
      ch.shotTimer = 0;
      ch.stopTimer = setTimeout(() => stopLoop(name), STOP_AFTER_MS);
    }
  }

  async function startLoop(name) {
    const ch = channel(name);
    if (ch.starting) return;
    ch.starting = true;
    try {
      const buffer = await load(name);
      if (!ch.on || ch.source) return;
      const { loopStart = 0, loopEnd = buffer.duration } = manifest[name];
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = loopStart;
      source.loopEnd = Math.min(loopEnd, buffer.duration);
      source.connect(ch.gain);
      // Begin somewhere in the loop, so it never opens the same way twice.
      const length = source.loopEnd - source.loopStart;
      source.start(ctx.currentTime + 0.02, source.loopStart + Math.random() * length);
      ch.source = source;
      // Fade in from silence: the decode may have taken a moment.
      ch.gain.gain.cancelScheduledValues(ctx.currentTime);
      ch.gain.gain.setValueAtTime(0, ctx.currentTime);
      ch.gain.gain.setTargetAtTime(perceptual(ch.vol), ctx.currentTime + 0.02, FADE);
    } catch {
      // onUnavailable has already been told.
    } finally {
      ch.starting = false;
    }
  }

  function stopLoop(name) {
    const ch = channel(name);
    if (ch.on || !ch.source) return;
    try { ch.source.stop(); } catch { /* already stopped */ }
    ch.source.disconnect();
    ch.source = null;
  }

  // --- One-shot layers ------------------------------------------------------
  function scheduleShot(parent) {
    const shot = ONE_SHOTS[parent];
    const ch = channel(parent);
    if (!shot || !has(shot) || ch.shotTimer) return;
    const [min, max] = SHOT_EVERY;
    const delay = (min + Math.random() * (max - min)) * 1000;
    ch.shotTimer = setTimeout(async () => {
      ch.shotTimer = 0;
      if (!ch.on || !ctx) return;
      try {
        const buffer = await load(shot);
        if (ch.on && ch.source && ctx.state === 'running') {
          playBuffer(buffer, {
            level: SHOT_LEVEL[shot] * (0.6 + Math.random() * 0.4),
            pan: (Math.random() * 2 - 1) * 0.5,
            rate: 0.94 + Math.random() * 0.12,
            destination: ch.gain,
          });
        }
      } catch { /* a missing layer is not worth interrupting anything */ }
      scheduleShot(parent);
    }, delay);
  }

  function playBuffer(buffer, { level, pan = 0, rate = 1, destination }) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = level;
    source.connect(gain);
    let tail = gain;
    if (pan && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner);
      tail = panner;
    }
    tail.connect(destination);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (tail !== gain) tail.disconnect();
    };
    source.start();
  }

  // --- Chime ----------------------------------------------------------------
  async function playChime() {
    if (!ctx || !has('chime')) return false;
    try {
      if (ctx.state !== 'running') await ctx.resume();
      playBuffer(await load('chime'), { level: CHIME_LEVEL, destination: master });
      return true;
    } catch {
      return false;
    }
  }

  return {
    unlock,
    setSound,
    playChime,
    has,
    get unlocked() { return Boolean(ctx); },

    setManifest(next) {
      manifest = next && typeof next === 'object' ? next : {};
      if (ctx) {
        for (const name of channels.keys()) apply(name, true);
        prefetch();
      }
    },

    setMuted(value) {
      muted = Boolean(value);
      if (ctx) rampTo(master.gain, muted ? 0 : 1, FADE, ctx);
    },
  };
}
