// Bundles the headless playthrough (it imports the JSON-importing packs, like core-entry.ts) and runs it.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '.build', 'node', 'playthrough.mjs');
await build({
  entryPoints: [join(here, 'run.ts')], outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node20', logLevel: 'error',
  external: ['esbuild'],
  plugins: [{ name: 'core-shim', setup(b) { b.onResolve({ filter: /^\.\/core$/ }, () => ({ path: join(here, 'core-shim.ts') })); } }], banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" }
});
const r = spawnSync(process.execPath, [out, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
