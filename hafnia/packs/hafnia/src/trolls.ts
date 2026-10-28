// The Six Forgotten Trolls (side quest 5, from Badge 3): six Troldtræ Titans asleep on Hafnia's outskirts, each a
// boss battle (+1 to every stat, can't be caught) that leaves a Titan Herb. Wake all six and Store Mor sends Lille
// Tom along with you.
import type { NpcDef, Script, ScriptApi } from '@hafnia/core';
import { capLevel } from './kalvebod';

interface Titan { id: string; name: string; map: string; x: number; y: number; wake: string; sleep: string }

const TITANS: Titan[] = [
  { id: 'storemor', name: 'Store Mor', map: 'kalvebod', x: 37, y: 20,
    wake: 'A mossy hill between the trees opens two knot-hole eyes.\nSTORE MOR, the biggest troll of all, wants to see you try.',
    sleep: 'Store Mor hums a lullaby that makes the reeds sway.' },
  { id: 'pia', name: 'Pia', map: 'dragor', x: 2, y: 17,
    wake: 'A troll made of old fishing boats sits at the end of the alley.\nPIA lifts a plank eyebrow and rolls up her sleeves.',
    sleep: 'Pia is counting the gulls again. She always gets a different number.' },
  { id: 'ulf', name: 'Ulf', map: 'dyrehaven', x: 32, y: 1,
    wake: 'Deep in the deer park, a troll with antlers of branches.\nULF stamps once. The deer scatter. You don\'t.',
    sleep: 'Ulf is pretending to be a tree. A Stantler is pretending to believe him.' },
  { id: 'lilletom', name: 'Lille Tom', map: 'drydock', x: 26, y: 8,
    wake: 'A small troll of pallets peeks out between the containers.\nLILLE TOM wants to play. Rough.',
    sleep: 'Lille Tom is stacking pebbles into a tiny troll. It keeps falling over.' },
  { id: 'hjalte', name: 'Hjalte', map: 'route10', x: 27, y: 5,
    wake: 'A troll lies by the old king\'s road, a tractor tyre for a hat.\nHJALTE yawns, cracks his knuckles, and stands.',
    sleep: 'Hjalte is asleep with one eye open, watching the road like he always has.' },
  { id: 'gamleknas', name: 'Gamle Knas', map: 'route14', x: 41, y: 15,
    wake: 'Under the granite cliffs, a troll so old the lichen has lichen.\nGAMLE KNAS creaks awake. Very slowly. Then very fast.',
    sleep: 'Gamle Knas creaks in the sea wind. You think he\'s smiling.' }
];

const beaten = (s: ScriptApi) => TITANS.filter(t => s.flag(`titan.${t.id}`)).length;

function* lilleTom(s: ScriptApi) {
  s.say('Store Mor: All six of us, awake at once. That hasn\'t happened\nsince they built the bridges.');
  s.say('Store Mor: Lille Tom wants to see the city with you.\nKeep his feet dry. He\'s mostly pallets.');
  const m = s.givePokemon('troldtrae', Math.max(30, capLevel(s) - 2));
  m.nickname = 'Lille Tom';
  s.me('me_get');
  s.say(`Lille Tom the Troldtræ joined ${s.player.name}!`);
  s.setFlag('trollGift', true);
}

const titanTalk = (t: Titan): Script => function* (s) {
  if (s.flag(`titan.${t.id}`)) {
    if (t.id === 'storemor' && beaten(s) === TITANS.length && !s.flag('trollGift')) { yield* lilleTom(s); return; }
    s.say(t.sleep);
    if (beaten(s) < TITANS.length) s.say(`(${beaten(s)} of the six trolls have woken.)`);
    return;
  }
  s.say(t.wake);
  s.cry('troldtrae');
  const r = yield s.battle({ kind: 'wild', titan: true, bg: 'field', foes: [{ species: 'troldtrae', level: capLevel(s) + 1, ability: 'Sturdy' }] });
  if (r !== 'win') return;
  s.setFlag(`titan.${t.id}`, true);
  s.say(`${t.name} laughs like a falling tree and sits back down.\nA tuft of moss drops from its shoulder.`);
  s.giveItem('titanherb'); s.me('me_item');
  s.say(`${s.player.name} got a Titan Herb!`);
  const n = beaten(s);
  if (n === TITANS.length) {
    s.say('Far away, five other trolls yawn at the same time.\nStore Mor in Kalvebod Wilds will want to see you.');
    if (t.id === 'storemor') yield* lilleTom(s);
  } else s.say(`(${n} of the six trolls have woken.)`);
  s.checkpoint();
};

/** The titans' NPCs by map; index.ts adds them to each map's scripts. */
export const TROLL_NPCS: Record<string, NpcDef[]> = {};
for (const t of TITANS) {
  (TROLL_NPCS[t.map] ??= []).push({ id: `titan.${t.id}`, sprite: 'chars/troldtrae', x: t.x, y: t.y, dir: 'down', talk: titanTalk(t),
    ...(t.id === 'lilletom' ? { when: f => !f('trollGift') } : {}) });
}
