// Loads game-core and the content packs into the test process: bundles core-entry.ts with esbuild
// once per process into bot/.build/node/ and imports it.
import { renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

export type Core = typeof import('./core-entry');
const here = dirname(fileURLToPath(import.meta.url));
let loading: Promise<Core> | null = null;

export function loadCore(): Promise<Core> {
  return loading ??= (async () => {
    const out = join(here, '..', '.build', 'node', 'core.mjs'), tmp = `${out}.${process.pid}.tmp.mjs`;
    await build({
      entryPoints: [join(here, 'core-entry.ts')], outfile: tmp, bundle: true, platform: 'node', format: 'esm', target: 'node20',
      logLevel: 'error', banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" }
    });
    renameSync(tmp, out);
    return import(pathToFileURL(out).href) as Promise<Core>;
  })();
}
