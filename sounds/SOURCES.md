# Sound sources

Every sound in Nook is a real recording released under **CC0** (public domain),
or recorded by the author. No synthesised noise, no CC-BY-NC, no
"royalty-free pack" licenses, nothing with unclear terms: this is a public repo.

## How to collect them

1. Make a free account at [freesound.org](https://freesound.org) (downloading needs a login).
2. Use the search links below. They already have the **Creative Commons 0**
   filter on (left sidebar: *License → Creative Commons 0*). Sort by
   *Duration (long first)* for the loops.
3. On the sound's own page, check the license box on the right says
   **Creative Commons 0** before downloading. The filter is not a substitute
   for reading it.
4. Download the **original file** (WAV / FLAC / AIFF), not the MP3 preview.
5. Save it into `sounds/raw/` under the file name given for each sound (any
   extension: `rain.wav`, `rain.flac`, …). `sounds/raw/` is git-ignored.
6. Fill in the URL, author and license below, then run
   `scripts/prepare-sounds.sh` (see the end of this file).

CC0 doesn't require credit, but we give it anyway.

Each license below was checked on the sound's own Freesound page, not taken
from the search filter. Sounds under any other license are not used, even
when the license would allow it with credit.

---

## Loops

### Rain on the window → `sounds/raw/rain.*`

Plays from the window. The main sound of the room, so it matters most.

- **Listen for:** rain on glass or a windowsill, close-mic, steady intensity.
  No thunder, no traffic, no voices, no gusts of wind, no gutters gushing.
  2+ minutes so there is a clean 30 s stretch to loop. 44.1 kHz or higher, stereo.
- **Search:**
  [rain window](https://freesound.org/search/?q=rain+window&f=license%3A%22Creative+Commons+0%22) ·
  [rain on glass](https://freesound.org/search/?q=rain+on+glass&f=license%3A%22Creative+Commons+0%22) ·
  [rain windowsill](https://freesound.org/search/?q=rain+windowsill&f=license%3A%22Creative+Commons+0%22)

| URL | Author | License | Notes (good stretch, start time) |
|-----|--------|---------|----------------------------------|
| [freesound.org/s/856405](https://freesound.org/s/856405/) “20260531 Raining in Bangkok 01” | kijjaz | CC0 1.0 | 6 min, 48 kHz/24-bit stereo. Loop taken from 4:45 (steadiest 30 s). |

### Café → `sounds/raw/cafe.*`

Plays from the mug.

- **Listen for:** soft, indistinct murmur, cups and the odd espresso hiss.
  **No music in the background** (it would be someone else's copyright), no
  close conversation where words are clear, no announcements or till beeps.
  2+ minutes, stereo.
- **Search:**
  [cafe ambience](https://freesound.org/search/?q=cafe+ambience&f=license%3A%22Creative+Commons+0%22) ·
  [coffee shop](https://freesound.org/search/?q=coffee+shop&f=license%3A%22Creative+Commons+0%22) ·
  [restaurant murmur](https://freesound.org/search/?q=restaurant+murmur&f=license%3A%22Creative+Commons+0%22)

| URL | Author | License | Notes |
|-----|--------|---------|-------|
| [freesound.org/s/380202](https://freesound.org/s/380202/) “Cafe Ambience Day - 1” | lunchmoney | CC0 1.0 | 21 s mono, ~16 s usable between digital silence; 14 s loop. A longer CC0 café recording would repeat less. |

### Fire → `sounds/raw/fire.*`

Plays from the stove.

- **Listen for:** a steady indoor wood fire: crackle and soft roar. No wind,
  no voices, no one poking the logs. Avoid recordings with a big pop near
  the stretch you want to loop (it would repeat every 30 s; the one-shots
  below add pops at random instead). 1+ minute.
- **Search:**
  [fireplace crackle](https://freesound.org/search/?q=fireplace+crackle&f=license%3A%22Creative+Commons+0%22) ·
  [wood stove](https://freesound.org/search/?q=wood+stove&f=license%3A%22Creative+Commons+0%22) ·
  [fire crackling](https://freesound.org/search/?q=fire+crackling&f=license%3A%22Creative+Commons+0%22)

| URL | Author | License | Notes |
|-----|--------|---------|-------|
| [freesound.org/s/81801](https://freesound.org/s/81801/) “Fire in Fireplace, Close Up, Reverberant 2” | silencyo | CC0 1.0 | 94 s stereo. Pops limited ~7 dB to sit with the other sounds. |

### Radio (lo-fi music) → `sounds/raw/radio.*`

Plays from the radio. Music is the hardest one to source cleanly.

- **Listen for:** soft, slow (70–90 BPM), no vocals, warm keys or guitar,
  gentle drums or none. The uploader must be the composer: skip anything
  whose description mentions samples from records, films or other tracks.
  It has to loop on a bar line, so note the **BPM** and pick a stretch that is
  a whole number of bars (8 bars at 80 BPM = 24 s). 20–30 s is plenty.
- **Search:**
  [lofi](https://freesound.org/search/?q=lofi&f=license%3A%22Creative+Commons+0%22) ·
  [rhodes loop](https://freesound.org/search/?q=rhodes+loop&f=license%3A%22Creative+Commons+0%22) ·
  [jazz piano loop](https://freesound.org/search/?q=jazz+piano+loop&f=license%3A%22Creative+Commons+0%22)

| URL | Author | License | BPM | Notes |
|-----|--------|---------|-----|-------|
|     |        |         |     |       |

---

## One-shots

Quiet layers that play now and then (every 20–90 s) while their parent
sound is on, so the loops never feel mechanical. Short, single events,
recorded in a quiet room.

### Cup clink (café) → `sounds/raw/clink.*`

- **Listen for:** one gentle ceramic clink: spoon on cup or cup on saucer.
  No voices.
- **Search:**
  [cup clink](https://freesound.org/search/?q=cup+clink&f=license%3A%22Creative+Commons+0%22) ·
  [spoon cup](https://freesound.org/search/?q=spoon+cup&f=license%3A%22Creative+Commons+0%22) ·
  [saucer](https://freesound.org/search/?q=saucer&f=license%3A%22Creative+Commons+0%22)

| URL | Author | License | Notes |
|-----|--------|---------|-------|
| — | — | — | **Needed.** The first download, “clinks2” by Halleck ([4099](https://freesound.org/s/4099/)), is **CC-BY 4.0, not CC0**, so it is not used. CC0 candidates (checked): [Cup clink by vicleb](https://freesound.org/s/712856/) · [TeaCup44 by ahill86](https://freesound.org/s/206171/) |

### Log pop (fire) → `sounds/raw/logpop.*`

- **Listen for:** a single pop or a log settling, with a little crackle after.
- **Search:**
  [fire pop](https://freesound.org/search/?q=fire+pop&f=license%3A%22Creative+Commons+0%22) ·
  [log crackle](https://freesound.org/search/?q=log+crackle&f=license%3A%22Creative+Commons+0%22) ·
  [ember](https://freesound.org/search/?q=ember+crackle&f=license%3A%22Creative+Commons+0%22)

| URL | Author | License | Notes |
|-----|--------|---------|-------|
| — | — | — | **Needed.** “Hard pop” by juskiddink ([108616](https://freesound.org/s/108616/)) is **CC-BY 4.0, not CC0**, so it is not used. CC0 candidates (checked): [Pinewood fire pops by YouMightLikeThis](https://freesound.org/s/785057/) · [fire crackles by florianreichelt](https://freesound.org/s/563766/) |

### Page turn (rain) → `sounds/raw/page.*`

- **Listen for:** one soft page turn from a paper book. No handling thumps.
- **Search:**
  [page turn](https://freesound.org/search/?q=page+turn&f=license%3A%22Creative+Commons+0%22) ·
  [book page](https://freesound.org/search/?q=book+page&f=license%3A%22Creative+Commons+0%22)

| URL | Author | License | Notes |
|-----|--------|---------|-------|
| [freesound.org/s/677130](https://freesound.org/s/677130/) “Paging through book” | Aurelon | CC0 1.0 | First 3 s. |

---

## The chime → `sounds/raw/chime.*`

Plays once when a session ends. It must be soft: a real bell, singing bowl or
kalimba, never a beep.

- **Listen for:** a single strike with a long, natural decay (2–6 s), not
  clipped, not cut off. Warm rather than piercing; a low singing bowl or a
  single kalimba note is ideal.
- **Search:**
  [singing bowl](https://freesound.org/search/?q=singing+bowl&f=license%3A%22Creative+Commons+0%22) ·
  [kalimba note](https://freesound.org/search/?q=kalimba+note&f=license%3A%22Creative+Commons+0%22) ·
  [soft bell](https://freesound.org/search/?q=soft+bell&f=license%3A%22Creative+Commons+0%22)

| URL | Author | License | Notes |
|-----|--------|---------|-------|
| — | — | — | **Needed.** “Chime_01” by Andromadax24 ([186719](https://freesound.org/s/186719/)) is **CC-BY 4.0, not CC0**, so it is not used. CC0 candidates (checked): [Kalimba by PanPiper5](https://freesound.org/s/659909/) · [Little bell by NikoletB](https://freesound.org/s/846674/) |

---

## Preparing them

```sh
scripts/prepare-sounds.sh            # all sounds found in sounds/raw/
scripts/prepare-sounds.sh rain fire  # just these
scripts/prepare-sounds.sh --preview  # also write 3× loop previews to sounds/raw/preview/
```

The script trims each loop, makes it seamless with an equal-power crossfade,
filters out rumble below 60 Hz, levels everything to about -23 LUFS and writes
`.ogg` (Opus) and `.m4a` (AAC) files, each under ~400 KB, plus
`sounds/manifest.json`. Listen to the previews: if a seam or a bad moment
lands in the loop, change that sound's start time in the table at the top of
the script and run it again.
