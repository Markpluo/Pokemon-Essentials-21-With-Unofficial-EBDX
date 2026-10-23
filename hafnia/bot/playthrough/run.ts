// Runs the headless playthrough: `npm run playthrough` (all chapters) or `-- --from ch3` / `-- --only ch1`.
// Writes bot/results/playthrough/: a save after each chapter (<chapter>.json, loadable by the browser bot),
// battles.tsv, transcript.txt and a summary on stdout.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Content, Game, hafnia } from '../lib/core-entry';
import { world } from '../lib/world';
import { Player } from './driver';
import * as R from './route';

const OUT = join(process.cwd(), 'bot', 'results', 'playthrough');
const CHAPTERS: [string, (p: Player) => void][] = [
  ['prologue', R.prologue], ['ch1', R.chapter1], ['ch2', R.chapter2], ['ch3', R.chapter3], ['ch4', R.chapter4], ['ch5', R.chapter5], ['ch6', R.chapter6], ['ch7', R.chapter7], ['ch8', R.chapter8], ['ch9', R.chapter9], ['ch10', R.chapter10], ['ch11', R.chapter11], ['ch12', R.chapter12], ['ch13', R.chapter13], ['pg1', R.postgame1], ['pg2', R.postgame2], ['pg3', R.postgame3]
];

async function main() {
  await world();
  mkdirSync(OUT, { recursive: true });
  const args = process.argv.slice(2);
  const from = args[args.indexOf('--from') + 1] ?? null, only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const seed = Number(args.includes('--seed') ? args[args.indexOf('--seed') + 1] : 7);
  const content = new Content([hafnia]);
  let start = 0;
  let p: Player;
  const first = only ?? (args.includes('--from') ? from : null);
  if (first) {
    start = CHAPTERS.findIndex(([id]) => id === first);
    if (start < 0) throw new Error(`no chapter ${first}`);
    const prev = start ? CHAPTERS[start - 1][0] : null;
    if (prev) {
      const file = join(OUT, `${prev}.json`);
      if (!existsSync(file)) throw new Error(`run ${prev} first (${file} missing)`);
      const game = Game.load(content, JSON.parse(readFileSync(file, 'utf8')));
      p = new Player(game, game.resumeEvents());
    } else { const { game, events } = Game.newGame(content, seed); p = new Player(game, events); }
  } else { const { game, events } = Game.newGame(content, seed); p = new Player(game, events); }
  const end = only ? start + 1 : CHAPTERS.length;
  let failed: unknown = null;
  for (let i = start; i < end; i++) {
    const [id, run] = CHAPTERS[i];
    const b0 = p.battles.length, s0 = p.steps;
    try { run(p); } catch (e) { failed = e; console.log(`\n!! ${id} stopped: ${(e as Error).message}\n   at ${p.mapId} ${p.s.x},${p.s.y}`); }
    const bs = p.battles.slice(b0);
    console.log(`${id}: ${bs.length} battles (${bs.filter(b => b.kind === 'trainer').length} trainer, ${bs.filter(b => b.result === 'lose').length} lost), ${p.steps - s0} steps; team ${p.s.party.map(m => `${m.species} ${m.level}`).join(', ')}; money ${p.s.money}`);
    writeFileSync(join(OUT, `${id}.json`), JSON.stringify(p.game.toSave()));
    if (failed) break;
  }
  const tsv = ['n\tchapter\tmap\tkind\ttrainer\tfoes\tteam\tresult\tturns\titems', ...p.battles.map(b => [b.n, b.chapter, b.map, b.kind, b.trainer, b.foes, b.team, b.result, b.turns, b.items].join('\t'))];
  writeFileSync(join(OUT, `battles${first ? `-${first}` : ''}.tsv`), tsv.join('\n'));
  writeFileSync(join(OUT, `transcript${first ? `-${first}` : ''}.txt`), p.said.join('\n\n'));
  console.log('\nTrainer battles:');
  for (const b of p.battles.filter(b => b.kind === 'trainer')) console.log(`  ${b.result.padEnd(4)} ${b.chapter.padEnd(10)} ${b.trainer.padEnd(30)} [${b.foes}] vs [${b.team}] ${b.turns}t`);
  if (p.notes.length) console.log(`\nNotes:\n  ${p.notes.join('\n  ')}`);
  if (p.problems.length) console.log(`\nProblems:\n  ${p.problems.join('\n  ')}`);
  if (failed) { console.error(failed); process.exit(1); }
}
main();
