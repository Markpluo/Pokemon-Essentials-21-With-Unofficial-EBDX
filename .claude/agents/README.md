# Game dev agent team

Claude Code subagents for *Pokémon: Copper & Current*. They describe the game as it is actually built: the TypeScript web stack in `hafnia/` (game-core on the Showdown simulator, the `hafnia` content pack, the browser client, the test bot and the playthrough bot). The Essentials + EBDX files are only the asset and data source.

They live in `.claude/agents/` at the root of Mark's fork, so Claude Code picks them up in any session on the repo. A copy is kept in the project files. Claude picks an agent from its description, or ask for one by name ("use the battle-designer to balance Gym 8").

Rewritten 2026-10-22 against the real repo (the 2026-10-20 versions described a planned layout: pnpm, Tiled maps, Colyseus server, JSON trainer files, none of which exist).

| Agent | Role |
|---|---|
| game-director | Vision, scope, the chapter plan, briefs with a "done" checklist, hands work to the others |
| story-writer | Story bible, dialogue in `content/demo/script.md` and its import into `strings/en.json` |
| art-director | Art gaps and specs for Mark's art, `pack.json` images, `art.ts` placeholders, animation look |
| game-programmer | game-core, Showdown battles, script API, saves, client, tooling, CI |
| battle-designer | Trainer teams, encounters, soft caps, AI tiers, items; proves balance with the playthrough bot |
| map-designer | Maps in `world.ts`, area scripts, chapter wiring in `index.ts`, softlock checks |
| audio-director | Track choice and assignment, MIDI to OGG, loudness, briefs, credits |
| qa-tester | Chapter tests, the regression every second chapter, bot scenarios, bug reports |

Every agent starts with the same project context block and points at the design docs in `/mnt/project-files/`.
