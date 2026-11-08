// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTimer, normaliseSettings, DEFAULT_SETTINGS } from '../js/timer.js';

const MIN = 60_000;

// A fake clock and a fake timer queue, so tests control time completely.
function harness(options = {}) {
  let t = 1_000_000;
  const queue = new Map();
  let nextId = 1;
  const events = [];
  const timer = createTimer({
    settings: DEFAULT_SETTINGS,
    now: () => t,
    setTimer: (fn, ms) => { const id = nextId++; queue.set(id, { fn, at: t + ms }); return id; },
    clearTimer: id => queue.delete(id),
    onComplete: e => events.push(e),
    ...options,
  });
  return {
    timer,
    events,
    // Move the clock forward, firing any wake-ups that fall due on the way.
    advance(ms) {
      const target = t + ms;
      for (;;) {
        const due = [...queue.entries()].filter(([, q]) => q.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        queue.delete(due[0]);
        t = due[1].at;
        due[1].fn();
      }
      t = target;
    },
    // Move the clock without firing anything: a throttled or frozen tab.
    jump(ms) { t += ms; },
  };
}

test('time left is derived from the end timestamp', () => {
  const h = harness();
  h.timer.start();
  h.advance(10_000);
  assert.equal(h.timer.snapshot().seconds, 25 * 60 - 10);
});

test('a frozen tab still shows the right time when it wakes', () => {
  const h = harness();
  h.timer.start();
  h.jump(7 * MIN + 30_000); // no timers fired at all
  assert.equal(h.timer.snapshot().seconds, 17 * 60 + 30);
});

test('pause keeps the time left, resume continues from it', () => {
  const h = harness();
  h.timer.start();
  h.advance(5 * MIN);
  h.timer.pause();
  h.jump(30 * MIN);
  assert.equal(h.timer.snapshot().seconds, 20 * 60);
  h.timer.start();
  h.advance(MIN);
  assert.equal(h.timer.snapshot().seconds, 19 * 60);
});

test('focus, short break, ... and a long break after four', () => {
  const h = harness();
  const phases = [];
  for (let i = 0; i < 8; i++) {
    h.timer.start();
    h.advance(h.timer.snapshot().remaining + 20);
    phases.push(h.timer.snapshot().phase);
  }
  assert.deepEqual(phases, ['short', 'focus', 'short', 'focus', 'short', 'focus', 'long', 'focus']);
  assert.equal(h.timer.snapshot().round, 0, 'the cycle restarts after the long break');
});

test('the end is noticed within a second', () => {
  const h = harness();
  h.timer.start();
  h.advance(25 * MIN + 50);
  assert.equal(h.events.length, 1);
  assert.equal(h.events[0].from, 'focus');
  assert.equal(h.events[0].late, false);
});

test('auto-start chains from the real end time, not from when it was noticed', () => {
  const h = harness({ settings: { ...DEFAULT_SETTINGS, autoStart: true } });
  h.timer.start();
  h.jump(25 * MIN + 20_000); // noticed 20 s late (throttled tab)
  h.timer.resync();
  const s = h.timer.snapshot();
  assert.equal(s.phase, 'short');
  assert.equal(s.status, 'running');
  assert.equal(s.seconds, 5 * 60 - 20);
});

test('a session missed by more than a minute does not auto-start the next', () => {
  const h = harness({ settings: { ...DEFAULT_SETTINGS, autoStart: true } });
  h.timer.start();
  h.jump(3 * 60 * MIN);
  h.timer.resync();
  assert.equal(h.timer.snapshot().status, 'idle');
  assert.equal(h.events.at(-1).late, true);
});

test('skip moves on without auto-starting, and counts the session', () => {
  const h = harness({ settings: { ...DEFAULT_SETTINGS, autoStart: true } });
  h.timer.start();
  h.timer.skip();
  const s = h.timer.snapshot();
  assert.equal(s.phase, 'short');
  assert.equal(s.status, 'idle');
  assert.equal(s.round, 1);
  assert.equal(h.events.at(-1).skipped, true);
});

test('a saved running session resumes after a reload', () => {
  const first = harness();
  first.timer.start();
  first.advance(3 * MIN);
  const saved = first.timer.serialise();

  let t = saved.endAt - 22 * MIN;
  const again = createTimer({ settings: DEFAULT_SETTINGS, saved, now: () => t, setTimer: () => 0, clearTimer: () => {} });
  assert.equal(again.snapshot().status, 'running');
  assert.equal(again.snapshot().seconds, 22 * 60);
});

test('changing the length applies to a session that has not started', () => {
  const h = harness();
  h.timer.setSettings({ ...DEFAULT_SETTINGS, focus: 50 });
  assert.equal(h.timer.snapshot().seconds, 50 * 60);
  h.timer.start();
  h.timer.setSettings({ ...DEFAULT_SETTINGS, focus: 10 });
  assert.equal(h.timer.snapshot().seconds, 50 * 60, 'a running session keeps its length');
});

test('settings are clamped and garbage falls back to defaults', () => {
  assert.deepEqual(
    normaliseSettings({ focus: '0', short: 99, long: 'abc', longEvery: 3.6, autoStart: 'yes' }),
    { focus: 1, short: 30, long: 15, longEvery: 4, autoStart: false },
  );
  assert.deepEqual(normaliseSettings(null), { ...DEFAULT_SETTINGS });
});

test('corrupt saved state is ignored', () => {
  const t = createTimer({ settings: DEFAULT_SETTINGS, saved: { phase: 'nap', status: 'running' } });
  assert.equal(t.snapshot().phase, 'focus');
  assert.equal(t.snapshot().status, 'idle');
});
