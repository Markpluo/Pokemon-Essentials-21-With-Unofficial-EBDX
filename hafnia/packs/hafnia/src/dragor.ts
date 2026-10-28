// Dragør (Ch3): the yellow fishing village with Vuggestuen, the daycare (design/breeding-and-daycare.md).
// Pædagog Bodil takes Pokémon at the door; Pædagog Jens hands out the Eggs napping in the pram yard.
import { DAYCARE_FEE, ITEMS, monName, type NpcDef, type Script, type ScriptApi } from '@hafnia/core';
import { capLevel } from './kalvebod';
import { talk, trainer, type MapScripts, type Step } from './lib';

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

// ---------- The Last Singers (from Badge 3) ----------
// Five elders each remember one verse of the Pact song and each wants a small favour first. With all five, the
// city's song in Chapter 12 gets Dragør's long verses, Karen's Lapras joins you and the Fleet safehouse opens.

const SINGERS_BADGES = 3;
const VERSES = [
  '"Sing low, sing slow, the herring know,',
  'the copper sleeps where cold tides go;',
  'give back the voice the city took,',
  'and light the lamp, and turn the hook:',
  'the Sound will answer, soft and whole,\nwhen one sings back the singer\'s soul."'
];
const ELDERS = ['ingeborg', 'poul', 'henning', 'asta'];
const verses = (s: ScriptApi) => ELDERS.filter(e => s.flag(`sing.${e}`) === 2).length;

function* verse(s: ScriptApi, who: string, n: number): Step {
  s.setFlag(`sing.${who}`, 2);
  s.sfx('select');
  s.say(`${who[0].toUpperCase()}${who.slice(1)} sings, thin and true:\n${VERSES[n]}`);
  s.say(`${s.player.name} learned a verse of the Pact song.\n(${verses(s)} of 5)`);
}

function* tooYoung(s: ScriptApi, name: string): Step {
  s.say(`${name}: Songs? I'm too old to sing for strangers.\nCome back when the city knows your name.`);
}

const ingeborg: Script = function* (s) {
  const st = s.flag('sing.ingeborg');
  if (s.badges < SINGERS_BADGES) return yield* tooYoung(s, 'Elder Ingeborg');
  if (st === 2) { s.say('Elder Ingeborg: Sing it to the water now and then.\nIt likes to hear it.'); return; }
  if (s.hasItem('netfloat')) {
    s.say('Elder Ingeborg: My float! Painted it myself in 1961.\nYou carried it all the way from the Brygge?');
    s.takeItem('netfloat');
    return yield* verse(s, 'ingeborg', 0);
  }
  s.say('Elder Ingeborg: The Pact song? I know a verse. But my\nnet float drifted off in the last storm.');
  s.say('Elder Ingeborg: Red and white glass. The tide always carries\nthings up the coast to the Islands Brygge quay.');
  s.setFlag('sing.ingeborg', 1);
};

const poul: Script = function* (s) {
  if (s.badges < SINGERS_BADGES) return yield* tooYoung(s, 'Elder Poul');
  if (s.flag('sing.poul') === 2) { s.say('Elder Poul: Wiglett, Wugtrio, little eels in the sand.\nThey hum too, if you listen.'); return; }
  if (s.party.some(m => !m.egg && (m.species === 'wiglett' || m.species === 'wugtrio'))) {
    s.say('Elder Poul: A Wiglett! When I was a boy they lined the\nwhole harbour floor, swaying to the song.');
    return yield* verse(s, 'poul', 1);
  }
  s.say('Elder Poul: Before I sing, show me a Wiglett. They used\nto sway to the song all along the harbour floor.');
  s.say('Elder Poul: Cast a rod off the quay. They\'re shy, but\nthey\'re still down there.');
  s.setFlag('sing.poul', 1);
};

const henning: Script = function* (s) {
  if (s.badges < SINGERS_BADGES) return yield* tooYoung(s, 'Elder Henning');
  const st = s.flag('sing.henning');
  if (st === 2) { s.say('Elder Henning: Oluf will make a fisherman yet.\nDon\'t tell him I said so.'); return; }
  if (s.flag('tr.oluf')) {
    s.say('Elder Henning: You beat my grandson? Good. He needed it.\nHere\'s your verse.');
    return yield* verse(s, 'henning', 2);
  }
  s.say('Elder Henning: My grandson Oluf thinks he\'s the best trainer\non the quay. Teach him otherwise, and I\'ll sing.');
  s.setFlag('sing.henning', 1);
};

const asta: Script = function* (s) {
  if (s.badges < SINGERS_BADGES) return yield* tooYoung(s, 'Elder Asta');
  if (s.flag('sing.asta') === 2) { s.say('Elder Asta: We sang it on the boats, hauling nets.\nIt kept the rhythm. And the courage.'); return; }
  s.say('Elder Asta: On the boats we sang the Pact while we worked.\nShow me you can keep the rhythm in a fight.');
  const c: number = yield s.ask('Battle Elder Asta?', ['Yes', 'Not now'], 1);
  if (c !== 0) return;
  const lv = Math.max(24, capLevel(s) - 2);
  const r = yield s.battle({ kind: 'trainer', ai: 2, bg: 'city', trainer: { name: 'Asta', title: 'Elder', sprite: 'tr/fisher' },
    foes: [{ species: 'wingull', level: lv - 1 }, { species: 'shellos', level: lv - 1 }, { species: 'pelipper', level: lv, item: 'oranberry' }] });
  if (r !== 'win') return;
  s.say('Elder Asta: Ha! You haul like a Dragør girl. Listen.');
  yield* verse(s, 'asta', 3);
};

const karen: Script = function* (s) {
  if (s.badges < SINGERS_BADGES) return yield* tooYoung(s, 'Elder Karen');
  if (s.flag('dragorMelody')) { s.say('Elder Karen: The song lives in you now. Sing it when\nthe Sound goes quiet.'); return; }
  const n = verses(s);
  if (n < 4) {
    s.say('Elder Karen: I only sing at night, and only the last verse.\nIt means nothing without the others.');
    s.say(`Elder Karen: Ingeborg, Poul, Henning and Asta know the rest.\nYou have ${n} of their verses.`);
    return;
  }
  s.say('Elder Karen: Four verses. Then you\'re ready for the last.\nThe one the Fleet captains learned.');
  s.say(`Elder Karen sings, and the old Lapras by the quay sings with her:\n${VERSES[4]}`);
  s.setFlag('dragorMelody', true);
  s.me('me_get');
  s.say(`${s.player.name} learned the whole Dragør Melody!`);
  s.say('Elder Karen: My Lapras has carried that song for sixty years.\nIt wants to carry it further. Take her.');
  s.cry('lapras');
  s.givePokemon('lapras', Math.max(25, capLevel(s) - 4));
  s.me('me_get');
  s.say(`${s.player.name} received Lapras!`);
  s.npc('quaylapras').hide();
  s.say('Elder Karen: And this key is for the red house by the hedge.\nFreja\'s crew sleeps there. Rest whenever you like.');
  s.setFlag('safehouseKey', true);
  s.checkpoint();
};

const safehouseDoor: Script = function* (s) {
  if (!s.flag('safehouseKey')) { s.say('A red fisher\'s house. The door is locked, and someone\nhas painted a tiny black ship by the handle.'); return; }
  s.warp('safehouse', 4, 3, 'up');
};

const SAFEHOUSE: MapScripts = {
  events: [
    { x: 1, y: 1, w: 2, on: 'interact', run: function* (s) {
      s.say('A ship\'s bunk, made up tight. Your team piles on...');
      s.heal(); s.me('me_heal');
      s.setRespawn('dragor', 13, 15, 'down', 'You wake up in the Fleet safehouse, team rested.');
      s.say('Your Pokémon are fully rested.');
    } },
    { x: 4, y: 1, on: 'interact', run: talk('A chart of the Sound with every herring run\nmarked in pencil, and a note: "Sing first, then fish."') },
    { x: 3, y: 3, w: 2, on: 'interact', run: talk('A tin of Dragør smoked herring and two tin mugs.\nSomeone left in a hurry.') }
  ]
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
    trainer({ id: 'oluf', x: 19, y: 11, dir: 'right', sprite: 'chars/fisher', sight: 0, cls: 'Fisher', name: 'Oluf',
      when: f => !!f('sing.henning'), foes: [{ species: 'finizen', level: 25 }, { species: 'wiglett', level: 25 }, { species: 'tentacool', level: 26 }],
      intro: ['Fisher Oluf: Granddad sent you? Fine. Best rod on\nthe quay against your best Pokémon.'], lose: ['Fisher Oluf: Okay. Second-best rod on the quay.'] }),
    { id: 'olufhint', sprite: 'chars/fisher', x: 19, y: 11, dir: 'right', when: f => !f('sing.henning'),
      talk: talk('Fisher Oluf: The old folk here still hum songs older\nthan the lighthouse. Ask around, if you\'ve time to listen.') },
    { id: 'ingeborg', sprite: 'chars/oldwoman', x: 12, y: 10, dir: 'down', talk: ingeborg },
    { id: 'poul', sprite: 'chars/oldman', x: 17, y: 16, dir: 'up', talk: poul },
    { id: 'henning', sprite: 'chars/oldman', x: 20, y: 14, dir: 'left', talk: henning },
    { id: 'asta', sprite: 'chars/oldwoman', x: 16, y: 7, dir: 'down', talk: asta },
    { id: 'karen', sprite: 'chars/oldwoman', x: 11, y: 16, dir: 'right', period: ['night'], talk: karen },
    { id: 'quaylapras', sprite: 'chars/lapras', x: 20, y: 17, dir: 'left', period: ['night'], when: f => !f('dragorMelody'),
      talk: function* (s) { s.cry('lapras'); s.say('An old Lapras rests by the quay, humming\nsomething slow under its breath.'); } }
  ] as NpcDef[],
  doors: { vuggestuen: bodil, safehouse: safehouseDoor }
};

export const DRAGOR_SCRIPTS: Record<string, MapScripts> = { dragor: DRAGOR, safehouse: SAFEHOUSE };
