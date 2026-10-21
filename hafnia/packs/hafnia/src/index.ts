// The base game, "Copper & Current", as a content pack: the demo from the Prologue in Nørrebro
// to the end of Chapter 4 on Søren's Lantern Walk. Lines live in strings/en.json (from the demo
// script); each area's scripts live in their own file.
import { speciesExtra, type Dir, type MapDef, type Pack, type Script } from '@hafnia/core';
import manifest from '../pack.json';
import strings from '../strings/en.json';
import { ASSISTENS_SCRIPTS, MAILBOXES, lanternGate, mailboxNpc, norrebroCh4, norrebroNorth } from './assistens';
import { CITY } from './city';
import { DRAGOR_SCRIPTS } from './dragor';
import { FREETOWN } from './freetown';
import { HOME, intro } from './home';
import { LAKES } from './lakes';
import type { MapScripts } from './lib';
import { starterVars } from './starters';
import { VESTERBRO_SCRIPTS, norrebroWest } from './vesterbro';
import { MAPS, STAMPS } from './world';

const SCRIPTS: Record<string, MapScripts & { exitGuards?: Partial<Record<Dir, Script>> }> = {
  ...HOME, ...LAKES, ...CITY, ...FREETOWN, ...DRAGOR_SCRIPTS, ...VESTERBRO_SCRIPTS, ...ASSISTENS_SCRIPTS
};
const homeEnter = SCRIPTS.norrebro.onEnter;
SCRIPTS.norrebro = {
  ...SCRIPTS.norrebro, exitGuards: { left: norrebroWest, up: norrebroNorth },
  onEnter: function* (s) { if (homeEnter) yield* homeEnter(s); yield* norrebroCh4(s); }
};
SCRIPTS.assistens.exitGuards = { up: lanternGate };
SCRIPTS.vesterbro = { ...SCRIPTS.vesterbro, doors: { ...SCRIPTS.vesterbro.doors, bakery: function* (s) { s.warp('bakery', 5, 4, 'up'); } } };
// Kanelsnegl Morning's letterboxes sit on maps from earlier chapters.
for (const m of MAILBOXES) SCRIPTS[m.map] = { ...SCRIPTS[m.map], npcs: [...(SCRIPTS[m.map].npcs ?? []), mailboxNpc(m)] };

const maps: Record<string, MapDef> = {};
for (const [id, m] of Object.entries(MAPS)) {
  const sc = SCRIPTS[id] ?? {};
  const exits = m.exits && Object.fromEntries(Object.entries(m.exits).map(([d, ex]) => [d, { ...ex, guard: sc.exitGuards?.[d as Dir] }]));
  maps[id] = { ...m, exits, npcs: sc.npcs ?? [], doors: sc.doors ?? {}, events: sc.events, onEnter: sc.onEnter };
}

export const hafnia: Pack = {
  manifest,
  maps,
  stamps: STAMPS,
  strings,
  textVars: starterVars,
  // Freja's Hisuian Qwilfish: Showdown knows the form, the PBS data only has the base species.
  speciesExtra: { qwilfishhisui: { ...speciesExtra('qwilfish'), key: 'QWILFISH_1', evolutions: [] } },
  newGame: {
    map: 'flat', x: 10, y: 2, dir: 'down', intro,
    respawn: { map: 'flat', x: 6, y: 4, dir: 'up', text: 'Mum: There you are. Let me look at your team...\nThere. Right as rain.' }
  }
};

export default hafnia;
