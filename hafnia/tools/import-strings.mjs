// Turns the demo dialogue script (content/demo/script.md in the project files) into the pack's
// string table. Each table row "| `key` | line |" becomes an entry; stage directions in *(...)*
// are dropped, other *italics* and **bold** lose their marks, and " / " becomes a line break.
// Usage: node tools/import-strings.mjs <path to script.md>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = process.argv[2];
if (!src) { console.error('usage: node tools/import-strings.mjs <script.md>'); process.exit(1); }
const out = join(root, 'packs', 'hafnia', 'strings', 'en.json');
const extra = JSON.parse(readFileSync(join(root, 'packs', 'hafnia', 'strings', 'en.extra.json'), 'utf8'));

const strings = {};
for (const row of readFileSync(src, 'utf8').split('\n')) {
  const m = row.match(/^\|\s*`([a-z0-9.]+)`\s*\|\s*(.+?)\s*\|\s*$/);
  if (!m) continue;
  const line = m[2]
    .replace(/\s*\*\([^)]*\)\*/g, '')          // *(stage direction)*
    .replace(/\*\*([^*]+)\*\*/g, '$1')          // **bold**
    .replace(/\*([^*]+)\*/g, '$1')              // *italics*
    .replace(/\s*\/\s*$/, '')                  // a box break left dangling by a removed direction
    .replace(/\s+\/\s+/g, '\n')
    .trim();
  if (line) strings[m[1]] = line;
}
Object.assign(strings, extra);   // hand-written lines and overrides
writeFileSync(out, JSON.stringify(strings, null, 1) + '\n');
console.log(`strings: ${Object.keys(strings).length} entries written to ${out}`);
