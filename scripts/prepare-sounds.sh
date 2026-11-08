#!/usr/bin/env bash
# Turn raw CC0 recordings (sounds/raw/) into small, seamless, level-matched
# files for the web (sounds/). See sounds/SOURCES.md.
#
#   scripts/prepare-sounds.sh [--preview] [name ...]
#
# Loops:     highpass → trim → equal-power crossfade at the seam → level →
#            pad with wrap-around margins → Opus (.ogg) + AAC (.m4a)
# One-shots: highpass → trim silence → short fade-out → level → encode
#
# Why margins: AAC and Opus add a little silence (encoder priming) at the
# edges of a file. Each loop is written as  [end of loop][loop][start of loop],
# and the player loops between loopStart and loopEnd from manifest.json, so
# that silence is never inside the part that repeats.
#
# Requires ffmpeg with libopus. Works with the bash that ships with macOS.
set -euo pipefail

# --- Settings (override any of these from the environment) -----------------
TARGET_LUFS="${TARGET_LUFS:--23}"   # loops and one-shots
CHIME_LUFS="${CHIME_LUFS:--20}"     # the chime sits a little forward
HIGHPASS_HZ="${HIGHPASS_HZ:-60}"
BITRATE="${BITRATE:-96k}"
RATE=48000
MARGIN=0.5                          # seconds of wrap-around padding per side
MAX_BYTES=409600                    # ~400 KB per file
PEAK_CEILING=-1                     # dBFS: never raise a sound past this
MAX_LIMIT_DB=10                     # most peak reduction allowed to reach the target

# name    kind  start(s) length(s) crossfade(s) channels  LUFS ("-" = default)
# Edit start/length after listening to the previews. For music, make
# length a whole number of bars and keep the crossfade tiny.
# Starts below were chosen by measuring each recording for the steadiest
# stretch (least loudness wobble, fewest spikes); cafe.wav has only ~16 s of
# usable audio between digital silence, and the clink is one of a series.
SOUNDS="
rain      loop  285      30        2            2         -
cafe      loop  2.2      14        2            1         -
fire      loop  1        30        2            2         -26
radio     loop  0        24        0.03         2         -
clink     shot  13.25    1.4       0            1         -
logpop    shot  0        4         0            1         -
page      shot  0        3         0            1         -
chime     shot  0        7         0            1         -20
"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="${RAW_DIR:-$ROOT/sounds/raw}"
OUT="${OUT_DIR:-$ROOT/sounds}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PREVIEW=0
ONLY=""
for arg in "$@"; do
  case "$arg" in
    --preview) PREVIEW=1 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    -*) echo "Unknown option: $arg" >&2; exit 2 ;;
    *) ONLY="$ONLY $arg" ;;
  esac
done

command -v ffmpeg >/dev/null || { echo "ffmpeg not found. On macOS: brew install ffmpeg" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe not found (it ships with ffmpeg)." >&2; exit 1; }
ffmpeg -hide_banner -encoders 2>/dev/null | grep -q ' libopus ' \
  || { echo "This ffmpeg has no libopus encoder." >&2; exit 1; }

# Apple's AAC encoder sounds better at low bitrates; use it when present.
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q ' aac_at '; then AAC=aac_at; else AAC=aac; fi

mkdir -p "$OUT"

# --- Helpers ------------------------------------------------------------------
# Parenthesised so BSD awk never reads ">" as a redirect.
calc() { awk "BEGIN { printf \"%.4f\", ($*) }"; }
num() { awk "BEGIN { printf \"%g\", ($*) }"; }
ff() { ffmpeg -hide_banner -nostdin -loglevel error -y "$@"; }

find_raw() {
  local name="$1" ext f
  for ext in wav WAV flac FLAC aif AIF aiff AIFF ogg OGG mp3 MP3 m4a M4A; do
    f="$RAW/$name.$ext"
    [ -f "$f" ] && { echo "$f"; return 0; }
  done
  return 1
}

duration() {
  ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$1" </dev/null
}

# Prints "<integrated LUFS> <true peak dBFS>".
loudness() {
  ffmpeg -hide_banner -nostdin -i "$1" -af ebur128=peak=true:framelog=verbose -f null - 2>&1 \
    | awk '/^ *I: / { i = $2 } /^ *Peak: / { p = $2 } END { print i, p }'
}

# Prints "<gain dB> <limit 0|1>": the gain that reaches the loudness target,
# and whether a peak limiter is needed to keep transients (log pops, clinks)
# under the ceiling. Past MAX_LIMIT_DB of limiting, the gain is held back.
gain_for() {
  local file="$1" target="$2" measured lufs peak gain over limit=0
  measured="$(loudness "$file")"
  lufs="${measured% *}"
  peak="${measured#* }"
  # Very short clips can fall under the loudness gate; level those by peak.
  if awk "BEGIN { exit !($lufs < -60) }"; then
    gain="$(calc "-12 - ($peak)")"
  else
    gain="$(calc "$target - ($lufs)")"
  fi
  over="$(calc "$peak + $gain - ($PEAK_CEILING)")"
  if awk "BEGIN { exit !($over > $MAX_LIMIT_DB) }"; then
    gain="$(calc "$gain - ($over - $MAX_LIMIT_DB)")"
    echo "  note: peaks too far above the rest; held back $(num "$over - $MAX_LIMIT_DB") dB" >&2
    limit=1
  elif awk "BEGIN { exit !($over > 0) }"; then
    echo "  note: limiting peaks by up to $(num "$over") dB to reach the target" >&2
    limit=1
  fi
  echo "$gain $limit"
}

# Volume, then (if needed) a look-ahead peak limiter at the ceiling.
# level=disabled stops alimiter from re-normalising; latency=1 removes its delay.
level_chain() { # <gain> <limit>
  local chain="volume=${1}dB"
  if [ "$2" = 1 ]; then
    chain="$chain,alimiter=limit=$(calc "10 ^ (($PEAK_CEILING - 0.5) / 20)"):attack=1:release=80:level=disabled:latency=1"
  fi
  echo "$chain"
}

encode() { # <input wav> <output base name> <channels>
  ff -i "$1" -ac "$3" -ar "$RATE" -c:a libopus -b:a "$BITRATE" -vbr constrained -application audio "$OUT/$2.ogg" || return 1
  ff -i "$1" -ac "$3" -ar "$RATE" -c:a "$AAC" -b:a "$BITRATE" -movflags +faststart "$OUT/$2.m4a" || return 1
}

size_of() { wc -c < "$1" | tr -d ' '; }

# --- Loops ----------------------------------------------------------------------
make_loop() {
  local name="$1" src="$2" start="$3" len="$4" xf="$5" ch="$6" target="$7"
  local have need
  have="$(duration "$src")"
  need="$(calc "$start + $len + $xf")"
  if awk "BEGIN { exit !($have < $need) }"; then
    echo "  skipped: needs ${need}s from ${start}s, file is ${have}s. Lower start/length in the table." >&2
    return 1
  fi

  # 1. High-pass the whole file first, so the filter is settled before the cut.
  ff -i "$src" -af "highpass=f=$HIGHPASS_HZ:poles=2" -ac "$ch" -ar "$RATE" -c:a pcm_f32le "$WORK/$name-hp.wav" || return 1

  # 2. Take length + crossfade, then fold the extra tail over the head with an
  #    equal-power (sine/cosine) crossfade. The last sample of the loop then
  #    leads straight back into its first.
  local tail_end
  tail_end="$(calc "$len + $xf")"
  ff -i "$WORK/$name-hp.wav" -filter_complex "
    [0:a]atrim=start=$start:duration=$tail_end,asetpts=PTS-STARTPTS,asplit=3[a][b][c];
    [a]atrim=start=0:end=$xf,asetpts=PTS-STARTPTS,afade=t=in:d=$xf:curve=qsin[head];
    [b]atrim=start=$xf:end=$len,asetpts=PTS-STARTPTS[body];
    [c]atrim=start=$len:end=$tail_end,asetpts=PTS-STARTPTS,afade=t=out:d=$xf:curve=qsin[tail];
    [head][tail]amix=inputs=2:normalize=0:duration=first[seam];
    [seam][body]concat=n=2:v=0:a=1[out]" \
    -map "[out]" -c:a pcm_f32le "$WORK/$name-loop.wav" || return 1

  # 3. Level the loop. The gain is linear; a limiter (when needed) runs over
  #    three back-to-back copies so it is in the same state on both sides
  #    of the seam.
  local measured gain limit chain pre
  measured="$(gain_for "$WORK/$name-loop.wav" "$target")" || return 1
  gain="${measured% *}"
  limit="${measured#* }"
  chain="$(level_chain "$gain" "$limit")"

  # 4. Keep the middle copy plus wrap-around margins:
  #    [last MARGIN s][loop][first MARGIN s].
  pre="$(calc "$len - $MARGIN")"
  ff -stream_loop 2 -i "$WORK/$name-loop.wav" \
    -af "$chain,atrim=start=$pre:duration=$(calc "$len + 2 * $MARGIN"),asetpts=PTS-STARTPTS" \
    -c:a pcm_f32le "$WORK/$name-final.wav" || return 1

  encode "$WORK/$name-final.wav" "$name" "$ch" || return 1

  if [ "$PREVIEW" = 1 ]; then
    mkdir -p "$RAW/preview"
    ff -stream_loop 2 -i "$WORK/$name-loop.wav" -af "$chain" -c:a pcm_s16le "$RAW/preview/$name-x3.wav"
  fi

  MANIFEST_ENTRIES="$MANIFEST_ENTRIES$(printf '    "%s": { "kind": "loop", "loopStart": %s, "loopEnd": %s }' \
    "$name" "$(num "$MARGIN")" "$(num "$MARGIN + $len")"),
"
}

# --- One-shots ------------------------------------------------------------------
make_shot() {
  local name="$1" src="$2" start="$3" len="$4" ch="$6" target="$7"

  # Trim silence at both ends, cap the length, fade the last 150 ms.
  ff -i "$src" -af "highpass=f=$HIGHPASS_HZ:poles=2,atrim=start=$start,asetpts=PTS-STARTPTS,
    silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.02,
    areverse,silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.05,areverse,
    atrim=end=$len,asetpts=PTS-STARTPTS" \
    -ac "$ch" -ar "$RATE" -c:a pcm_f32le "$WORK/$name-trim.wav" || return 1

  local dur fade_at measured
  dur="$(duration "$WORK/$name-trim.wav")"
  fade_at="$(calc "$dur > 0.3 ? $dur - 0.15 : 0")"
  measured="$(gain_for "$WORK/$name-trim.wav" "$target")" || return 1
  ff -i "$WORK/$name-trim.wav" -af "afade=t=out:st=$fade_at:d=0.15,$(level_chain ${measured% *} ${measured#* })" \
    -c:a pcm_f32le "$WORK/$name-final.wav" || return 1

  encode "$WORK/$name-final.wav" "$name" "$ch" || return 1
  MANIFEST_ENTRIES="$MANIFEST_ENTRIES$(printf '    "%s": { "kind": "shot" }' "$name"),
"
}

# --- Run --------------------------------------------------------------------------
MANIFEST_ENTRIES=""
MISSING=""
FAILED=""
DONE=""
WARN=0

while read -r name kind start len xf ch lufs; do
  [ -z "${name:-}" ] && continue
  if [ -n "$ONLY" ] && ! echo " $ONLY " | grep -q " $name "; then continue; fi
  if ! src="$(find_raw "$name")"; then
    MISSING="$MISSING $name"
    continue
  fi
  echo "• $name  ←  ${src#"$ROOT"/}"
  target="$TARGET_LUFS"
  if [ "$name" = chime ]; then target="$CHIME_LUFS"; fi
  if [ -n "${lufs:-}" ] && [ "$lufs" != "-" ]; then target="$lufs"; fi
  if [ "$kind" = loop ]; then
    make_loop "$name" "$src" "$start" "$len" "$xf" "$ch" "$target" || { FAILED="$FAILED $name"; continue; }
  else
    make_shot "$name" "$src" "$start" "$len" "$xf" "$ch" "$target" || { FAILED="$FAILED $name"; continue; }
  fi
  DONE="$DONE $name"
done <<EOF
$SOUNDS
EOF

if [ -z "$DONE" ]; then
  echo "Nothing prepared. Put recordings in ${RAW#"$ROOT"/}/ (see sounds/SOURCES.md)." >&2
  exit 1
fi

# Manifest: merge with entries from earlier runs for sounds not redone now.
{
  echo "{"
  echo "  \"version\": 1,"
  echo "  \"sounds\": {"
  if [ -f "$OUT/manifest.json" ]; then
    for old in $(grep -oE '^    "[a-z]+"' "$OUT/manifest.json" | tr -d ' "'); do
      echo " $DONE " | grep -q " $old " && continue
      grep -E "^    \"$old\":" "$OUT/manifest.json" | sed 's/,*$/,/'
    done
  fi
  printf '%s' "$MANIFEST_ENTRIES" | sed '$ s/,$//'
  echo "  }"
  echo "}"
} > "$WORK/manifest.json"
mv "$WORK/manifest.json" "$OUT/manifest.json"

# Report.
echo
printf '%-8s %8s %9s %10s %10s\n' sound seconds LUFS ogg m4a
for name in $DONE; do
  ogg="$OUT/$name.ogg"; m4a="$OUT/$name.m4a"
  read -r lufs _ <<< "$(loudness "$ogg")"
  # Clips under ~0.4 s are too short to measure; they were levelled by peak.
  awk "BEGIN { exit !($lufs < -60) }" && lufs=short
  so="$(size_of "$ogg")"; sm="$(size_of "$m4a")"
  flag=""
  if [ "$so" -gt "$MAX_BYTES" ] || [ "$sm" -gt "$MAX_BYTES" ]; then flag="  over 400 KB"; WARN=1; fi
  printf '%-8s %8.1f %9s %9sK %9sK%s\n' "$name" "$(duration "$ogg")" "$lufs" "$((so / 1024))" "$((sm / 1024))" "$flag"
done
[ -n "$MISSING" ] && echo && echo "Not found in ${RAW#"$ROOT"/}/:$MISSING"
[ -n "$FAILED" ] && echo "Not prepared (see messages above):$FAILED"
[ "$WARN" = 1 ] && echo "Some files are over 400 KB: shorten that loop or try BITRATE=80k."
[ "$PREVIEW" = 1 ] && echo && echo "Previews (3× loop) in ${RAW#"$ROOT"/}/preview/"
exit 0
