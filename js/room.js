// The room: everything that touches the scene's DOM.
// - keeps the SVG viewBox in step with the CSS layout (--vb-* on .scene)
// - links each transparent button to its drawing (hover/focus light)
// - renders sound, lamp and task state onto the objects and the shelf drawer
// It owns no app state; main.js passes state in and receives intents back.

export const SOUNDS = ['rain', 'cafe', 'fire', 'radio'];
const OBJECT_FOR = { rain: 'window', cafe: 'mug', fire: 'stove', radio: 'radio' };
const NOTE_WIDTH = 106;      // usable width on the sticky note, in viewBox units
const NOTE_PLACEHOLDER = 'One thing.';
const NOTE_BASELINES = { normal: [376, 400, 424], small: [372, 391, 410] };

export function createRoom({ onToggleSound, onVolume, onTask, onLamp, onClock, onSkip, onSettings }) {
  const scene = document.getElementById('scene');
  const svg = scene.querySelector('svg.room');
  const drawer = document.getElementById('drawer');
  const objects = [...scene.querySelectorAll('.obj')];
  const objectByName = new Map(objects.map(el => [el.dataset.obj, el]));
  const drawing = name => svg.getElementById(name);

  syncViewBox(scene, svg);
  linkHoverToDrawing(objects, drawing);
  const closeTags = setUpTouchTags(objects);

  // --- Sounds -------------------------------------------------------------
  for (const name of SOUNDS) {
    objectByName.get(OBJECT_FOR[name])
      .querySelector('.obj-btn')
      .addEventListener('click', () => onToggleSound(name));
    drawer.querySelector(`.shelf-row[data-sound="${name}"] .shelf-toggle`)
      .addEventListener('click', () => onToggleSound(name));
  }
  document.addEventListener('input', event => {
    const slider = event.target.closest('.slider');
    const host = slider?.closest('[data-sound]');
    if (host) onVolume(host.dataset.sound, slider.valueAsNumber / 100);
  });

  function renderSound(name, { on, vol }) {
    const g = drawing(OBJECT_FOR[name]);
    g.dataset.on = String(on);
    g.style.setProperty('--vol', vol.toFixed(3));

    const obj = objectByName.get(OBJECT_FOR[name]);
    obj.querySelector('.obj-btn').setAttribute('aria-pressed', String(on));
    obj.querySelector('.tag-state').textContent = on ? 'on' : 'off';
    drawer.querySelector(`.shelf-row[data-sound="${name}"] .shelf-toggle`)
      .setAttribute('aria-pressed', String(on));

    for (const slider of document.querySelectorAll(`[data-sound="${name}"] .slider`)) {
      const value = Math.round(vol * 100);
      if (slider.valueAsNumber !== value) slider.value = String(value);
      slider.style.setProperty('--pct', `${value}%`);
      slider.setAttribute('aria-valuetext', `${value} percent${on ? '' : ', off'}`);
    }
  }

  function renderDrawerSummary(playing) {
    const names = { rain: 'rain', cafe: 'café', fire: 'fire', radio: 'radio' };
    drawer.querySelector('.drawer-summary').textContent =
      playing.length === 0 ? 'all quiet' : playing.map(n => names[n]).join(', ');
  }

  // --- Lamp ---------------------------------------------------------------
  objectByName.get('lamp').querySelector('.obj-btn').addEventListener('click', () => onLamp());

  function renderLamp(on, overridden) {
    // Only override the token when the visitor has flipped the lamp;
    // otherwise the time of day decides (tokens.css).
    if (overridden) scene.style.setProperty('--lamp-on', on ? '1' : '0');
    else scene.style.removeProperty('--lamp-on');
    const obj = objectByName.get('lamp');
    obj.querySelector('.obj-btn').setAttribute('aria-pressed', String(on));
    obj.querySelector('.tag-state').textContent = on ? 'on' : 'off';
  }

  // --- Sticky note --------------------------------------------------------
  const noteObj = objectByName.get('note');
  const input = noteObj.querySelector('#task-input');
  const lines = ['note-line-1', 'note-line-2', 'note-line-3'].map(id => svg.getElementById(id));
  let savedTask = '';

  noteObj.querySelector('.obj-btn').addEventListener('click', () => input.focus());
  input.addEventListener('input', () => renderNote(input.value));
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    } else if (event.key === 'Escape') {
      input.value = savedTask;
      renderNote(savedTask);
      input.blur();
    }
  });
  input.addEventListener('change', () => {
    savedTask = input.value.trim();
    input.value = savedTask;
    renderNote(savedTask);
    onTask(savedTask);
  });

  function setTask(text) {
    savedTask = text;
    input.value = text;
    renderNote(text);
    // Line breaks depend on the real font metrics; redo once fonts arrive.
    document.fonts?.ready.then(() => renderNote(input.value));
  }

  function renderNote(text) {
    const value = text.trim();
    const empty = value === '';
    for (const line of lines) {
      line.classList.toggle('note-text--empty', empty);
      line.classList.remove('note-text--small');
    }
    if (empty) {
      layoutNote(false);
      lines.forEach((line, i) => { line.textContent = i === 0 ? NOTE_PLACEHOLDER : ''; });
      return;
    }
    // Two lines at the normal size; failing that, three smaller ones.
    if (!fitNote(value, false)) fitNote(value, true);
  }

  function layoutNote(small) {
    NOTE_BASELINES[small ? 'small' : 'normal'].forEach((y, i) => {
      lines[i].setAttribute('y', String(y));
      lines[i].classList.toggle('note-text--small', small);
    });
  }

  // Word wrap measured on the real <text> element, so it matches the font.
  function fitNote(value, small) {
    layoutNote(small);
    const maxLines = small ? 3 : 2;
    const probe = lines[0];
    const fits = text => {
      probe.textContent = text;
      return probe.getComputedTextLength() <= NOTE_WIDTH;
    };

    const out = [];
    let current = '';
    for (const word of value.split(/\s+/)) {
      const trial = current ? `${current} ${word}` : word;
      if (fits(trial)) { current = trial; continue; }
      if (current) out.push(current);
      current = word;
      while (!fits(current)) {           // a single word wider than the note
        let cut = current.length - 1;
        while (cut > 1 && !fits(current.slice(0, cut))) cut--;
        out.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
    if (current) out.push(current);

    if (out.length > maxLines) {
      if (!small) return false;
      out.length = maxLines;
      let last = out[maxLines - 1];
      while (last && !fits(`${last}…`)) last = last.slice(0, -1).trimEnd();
      out[maxLines - 1] = `${last}…`;
    }
    lines.forEach((line, i) => { line.textContent = out[i] ?? ''; });
    return true;
  }

  // --- Drawer (narrow layout) --------------------------------------------
  const handle = drawer.querySelector('.drawer-handle');
  handle.addEventListener('click', () => setDrawer(drawer.dataset.open !== 'true'));
  function setDrawer(open) {
    drawer.dataset.open = String(open);
    handle.setAttribute('aria-expanded', String(open));
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.target === input) return;
    closeTags();
    if (drawer.dataset.open === 'true') {
      setDrawer(false);
      handle.focus();
    }
  });

  // --- Clock --------------------------------------------------------------
  const clockObj = objectByName.get('clock');
  const clockBtn = clockObj.querySelector('.obj-btn');
  const clockG = drawing('clock');
  const digits = svg.getElementById('clock-digits');
  const pips = svg.getElementById('clock-pips');
  const readout = document.querySelector('.readout');
  const readoutTime = readout.querySelector('.readout-time');
  const status = document.getElementById('status');

  clockBtn.addEventListener('click', () => onClock());
  readout.addEventListener('click', () => onClock());
  clockObj.querySelector('[data-action="skip"]').addEventListener('click', () => onSkip());
  clockObj.querySelector('[data-action="settings"]')
    .addEventListener('click', event => onSettings(event.currentTarget));

  function renderClock(snap) {
    const time = formatTime(snap.seconds);
    if (digits.textContent !== time) digits.textContent = time;
    if (readoutTime.textContent !== time) readoutTime.textContent = time;
    clockG.dataset.phase = snap.phase;
    clockG.dataset.status = snap.status;
    readout.dataset.phase = snap.phase;
    readout.dataset.status = snap.status;

    renderPips(snap);

    const phaseName = PHASE_NAMES[snap.phase];
    clockObj.querySelector('.clock-phase').textContent =
      snap.phase === 'focus' ? `${phaseName}, ${snap.session} of ${snap.longEvery}` : phaseName;
    clockObj.querySelector('.tag-state').textContent = STATUS_WORDS[snap.status];

    // Spoken labels change once a minute, not every second.
    const action = snap.status === 'running' ? 'Pause' : 'Start';
    const label = `${phaseName}, ${spokenTime(snap)}. ${action}`;
    setIfChanged(clockBtn, 'aria-label', `Desk clock. ${label}`);
    setIfChanged(readout, 'aria-label', label);
  }

  function renderPips({ longEvery, round, phase }) {
    if (pips.childElementCount !== longEvery) {
      pips.replaceChildren();
      const gap = 10;
      const first = 706 - ((longEvery - 1) * gap) / 2;
      for (let i = 0; i < longEvery; i++) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', String(first + i * gap));
        dot.setAttribute('cy', '631');
        dot.setAttribute('r', '2.4');
        pips.append(dot);
      }
    }
    const done = phase === 'long' ? longEvery : Math.min(round, longEvery);
    [...pips.children].forEach((dot, i) => dot.classList.toggle('is-done', i < done));
  }

  function setStatus(text) {
    if (status.textContent !== text) status.textContent = text;
  }

  // --- Cat ----------------------------------------------------------------
  const catG = drawing('cat');
  const catObj = objectByName.get('cat');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let catTimer = 0;

  function setCat(state, { stretch = false } = {}) {
    clearTimeout(catTimer);
    const awake = state === 'awake';
    if (awake && stretch && !reducedMotion.matches && catG.dataset.state === 'asleep') {
      catG.dataset.state = 'stretch';
      catTimer = setTimeout(() => { catG.dataset.state = 'awake'; }, 1400);
    } else {
      catG.dataset.state = state;
    }
    const word = awake ? 'awake' : 'asleep';
    catObj.querySelector('.tag-state').textContent = word;
    catObj.querySelector('.obj-btn').setAttribute('aria-label', `The cat, ${word}`);
  }

  // A sound with no file: its object becomes plain scenery, its shelf row goes.
  function setSoundAvailable(name, available) {
    const obj = objectByName.get(OBJECT_FOR[name]);
    obj.hidden = !available;
    drawer.querySelector(`.shelf-row[data-sound="${name}"]`).hidden = !available;
    if (!available) drawing(OBJECT_FOR[name]).dataset.on = 'false';
  }

  return { renderSound, renderDrawerSummary, renderLamp, setTask, renderClock, setStatus, setCat, closeTags, setSoundAvailable };
}

const PHASE_NAMES = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const STATUS_WORDS = { idle: 'ready', running: 'running', paused: 'paused' };

export function formatTime(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function spokenTime({ seconds, status }) {
  const minutes = Math.ceil(seconds / 60);
  const amount = minutes <= 1 ? (seconds <= 59 ? 'under a minute' : '1 minute') : `${minutes} minutes`;
  return status === 'idle' ? amount : `${amount} left`;
}

function setIfChanged(el, attr, value) {
  if (el.getAttribute(attr) !== value) el.setAttribute(attr, value);
}

// Copy the layout's --vb-* (set per breakpoint in ui.css) into the viewBox,
// so CSS stays the single source of truth for the crop.
function syncViewBox(scene, svg) {
  let current = '';
  const apply = () => {
    const style = getComputedStyle(scene);
    const box = ['--vb-x', '--vb-y', '--vb-w', '--vb-h']
      .map(key => style.getPropertyValue(key).trim())
      .join(' ');
    if (box !== current) {
      current = box;
      svg.setAttribute('viewBox', box);
    }
  };
  apply();
  new ResizeObserver(apply).observe(scene);
}

// Pointer or keyboard focus on a button lights up the drawing beneath it.
function linkHoverToDrawing(objects, drawing) {
  for (const obj of objects) {
    const g = drawing(obj.dataset.obj);
    if (!g) continue;
    const on = () => g.setAttribute('data-hover', '');
    const off = () => {
      if (!obj.matches(':hover') && !obj.contains(document.activeElement)) g.removeAttribute('data-hover');
    };
    obj.addEventListener('pointerenter', on);
    obj.addEventListener('pointerleave', off);
    obj.addEventListener('focusin', on);
    obj.addEventListener('focusout', () => requestAnimationFrame(off));
  }
}

// Touch screens have no hover, and Safari doesn't focus buttons on tap.
// A tap on an object opens its tag until the next tap elsewhere.
function setUpTouchTags(objects) {
  let lastPointer = 'mouse';
  const closeAll = () => objects.forEach(o => o.removeAttribute('data-active'));

  document.addEventListener('pointerdown', event => {
    lastPointer = event.pointerType;
    if (!event.target.closest('.obj')) closeAll();
  }, { capture: true });

  for (const obj of objects) {
    obj.querySelector('.obj-btn').addEventListener('click', () => {
      if (lastPointer === 'mouse') return;
      closeAll();
      obj.setAttribute('data-active', '');
    });
  }
  return closeAll;
}
