// Pomodoro engine. No DOM, so it can be tested in Node with a fake clock.
//
// Time is never counted down. A running session stores the timestamp it ends
// at, and the time left is always derived as endAt - now(). Background tabs,
// throttled timers and a sleeping laptop can delay when we *notice* the end,
// but never make the clock drift. The setTimeout below only decides when to
// look again; it carries no time of its own.

export const PHASES = ['focus', 'short', 'long'];

export const DEFAULT_SETTINGS = Object.freeze({
  focus: 25,       // minutes
  short: 5,
  long: 15,
  longEvery: 4,    // focus sessions before a long break
  autoStart: false,
});

export const LIMITS = Object.freeze({
  focus: [1, 120],
  short: [1, 30],
  long: [1, 60],
  longEvery: [2, 8],
});

// A session that ended more than this long ago was missed (tab asleep, lid
// closed). We don't chain into the next one automatically after that.
const LATE_AFTER_MS = 60_000;

export function normaliseSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const out = { autoStart: source.autoStart === true };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const n = Math.round(Number(source[key]));
    out[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : DEFAULT_SETTINGS[key];
  }
  return out;
}

export function createTimer({
  settings,
  saved,
  now = Date.now,
  onChange = () => {},
  onTick = () => {},
  onComplete = () => {},
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = id => clearTimeout(id),
} = {}) {
  let config = normaliseSettings(settings);
  let state = restore(saved) ?? fresh();
  let pending = 0;

  function duration(phase) {
    return config[phase] * 60_000;
  }

  function fresh() {
    return { phase: 'focus', status: 'idle', endAt: 0, remaining: duration('focus'), round: 0 };
  }

  function restore(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const { phase, status, endAt, remaining, round } = raw;
    if (!PHASES.includes(phase) || !['idle', 'running', 'paused'].includes(status)) return null;
    if (![endAt, remaining, round].every(Number.isFinite)) return null;
    if (status === 'running' && endAt <= 0) return null;
    return {
      phase,
      status,
      endAt: status === 'running' ? endAt : 0,
      remaining: Math.max(0, Math.min(remaining, duration(phase))),
      round: Math.max(0, Math.floor(round)),
    };
  }

  function timeLeft() {
    return state.status === 'running' ? Math.max(0, state.endAt - now()) : state.remaining;
  }

  function snapshot() {
    const ms = timeLeft();
    return {
      phase: state.phase,
      status: state.status,
      remaining: ms,
      seconds: Math.ceil(ms / 1000),
      duration: duration(state.phase),
      round: state.round,
      longEvery: config.longEvery,
      // Which focus session this is (or the one just finished, on a break).
      session: state.phase === 'focus' ? state.round + 1 : Math.max(1, state.round),
    };
  }

  function commit() {
    onChange(snapshot());
    schedule();
  }

  // Wake up just after the next whole second of the time left changes.
  function schedule() {
    clearTimer(pending);
    pending = 0;
    if (state.status !== 'running') return;
    const ms = state.endAt - now();
    const delay = ms <= 0 ? 0 : (ms % 1000 || 1000) + 8;
    pending = setTimer(check, delay);
  }

  function check() {
    pending = 0;
    if (state.status === 'running' && now() >= state.endAt) {
      advance({ endedAt: state.endAt, skipped: false });
    } else {
      onTick(snapshot());
      schedule();
    }
  }

  function advance({ endedAt, skipped }) {
    const from = state.phase;
    let round = state.round;
    let to;
    if (from === 'focus') {
      round += 1;
      to = round >= config.longEvery ? 'long' : 'short';
    } else {
      to = 'focus';
      if (from === 'long') round = 0;
    }

    const late = !skipped && now() - endedAt > LATE_AFTER_MS;
    const auto = config.autoStart && !skipped && !late;
    state = auto
      // Chain from the moment the last one ended, not from when we noticed.
      ? { phase: to, status: 'running', endAt: endedAt + duration(to), remaining: duration(to), round }
      : { phase: to, status: 'idle', endAt: 0, remaining: duration(to), round };

    commit();
    onComplete({ from, to, skipped, late, auto });
  }

  return {
    snapshot,
    serialise: () => ({ ...state }),

    start() {
      if (state.status === 'running') return;
      state = { ...state, status: 'running', endAt: now() + state.remaining };
      commit();
    },

    pause() {
      if (state.status !== 'running') return;
      state = { ...state, status: 'paused', remaining: Math.max(0, state.endAt - now()), endAt: 0 };
      commit();
    },

    toggle() {
      if (state.status === 'running') this.pause();
      else this.start();
    },

    skip() {
      advance({ endedAt: now(), skipped: true });
    },

    // Look at the clock now: on load, and whenever the tab becomes visible.
    resync() {
      check();
    },

    setSettings(next) {
      config = normaliseSettings(next);
      // A session that hasn't started takes the new length at once;
      // one in progress keeps the length it started with.
      if (state.status === 'idle') state = { ...state, remaining: duration(state.phase) };
      commit();
      return config;
    },

    dispose() {
      clearTimer(pending);
      pending = 0;
    },
  };
}
