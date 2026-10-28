// Kalvebod Wilds (from Badge 3): the catching area south of Islands Brygge. The rangers' skiff runs from the
// Brygge lawn; Ranger Ebbe hands out research tasks (register Kalvebod Pokémon, then the giant Orthworm that
// tunnels under the old firing range). Wild levels follow the level cap (MapDef.scaleLevels).
import type { Script, ScriptApi } from '@hafnia/core';
import { itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';

const WILDS_BADGES = 3;
/** Pokémon found in the Wilds and the range; Ebbe's research counts how many of them you have caught. */
export const KALVEBOD_DEX = ['tauros', 'mudbray', 'wooloo', 'starly', 'lotad', 'poliwag', 'phanpy', 'flamigo', 'girafarig', 'hoothoot',
  'stunky', 'chewtle', 'wiglett', 'buizel', 'rolycoly', 'silicobra', 'cufant', 'rufflet', 'orthworm'];
const LEVEL_CAPS = [14, 19, 24, 29, 34, 39, 44, 49, 55, 62];

/** The level of a one-off wild Pokémon in a side area: the current level cap (Champions get 66). */
export const capLevel = (s: ScriptApi) => s.flag('champion') ? 66 : LEVEL_CAPS[Math.min(s.badges, LEVEL_CAPS.length - 1)];

/** Ranger Ib's skiff between Islands Brygge and the Wilds. */
export const skiff = (to: 'kalvebod' | 'islandsbrygge'): Script => function* (s) {
  if (to === 'kalvebod' && s.badges < WILDS_BADGES) {
    s.say('c3.ib.ranger');
    s.say('Ranger: I run trainers over in the skiff, but only\nwith three badges. The Tauros don\'t do beginners.');
    return;
  }
  s.say(to === 'kalvebod' ? 'Ranger Ib: Out to Kalvebod Wilds? Tauros, Mudbray,\nbirds you\'ve never seen. The skiff\'s ready.'
    : 'Ranger Ib: Heading back to Islands Brygge?');
  const c: number = yield s.ask('Take the skiff?', ['Yes', 'No'], 1);
  if (c !== 0) return;
  s.fade(1, 20);
  if (to === 'kalvebod') s.warp('kalvebod', 19, 2, 'down');
  else s.warp('islandsbrygge', 19, 12, 'right');
  s.fade(0, 20);
};

const caught = (s: ScriptApi) => KALVEBOD_DEX.filter(sp => s.hasCaught(sp)).length;

function* reward(s: ScriptApi, flag: string, item: string, qty: number, label: string): Step {
  s.setFlag(flag, true);
  s.giveItem(item, qty); s.me('me_item');
  s.say(`${s.player.name} received ${label}!`);
}

const ebbe: Script = function* (s) {
  if (!s.flag('ebbeMet')) {
    s.setFlag('ebbeMet', true);
    s.say('Ranger Ebbe: Welcome to Kalvebod! Reed marsh to the west,\nTauros meadow to the east, the old firing range south.');
    s.say('Ranger Ebbe: I\'m surveying what lives out here. Catch\nwhat you find, and I\'ll pay you for the data.');
  }
  const n = caught(s);
  if (!s.flag('ebbe1')) {
    if (n < 5) { s.say(`Ranger Ebbe: First task: catch five kinds of Kalvebod\nPokémon. You have ${n} so far.`); return; }
    s.say('Ranger Ebbe: Five kinds already! That\'s a proper start.');
    yield* reward(s, 'ebbe1', 'greatball', 10, '10 Great Balls');
  }
  if (!s.flag('ebbe2')) {
    if (n < 10) { s.say(`Ranger Ebbe: Next: ten kinds. You're at ${n}.\nTry the ponds with a rod, and come back at night.`); return; }
    s.say('Ranger Ebbe: Ten! You notice things. Take this.\nIt\'s what we rangers wear on long surveys.');
    yield* reward(s, 'ebbe2', 'expcharm', 1, 'the Exp. Charm');
    s.say('Ranger Ebbe: With the Exp. Charm, your Pokémon learn\nmore from every battle.');
  }
  if (!s.flag('ebbe3')) {
    if (!s.flag('orthwormDone')) {
      s.say('Ranger Ebbe: Last task. Something huge is tunnelling under\nthe firing range. The ground hums at the firing line.');
      s.say('Ranger Ebbe: Find out what it is. Battle it or catch it,\njust get me a look.');
      return;
    }
    s.say('Ranger Ebbe: An Orthworm the size of a tram! That\'s going\nin the report. Here, you\'ve earned these.');
    yield* reward(s, 'ebbe3', 'expcandym', 3, '3 Exp. Candy M');
    yield* reward(s, 'ebbe3', 'ultraball', 5, '5 Ultra Balls');
  }
  s.say(n >= KALVEBOD_DEX.length ? 'Ranger Ebbe: Every Pokémon in the Wilds, registered.\nI\'ll put your name on the survey.'
    : `Ranger Ebbe: You've registered ${n} of the ${KALVEBOD_DEX.length} kinds I know of.\nThe rest are out there somewhere.`);
};

/** The giant Orthworm under the firing range, a one-off wild battle at the level cap. */
const orthworm: Script = function* (s) {
  s.say('The concrete hums. Something heavy turns over under it...');
  s.cry('orthworm');
  s.say('A giant Orthworm bursts out of the firing line!');
  const r = yield s.battle({ kind: 'wild', bg: 'field', foes: [{ species: 'orthworm', level: capLevel(s) + 2, moves: ['irontail', 'dig', 'wrap', 'irondefense'] }] });
  if (r === 'win' || r === 'caught') { s.setFlag('orthwormDone', true); if (r === 'win') s.say('The Orthworm dives back under the range and is gone.'); }
};

const KALVEBOD: MapScripts = {
  onEnter: function* (s) {
    if (s.flag('kalvebodArrive')) return;
    s.setFlag('kalvebodArrive', true);
    s.say('Reeds to the horizon, a fence of grazing Tauros,\nand not one bike lane. KALVEBOD WILDS.');
  },
  npcs: [
    { id: 'ib', sprite: 'chars/ranger', x: 18, y: 2, dir: 'right', talk: skiff('islandsbrygge') },
    { id: 'ebbe', sprite: 'chars/signe', x: 21, y: 2, dir: 'left', talk: ebbe },
    sign('kvsign', 21, 25, 'obj:sign', 'South: Vestamager firing range.\nClosed to the army since 1984. Open to Pokémon.'),
    { id: 'herd1', sprite: 'chars/tauros', x: 30, y: 14, dir: 'left', talk: function* (s) { s.cry('tauros'); s.say('The Tauros snorts and paws the ground.\nThe herd keeps one eye on you.'); } },
    { id: 'herd2', sprite: 'chars/tauros', x: 34, y: 16, dir: 'left', talk: function* (s) { s.cry('tauros'); s.say('This Tauros is chewing very slowly.\nIt doesn\'t look impressed.'); } },
    trainer({ id: 'kvbird', x: 9, y: 9, dir: 'down', sprite: 'chars/ranger', sight: 2, cls: 'Ranger', name: 'Tove',
      foes: [{ species: 'starly', level: 23 }, { species: 'flamigo', level: 24 }],
      intro: ['Ranger Tove: Shh! The Flamigo are nesting.\nWe settle this quietly. With a battle.'], lose: ['Ranger Tove: Quietly, I said!'] }),
    trainer({ id: 'kvfish', x: 13, y: 14, dir: 'down', sprite: 'chars/fisher', sight: 2, cls: 'Fisher', name: 'Knud',
      foes: [{ species: 'chewtle', level: 23 }, { species: 'wiglett', level: 23 }, { species: 'buizel', level: 24 }],
      intro: ['Fisher Knud: The pond\'s mine at dawn. Yours\nif you beat me.'], lose: ['Fisher Knud: The pond\'s ours, then.'] }),
    trainer({ id: 'kvcamper', x: 28, y: 20, dir: 'left', sprite: 'chars/picnicker', sight: 3, cls: 'Picnicker', name: 'Sanne',
      foes: [{ species: 'wooloo', level: 23 }, { species: 'mudbray', level: 24 }],
      intro: ['Picnicker Sanne: Rugbrød, a flask of coffee and a battle.\nPerfect Danish day.'], lose: ['Picnicker Sanne: Have a bit of rugbrød. Consolation.'] }),
    itemBall('item.kv1', 3, 24, 'netball', 3, 'Net Balls'),
    itemBall('item.kv2', 36, 9, 'superpotion', 2, 'Super Potions'),
    itemBall('item.kv3', 6, 4, 'revive', 1, 'a Revive')
  ],
  doors: { hut: function* (s) { s.warp('rangerhut', 4, 3, 'up'); } }
};

const RANGE: MapScripts = {
  npcs: [
    { id: 'bigworm', sprite: 'chars/orthworm', x: 15, y: 14, dir: 'up', when: f => !f('orthwormDone'), talk: orthworm },
    sign('rangesign', 13, 6, 'obj:sign', 'VESTAMAGER FIRING RANGE. Unexploded history.\nStay on the gravel. (Pokémon may ignore this.)'),
    trainer({ id: 'kvhiker', x: 22, y: 10, dir: 'left', sprite: 'chars/ranger', sight: 3, cls: 'Explorer', name: 'Malte',
      foes: [{ species: 'rolycoly', level: 24 }, { species: 'silicobra', level: 24 }, { species: 'cufant', level: 25 }],
      intro: ['Explorer Malte: Old shell casings, old bunkers,\nnew Pokémon. Best place in Copenhagen.'], lose: ['Explorer Malte: I\'ll be digging here a while.'] }),
    itemBall('item.kvr1', 27, 16, 'hyperpotion', 1, 'a Hyper Potion'),
    itemBall('item.kvr2', 2, 14, 'ultraball', 2, 'Ultra Balls')
  ]
};

const HUT: MapScripts = {
  events: [
    { x: 1, y: 1, w: 2, on: 'interact', run: function* (s) {
      s.say('A ranger\'s bunk. Your team curls up for a nap...');
      s.heal(); s.me('me_heal');
      s.setRespawn('kalvebod', 23, 6, 'down', 'You wake up in the rangers\' hut, team rested.');
      s.say('Your Pokémon are fully rested.');
    } },
    { x: 2, y: 3, on: 'interact', run: talk('A survey map of the Wilds, covered in pencil:\n"TAUROS", "FLAMIGO NESTS", "??? UNDER RANGE".') }
  ]
};

export const KALVEBOD_SCRIPTS: Record<string, MapScripts> = { kalvebod: KALVEBOD, kalvebodrange: RANGE, rangerhut: HUT };
