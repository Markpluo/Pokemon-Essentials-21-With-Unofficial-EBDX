// Renders the Essentials MIDI tracks the base pack uses as placeholder music into OGG files
// (browsers can't play MIDI). Uses the repo's soundfont.sf2 with FluidSynth, then ffmpeg trims
// the silent tail and encodes. The OGGs are committed under packs/hafnia/assets/audio/bgm, so a
// normal build never needs FluidSynth; run this again only when the list below changes.
// Needs: fluidsynth, ffmpeg.   Usage: node tools/render-music.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repo = join(root, '..');
const out = join(root, 'packs', 'hafnia', 'assets', 'audio', 'bgm');
const soundfont = join(repo, 'soundfont.sf2');

// Output file -> MIDI in Audio/BGM. pack.json maps the game's music keys onto these files.
export const TRACKS = {
  'lappet-town': 'Lappet Town.mid',
  'radio-lullaby': 'Radio - Lullaby.mid',
  'radio-oak': 'Radio - Oak.mid',
  'radio-march': 'Radio - March.mid',
  'new-start': 'New Start.mid',
  'poke-center': 'Poke Center.mid',
  'poke-mart': 'Poke Mart.mid',
  'gym': 'Gym.mid',
  'route-1': 'Route 1.mid',
  'route-2': 'Route 2.mid',
  'route-3': 'Route 3.mid',
  'lab': 'Lab.mid',
  'cave': 'Cave.mid',
  'cedolan-city': 'Cedolan City.mid',
  'lerucean-town': 'Lerucean Town.mid',
  'natural-park': 'Natural Park.mid',
  'safari-zone': 'Safari Zone.mid',
  'safari-zone-exterior': 'Safari Zone exterior.mid',
  'tiall': 'Tiall.mid',
  'islands': 'Islands.mid',
  'ingido-plateau': 'Ingido Plateau.mid',
  'hall-of-fame': 'Hall of Fame.mid',
  'triple-triad': 'Triple Triad.mid',
  'game-corner': 'Game Corner.mid',
  'battle-roaming': 'Battle roaming.mid',
  'battle-gym-leader': 'Battle Gym Leader.mid',
  'battle-frontier': 'Battle Frontier.mid',
  'battle-champion': 'Battle Champion.mid'
};

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(out, { recursive: true });
  const tmp = join(out, '_render.wav');
  for (const [name, mid] of Object.entries(TRACKS)) {
    const src = join(repo, 'Audio', 'BGM', mid);
    if (!existsSync(src)) throw new Error(`missing ${src}`);
    execFileSync('fluidsynth', ['-ni', '-q', '-g', '0.5', '-r', '44100', '-F', tmp, soundfont, src], { stdio: 'ignore' });
    // Drop the reverb tail and silence after the last note so the loop restarts promptly; even out loudness without clipping.
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp,
      '-af', 'areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse,loudnorm=I=-17:TP=-1.5:LRA=11,aresample=44100',
      '-c:a', 'libvorbis', '-q:a', '1', join(out, `${name}.ogg`)]);
    console.log(`rendered ${name}.ogg`);
  }
  rmSync(tmp, { force: true });
}
