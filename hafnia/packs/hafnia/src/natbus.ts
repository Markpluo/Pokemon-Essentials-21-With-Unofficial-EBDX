// Bus stops: fast travel between the hubs you've reached. The Natbus (night bus, glossary) runs
// 01:00-05:00 for free and drops you off at 05:00; by day a city bus does the same trip for a fare.
import type { FlagReader, NpcDef, Script } from '@hafnia/core';

const FARE = 50;
const NATBUS_FROM = 60, NATBUS_UNTIL = 5 * 60;

interface Stop { map: string; name: string; x: number; y: number; open: (f: FlagReader) => boolean }
// The stop stands at (x, y); riders get off on the tile below it.
export const STOPS: Stop[] = [
  { map: 'norrebro', name: 'Nørrebro', x: 19, y: 6, open: () => true },
  { map: 'garden', name: 'Botanical Garden', x: 17, y: 11, open: f => !!f('starter') },
  { map: 'indreby', name: 'Indre By', x: 3, y: 5, open: f => !!f('c2') },
  { map: 'christianshavn', name: 'Christianshavn', x: 19, y: 10, open: f => !!f('enforcer') },
  { map: 'vesterbro', name: 'Vesterbro', x: 22, y: 7, open: f => !!f('vbArrive') }
];

const ride = (here: Stop): Script => function* (s) {
  const night = s.clock >= NATBUS_FROM && s.clock < NATBUS_UNTIL;
  s.say(night ? 'Bus stop. The Natbus is running: free rides\nuntil 05:00.' : `Bus stop. City bus: ${FARE} kr. a ride.\nThe free Natbus runs 01:00 to 05:00.`);
  const to = STOPS.filter(t => t !== here && t.open(n => s.flag(n)));
  if (!to.length) { s.say('No other stops you know yet.'); return; }
  const c: number = yield s.ask('Ride to...', [...to.map(t => t.name), 'Cancel'], to.length);
  if (c >= to.length) return;
  if (!night && !s.takeMoney(FARE)) { s.say('You can\'t afford the fare.'); return; }
  const t = to[c];
  s.fade(1, 20);
  if (night) { s.setClock(NATBUS_UNTIL); s.say(`You doze off on the back seat... The Natbus\npulls into ${t.name} at 05:00.`); }
  s.warp(t.map, t.x, t.y + 1, 'down');
  s.fade(0, 20);
};

export const stopNpc = (stop: Stop): NpcDef => ({ id: 'busstop', sprite: 'obj:sign', x: stop.x, y: stop.y, dir: 'down', object: true, talk: ride(stop) });
