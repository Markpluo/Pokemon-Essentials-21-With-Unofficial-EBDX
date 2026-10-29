// Assembles blyn.dk into blyn/dist: the portal (blyn/public) at the root and each project in its
// own folder. Build the projects first (cd hafnia && npm run build).
// Usage: node blyn/build.mjs
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
const projects = { 'copper-current': join(here, '..', 'hafnia', 'apps', 'client', 'dist') };

rmSync(dist, { recursive: true, force: true });
cpSync(join(here, 'public'), dist, { recursive: true });
for (const [dir, src] of Object.entries(projects)) {
  if (!existsSync(src)) throw new Error(`${src} is missing: build ${dir} first`);
  // robots.txt and Cloudflare _headers only count at the site root, which the portal provides.
  cpSync(src, join(dist, dir), { recursive: true, filter: f => !/[\\/](_headers|robots\.txt)$/.test(f) });
}
console.log(`blyn/dist ready (${Object.keys(projects).join(', ')})`);
