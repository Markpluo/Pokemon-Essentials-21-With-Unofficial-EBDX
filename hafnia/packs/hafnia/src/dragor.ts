// Dragør (Ch3): the yellow fishing village with Vuggestuen, the daycare (design/breeding-and-daycare.md).
// Pædagog Bodil takes Pokémon at the door; Pædagog Jens hands out the Eggs napping in the pram yard.
import { DAYCARE_FEE, ITEMS, monName, type NpcDef, type Script, type ScriptApi } from '@hafnia/core';
import { talk, type MapScripts } from './lib';

const DAYCARE_BADGES = 3;

/** Skipper Mads's little ferry down the Amager coast, Islands Brygge to Dragør and back. */
export const ferry = (to: 'dragor' | 'islandsbrygge'): Script => function* (s) {
  s.say(to === 'dragor' ? 'Skipper Mads: Down the coast to Dragør? Yellow houses,\nold harbour, and the nursery. Twenty minutes.'
    : 'Skipper Mads: Back up to Islands Brygge?');
  const c: number = yield s.ask('Take the ferry?', ['Yes', 'No'], 1);
  if (c !== 0) return;
  s.fade(1, 20);
  if (to === 'dragor') s.warp('dragor', 20, 9, 'up');
  else s.warp('islandsbrygge', 3, 11, 'right');
  s.fade(0, 20);
};
const TOYS = ['everstone', 'destinyknot'];

const bodil: Script = function* (s) {
  if (s.badges < DAYCARE_BADGES) {
    s.say('Pædagog Bodil: Welcome to Vuggestuen, the nursery!\nWe look after Pokémon so they can have Eggs.');
    s.say('Pædagog Bodil: But we only take Pokémon from trainers\nwith three badges. There\'s a waiting list, you know.');
    return;
  }
  if (!s.flag('vuggestuen')) {
    s.say('Pædagog Bodil: Welcome to Vuggestuen! Leave two\nPokémon with us and, if they get along, an Egg turns up.');
    s.say('Pædagog Bodil: The Eggs nap outside in the prams,\nlike all good Danish babies. Jens keeps an eye on them.');
    s.say(`Pædagog Bodil: It's ${DAYCARE_FEE} kr. a Pokémon. And here,\nevery child should have a favourite toy.`);
    s.giveItem('everstone'); s.me('me_item');
    s.say(`${s.player.name} received an Everstone!`);
    s.say('Pædagog Bodil: Leave a Pokémon with an Everstone and\nits Egg takes after it: same nature, every time.');
    s.setFlag('vuggestuen', true);
  }
  for (;;) {
    const kids = s.daycare;
    const status = !kids.length ? 'We have none of your Pokémon right now.'
      : `We're looking after ${kids.map(k => `${k.name} (Lv. ${k.level})`).join(' and ')}.`;
    const compat = s.daycareCompat();
    const c: number = yield s.ask(`Pædagog Bodil: ${status}${compat ? `\n${compat}` : ''}`, ['Leave a Pokémon', 'Pick one up', 'Goodbye'], 2);
    if (c === 2) { s.say('Pædagog Bodil: Hej hej! Mind the cobbles.'); return; }
    if (c === 0) yield* leaveMon(s);
    else yield* pickUpMon(s);
  }
};

function* leaveMon(s: ScriptApi): Generator<any, void, any> {
  if (s.daycare.length >= 2) { s.say('Pædagog Bodil: We already have two of yours.\nThat\'s our limit, I\'m afraid.'); return; }
  const able = s.party.filter(m => !m.egg);
  if (able.length < 2) { s.say('Pædagog Bodil: Then you\'d have no Pokémon to walk home with!\nCatch another one first.'); return; }
  const i: number = yield s.ask('Pædagog Bodil: Which Pokémon will stay with us?', [...able.map(m => `${monName(m)} Lv. ${m.level}`), 'Back'], able.length);
  if (i >= able.length) return;
  const mon = able[i];
  if (!s.takeMoney(DAYCARE_FEE)) { s.say(`Pædagog Bodil: That's ${DAYCARE_FEE} kr., dear.\nYou don't have enough.`); return; }
  let toy: string | undefined;
  const toys = TOYS.filter(t => s.hasItem(t));
  if (toys.length) {
    const t: number = yield s.ask(`Pædagog Bodil: Will ${monName(mon)} bring a toy?`, [...toys.map(x => ITEMS[x].name), 'No toy'], toys.length);
    if (t < toys.length) toy = toys[t];
  }
  if (!s.depositDaycare(mon.uid, toy)) { s.giveMoney(DAYCARE_FEE); s.say('Pædagog Bodil: Hmm, that didn\'t work. Try again?'); return; }
  s.sfx('select');
  s.say(`Pædagog Bodil: ${monName(mon)} is in good hands.${toy ? `\nAnd the ${ITEMS[toy].name} too.` : ''}`);
  const compat = s.daycareCompat();
  if (compat) s.say(`Pædagog Bodil: ${compat}`);
}

function* pickUpMon(s: ScriptApi): Generator<any, void, any> {
  const kids = s.daycare;
  if (!kids.length) { s.say('Pædagog Bodil: We have none of your Pokémon.'); return; }
  const i: number = yield s.ask('Pædagog Bodil: Who are we sending home?', [...kids.map(k => `${k.name} Lv. ${k.level}`), 'Back'], kids.length);
  if (i >= kids.length) return;
  const kid = kids[i];
  const m = s.withdrawDaycare(i);
  if (!m) { s.say('Pædagog Bodil: Your team is full! Make some room first.'); return; }
  s.cry(m.species);
  s.say(`Pædagog Bodil: Here's ${kid.name}, rested and happy.${kid.item ? `\nDon't forget the ${ITEMS[kid.item].name}!` : ''}`);
}

const jens: Script = function* (s) {
  if (s.badges < DAYCARE_BADGES || !s.flag('vuggestuen')) {
    s.say('Pædagog Jens: Shh! The little ones are napping in\ntheir prams. Fresh air, even in January.');
    s.say('Pædagog Jens: Bodil at the door takes care of\nthe grown-up Pokémon.');
    return;
  }
  if (!s.daycareEggs) {
    s.say(s.daycare.length < 2 ? 'Pædagog Jens: Leave two Pokémon with Bodil and the\nprams won\'t stay empty for long.'
      : 'Pædagog Jens: No Eggs in the prams yet. Go for a good walk\nand come back. A watched Egg never appears!');
    return;
  }
  while (s.daycareEggs) {
    const c: number = yield s.ask('Pædagog Jens: An Egg has been napping in this pram!\nWill you take it home?', ['Yes', 'No'], 1);
    if (c !== 0) { s.say('Pædagog Jens: I\'ll keep it wrapped up warm.'); return; }
    if (!s.takeDaycareEgg()) { s.say('Pædagog Jens: Your team is full! You need a free place\nfor the Egg.'); return; }
    s.me('me_get');
    s.say(`${s.player.name} received an Egg!`);
    s.say('Pædagog Jens: Keep it with you and keep walking.\nIt hatches faster on the move.');
  }
};

const DRAGOR: MapScripts = {
  npcs: [
    { id: 'bodil', sprite: 'chars/bodil', x: 6, y: 8, dir: 'down', talk: bodil },
    { id: 'jens', sprite: 'chars/jens', x: 4, y: 13, dir: 'right', talk: jens },
    { id: 'toddler', sprite: 'chars/toddler', x: 6, y: 14, dir: 'left',
      talk: talk('Toddler: Æg! Æg!', 'The toddler points at a pram and giggles.') },
    { id: 'holm', sprite: 'chars/oldwoman', x: 14, y: 7, dir: 'down',
      talk: talk('Fru Holm: Danish babies nap outside in their prams,\nrain or shine. Vuggestuen does the same with Eggs!',
        'Fru Holm: Pokémon from the same family, raised by\ndifferent trainers, get along best. Like cousins.') },
    { id: 'skipper', sprite: 'chars/sailor', x: 20, y: 8, dir: 'left', talk: ferry('islandsbrygge') },
    { id: 'oluf', sprite: 'chars/fisher', x: 19, y: 11, dir: 'right',
      talk: talk('Fisher Oluf: The old folk here still hum songs older\nthan the lighthouse. Ask around, if you\'ve time to listen.') }
  ] as NpcDef[],
  doors: { vuggestuen: bodil }
};

export const DRAGOR_SCRIPTS: Record<string, MapScripts> = { dragor: DRAGOR };
