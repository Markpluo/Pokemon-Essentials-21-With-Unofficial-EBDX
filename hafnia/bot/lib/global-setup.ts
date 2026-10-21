// Clears the previous run's screenshots so bot/results/shots/ only shows this run.
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export default function globalSetup() {
  rmSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'results', 'shots'), { recursive: true, force: true });
}
