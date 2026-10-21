// Serves the game for the test bot: a production build with the Debug menu switched on
// (VITE_DEBUG=1), in bot/.build so it never mixes with the real dist/. Playwright starts this.
// BOT_NO_BUILD=1 reuses the last build (handy when only scenarios changed).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const client = join(root, 'apps', 'client');
const outDir = join(root, 'bot', '.build');
const port = Number(process.env.BOT_PORT || 4317);

process.env.VITE_DEBUG = '1';
const config = { root: client, configFile: join(client, 'vite.config.ts'), logLevel: 'warn', build: { outDir, emptyOutDir: true } };
if (process.env.BOT_NO_BUILD !== '1' || !existsSync(join(outDir, 'play.html'))) {
  execFileSync(process.execPath, [join(root, 'tools', 'sync-assets.mjs')], { stdio: 'inherit' });
  await build(config);
}
const server = await preview({ ...config, preview: { port, strictPort: true, host: '127.0.0.1' } });
server.printUrls();
