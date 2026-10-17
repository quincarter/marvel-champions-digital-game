#!/usr/bin/env node
/**
 * Trims an MP3 to N seconds by whole MPEG frames, optionally skipping silence at the front first: no re-encoding, so the kept audio is byte for byte the
 * original's (no ffmpeg needed). Drops the ID3 tag and a leading Xing/Info frame, whose frame count would otherwise
 * still claim the full length. MPEG-1 Layer III only (what most MP3s are).
 *
 * Usage: node scripts/trim-mp3.mjs <in.mp3> <out.mp3> <seconds> [startSeconds]
 *   node scripts/trim-mp3.mjs ~/Downloads/impact.mp3 packages/client/src/audio/sfx/shield-toss.mp3 1.6
 *   node scripts/trim-mp3.mjs ~/Downloads/punch.mp3 packages/client/src/audio/sfx/basic-attack.mp3 1 0.62
 *
 * `seconds` is how much to keep, from `startSeconds` (default 0). Cut where the sound is silent: a hard cut through a
 * loud part clicks. Starting a frame or two before the sound begins lets the decoder settle (an MP3 frame can lean on
 * the one before it), so the onset itself is never the first frame.
 */
import fs from "node:fs";
const [, , src, out, seconds, start = "0"] = process.argv;
if (!src || !out || !seconds) {
  console.error("Usage: node scripts/trim-mp3.mjs <in.mp3> <out.mp3> <seconds> [startSeconds]");
  process.exit(1);
}
const buf = fs.readFileSync(src);
let pos = 0;
if (buf.toString("latin1", 0, 3) === "ID3") {
  const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
  pos = 10 + size;
}
const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const RATES = [44100, 48000, 32000];
const frames = [];
let samples = 0;
let skipped = 0;
while (pos + 4 <= buf.length) {
  if (buf[pos] !== 0xff || (buf[pos + 1] & 0xe0) !== 0xe0) {
    pos++;
    continue;
  }
  const version = (buf[pos + 1] >> 3) & 3,
    layer = (buf[pos + 1] >> 1) & 3;
  if (version !== 3 || layer !== 1) {
    pos++;
    continue;
  } // MPEG-1 Layer III only
  const bitrate = BITRATES[buf[pos + 2] >> 4] * 1000,
    rate = RATES[(buf[pos + 2] >> 2) & 3],
    pad = (buf[pos + 2] >> 1) & 1;
  if (!bitrate || !rate) {
    pos++;
    continue;
  }
  const len = Math.floor((144 * bitrate) / rate) + pad;
  const frame = buf.subarray(pos, pos + len);
  const tag = frame.toString("latin1", 0, 64);
  if (frames.length === 0 && skipped === 0 && (tag.includes("Xing") || tag.includes("Info"))) {
    // The header frame: no audio.
  } else if (skipped / rate < +start) {
    skipped += 1152;
  } else {
    frames.push(frame);
    samples += 1152;
    if (samples / rate >= +seconds) break;
  }
  pos += len;
}
fs.writeFileSync(out, Buffer.concat(frames));
console.log(`${frames.length} frames, ${Buffer.concat(frames).length} bytes, written to ${out}`);
