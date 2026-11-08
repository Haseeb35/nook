// Nook — app state and wiring.
import { read, write } from './storage.js';
import { createRoom, formatTime, SOUNDS } from './room.js';
import { createTimer, normaliseSettings } from './timer.js';
import { createSettings, createShortcuts } from './settings.js';
import { createAudio, loadManifest } from './audio.js';

const DEFAULT_VOLUME = { rain: 0.6, cafe: 0.4, fire: 0.5, radio: 0.45 };
const TIMES = ['morning', 'afternoon', 'evening', 'night'];
const LAMP_ON_BY_DEFAULT = { morning: false, afternoon: false, evening: true, night: true };
const TITLE_WORDS = { focus: 'focus', short: 'break', long: 'long break' };
const AMBIENCE = { rain: "Rain's on.", cafe: "Kettle's warm.", fire: "Fire's lit.", radio: "Radio's low." };
const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
const html = document.documentElement;

// --- Sounds ------------------------------------------------------------------
// Volumes persist. On/off does not: audio may only start after a gesture,
// and the room should never show a sound playing when it is silent.
const savedVolumes = read('volumes', {}) ?? {};
const sounds = Object.fromEntries(SOUNDS.map(name => {
  const v = Number(savedVolumes[name]);
  return [name, { on: false, vol: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME[name] }];
}));
const available = new Set(SOUNDS); // narrowed once the manifest arrives
let muted = false;

const audio = createAudio({
  // A file that fails to load or decode: switch it off and take it away.
  onUnavailable(name) {
    if (!SOUNDS.includes(name)) return;
    available.delete(name);
    sounds[name].on = false;
    room.setSoundAvailable(name, false);
    renderSound(name);
  },
});

let saveTimer = 0;
function saveVolumes() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    write('volumes', Object.fromEntries(SOUNDS.map(n => [n, sounds[n].vol])));
  }, 250);
}

function toggleSound(name) {
  if (!available.has(name)) return;
  audio.unlock(); // inside the click or key press: browsers only allow sound to start here
  sounds[name].on = !sounds[name].on;
  if (sounds[name].on && muted) setMuted(false); // switching something on means "I want to hear it"
  renderSound(name);
}

function setMuted(value) {
  muted = value;
  audio.setMuted(muted);
  room.renderDrawerSummary(SOUNDS.filter(n => sounds[n].on), { muted });
  render(timer.snapshot());
}

// --- Time of day ---------------------------------------------------------------
// The room follows the visitor's local clock (js/early.js sets the first
// period before paint). ?time=morning|afternoon|evening|night pins one.
const pinned = TIMES.includes(new URLSearchParams(location.search).get('time'));
let time = html.dataset.time;

function periodAt(date) {
  const h = date.getHours();
  if (h >= 21 || h < 5) return 'night';
  if (h >= 17) return 'evening';
  if (h >= 12) return 'afternoon';
  return 'morning';
}

function msUntilNextPeriod(date) {
  const next = new Date(date);
  const boundary = [5, 12, 17, 21].find(h => h > date.getHours()) ?? 24 + 5;
  next.setHours(boundary, 0, 0, 0);
  return next - date;
}

let periodTimer = 0;
function followClock() {
  clearTimeout(periodTimer);
  if (pinned) return;
  const now = new Date();
  setTime(periodAt(now));
  // Timers sleep in background tabs; visibilitychange also calls this.
  periodTimer = setTimeout(followClock, msUntilNextPeriod(now) + 500);
}

function setTime(next) {
  if (next === time) return;
  time = next;
  html.dataset.time = next;
  lampOverride = null; // the lamp goes back to doing its own thing
  room.renderLamp(lampIsOn(), false);
  setTimeout(syncThemeColor, 2600); // after the 2.4 s crossfade in tokens.css
}

// Browser chrome (and the installed app's title bar) matches the wall.
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  const wall = getComputedStyle(html).getPropertyValue('--wall').trim();
  if (meta && wall) meta.setAttribute('content', wall);
}

let lampOverride = null; // null = follow the time of day; true/false = the visitor's choice
const lampIsOn = () => lampOverride ?? LAMP_ON_BY_DEFAULT[time];

// --- Status line -----------------------------------------------------------------
let firstVisit = !read('visited', false);
let lastEvent = null; // 'late' | 'back' | null — colours the next idle sentence

function minutesText(n) {
  return n === 1 ? '1 minute.' : `${n} minutes.`;
}

function longBreakText(snap) {
  return `${NUMBER_WORDS[snap.longEvery] ?? snap.longEvery} down. Make a proper cup.`;
}

function statusText(snap) {
  if (firstVisit) return 'Click things. Space starts the clock.';
  if (snap.status === 'paused') {
    return sounds.rain.on && !muted ? 'Paused. The rain kept going.' : 'Paused. Take your time.';
  }
  if (lastEvent === 'late' && snap.status === 'idle') return 'That session ended while you were away.';
  if (snap.phase === 'short') return 'The cat is awake. Stretch with it.';
  if (snap.phase === 'long') return longBreakText(snap);

  const minutes = minutesText(Math.round(snap.duration / 60_000));
  if (lastEvent === 'back' && snap.status === 'idle') return `Back to the desk. ${minutes}`;
  if (muted) return `Quiet room. ${minutes}`;
  const playing = SOUNDS.filter(n => sounds[n].on).map(n => AMBIENCE[n]);
  return `${playing.length ? playing.join(' ') : 'The room is quiet.'} ${minutes}`;
}

function titleText(snap) {
  if (snap.status === 'idle') return 'Nook';
  const word = snap.status === 'paused' ? 'paused' : TITLE_WORDS[snap.phase];
  return `${formatTime(snap.seconds)} ${word} · Nook`;
}

// --- Room ----------------------------------------------------------------------
let settings = normaliseSettings(read('settings', null));
let notify = read('notify', false) === true && notificationsAllowed();

const room = createRoom({
  onToggleSound: toggleSound,
  onVolume(name, vol) {
    audio.unlock();
    const sound = sounds[name];
    sound.vol = vol;
    if (!sound.on && vol > 0) {
      sound.on = true; // reaching for the dial means "play"
      if (muted) setMuted(false);
    }
    renderSound(name);
    saveVolumes();
  },
  onTask(text) {
    write('task', text);
  },
  onLamp() {
    const next = !lampIsOn();
    lampOverride = next === LAMP_ON_BY_DEFAULT[time] ? null : next;
    room.renderLamp(lampIsOn(), lampOverride !== null);
  },
  onClock: toggleClock,
  onSkip: () => timer.skip(),
  onSettings(opener) {
    room.closeTags(); // a tapped-open tag would sit behind the sheet
    settingsPanel.toggle(opener);
  },
});

function renderSound(name) {
  audio.setSound(name, sounds[name]);
  room.renderSound(name, sounds[name]);
  room.renderDrawerSummary(SOUNDS.filter(n => sounds[n].on), { muted });
  render(timer.snapshot());
}

// --- Timer -----------------------------------------------------------------------
const timer = createTimer({
  settings,
  saved: read('timer', null),
  onChange(snap) {
    write('timer', timer.serialise());
    render(snap);
  },
  onTick: render,
  onComplete({ from, to, late, skipped }) {
    lastEvent = late ? 'late' : from !== 'focus' && to === 'focus' ? 'back' : null;
    if (to === 'focus') room.setCat('asleep');
    else room.setCat('awake', { stretch: !late });
    if (!late && !skipped) {
      audio.playChime();
      notifySessionEnd(from, timer.snapshot());
    }
    render(timer.snapshot());
  },
});

function toggleClock() {
  if (timer.snapshot().status !== 'running') lastEvent = null;
  timer.toggle();
}

function render(snap) {
  room.renderClock(snap);
  room.setStatus(statusText(snap));
  const title = titleText(snap);
  if (document.title !== title) document.title = title;
}

// --- Notifications ------------------------------------------------------------------
// Optional. Only when the page isn't being looked at; the chime covers the rest.
function notificationsAllowed() {
  return 'Notification' in window && Notification.permission === 'granted';
}

async function notifySessionEnd(from, snap) {
  if (!notify || !notificationsAllowed() || !document.hidden) return;
  const title = from === 'focus' ? 'Focus done.' : "Break's over.";
  const body = from !== 'focus'
    ? `Back to the desk. ${minutesText(Math.round(snap.duration / 60_000))}`
    : snap.phase === 'long' ? longBreakText(snap) : 'The cat is awake. Stretch with it.';
  const options = { body, icon: 'icons/icon-192.png', tag: 'nook-session', renotify: true, silent: audio.unlocked && !muted };
  try {
    // Through the service worker where there is one (required on Android).
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) return await registration.showNotification(title, options);
    const note = new Notification(title, options);
    note.onclick = () => { window.focus(); note.close(); };
  } catch { /* a notification is a nicety, never an error */ }
}

const settingsPanel = createSettings({
  getSettings: () => ({ ...settings, notify }),
  onChange({ notify: wantsNotify, ...next }) {
    settings = timer.setSettings(next);
    write('settings', settings);
    if (wantsNotify !== notify) setNotify(wantsNotify);
    return { ...settings, notify };
  },
  anchor: () => document.querySelector('.obj[data-obj="clock"]'),
});

function setNotify(wanted) {
  if (!wanted || !('Notification' in window)) {
    notify = false;
    write('notify', false);
    return;
  }
  if (Notification.permission === 'granted') {
    notify = true;
    write('notify', true);
    return;
  }
  if (Notification.permission === 'denied') {
    settingsPanel.refresh('Notifications are blocked for this page in your browser settings.');
    return;
  }
  // Ask once, from the checkbox click (browsers only allow it from a gesture).
  Notification.requestPermission().then(permission => {
    notify = permission === 'granted';
    write('notify', notify);
    settingsPanel.refresh(notify ? '' : 'Notifications stay off. The browser said no.');
  });
}

// --- Keyboard ------------------------------------------------------------------------
const shortcuts = createShortcuts();
document.querySelector('.keys-btn').addEventListener('click', event => shortcuts.toggle(event.currentTarget));

const SOUND_KEYS = { 1: 'rain', 2: 'cafe', 3: 'fire', 4: 'radio' };

document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (settingsPanel.isOpen || shortcuts.isOpen) return;
  const target = event.target instanceof Element ? event.target : document.body;
  if (target.closest('input, textarea, select, [contenteditable]')) return;

  if (event.code === 'Space' && !target.closest('button')) {
    event.preventDefault();
    toggleClock();
  } else if (event.key === 's' || event.key === 'S') {
    event.preventDefault();
    timer.skip();
  } else if (event.key === 'm' || event.key === 'M') {
    event.preventDefault();
    audio.unlock();
    setMuted(!muted);
  } else if (SOUND_KEYS[event.key]) {
    event.preventDefault();
    toggleSound(SOUND_KEYS[event.key]);
  } else if (event.key === '?') {
    event.preventDefault();
    shortcuts.open(document.activeElement);
  }
});

// The first click or key press unlocks audio, so the chime can play later
// even if no sound was switched on. (Not pointerdown: on touch screens a
// finger going down doesn't yet count as a gesture that may start audio.)
document.addEventListener('click', () => audio.unlock(), { once: true, capture: true });
document.addEventListener('keydown', () => audio.unlock(), { once: true, capture: true });

// The first touch of anything retires the first-visit hint.
function firstGesture() {
  if (!firstVisit) return;
  firstVisit = false;
  write('visited', true);
  render(timer.snapshot());
}
document.addEventListener('pointerdown', firstGesture, { once: true, capture: true });
document.addEventListener('keydown', firstGesture, { once: true, capture: true });

// Background tabs throttle timers; look at the real clock when we come back.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  timer.resync();
  followClock();
});
window.addEventListener('pageshow', () => timer.resync());

// --- First paint -------------------------------------------------------------------
SOUNDS.forEach(name => room.renderSound(name, sounds[name]));
room.renderDrawerSummary([], { muted });
room.renderLamp(lampIsOn(), false);
room.setTask(read('task', '') ?? '');
room.setCat(timer.snapshot().phase === 'focus' ? 'asleep' : 'awake');
render(timer.snapshot());
syncThemeColor();
followClock();
timer.resync(); // a session that ended while the page was closed completes now

// Sounds without a prepared file (see sounds/SOURCES.md) leave the room.
loadManifest().then(manifest => {
  audio.setManifest(manifest);
  for (const name of SOUNDS) {
    const has = Boolean(manifest[name]);
    if (!has) available.delete(name);
    room.setSoundAvailable(name, has);
  }
});

// Works offline after the first visit.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* online-only is fine */ });
  });
}
