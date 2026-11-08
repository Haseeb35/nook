// Nook — app state and wiring.
import { read, write } from './storage.js';
import { createRoom, formatTime, SOUNDS } from './room.js';
import { createTimer, normaliseSettings } from './timer.js';
import { createSettings } from './settings.js';
import { createAudio, loadManifest } from './audio.js';

const DEFAULT_VOLUME = { rain: 0.6, cafe: 0.4, fire: 0.5, radio: 0.45 };
const TIMES = ['morning', 'afternoon', 'evening', 'night'];
const LAMP_ON_BY_DEFAULT = { morning: false, afternoon: false, evening: true, night: true };
const TITLE_WORDS = { focus: 'focus', short: 'break', long: 'long break' };
const AMBIENCE = { rain: "Rain's on.", cafe: "Kettle's warm.", fire: "Fire's lit.", radio: "Radio's low." };
const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

// --- Sounds ------------------------------------------------------------------
// Volumes persist. On/off does not: audio may only start after a gesture,
// and the room should never show a sound playing when it is silent.
const savedVolumes = read('volumes', {}) ?? {};
const sounds = Object.fromEntries(SOUNDS.map(name => {
  const v = Number(savedVolumes[name]);
  return [name, { on: false, vol: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME[name] }];
}));

const audio = createAudio({
  // A file that fails to load or decode: switch it off and take it away.
  onUnavailable(name) {
    if (!SOUNDS.includes(name)) return;
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

// --- Time of day ---------------------------------------------------------------
// Phase 5 drives this from the local clock; for now evening, or
// ?time=morning|afternoon|evening|night to review the other lights.
const requested = new URLSearchParams(location.search).get('time');
const time = TIMES.includes(requested) ? requested : 'evening';
document.documentElement.dataset.time = time;

let lampOverride = null; // null = follow the time of day; true/false = the visitor's choice
const lampIsOn = () => lampOverride ?? LAMP_ON_BY_DEFAULT[time];

// --- Status line -----------------------------------------------------------------
let firstVisit = !read('visited', false);
let lastEvent = null; // 'late' | 'back' | null — colours the next idle sentence

function minutesText(n) {
  return n === 1 ? '1 minute.' : `${n} minutes.`;
}

function statusText(snap) {
  if (firstVisit) return 'Click things. Space starts the clock.';
  if (snap.status === 'paused') {
    return sounds.rain.on ? 'Paused. The rain kept going.' : 'Paused. Take your time.';
  }
  if (lastEvent === 'late' && snap.status === 'idle') return 'That session ended while you were away.';
  if (snap.phase === 'short') return 'The cat is awake. Stretch with it.';
  if (snap.phase === 'long') return `${NUMBER_WORDS[snap.longEvery] ?? snap.longEvery} down. Make a proper cup.`;

  const minutes = minutesText(Math.round(snap.duration / 60_000));
  if (lastEvent === 'back' && snap.status === 'idle') return `Back to the desk. ${minutes}`;
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

const room = createRoom({
  onToggleSound(name) {
    audio.unlock(); // inside the click: browsers only allow sound to start here
    sounds[name].on = !sounds[name].on;
    renderSound(name);
  },
  onVolume(name, vol) {
    audio.unlock();
    const sound = sounds[name];
    sound.vol = vol;
    if (!sound.on && vol > 0) sound.on = true; // reaching for the dial means "play"
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
  room.renderDrawerSummary(SOUNDS.filter(n => sounds[n].on));
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
    if (!late && !skipped) audio.playChime();
    lastEvent = late ? 'late' : from !== 'focus' && to === 'focus' ? 'back' : null;
    if (to === 'focus') room.setCat('asleep');
    else room.setCat('awake', { stretch: !late });
    // The browser notification (phase 5) hooks in here.
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

const settingsPanel = createSettings({
  getSettings: () => settings,
  onChange(next) {
    settings = timer.setSettings(next);
    write('settings', settings);
    return settings;
  },
  anchor: () => document.querySelector('.obj[data-obj="clock"]'),
});

// --- Keyboard: Space starts or pauses, S skips -------------------------------------
// (M, 1–4 and ? arrive with the rest of the shortcuts in phase 5.)
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (settingsPanel.isOpen) return;
  const target = event.target instanceof Element ? event.target : document.body;
  if (target.closest('input, textarea, select, [contenteditable]')) return;

  if (event.code === 'Space' && !target.closest('button')) {
    event.preventDefault();
    toggleClock();
  } else if (event.key === 's' || event.key === 'S') {
    event.preventDefault();
    timer.skip();
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
  if (!document.hidden) timer.resync();
});
window.addEventListener('pageshow', () => timer.resync());

// --- First paint -------------------------------------------------------------------
SOUNDS.forEach(name => room.renderSound(name, sounds[name]));
room.renderDrawerSummary([]);
room.renderLamp(lampIsOn(), false);
room.setTask(read('task', '') ?? '');
room.setCat(timer.snapshot().phase === 'focus' ? 'asleep' : 'awake');
render(timer.snapshot());
timer.resync(); // a session that ended while the page was closed completes now

// Sounds without a prepared file (see sounds/SOURCES.md) leave the room.
loadManifest().then(manifest => {
  audio.setManifest(manifest);
  for (const name of SOUNDS) room.setSoundAvailable(name, Boolean(manifest[name]));
});
