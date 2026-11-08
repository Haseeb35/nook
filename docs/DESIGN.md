# Nook — design

A Pomodoro timer you don't look at so much as sit inside. The room is the
interface: every control is an object, and every object behaves the way the
real thing would.

Visual reference: [`room-preview.html`](room-preview.html) (serve the repo root
locally and open `/docs/room-preview.html`).

---

## 1. Mood

**A rainy evening in an old apartment.** Plaster walls painted a dark plum-grey,
a heavy wooden desk, a window that looks onto wet rooftops, a wood stove that
ticks as it heats. Things are slightly worn, warm and still.

Three words to test every decision against: **quiet, physical, lived-in.**

- Quiet: low contrast everywhere except where light falls. One accent (lamp
  amber), used sparingly. Nothing bounces or flashes.
- Physical: one light source per moment (window by day, lamp at night),
  shadows always fall to the right, light behaves like light: it pools and
  fades, it doesn't glow decoratively.
- Lived-in: a sticky note with handwriting, a stack of books, a cat that has
  claimed the warm spot under the window.

What it is not: a dashboard, a landing page, a "productivity" product. No cards,
gradients, glass, glow blobs, emoji or exclamation marks.

---

## 2. Palette

Six base tokens, defined in [`css/tokens.css`](../css/tokens.css). Each time of
day re-tunes the **same six**; the artwork is drawn once.

| Token     | Morning   | Afternoon | Evening (reference) | Night     | Used for |
|-----------|-----------|-----------|---------------------|-----------|----------|
| `--wall`  | `#5A5D68` | `#534B48` | `#2B2A33`           | `#1F1E26` | Walls, page background, all shadow tones |
| `--wood`  | `#8A604C` | `#8C5D43` | `#7A5240`           | `#5B3D31` | Desk, window frame, radio, clock case, floor |
| `--lamp`  | `#F2C57C` | `#F2C57C` | `#F2C57C`           | `#EDB869` | Light: lamp, fire, lit windows, clock digits, focus rings |
| `--rain`  | `#AFC2D3` | `#A2A6A8` | `#5C7A99`           | `#33465C` | Sky, rain, city, rug, mug band |
| `--plant` | `#5C7C5A` | `#5F7449` | `#4F6B4A`           | `#3B5038` | Plant, lamp shade, one book |
| `--paper` | `#F1EBE0` | `#F1E3CB` | `#EDE3D1`           | `#DDD2BF` | Text, mug, highlights, steam |

The intent behind each column:

- **Morning**: cool, flat, overcast light. The wall lifts toward blue-grey, the
  sky is pale, the lamp is off.
- **Afternoon**: the same rain, but warmer. Taupe wall, warm-grey sky, still no lamp.
- **Evening**: the reference mood. The lamp switches on and the city lights come up.
- **Night**: everything sinks, the lamp and stove carry the room, and the
  paper tone dims slightly so white objects don't glare.

### Derived tones

Everything else is a `color-mix(in oklab, …)` of the six, recomputed per time of
day (they are redeclared on `[data-time]`, so they never inherit stale values):

`--ink` (wall + 48% black: deepest shadow, text on paper) · `--wall-deep` ·
`--wall-lit` · `--iron` / `--iron-lit` (stove, lamp arm) · `--wood-dark` /
`--wood-lit` · `--brass` (lamp + wood) · `--fur` (wood + lamp: the ginger cat) ·
`--note` (lamp + paper: the sticky note) · `--curtain` · `--rug` · `--grille` ·
`--pot` · `--sky` · `--city-far` / `--city` · `--streak` · `--ember`.

No colour appears in the scene that isn't one of the six or a mix of them.

### Light levels

Non-colour tokens that switch the light sources on and off. In the scene they
are used only as opacities.

| Token           | Morning | Afternoon | Evening | Night | Meaning |
|-----------------|---------|-----------|---------|-------|---------|
| `--daylight`    | 0.55    | 0.40      | 0.12    | 0     | Window light falling on the desk |
| `--lamp-on`     | 0       | 0         | 1       | 1     | Desk lamp (switches on by itself at 17:00) |
| `--city-lights` | 0.08    | 0.20      | 0.75    | 1     | Lit windows across the street |
| `--sky-lift`    | 30%     | 22%       | 10%     | 0%    | Paper mixed into the sky |
| `--fire`        | follows crackle volume (0 to 1) | | | | Stove flame and floor glow |

Times: morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–20:59,
night 21:00–04:59, from the visitor's local clock. A change of period
crossfades the tokens over 800 ms.

### Contrast (WCAG AA)

Measured on the computed sRGB values, including the `color-mix` tones:

| Pair                                  | Morning | Afternoon | Evening | Night | Need |
|---------------------------------------|---------|-----------|---------|-------|------|
| `--text` (paper) on `--wall`          | 5.53    | 6.72      | 11.14   | 11.04 | 4.5  |
| `--text-muted` on `--wall`            | 4.67    | 5.55      | ≥6      | ≥6    | 4.5  |
| Clock digits (lamp) on `--ink`        | 9.99    | 10.84     | 12.21   | 11.24 | 4.5  |
| Sticky note text (ink) on `--note`    | 11.54   | 12.13     | 13.62   | 12.21 | 4.5  |
| Focus ring (lamp) against `--wall`    | 4.08    | 5.29      | 8.81    | 9.17  | 3.0  |

Rule that keeps this true: lamp amber is never used for body text on the wall,
only for light, digits on the dark clock face, and focus rings.

---

## 3. Type

Two families, both self-hosted variable woff2 under SIL OFL
(`fonts/OFL-*.txt`). No third font, no system fallback styling beyond the
stack.

- **Fraunces** (opsz 9–144, wght 100–900, plus italic): every word on screen.
  Optical size is left on `auto`, so small labels get the sturdier
  small-size cut and large lines get the finer display cut. Weight 400; nothing
  bold. The sticky note uses the italic as its "handwriting".
- **JetBrains Mono** (wght 100–800): timer digits only, weight 500, tabular
  by nature so the clock never jitters.

| Step       | Size  | Use |
|------------|-------|-----|
| `--step--1`| 13 px | Object labels beside sliders, shortcut keys |
| `--step-0` | 15 px | First-visit hint, settings body |
| `--step-1` | 19 px | Sticky note task, popover titles |
| `--step-2` | 24 px | One-line status ("Rain's on. Kettle's warm. 25 minutes.") |
| `--step-3` | 38 px | Timer readout on phones |

Line height 1.5 for prose, 1.1 for single lines. Sentence case everywhere.
No letter-spaced uppercase.

### Voice

Short, calm, declarative. Periods, not exclamation marks. Describe the room,
not the user's productivity.

- First visit: *Click things. Space starts the clock.*
- Focus starts: *Rain's on. Kettle's warm. 25 minutes.*
- Break starts: *The cat is awake. Stretch with it.*
- Long break: *Four down. Make a proper cup.*
- Paused: *Paused. The rain kept going.*
- Muted: *Quiet room.*

---

## 4. Motion

Slow and physical. Things settle, they never spring.

| Token          | Value | Used for |
|----------------|-------|----------|
| `--ease-out`   | `cubic-bezier(0.22, 1, 0.36, 1)` | Everything that arrives or settles. No overshoot. |
| `--ease-soft`  | `cubic-bezier(0.45, 0, 0.55, 1)` | Loops: breathing, steam drift |
| `--dur-quick`  | 300 ms | Label and slider reveal, focus ring |
| `--dur-calm`   | 500 ms | Popovers, the phone drawer, object state changes |
| `--dur-slow`   | 800 ms | Lamp warming up, time-of-day crossfade, first-visit fade-in |

Per object:

- **Rain**: streaks fall diagonally (0.9 to 1.6 s per pass, linear, staggered).
  Three density tiers (`data-tier` 1–3) are revealed as the rain volume rises.
  Droplets stay put.
- **Steam**: two wisps rise and fade over about 6 s, offset from each other,
  only while café sound plays.
- **Stove**: flame opacity follows `--fire`. A slow, irregular flicker of
  ±6% opacity, never a strobe.
- **Lamp**: switching on takes 800 ms: the bulb first, then the cone and pool,
  like a filament warming.
- **Cat**: asleep, the body scales 1 → 1.025 vertically over a 4.2 s breath
  cycle. At the break it lifts its head, then stretches (about 1.2 s, one time),
  then sits.
- **Radio**: the dial needle eases to the new position when volume changes.
- **Clock**: digits change instantly (they're digits), with no ticking animation.

**`prefers-reduced-motion: reduce`**: rain, steam, flicker and breathing become
static frames. The cat changes pose with a 300 ms crossfade instead of
stretching. Lamp and time-of-day changes stay as plain opacity fades.
Nothing moves across the screen.

---

## 5. Composition

One inline SVG, `viewBox="0 0 1600 1000"`. Light enters from the window on the
left, so lit edges face left and every shadow (side shading and cast shadows on
the desk) falls to the right.

```
  0                400               800               1200              1600
  ┌──────────────────────────────────────────────────────────────┬──┬──────┐  0
  │ ═══ picture rail ════════════════════════════════════════════│  │══════│
  │ ┃curtain┃═══════ rod ════════════╕                           │p │      │ 100
  │ ┃       ┃┌──────────┬──────────┐ │                           │i │      │
  │ ┃       ┃│  rain    │  ╱ sheen │ │     ┌────────┐            │p │      │
  │ ┃       ┃│   ╱ ╱    │          │ │     │ today  │ #note  ┌───┤e │      │ 300
  │ ┃       ┃├──────────┼──────────┤ │     │ Finish │        │▌▌▌▌╱ shelf  │
  │ ┃       ┃│ ▙▟ city  │ ▟▙ lights│ │     └────────┘   ◣    └───┤  │      │
  │ ┃       ┃│ ▛▜▛▜     │  ✿ plant │ │              lamp ╲ ╲    ╱│  │      │ 450
  │ ┃       ┃└──────────┴──────────┘ #window         cone ╲     │antenna  │
  │ ┃       ┃═════════ sill ═════════                  ╲   ╲  ┌──────┐┌───┐│ 550
  │ ┃       ┃ (cat)   ▯mug  [25:00]           ┃  ║ #radio│ ▤ ◎  ││ ▲ ││
  │ ━━━━━━━━━━━━━━━━━━━ desk top ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┘│fire│ 640
  │  ┃            under-desk shadow           ┃ ▭ drawers ▭ ┃     │ #stove
  │  ┃                                        ┃ ▭         ▭ ┃     └───┘ ◎◎  │ 880
  │▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ floor ▀▀▀  ▄▄▄▄ rug ▄▄▄▄  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  glow  ▀▀▀▀▀▀│
  └────────────────────────────────────────────────────────────────────────┘ 1000
```

### Interactive objects

Each is its own `<g id>` and, in the app, sits inside a real `<button>`
(via a positioned HTML button aligned to the object's bounds, so focus rings,
`aria-label` and keyboard handling are native).

| id        | Object      | Does |
|-----------|-------------|------|
| `#window` | Window      | Rain on/off; streak density follows volume |
| `#mug`    | Mug         | Café ambience; steam while playing |
| `#stove`  | Wood stove  | Crackle; `--fire` follows volume |
| `#radio`  | Radio       | Lo-fi music; the dial is the volume |
| `#clock`  | Desk clock  | Start/pause the Pomodoro; shows the time left |
| `#cat`    | Cat         | Asleep during focus, awake on breaks (`data-state`) |
| `#lamp`   | Lamp        | Automatic from 17:00; a click toggles it for this session |
| `#note`   | Sticky note | The one task for this session, editable |

Decorative, non-interactive groups carry `aria-hidden="true"`: wall, curtain,
plant, shelf, desk, floor, light layers, grain.

### Layer order (back to front)

1. Wall, rails, wainscot
2. Lamp light on the wall (one flat disc at 3.5% opacity)
3. Window: sky, far skyline, near skyline, lit windows, rain, droplets, glass
   sheen, frame, sill
4. Curtain and rod (overlaps the frame for depth)
5. Plant, sticky note, shelf
6. Floor, rug, stove
7. Desk (shadow beneath, legs, drawers, top, daylight patch, lamp pool)
8. Desk objects, left to right: cat, mug, clock, lamp, radio
9. Lamp cone (translucent, over the objects)
10. Grain: `feTurbulence` noise at 14% opacity, `mix-blend-mode: overlay`

### Phone crop

Below 720 px wide, or on any screen narrower than 13:10, the same SVG uses
`viewBox="172 40 624 960"`: a portrait crop around the window, note, cat, mug
and clock. The lamp's light still falls in from the right edge. The scene sits
above a bottom drawer drawn as a wooden shelf, which holds all four sound
controls (the radio and stove leave the frame). The band of wall above the
scene is where the large timer readout and the status line live. Every touch
target is at least 44 × 44 px, and nothing scrolls horizontally at 360 px.

The crop lives in CSS only (`--vb-*` on `.scene` in `css/ui.css`); `js/room.js`
copies it into the SVG `viewBox`, so the buttons and the drawing always agree.

---

## 6. Texture and detail rules

- Flat shapes only: rects, simple paths, circles. No gradients in the
  scene. Light is built from translucent flat shapes, which gives a soft
  stepped falloff instead of a blur.
- Shading = one `--ink` shape at 15–35% over the right side of an object.
  Highlight = a thin `--paper` sliver at 8–12% on its left edge.
- Cast shadows: flat ellipses in `--ink` at 35%, offset right.
- Grain is the only texture. It sits above everything, so it unifies the layers.
- Stroke widths are 3, 5 or 7 units, round caps.
