// Nook — app state and wiring.
import { read, write } from './storage.js';
import { createRoom, SOUNDS } from './room.js';

const DEFAULT_VOLUME = { rain: 0.6, cafe: 0.4, fire: 0.5, radio: 0.45 };
const TIMES = ['morning', 'afternoon', 'evening', 'night'];
const LAMP_ON_BY_DEFAULT = { morning: false, afternoon: false, evening: true, night: true };

// Volumes persist. On/off does not: audio may only start after a gesture,
// and the room should never show a sound playing when it is silent.
const savedVolumes = read('volumes', {}) ?? {};
const sounds = Object.fromEntries(SOUNDS.map(name => {
  const v = Number(savedVolumes[name]);
  return [name, { on: false, vol: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME[name] }];
}));

// Time of day. Phase 5 drives this from the local clock; for now evening,
// or ?time=morning|afternoon|evening|night to review the other lights.
const requested = new URLSearchParams(location.search).get('time');
const time = TIMES.includes(requested) ? requested : 'evening';
document.documentElement.dataset.time = time;

let lampOverride = null; // null = follow the time of day; true/false = the visitor's choice
const lampIsOn = () => lampOverride ?? LAMP_ON_BY_DEFAULT[time];

let saveTimer = 0;
function saveVolumes() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    write('volumes', Object.fromEntries(SOUNDS.map(n => [n, sounds[n].vol])));
  }, 250);
}

const room = createRoom({
  onToggleSound(name) {
    sounds[name].on = !sounds[name].on;
    renderSound(name);
  },
  onVolume(name, vol) {
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
});

function renderSound(name) {
  room.renderSound(name, sounds[name]);
  room.renderDrawerSummary(SOUNDS.filter(n => sounds[n].on));
}

SOUNDS.forEach(renderSound);
room.renderLamp(lampIsOn(), false);
room.setTask(read('task', '') ?? '');
