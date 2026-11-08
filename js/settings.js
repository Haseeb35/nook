// Popovers: the clock's settings and the list of keyboard shortcuts.
import { LIMITS } from './timer.js';

const NARROW_QUERY = '(max-width: 720px), (max-aspect-ratio: 13/10)';

// A small non-modal dialog: focus moves in on open and back on close;
// Esc and a click outside close it; Tab stays inside while it is open.
function createPopover(panel, { anchor = null, firstFocus, onClose = () => {} }) {
  const narrow = window.matchMedia(NARROW_QUERY);
  let opener = null;

  function place() {
    panel.style.removeProperty('left');
    panel.style.removeProperty('top');
    if (!anchor || narrow.matches) return; // CSS centres or docks it
    const box = anchor().getBoundingClientRect();
    const left = Math.min(window.innerWidth - panel.offsetWidth - 16,
      Math.max(16, box.left + box.width / 2 - panel.offsetWidth / 2));
    const top = Math.max(16, box.top - panel.offsetHeight - 18);
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  function open(from) {
    opener = from ?? document.activeElement;
    panel.hidden = false;
    place();
    requestAnimationFrame(() => panel.setAttribute('data-open', ''));
    (firstFocus?.() ?? panel.querySelector('input, button'))?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
  }

  function close() {
    if (panel.hidden) return;
    onClose();
    panel.removeAttribute('data-open');
    panel.hidden = true;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    // The opener may live in a tag that has hidden itself by now;
    // fall back to the anchor, which is always there.
    opener?.focus({ preventScroll: true });
    if (document.activeElement !== opener) anchor?.()?.querySelector('.obj-btn')?.focus({ preventScroll: true });
    opener = null;
  }

  function onOutside(event) {
    if (!panel.contains(event.target)) close();
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...panel.querySelectorAll('input:not([hidden]), button')]
      .filter(el => el.offsetParent !== null);
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return {
    open,
    close,
    toggle: from => (panel.hidden ? open(from) : close()),
    get isOpen() { return !panel.hidden; },
  };
}

// --- Settings -------------------------------------------------------------------
export function createSettings({ getSettings, onChange, anchor }) {
  const panel = document.getElementById('settings');
  const form = panel.querySelector('form');
  const notifyRow = form.querySelector('[data-row="notify"]');
  const notifyNote = form.querySelector('.settings-note');

  // Browsers without notifications (e.g. iOS Safari outside an installed app)
  // don't get the option at all.
  if (!('Notification' in window)) notifyRow.hidden = true;

  function fill(settings) {
    for (const key of Object.keys(LIMITS)) form.elements[key].value = String(settings[key]);
    form.elements.autoStart.checked = settings.autoStart;
    form.elements.notify.checked = settings.notify;
  }

  function read() {
    const out = { autoStart: form.elements.autoStart.checked, notify: form.elements.notify.checked };
    for (const key of Object.keys(LIMITS)) out[key] = form.elements[key].valueAsNumber;
    return out;
  }

  // Apply on every valid edit; an empty or half-typed field waits for blur.
  form.addEventListener('input', event => {
    if (event.target.type === 'number' && !Number.isFinite(event.target.valueAsNumber)) return;
    if (event.target.type === 'checkbox') return; // handled on change
    onChange(read());
  });
  form.addEventListener('change', () => fill(onChange(read())));
  form.addEventListener('submit', event => {
    event.preventDefault();
    popover.close();
  });

  const popover = createPopover(panel, {
    anchor,
    firstFocus: () => form.elements.focus,
    onClose: () => fill(onChange(read())),
  });

  return {
    ...popover,
    get isOpen() { return popover.isOpen; },
    open(from) {
      fill(getSettings());
      notifyNote.textContent = '';
      popover.open(from);
    },
    toggle(from) {
      if (popover.isOpen) popover.close();
      else this.open(from);
    },
    // Re-read the outside state (after a permission prompt, say).
    refresh(note = '') {
      fill(getSettings());
      notifyNote.textContent = note;
    },
  };
}

// --- Shortcuts --------------------------------------------------------------------
export function createShortcuts() {
  const panel = document.getElementById('shortcuts');
  panel.querySelector('[data-close]').addEventListener('click', () => popover.close());
  const popover = createPopover(panel, {});
  return popover;
}
