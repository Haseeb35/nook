// The clock's settings popover: lengths, cycle and auto-start.
// Values are applied as they change; "Done" just closes.
import { LIMITS } from './timer.js';

const NARROW_QUERY = '(max-width: 720px), (max-aspect-ratio: 13/10)';

export function createSettings({ getSettings, onChange, anchor }) {
  const panel = document.getElementById('settings');
  const form = panel.querySelector('form');
  const narrow = window.matchMedia(NARROW_QUERY);
  let opener = null;

  function fill(settings) {
    for (const key of Object.keys(LIMITS)) form.elements[key].value = String(settings[key]);
    form.elements.autoStart.checked = settings.autoStart;
  }

  function read() {
    const out = { autoStart: form.elements.autoStart.checked };
    for (const key of Object.keys(LIMITS)) out[key] = form.elements[key].valueAsNumber;
    return out;
  }

  // Apply on every valid edit; an empty or half-typed field waits for blur.
  form.addEventListener('input', event => {
    if (event.target.type === 'number' && !Number.isFinite(event.target.valueAsNumber)) return;
    onChange(read());
  });
  form.addEventListener('change', () => fill(onChange(read())));
  form.addEventListener('submit', event => {
    event.preventDefault();
    close();
  });

  function place() {
    panel.style.removeProperty('left');
    panel.style.removeProperty('top');
    if (narrow.matches) return; // CSS docks it above the shelf
    const box = anchor().getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const left = Math.min(window.innerWidth - width - 16, Math.max(16, box.left + box.width / 2 - width / 2));
    const top = Math.max(16, box.top - height - 18);
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  function open(from) {
    opener = from ?? document.activeElement;
    fill(getSettings());
    panel.hidden = false;
    place();
    requestAnimationFrame(() => panel.setAttribute('data-open', ''));
    form.elements.focus.focus({ preventScroll: true });
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
  }

  function close() {
    if (panel.hidden) return;
    fill(onChange(read()));
    panel.removeAttribute('data-open');
    panel.hidden = true;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    // The opener may live in a tag that has hidden itself by now;
    // fall back to the clock, which is always there.
    opener?.focus({ preventScroll: true });
    if (document.activeElement !== opener) anchor().querySelector('.obj-btn')?.focus({ preventScroll: true });
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
    // Keep Tab inside the popover while it is open.
    if (event.key !== 'Tab') return;
    const items = [...panel.querySelectorAll('input, button')];
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
