// Synthesises the placeholder sound effects and looping area sounds the Essentials folders don't
// have (bike bell, ship horn, crane, waves, drips...). Everything is generated from code with a
// fixed seed, so the files are reproducible and free to use; Mark's own recordings replace them
// by pointing pack.json "audio" at new files. Writes OGGs under packs/hafnia/assets/audio/se.
// Needs: ffmpeg.   Usage: node tools/make-sfx.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'packs', 'hafnia', 'assets', 'audio', 'se');
const RATE = 22050;

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const noise = () => rnd() * 2 - 1;
const TAU = Math.PI * 2;

/** One-pole low-pass over a buffer (k: 0..1, lower = darker). */
function lowpass(b, k) { let y = 0; for (let i = 0; i < b.length; i++) b[i] = y += k * (b[i] - y); return b; }
function highpass(b, k) { let y = 0, x0 = 0; for (let i = 0; i < b.length; i++) { const x = b[i]; y = k * (y + x - x0); x0 = x; b[i] = y; } return b; }
const buf = secs => new Float32Array(Math.round(secs * RATE));
function mixInto(dst, src, at = 0, gain = 1) { const o = Math.round(at * RATE); for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * gain; return dst; }
function normalize(b, peak = 0.89) { let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); if (m) for (let i = 0; i < b.length; i++) b[i] *= peak / m; return b; }
/** Crossfades the end into the start so the file loops without a click. */
function loopable(b, fade = 1) {
  const n = Math.round(fade * RATE), r = b.slice(0, b.length - n);
  for (let i = 0; i < n; i++) { const t = i / n; r[i] = r[i] * t + b[b.length - n + i] * (1 - t); }
  return r;
}
/** A decaying sum of partials (bells, clinks). */
function partials(secs, list) {
  const b = buf(secs);
  for (const [f, a, d] of list) for (let i = 0; i < b.length; i++) { const t = i / RATE; b[i] += a * Math.sin(TAU * f * t) * Math.exp(-t / d); }
  return b;
}
function env(b, attack, release) {
  const a = attack * RATE, r = release * RATE;
  for (let i = 0; i < b.length; i++) b[i] *= Math.min(1, i / a || 1, (b.length - i) / r || 1);
  return b;
}

const SOUNDS = {
  // ---------- one-shots ----------
  bike_bell: () => {
    const ding = partials(0.9, [[2093, 0.6, 0.35], [2637, 0.35, 0.3], [5230, 0.2, 0.12], [6100, 0.1, 0.08]]);
    return mixInto(mixInto(buf(1.1), ding), ding, 0.16, 0.8);
  },
  ship_horn: () => {
    const b = buf(2.4);
    for (let i = 0; i < b.length; i++) { const t = i / RATE; let v = 0; for (const f of [98, 196, 294, 392, 147]) v += Math.sign(Math.sin(TAU * f * t)) * 0.2 / (f / 98); b[i] = v; }
    return env(lowpass(b, 0.12), 0.15, 0.6);
  },
  crane: () => {
    const b = buf(2.2);
    for (let i = 0; i < b.length; i++) { const t = i / RATE; const f = 55 + 30 * Math.min(1, t * 2); b[i] = Math.sin(TAU * f * t + Math.sin(TAU * 7 * t)) * 0.6 + noise() * 0.15; }
    const clank = lowpass(env(Float32Array.from(buf(0.3), () => noise()), 0.001, 0.25), 0.5);
    mixInto(b, clank, 0.05, 0.8); mixInto(b, clank, 1.9, 1);
    return env(lowpass(b, 0.3), 0.08, 0.3);
  },
  spray: () => {
    const b = Float32Array.from(buf(0.9), () => noise());
    for (let i = 0; i < b.length; i++) b[i] *= 0.6 + 0.4 * Math.sin(TAU * 11 * i / RATE);
    return env(highpass(b, 0.6), 0.02, 0.15);
  },
  explosion: () => {
    const b = Float32Array.from(buf(1.8), () => noise());
    lowpass(b, 0.06);
    for (let i = 0; i < b.length; i++) b[i] *= Math.exp(-i / RATE / 0.45);
    return env(b, 0.003, 0.3);
  },
  cannon: () => {
    const b = buf(1.6);
    for (let i = 0; i < b.length; i++) { const t = i / RATE; b[i] = Math.sin(TAU * (70 - 30 * t) * t) * Math.exp(-t / 0.25) + noise() * Math.exp(-t / 0.5) * 0.5; }
    return env(lowpass(b, 0.15), 0.002, 0.4);
  },
  scan_ping: () => mixInto(partials(1.0, [[1760, 0.6, 0.25], [3520, 0.2, 0.1]]), partials(0.8, [[1760, 0.3, 0.2]]), 0.3),
  rotom: () => {
    const b = buf(0.6);
    for (let i = 0; i < b.length; i++) { const t = i / RATE; const f = 300 + 900 * Math.abs(Math.sin(TAU * 6 * t)); b[i] = Math.sign(Math.sin(TAU * f * t)) * 0.4 + noise() * 0.2 * (rnd() < 0.02 ? 1 : 0.2); }
    return env(lowpass(b, 0.4), 0.01, 0.1);
  },
  bell_toll: () => env(partials(4, [[220, 0.5, 1.6], [440, 0.3, 1.0], [528, 0.25, 1.2], [660, 0.15, 0.8], [880, 0.1, 0.5]]), 0.005, 1),
  drip: () => {
    const b = buf(0.5);
    for (let i = 0; i < b.length; i++) { const t = i / RATE; b[i] = Math.sin(TAU * (900 + 1400 * t) * t) * Math.exp(-t / 0.06); }
    return b;
  },
  coaster: () => {
    const b = buf(2.5);
    for (let k = 0; k < 2.5 * 14; k++) { const click = lowpass(env(Float32Array.from(buf(0.03), () => noise()), 0.001, 0.02), 0.5); mixInto(b, click, k / 14 + rnd() * 0.01, 0.5 + 0.5 * (k / 35)); }
    for (let i = 0; i < b.length; i++) b[i] += Math.sin(TAU * 60 * i / RATE) * 0.15 * (i / b.length);
    return env(b, 0.2, 0.4);
  },
  coins: () => {
    const b = buf(1.2);
    for (let k = 0; k < 7; k++) mixInto(b, partials(0.4, [[3100 + rnd() * 900, 0.4, 0.09], [5200 + rnd() * 800, 0.2, 0.05]]), k * 0.07 + rnd() * 0.04);
    return b;
  },
  turbine: () => {
    const b = buf(3);
    for (let i = 0; i < b.length; i++) { const t = i / RATE; const f = 80 + 220 * Math.min(1, t / 2); b[i] = Math.sin(TAU * f * t) * 0.4 + Math.sin(TAU * f * 3.01 * t) * 0.15 + noise() * 0.1; }
    return env(lowpass(b, 0.25), 0.4, 0.6);
  },
  steam: () => env(highpass(Float32Array.from(buf(1.4), () => noise()), 0.7), 0.05, 0.9),
  // ---------- looping area sounds (quiet beds under the music) ----------
  amb_waves: () => {
    const b = Float32Array.from(buf(13), () => noise());
    lowpass(b, 0.05);
    for (let i = 0; i < b.length; i++) { const t = i / RATE; b[i] *= 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * t / 6.5), 2); }
    // two far-off gulls
    for (const at of [2.5, 8.2]) { const g = buf(0.5); for (let i = 0; i < g.length; i++) { const t = i / RATE; g[i] = Math.sin(TAU * (1500 - 700 * t) * t) * Math.sin(Math.PI * t / 0.5) * 0.12; } mixInto(b, g, at); }
    return loopable(b);
  },
  amb_drips: () => {
    const b = Float32Array.from(buf(11), () => noise() * 0.03);
    lowpass(b, 0.03);
    for (let k = 0; k < 14; k++) { const d = SOUNDS.drip(); mixInto(b, d, 0.3 + rnd() * 9.5, 0.25 + rnd() * 0.35); }
    return loopable(b, 0.5);
  },
  amb_wind: () => {
    const b = Float32Array.from(buf(12), () => noise());
    lowpass(b, 0.02);
    for (let i = 0; i < b.length; i++) { const t = i / RATE; b[i] *= 0.5 + 0.5 * Math.sin(TAU * t / 6) * Math.sin(TAU * t / 4); }
    return loopable(b);
  },
  amb_birds: () => {
    const b = Float32Array.from(buf(12), () => noise() * 0.02);
    lowpass(b, 0.02);
    for (let k = 0; k < 10; k++) {
      const base = 2500 + rnd() * 2000, n = 2 + Math.floor(rnd() * 4), at = rnd() * 10.5;
      for (let j = 0; j < n; j++) { const c = buf(0.09); for (let i = 0; i < c.length; i++) { const t = i / RATE; c[i] = Math.sin(TAU * (base + 1800 * t * (j % 2 ? -1 : 1)) * t) * Math.sin(Math.PI * t / 0.09); } mixInto(b, c, at + j * 0.12, 0.12); }
    }
    return loopable(b, 0.5);
  },
  amb_machinery: () => {
    const b = buf(10);
    for (let i = 0; i < b.length; i++) { const t = i / RATE; b[i] = Math.sin(TAU * 50 * t) * 0.2 + Math.sin(TAU * 100 * t) * 0.1 + noise() * 0.12; }
    lowpass(b, 0.08);
    for (let k = 0; k < 5; k++) mixInto(b, lowpass(env(Float32Array.from(buf(0.4), () => noise()), 0.001, 0.35), 0.3), 0.5 + k * 1.9 + rnd() * 0.5, 0.6);
    return loopable(b, 0.5);
  },
  amb_hum: () => {
    const b = buf(8);
    for (let i = 0; i < b.length; i++) { const t = i / RATE; b[i] = (Math.sin(TAU * 50 * t) + Math.sign(Math.sin(TAU * 100 * t)) * 0.15 + Math.sin(TAU * 150 * t) * 0.3) * (0.8 + 0.2 * Math.sin(TAU * 0.25 * t)) + noise() * (rnd() < 0.0005 ? 1.5 : 0.03); }
    return loopable(lowpass(b, 0.2), 0.5);
  },
  amb_steam: () => {
    const b = Float32Array.from(buf(10), () => noise());
    highpass(b, 0.5); lowpass(b, 0.4);
    for (let i = 0; i < b.length; i++) { const t = i / RATE; b[i] *= 0.15 + 0.5 * Math.pow(Math.max(0, Math.sin(TAU * t / 5)), 6); }
    return loopable(b);
  }
};

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

mkdirSync(out, { recursive: true });
const tmp = join(out, '_sfx.wav');
for (const [name, make] of Object.entries(SOUNDS)) {
  seed = [...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  // Area beds sit well under the music; one-shots are peak-normalised.
  writeFileSync(tmp, wav(normalize(make(), name.startsWith('amb_') ? 0.5 : 0.89)));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'libvorbis', '-q:a', '2', join(out, `${name}.ogg`)]);
  console.log(`made ${name}.ogg`);
}
rmSync(tmp, { force: true });
