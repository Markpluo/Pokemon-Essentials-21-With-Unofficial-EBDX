// Bundles the sight-line checker (the packs import JSON) and runs it: `npm run sightlines [-- --fix [--write]]`.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '.build', 'node', 'sightlines.mjs');
await build({
  entryPoints: [join(here, 'check.ts')], outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node20', logLevel: 'error',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" }
});
const r = spawnSync(process.execPath, [out, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
