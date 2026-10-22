// The base game, "Copper & Current", as a content pack: the demo from the Prologue in Nørrebro
// to the end of Chapter 10 at CopenHill. Lines live in strings/en.json (from the demo
// script); each area's scripts live in their own file.
import { speciesExtra, type Dir, type MapDef, type Pack, type Script } from '@hafnia/core';
import manifest from '../pack.json';
import strings from '../strings/en.json';
import { BAKKEN_SCRIPTS, bakkenGate, ch7Start, langelinieGate } from './bakken';
import { ASSISTENS_SCRIPTS, MAILBOXES, lanternGate, mailboxNpc, norrebroCh4, norrebroNorth } from './assistens';
import { CISTERNS_SCRIPTS, ch5Start, frederiksbergGate } from './cisterns';
import { CITY } from './city';
import { DRAGOR_SCRIPTS } from './dragor';
import { FREETOWN } from './freetown';
import { HOME, intro } from './home';
import { LAKES } from './lakes';
import type { MapScripts } from './lib';
import { starterVars } from './starters';
import { VESTERBRO_SCRIPTS, norrebroWest } from './vesterbro';
import { RUNDETARN_SCRIPTS, ch6Start } from './rundetarn';
import { SHIPYARD_SCRIPTS, ch10Start, copenhillGate, shipyardsGate } from './shipyards';
import { ROUTE4_LUKAS, SPIRE_SCRIPTS, ch9Start, route4Enter, slotsholmenGate } from './spire';
import { DAWN_NPCS, FLEET_DECKHAND, TREKRONER_SCRIPTS, ch8Start } from './trekroner';
import { MAPS, STAMPS } from './world';
import { battleMusic, withMusic } from './music';

const SCRIPTS: Record<string, MapScripts & { exitGuards?: Partial<Record<Dir, Script>> }> = {
  ...HOME, ...LAKES, ...CITY, ...FREETOWN, ...DRAGOR_SCRIPTS, ...VESTERBRO_SCRIPTS, ...ASSISTENS_SCRIPTS, ...CISTERNS_SCRIPTS, ...RUNDETARN_SCRIPTS, ...BAKKEN_SCRIPTS, ...TREKRONER_SCRIPTS, ...SPIRE_SCRIPTS, ...SHIPYARD_SCRIPTS
};
const homeEnter = SCRIPTS.norrebro.onEnter;
SCRIPTS.norrebro = {
  ...SCRIPTS.norrebro, exitGuards: { left: norrebroWest, up: norrebroNorth },
  onEnter: function* (s) { if (homeEnter) yield* homeEnter(s); yield* norrebroCh4(s); yield* ch5Start(s); }
};
// Chapter 5 starts wherever you come out after the Lantern Walk.
for (const id of ['assistens', 'route2']) {
  const enter = SCRIPTS[id].onEnter;
  SCRIPTS[id] = { ...SCRIPTS[id], onEnter: function* (s) { if (enter) yield* enter(s); yield* ch5Start(s); } };
}
// Chapter 6 starts on the next map you enter after the Cisterns (not the one where Chapter 5 ends).
for (const id of ['frederiksberg', 'pcfrederiksberg', 'route2', 'norrebro', 'assistens', 'garden', 'indreby', 'towerin', 'vesterbro']) {
  const enter = SCRIPTS[id].onEnter;
  SCRIPTS[id] = { ...SCRIPTS[id], onEnter: function* (s) { if (s.flag('ch5done')) yield* ch6Start(s); if (enter) yield* enter(s); } };
}
// Chapter 7 starts on the next map you enter after Rundetårn's observatory.
for (const id of ['towerin', 'indreby', 'pcindreby', 'nyhavn', 'garden']) {
  const enter = SCRIPTS[id].onEnter;
  SCRIPTS[id] = { ...SCRIPTS[id], onEnter: function* (s) { if (s.flag('ch6done')) yield* ch7Start(s); if (enter) yield* enter(s); } };
}
// Chapter 8 starts on the next map you enter after Pierrot's tent.
for (const id of ['bakken', 'pcbakken', 'dyrehaven', 'osterbro', 'nyhavn', 'christianshavn']) {
  const enter = SCRIPTS[id].onEnter;
  SCRIPTS[id] = { ...SCRIPTS[id], onEnter: function* (s) { if (s.flag('ch7done')) yield* ch8Start(s); if (enter) yield* enter(s); } };
}
// The Black Fleet's gangplank, and Maja and Lukas at dawn, on the Christianshavn canal.
SCRIPTS.christianshavn = { ...SCRIPTS.christianshavn, npcs: [...(SCRIPTS.christianshavn.npcs ?? []), FLEET_DECKHAND, ...DAWN_NPCS] };
// Chapter 9 starts on the next map you enter after dawn in Christianshavn; Lukas waits on Knippelsbro after Gym 7.
for (const id of ['route4', 'pcchristianshavn', 'stadsgraven', 'indreby', 'nyhavn']) {
  const enter = SCRIPTS[id]?.onEnter;
  SCRIPTS[id] = { ...SCRIPTS[id], onEnter: function* (s) { if (s.flag('ch8done')) yield* ch9Start(s); if (enter) yield* enter(s); if (id === 'route4') yield* route4Enter(s); } };
}
SCRIPTS.route4 = { ...SCRIPTS.route4, npcs: [...(SCRIPTS.route4.npcs ?? []), ROUTE4_LUKAS], exitGuards: { left: slotsholmenGate } };
// Chapter 10 starts on the next map you enter after Knippelsbro; the drydock's east gate opens onto the shipyards.
for (const id of ['indreby', 'christianshavn', 'slotsholmen', 'pcslotsholmen', 'nyhavn', 'pcchristianshavn', 'stadsgraven', 'drydock']) {
  const enter = SCRIPTS[id]?.onEnter;
  SCRIPTS[id] = { ...SCRIPTS[id], onEnter: function* (s) { if (s.flag('ch9done')) yield* ch10Start(s); if (enter) yield* enter(s); } };
}
SCRIPTS.drydock.exitGuards = { right: shipyardsGate };
SCRIPTS.eastquay.exitGuards = { right: copenhillGate };
SCRIPTS.nyhavn.exitGuards = { right: langelinieGate };
SCRIPTS.dyrehaven.exitGuards = { up: bakkenGate };
SCRIPTS.assistens.exitGuards = { up: lanternGate };
SCRIPTS.route2.exitGuards = { up: frederiksbergGate };
SCRIPTS.vesterbro = { ...SCRIPTS.vesterbro, doors: { ...SCRIPTS.vesterbro.doors, bakery: function* (s) { s.warp('bakery', 5, 4, 'up'); } } };
// Kanelsnegl Morning's letterboxes sit on maps from earlier chapters.
for (const m of MAILBOXES) SCRIPTS[m.map] = { ...SCRIPTS[m.map], npcs: [...(SCRIPTS[m.map].npcs ?? []), mailboxNpc(m)] };

const maps: Record<string, MapDef> = {};
for (const [id, m] of Object.entries(MAPS)) {
  const sc = SCRIPTS[id] ?? {};
  const exits = m.exits && Object.fromEntries(Object.entries(m.exits).map(([d, ex]) => [d, { ...ex, guard: sc.exitGuards?.[d as Dir] }]));
  maps[id] = withMusic({ ...m, exits, npcs: sc.npcs ?? [], doors: sc.doors ?? {}, events: sc.events, onEnter: sc.onEnter });
}

export const hafnia: Pack = {
  manifest,
  maps,
  stamps: STAMPS,
  battleMusic,
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
