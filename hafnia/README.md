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

Pick "Animation viewer" in the Debug menu (dev builds), or open the game with `?anims` (for example `http://localhost:5173/play.html?anims`) for the battle
animation preview: left/right picks an animation, A plays it, B swaps which side attacks.

## Homepage and private demo

`apps/client/index.html` is the homepage (what the game is, screenshots, credits, privacy, and the
invite-code form); the game itself is `play.html`. In `npm run dev` the form just opens the game.

Deployed on Cloudflare Pages, the invite gate is real: `apps/client/functions/` holds two Pages
Functions. `_middleware.js` sends anyone without a valid invite cookie from `/play` back to the
homepage and refuses the game's `/assets/` and `/game-assets/` files; `api/invite.js` checks the code
and sets a signed cookie for 60 days. Every response is marked `noindex`, and `robots.txt` disallows
everything.

Cloudflare Pages settings:

| Setting | Value |
|---|---|
| Root directory | `hafnia` |
| Build command | `npm install && npm run build` (needs the Essentials `Graphics/` and `Audio/` folders next to `hafnia/`, so build from the whole repo) |
| Build output | `apps/client/dist` |
| Functions directory | `apps/client/functions` (or deploy with `npx wrangler pages deploy apps/client/dist` from `apps/client`) |
| Env var `INVITE_CODES` | comma-separated codes, case-insensitive, for example `HYGGE,KOBENHAVN` |
| Env var `INVITE_SECRET` | a long random string; changing it logs everyone out |

To hand out or revoke codes, edit `INVITE_CODES` and redeploy. Without both env vars the gate stays shut.

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
| `apps/server` | Online game server (Node, WebSockets, Postgres). Runs the same game-core per player, plus presence, chat, trades and PvP. |
| `tools/` | `pbs-import.mjs` (Essentials PBS to JSON) and `sync-assets.mjs` (copies each pack's assets into the client). |

## How solo and online share one game

The client never decides outcomes. It talks to a `GameConnection`:

- **Solo:** `LocalServer` (game-core plus IndexedDB saves) runs in a Web Worker.
- **Online:** the same game-core runs on the authoritative server in `apps/server`, one `Game` per player,
  behind a WebSocket (`apps/client/src/online.ts`).

Battles, encounters, catching and items all resolve in game-core, so the online server
can run the same code unchanged. See `/mnt/project-files/architecture/solo-and-online-architecture.md`.

## Online server

Online characters live only on the server (separate from solo saves). Accounts use Supabase Auth
(email magic link); the server checks the login token, and new players need an invite code.

Run both locally, no accounts or database needed:

```
cd hafnia
DEV_AUTH=1 ADMIN_EMAILS=you@example.com npm -w @hafnia/server run dev      # ws://localhost:8787/ws, data in apps/server/.data/
VITE_SERVER_URL=ws://localhost:8787/ws VITE_DEV_AUTH=1 npm run dev         # title screen shows "Play online"
```

Sign in with any email. Admin emails need no invite; in chat, `/invite 3` makes invite codes and `/help`
lists the moderation commands. `npm -w @hafnia/server run invite -- 5` makes codes from the command line.

| Server setting | What it is |
|---|---|
| `DATABASE_URL` | Postgres connection string (Supabase "Session pooler"). Apply `apps/server/db/001_init.sql` once. Required in production. |
| `SUPABASE_URL` | The Supabase project URL; login tokens are checked against its signing keys. |
| `SUPABASE_JWT_SECRET` | Only for projects still on the legacy shared JWT secret. |
| `ADMIN_EMAILS` | Comma-separated admin emails. |
| `ALLOWED_ORIGINS` | The client's site, e.g. `https://copper-current.pages.dev`. |
| `DEV_AUTH=1` | Local only: any `dev:<email>` token logs in, and the debug menu works. Refused in production. |

The client needs `VITE_SERVER_URL` (`wss://.../ws`), `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time.
Deploying: `apps/server/Dockerfile` and `apps/server/fly.toml` (Fly.io, Stockholm).

## Content packs (DLC)

Everything a pack adds is namespaced (`hafnia:norrebro`, `hafnia:badge`). A new city or
country is a new folder in `packs/` with its own `pack.json`, maps and scripts. Saves
record the packs they used and refuse to load cleanly if one is missing.

Non-commercial fan game. Pokémon and all related names, sprites and sounds are © Nintendo,
Game Freak and The Pokémon Company. Graphics and audio come from Pokémon Essentials v21.1
with Unofficial EBDX and their many credited contributors.
