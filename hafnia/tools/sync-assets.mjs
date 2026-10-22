// Copies the graphics and audio each content pack lists from the Essentials repo
// (../Graphics, ../Audio) into the client's public folder. Pokémon sprites and cries are
// shared by all packs and found by their Essentials ID (e.g. SPRIGATITO). A source starting with
// "pack:" is a file inside the pack's own folder (e.g. a recoloured sprite).
// Usage: npm run assets
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repo = join(root, '..');
const out = join(root, 'apps', 'client', 'public', 'game-assets');
const species = JSON.parse(readFileSync(join(root, 'packages', 'core', 'data', 'species.json'), 'utf8'));

let copied = 0, missing = [];
function copy(src, dest, packDir) {
  let from = src.startsWith('pack:') ? join(packDir, src.slice(5)) : join(repo, src);
  // Some Essentials files have upper-case extensions (QWILFISH_1.PNG).
  if (!existsSync(from)) from = from.replace(/\.(\w+)$/, (_, ext) => `.${ext.toUpperCase()}`);
  if (!existsSync(from)) { missing.push(src); return; }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(from, dest);
  copied++;
}

for (const dir of readdirSync(join(root, 'packs'))) {
  const manifestPath = join(root, 'packs', dir, 'pack.json');
  if (!existsSync(manifestPath)) continue;
  const pack = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const packDir = join(root, 'packs', dir);
  for (const [key, src] of Object.entries(pack.images)) copy(src, join(out, pack.id, `${key}.png`), packDir);
  for (const [key, src] of Object.entries(pack.audio)) copy(src, join(out, pack.id, 'audio', `${key}.ogg`));
  // Species plus everything they evolve into by levelling up, so evolution scenes have sprites.
  const all = new Set(pack.species);
  for (const id of all) for (const [to, method] of species[id]?.evolutions ?? []) if (method.startsWith('Level') && species[to]) all.add(to);
  // Hafnia's own Pokémon (pack.json "pokemon"): sprites and cry by key, from the pack or the repo.
  const own = pack.pokemon ?? {};
  for (const [key, src] of Object.entries(own)) {
    for (const kind of ['front', 'back', 'icons']) copy(src[kind], join(out, 'pokemon', kind, `${key}.png`), packDir);
    copy(src.cry, join(out, 'pokemon', 'cries', `${key}.ogg`), packDir);
  }
  for (const id of all) {
    if (own[id.toUpperCase()]) continue;
    // Regional forms the pack adds itself (speciesExtra) list their sprite key in pack.json "spriteKeys".
    const key = pack.spriteKeys?.[id] ?? species[id]?.key ?? id.toUpperCase();
    const base = key.replace(/_\d+$/, '');
    copy(`Graphics/Pokemon/Front/${key}.png`, join(out, 'pokemon', 'front', `${key}.png`));
    copy(`Graphics/Pokemon/Back/${key}.png`, join(out, 'pokemon', 'back', `${key}.png`));
    copy(`Graphics/Pokemon/Icons/${key}.png`, join(out, 'pokemon', 'icons', `${key}.png`));
    const cry = existsSync(join(repo, `Audio/SE/Cries/${key}.ogg`)) ? key : base; // forms share the base cry
    copy(`Audio/SE/Cries/${cry}.ogg`, join(out, 'pokemon', 'cries', `${key}.ogg`));
  }
}
// The homepage's credits page shows the Essentials + EBDX credits list as it is.
copy('README.md', join(root, 'apps', 'client', 'public', 'credits.txt'));
// Eggs share one sprite set (Graphics/Pokemon/Eggs/000*.png) under the key EGG.
copy('Graphics/Pokemon/Eggs/000.png', join(out, 'pokemon', 'front', 'EGG.png'));
copy('Graphics/Pokemon/Eggs/000_icon.png', join(out, 'pokemon', 'icons', 'EGG.png'));
copy('Graphics/Pokemon/Eggs/000_cracks.png', join(out, 'pokemon', 'front', 'EGG_cracks.png'));
console.log(`assets: ${copied} files copied to apps/client/public/game-assets`);
if (missing.length) { console.error(`missing: ${missing.join(', ')}`); process.exit(1); }
