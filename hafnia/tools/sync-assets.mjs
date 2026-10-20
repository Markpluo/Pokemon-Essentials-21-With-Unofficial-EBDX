// Copies the graphics and audio each content pack lists from the Essentials repo
// (../Graphics, ../Audio) into the client's public folder. Pokémon sprites and cries are
// shared by all packs and found by their Essentials ID (e.g. SPRIGATITO).
// Usage: npm run assets
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repo = join(root, '..');
const out = join(root, 'apps', 'client', 'public', 'game-assets');
const species = JSON.parse(readFileSync(join(root, 'packages', 'core', 'data', 'species.json'), 'utf8'));

let copied = 0, missing = [];
function copy(src, dest) {
  const from = join(repo, src);
  if (!existsSync(from)) { missing.push(src); return; }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(from, dest);
  copied++;
}

for (const dir of readdirSync(join(root, 'packs'))) {
  const manifestPath = join(root, 'packs', dir, 'pack.json');
  if (!existsSync(manifestPath)) continue;
  const pack = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const [key, src] of Object.entries(pack.images)) copy(src, join(out, pack.id, `${key}.png`));
  for (const [key, src] of Object.entries(pack.audio)) copy(src, join(out, pack.id, 'audio', `${key}.ogg`));
  for (const id of pack.species) {
    const key = species[id]?.key ?? id.toUpperCase();
    copy(`Graphics/Pokemon/Front/${key}.png`, join(out, 'pokemon', 'front', `${key}.png`));
    copy(`Graphics/Pokemon/Back/${key}.png`, join(out, 'pokemon', 'back', `${key}.png`));
    copy(`Graphics/Pokemon/Icons/${key}.png`, join(out, 'pokemon', 'icons', `${key}.png`));
    copy(`Audio/SE/Cries/${key}.ogg`, join(out, 'pokemon', 'cries', `${key}.ogg`));
  }
}
console.log(`assets: ${copied} files copied to apps/client/public/game-assets`);
if (missing.length) { console.error(`missing: ${missing.join(', ')}`); process.exit(1); }
