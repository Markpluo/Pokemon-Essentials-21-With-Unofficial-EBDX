# The test bot

One shared bot that plays the real game in headless Chromium with the keyboard, like a player.
Every feature gets checked the same way: add a scenario file here instead of playtesting by hand.

```
cd hafnia
npm run bot                      # every scenario (builds a debug build first, ~4 min on 4 cores)
npm run bot -- starters          # only files matching "starters"
npm run bot -- --grep @smoke     # only tests tagged @smoke (also @battle, @save, @maps, @story)
npm run bot -- --headed          # watch it play (needs a display)
BOT_NO_BUILD=1 npm run bot       # reuse the last build when only scenarios changed
npm run bot:report               # open the HTML report
```

Results land in `bot/results/`:

- `shots/<test>/NN_<name>.png`: every `bot.shot()`, in order. Look at these after visual changes.
- `report/`: the HTML report, with screenshots, the transcript of everything the game said, and
  for failures the bot's last view of the screen (`state.txt`) and a video (plus a Playwright trace
  when CI retries a failed test).

CI runs the whole bot on every push and PR that touches `hafnia/` (the `bot` job in
`.github/workflows/hafnia.yml`) and uploads `bot/results/` as the `bot-results` artifact.

## How it works

- `serve.mjs` builds the client with `VITE_DEBUG=1` (Debug menu on) into `bot/.build/` and serves it.
  `BOT_URL=http://localhost:5173/ npm run bot` points the bot at a running `npm run dev` instead.
- The game exposes `window.__hafnia.probe()`: a plain snapshot of what is on screen (scene, map,
  position, text box, menu options and cursor, pickers, battle state and the battle request).
  The bot reads it, decides, and presses keys. Nothing is faked: input goes through the game's own
  key handling.
- `?speed=4` (debug builds only) runs the game loop 4x faster; battle animations and sound are off.
  `bot.boot({ speed: 1, animations: 'on', sound: true })` for real time.
- Every test fails if the page logs an error. `bot.allowError(/known thing/)` accepts one.

## Writing a scenario

Make `bot/scenarios/<feature>.bot.ts`:

```ts
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('my feature @myfeature', async ({ bot }) => {
  // Start where the feature is, not at the title: a real save made by game-core in a second.
  await bot.loadSave(tweak(afterStarter('popplio'), { party: [{ species: 'ditto', level: 20 }], noEncounters: true }));
  await bot.warp('christianshavn');                   // Debug-menu warp
  await bot.talkTo(9, 9);                             // walk next to it, face it, press A, click through
  expect(bot.said.join('\n')).toContain('Old Rod');
  expect((await bot.state()).world!.bag.oldrod).toBe(1);
  await bot.shot('got-the-rod');
});
```

### Starting points (`lib/saves.ts`)

| Function | Where it puts you |
|---|---|
| `bot.boot()` then `bot.newGame({ name, look })` | A brand-new game, in the flat after the intro |
| `beforeStarter()` | King's Garden, one step below the Palm House door (step `up` for the starter scene) |
| `afterStarter(species)` | Palm House after Lukas's first battle; Coil online, bike and 5 Poké Balls |
| `tweak(save, { map, x, y, party, bag, money, flags, badges, coil, noEncounters })` | Any of those, changed |
| `new CoreDriver(...)` / `CoreDriver.newGame()` | Play game-core headlessly yourself (`walkTo`, `exit`, `answers`), then `.save()` |

Pass any of them to `bot.loadSave(save, slot = 1)`.

### What the bot can do (`lib/bot.ts`)

| Call | Does |
|---|---|
| `walkTo(x, y)` | Path-finds on the current map (avoids tall grass, re-plans around NPCs), fights anything that jumps out. Stops if the map changes. |
| `exit(dir, x, y)` | Walk to (x, y), then step `dir` (off the map edge, through a door). |
| `enter('palm')` | Walk into a building's door by its id. |
| `talkTo(x, y)` | Walk next to it, face it, press A, click through. |
| `step(dir)`, `face(dir)`, `interact()`, `tap('A')` | Single inputs. |
| `settle(opts)` | The autopilot: clicks through text, answers prompts, picks in pickers, fights battles, until you can walk again. Most calls end with it. `until: s => ...` stops early. |
| `answers.push({ when: /question/, pick: 'Yes' })` | How to answer prompts (by label, prefix, regex or index). Without a match: the first option. |
| `battlePlan = 'fight' \| 'coil' \| 'catch' \| 'run' \| (s => choice)` | How to fight. `coil` spends Current or Copper as soon as it's charged. A function gets the probe and returns `{ move, coil? }`, `{ ball }`, `{ run: true }` or `{ switchTo }`. |
| `wildBattle(plan)` | Paces in the nearest tall grass until something appears, then fights it. |
| `fight(plan)` | Fights the battle that is starting now. |
| `menu('Bag')`, `openMenu()`, `choose(label)`, `pick(label)` | Menus by label. |
| `debug('Heal team')`, `warp('nyhavn')` | Debug menu commands and warps (labels as in the Debug menu). |
| `save(slot)`, `reload()`, `continueGame(slot)` | Saving and loading through the real menus. |
| `state()`, `waitFor(pred)` | The probe, and waiting on it. |
| `said`, `battles` | What the game said, and each battle's foe and result. |
| `shot(name)` | Screenshot of the game screen into the report and `results/shots/`. |

### Conventions

- One file per feature, named after it; tag tests (`@daycare`, `@online`) so others can run just yours.
- Start from a save next to the feature. Replaying the story belongs in `prologue.bot.ts` only.
- Assert on game state (`state().world`: map, position, party, bag, money, badges) and on `bot.said`.
  Story flags are not sent to the client; check what the player would see instead.
- Take a `shot()` at each screen a human should look at. Name it after what it shows.
- Keep tests independent: each one gets a fresh browser profile, so saves never leak between them.

### When you add a new screen to the game

The autopilot understands text boxes, menus made with `choose()`, the battle grid and the pickers
that set `G.ui.picker` (starters, character look, party). A new full-screen picker should set
`G.ui.picker = { kind, options, idx }` too, or the bot will only be able to press A on it.
