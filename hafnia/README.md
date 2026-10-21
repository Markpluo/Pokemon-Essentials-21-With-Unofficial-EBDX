# Copper & Current (Hafnia)

A Pokémon fan game set in Copenhagen, built to be played solo now and online later.
This folder is the game. The Essentials + EBDX project around it is used only as the
source of sprites, sounds and Pokémon data.

## Run it

```
cd hafnia
npm install
npm run dev        # copies assets from ../Graphics and ../Audio, then starts Vite
npm test           # plays the whole prologue through game-core, no browser needed
npm run build      # static site in apps/client/dist
```

Pick "Animation viewer" in the Debug menu (dev builds), or open the game with `?anims` (for example `http://localhost:5173/?anims`) for the battle
animation preview: left/right picks an animation, A plays it, B swaps which side attacks.

## Battle animations

Moves animate from data, not code (`/mnt/project-files/design/battle-animations.md`). A move plays its
pack's bespoke timeline from `packs/<pack>/anims.json` if there is one, otherwise the generic one for
its type and category (`apps/client/src/anim-data.ts`). Steps (`lunge`, `shake`, `projectile`, `beam`,
`particles`, `burst`, ...) are listed in `packages/core/src/anim.ts`; the player is `apps/client/src/anim.ts`.
The header button cycles Animations on / fast / off, and `prefers-reduced-motion` turns off screen
shake and strobing.

## Layout

| Path | What it is |
|---|---|
| `packages/core` | game-core: world rules, story script runner, saves, and battles on the Pokémon Showdown simulator (`@pkmn/sim`). No DOM, no network. |
| `packages/core/data/species.json` | Catch rates, base EXP, growth rates and learnsets imported from Essentials PBS (`npm run pbs`). |
| `packs/hafnia` | The base game as a content pack: maps, NPCs, story scripts, and `pack.json` listing its species, graphics and audio. |
| `apps/client` | Browser client: rendering, input, audio and menus. It sends intents and plays back events. |
| `tools/` | `pbs-import.mjs` (Essentials PBS to JSON) and `sync-assets.mjs` (copies each pack's assets into the client). |

## How solo and online share one game

The client never decides outcomes. It talks to a `GameConnection`:

- **Solo:** `LocalServer` (game-core plus IndexedDB saves) runs in a Web Worker.
- **Online (later):** the same game-core runs on an authoritative server behind a WebSocket.

Battles, encounters, catching and items all resolve in game-core, so the online server
can run the same code unchanged. See `/mnt/project-files/architecture/solo-and-online-architecture.md`.

## Content packs (DLC)

Everything a pack adds is namespaced (`hafnia:norrebro`, `hafnia:badge`). A new city or
country is a new folder in `packs/` with its own `pack.json`, maps and scripts. Saves
record the packs they used and refuse to load cleanly if one is missing.

Non-commercial fan game. Pokémon and all related names, sprites and sounds are © Nintendo,
Game Freak and The Pokémon Company. Graphics and audio come from Pokémon Essentials v21.1
with Unofficial EBDX and their many credited contributors.
