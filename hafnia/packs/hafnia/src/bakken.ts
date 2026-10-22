// Chapter 7, North by Kystbanen: Maja meets you at Langelinie, where the little statue hums like a heartbeat.
// Kastellet's cadets drill on the ramparts. Strandvejen runs north to Lyngby, where Ingrid tells the Holger
// Danske legend, and on to Dyrehaven at sundown. Navigator Sif waits by Vanguard's hidden sub-station that is
// draining Bakken's lights; you shut it down with her codes. Then Gym 6: Pierrot's Hall of Mirrors and the
// Rutschebanen. Side quests: the Kastellet Cadets gauntlet and Bakken's Lost Laughter (Pierrot's five cards).
import type { NpcDef, Script, ScriptApi } from '@hafnia/core';
import { centerNpcs } from './home';
import { itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';

// ---------- The chapter starts ----------

/** Runs on the next map you enter after Rundetårn's observatory. */
export function* ch7Start(s: ScriptApi): Step {
  if (!s.flag('ch6done') || s.flag('ch7')) return;
  s.setFlag('ch7', true);
  s.chapterEnd('Chapter 7', 'North by Kystbanen');
  s.sfx('select');
  s.say('c7.start.1'); s.say('c7.start.2');
  s.checkpoint();
}

/** Nyhavn's quay east to Langelinie opens with Chapter 7. */
export const langelinieGate: Script = function* (s) {
  if (s.flag('ch7')) return true;
  s.say('c7.gate.early');
  return false;
};

/** Puts a hidden scene NPC next to the player, facing them. */
function cast(s: ScriptApi, id: string, nearX = s.player.x, nearY = s.player.y) {
  const n = s.npc(id);
  const [x, y] = s.freeSpotNear(nearX, nearY);
  n.place(x, y, 'down'); n.show(); n.facePlayer();
  return { n, x, y };
}

// ---------- Østerbro ----------

function* langelinie(s: ScriptApi): Step {
  s.setFlag('c7met', true);
  s.say('c7.ost.arrive');
  const m = cast(s, 'maja7');
  s.player.faceTo(m.x, m.y);
  s.say('c7.ost.maja.1'); s.say('c7.ost.maja.2');
  s.say('c7.ost.tourists');
  s.say('c7.ost.maja.3'); s.say('c7.ost.maja.4'); s.say('c7.ost.maja.5');
  m.n.walk('right', 3); m.n.hide();
  s.checkpoint();
}

const statue: Script = function* (s) {
  s.say('c7.statue.1');
  if (s.flag('statueHeard')) { s.say('c7.statue.after'); return; }
  s.setFlag('statueHeard', true);
  s.wait(20);
  for (let i = 0; i < 2; i++) { s.sfx('select'); s.wait(30); }
  s.say('c7.statue.2'); s.say('c7.statue.3');
};

/** Kystbanen: Østerport and Klampenborg, once you've walked up to Dyrehaven once. */
const train = (here: 'osterbro' | 'dyrehaven'): Script => function* (s) {
  s.say(here === 'osterbro' ? 'c7.train.osterport' : 'c7.train.klampenborg');
  if (!s.flag('dyrehavenSeen')) { s.say('c7.train.closed'); return; }
  const c: number = yield s.ask(here === 'osterbro' ? 'c7.train.ask.north' : 'c7.train.ask.south', ['Ride', 'Stay'], 1);
  if (c !== 0) return;
  s.sfx('door'); s.fade(1, 20);
  if (here === 'osterbro') s.warp('dyrehaven', 15, 25, 'up'); else s.warp('osterbro', 26, 4, 'down');
  s.fade(0, 20);
};

const TOURISTS: NpcDef[] = [
  { id: 'gerd7', sprite: 'chars/tourist', x: 17, y: 9, dir: 'right', talk: talk('c7.gerd') },
  { id: 'hp7', sprite: 'chars/gentleman', x: 18, y: 10, dir: 'right', talk: talk('c7.hanspeter') }
];

const OSTERBRO: MapScripts = {
  onEnter: function* (s) { if (s.flag('ch7') && !s.flag('c7met')) yield* langelinie(s); },
  doors: {
    kastellet: function* (s) { s.sfx('door'); s.warp('kastellet', 10, 17, 'up'); },
    pc: function* (s) { s.warp('pcosterbro', 6, 5, 'up'); }
  },
  npcs: [
    { id: 'maja7', sprite: 'chars/maja', x: 10, y: 8, dir: 'down', hidden: true },
    { id: 'mermaid', sprite: 'obj:mermaid', x: 22, y: 13, dir: 'down', object: true, talk: statue },
    { id: 'osttrain', sprite: 'obj:train', x: 27, y: 4, dir: 'down', object: true, talk: train('osterbro') },
    sign('ostsign', 3, 8, 'obj:sign', 'c7.ost.sign'),
    sign('langsign', 19, 8, 'obj:sign', 'c7.ost.langsign'),
    ...TOURISTS,
    { id: 'ostcard', sprite: 'obj:card', x: 28, y: 1, dir: 'down', object: true, when: f => !f('card5'), talk: card(5) },
    trainer({ id: 'ostJogger', x: 8, y: 14, dir: 'up', sprite: 'chars/jogger', sight: 3, cls: 'Jogger', name: 'Rasmus',
      foes: [{ species: 'fletchinder', level: 31 }, { species: 'deerling', level: 31 }], intro: ['c7.ost.jogger.intro'], lose: ['c7.ost.jogger.lose'] }),
    trainer({ id: 'ostLady', x: 13, y: 16, dir: 'left', sprite: 'chars/lady', sight: 3, cls: 'Lady', name: 'Vibeke',
      foes: [{ species: 'flabebe', level: 31 }, { species: 'floette', level: 32 }], intro: ['c7.ost.lady.intro'], lose: ['c7.ost.lady.lose'] }),
    itemBall('item.ost1', 3, 16, 'hyperpotion', 1, 'a Hyper Potion'),
    itemBall('item.ost2', 26, 9, 'ultraball', 2, 'Ultra Balls')
  ]
};

// ---------- Kastellet: the cadet gauntlet ----------

const GAUNTLET: { name: string; foes: { species: string; level: number }[] }[] = [
  { name: 'Ane', foes: [{ species: 'pawmo', level: 33 }, { species: 'staravia', level: 33 }] },
  { name: 'Bertil', foes: [{ species: 'machoke', level: 34 }] },
  { name: 'Cecilie', foes: [{ species: 'kilowattrel', level: 33 }, { species: 'floette', level: 33 }] },
  { name: 'Dennis', foes: [{ species: 'golbat', level: 34 }, { species: 'magneton', level: 34 }] },
  { name: 'Emma', foes: [{ species: 'azumarill', level: 34 }, { species: 'pawmo', level: 35 }] },
  { name: 'Frederik', foes: [{ species: 'staraptor', level: 35 }, { species: 'machoke', level: 35 }, { species: 'kilowattrel', level: 35 }] }
];

const commandant: Script = function* (s) {
  if (s.flag('gauntletDone')) { s.say('c7.kas.cmd.after'); s.say('c7.kas.cmd.charts'); return; }
  s.say('c7.kas.cmd.1'); s.say('c7.kas.cmd.2');
  const c: number = yield s.ask('c7.kas.cmd.ask', ['Yes', 'Not now'], 1);
  if (c !== 0) return;
  s.say('c7.kas.cmd.go');
  for (let i = 0; i < GAUNTLET.length; i++) {
    const g = GAUNTLET[i];
    s.say(s.t('c7.kas.next').replace('{n}', String(i + 1)).replace('{name}', g.name));
    const r = yield s.battle({ kind: 'trainer', soft: true, trainer: { name: g.name, title: 'Cadet', sprite: 'tr/guard' }, foes: g.foes });
    if (r !== 'win') { s.heal(); s.say('c7.kas.fail'); return; }
    if (i === 2) { s.heal(); s.me('me_heal'); s.say('c7.kas.rest'); }
  }
  s.setFlag('gauntletDone', true);
  s.say('c7.kas.win');
  s.giveItem('expcandym', 3); s.giveItem('ultraball', 5); s.me('me_item');
  s.say('c7.kas.got');
  s.say('c7.kas.cmd.charts');
  s.checkpoint();
};

const KASTELLET: MapScripts = {
  npcs: [
    { id: 'commandant', sprite: 'chars/gentleman', x: 11, y: 2, dir: 'down', talk: commandant },
    ...[5, 7, 9, 13, 15, 17].map((x, i): NpcDef => ({ id: `cadet${i}`, sprite: 'chars/guard', x, y: 15, dir: 'up', talk: talk('c7.kas.cadet') })),
    sign('kassign', 12, 16, 'obj:sign', 'c7.kas.sign'),
    sign('kasmill', 3, 13, 'obj:sign', 'c7.kas.mill'),
    itemBall('item.kas1', 20, 14, 'revive', 1, 'a Revive')
  ]
};

// ---------- Strandvejen and Lyngby ----------

const ROUTE8: MapScripts = {
  npcs: [
    sign('r8sign', 4, 37, 'obj:sign', 'c7.r8.sign'),
    sign('r8club', 9, 23, 'obj:sign', 'c7.r8.club'),
    { id: 'r8bather', sprite: 'chars/oldman', x: 14, y: 25, dir: 'left', talk: talk('c7.r8.bather', 'c7.r8.bather.2') },
    trainer({ id: 'r8Swim1', x: 12, y: 24, dir: 'left', sprite: 'chars/swimmer', sight: 3, cls: 'Swimmer', name: 'Mette',
      foes: [{ species: 'spheal', level: 32 }, { species: 'buizel', level: 32 }], intro: ['c7.r8.swim1.intro'], lose: ['c7.r8.swim1.lose'] }),
    trainer({ id: 'r8Swim2', x: 10, y: 25, dir: 'up', sprite: 'chars/swimmer', sight: 2, cls: 'Swimmer', name: 'Kaj',
      foes: [{ species: 'sealeo', level: 33 }, { species: 'clauncher', level: 32 }], intro: ['c7.r8.swim2.intro'], lose: ['c7.r8.swim2.lose'] }),
    trainer({ id: 'r8Cyclist', x: 8, y: 16, dir: 'down', sprite: 'chars/cyclist2', sight: 4, cls: 'Cyclist', name: 'Line',
      foes: [{ species: 'kilowattrel', level: 32 }, { species: 'staravia', level: 32 }], intro: ['c7.r8.cyc.intro'], lose: ['c7.r8.cyc.lose'] }),
    trainer({ id: 'r8Fisher', x: 10, y: 9, dir: 'down', sprite: 'chars/fisher', sight: 3, cls: 'Fisher', name: 'Poul',
      foes: [{ species: 'shellder', level: 32 }, { species: 'golduck', level: 33 }], intro: ['c7.r8.fish.intro'], lose: ['c7.r8.fish.lose'] }),
    itemBall('item.r81', 1, 5, 'hyperpotion', 1, 'a Hyper Potion'),
    itemBall('item.r82', 10, 31, 'fullheal', 2, 'Full Heals')
  ]
};

const ingrid: Script = function* (s) {
  if (s.flag('ingridTold')) { s.say('c7.ingrid.after'); return; }
  s.say('c7.ingrid.1'); s.say('c7.ingrid.2'); s.say('c7.ingrid.3'); s.say('c7.ingrid.4'); s.say('c7.ingrid.5');
  s.setFlag('ingridTold', true);
  s.giveItem('expcandym'); s.me('me_item');
  s.say('c7.ingrid.got');
  s.say('c7.ingrid.6');
  s.checkpoint();
};

const LYNGBY: MapScripts = {
  npcs: [
    { id: 'ingrid', sprite: 'chars/oldwoman', x: 9, y: 8, dir: 'down', talk: ingrid },
    sign('lysign', 23, 8, 'obj:sign', 'c7.ly.sign'),
    sign('lyfarm', 18, 4, 'obj:sign', 'c7.ly.farm'),
    { id: 'lyfarmer', sprite: 'chars/gardener', x: 15, y: 12, dir: 'down', talk: talk('c7.ly.farmer') },
    trainer({ id: 'lyPicnic', x: 5, y: 12, dir: 'right', sprite: 'chars/picnicker', sight: 3, cls: 'Picnicker', name: 'Sigrid',
      foes: [{ species: 'dachsbun', level: 33 }, { species: 'wooloo', level: 32 }], intro: ['c7.ly.picnic.intro'], lose: ['c7.ly.picnic.lose'] }),
    trainer({ id: 'lyGarden', x: 20, y: 12, dir: 'left', sprite: 'chars/gardener', sight: 3, cls: 'Gardener', name: 'Holger',
      foes: [{ species: 'morelull', level: 32 }, { species: 'impidimp', level: 32 }, { species: 'dolliv', level: 33 }], intro: ['c7.ly.garden.intro'], lose: ['c7.ly.garden.lose'] }),
    itemBall('item.ly1', 24, 2, 'ultraball', 2, 'Ultra Balls'),
    itemBall('item.ly2', 1, 17, 'revive', 1, 'a Revive')
  ]
};

// ---------- Dyrehaven: sundown, Sif and the sub-station ----------

function* sundown(s: ScriptApi): Step {
  s.setFlag('dyrehavenSeen', true);
  if (s.period !== 'evening' && s.period !== 'night') { s.fade(1, 20); s.setTime('evening'); s.fade(0, 20); }
  s.say('c7.dyr.arrive.1'); s.say('c7.dyr.arrive.2');
  s.checkpoint();
}

function* sifScene(s: ScriptApi): Step {
  s.sfx('exclaim');
  const sif = cast(s, 'sif');
  s.player.faceTo(sif.x, sif.y);
  s.say('c7.sif.1'); s.say('c7.sif.2'); s.say('c7.sif.3'); s.say('c7.sif.4');
  s.sfx('exclaim');
  s.say('c7.sif.guards');
  const r = yield s.battle({
    kind: 'trainer', bg: 'field', prize: 0, trainer: { name: 'Nanna', title: 'Grid Enforcer', sprite: 'tr/enforcer' },
    foes: [{ species: 'magneton', level: 34 }, { species: 'golbat', level: 35 }],
    multi: {
      // Sif's moves only ever hit the other side, so she never catches your Pokémon in a spread move.
      partner: { name: 'Sif', sprite: 'tr/sif', foes: [
        { species: 'glimmet', level: 34, moves: ['powergem', 'acidspray', 'rockslide', 'mortalspin'] },
        { species: 'toxtricity', level: 36, moves: ['overdrive', 'poisonjab', 'venoshock', 'nuzzle'] }
      ] },
      second: { name: 'Ole', title: 'Grid Enforcer', sprite: 'tr/enforcer', foes: [{ species: 'klang', level: 34 }, { species: 'pawmo', level: 35 }] }
    }
  });
  if (r !== 'win') { sif.n.hide(); return; }
  s.setFlag('sifMet', true);
  s.say('c7.sif.5'); s.say('c7.sif.6');
  s.giveItem('sifcodes'); s.me('me_item');
  s.say('c7.sif.got');
  s.say('c7.sif.7');
  sif.n.hide();
  s.checkpoint();
}

/** Bakken's gate stays chained while the sub-station is draining the carnival. */
export const bakkenGate: Script = function* (s) {
  if (s.flag('lightsOn')) return true;
  s.say('c7.bakken.dark');
  return false;
};

const DYREHAVEN: MapScripts = {
  onEnter: function* (s) { if (!s.flag('dyrehavenSeen')) yield* sundown(s); },
  doors: {
    substation: function* (s) {
      if (!s.flag('sifMet')) { s.say('c7.sub.locked'); return; }
      s.sfx('door');
      s.warp('substation', 7, 6, 'up');
    }
  },
  npcs: [
    { id: 'sif', sprite: 'chars/sif', x: 26, y: 10, dir: 'down', hidden: true },
    { id: 'dyrtrain', sprite: 'obj:train', x: 14, y: 26, dir: 'down', object: true, talk: train('dyrehaven') },
    sign('dyrsign', 19, 25, 'obj:sign', 'c7.dyr.sign'),
    sign('eremitage', 9, 4, 'obj:sign', 'c7.dyr.eremitage'),
    ...[[6, 6], [9, 15], [25, 17]].map(([x, y], i): NpcDef => ({ id: `stantler${i}`, sprite: 'chars/stantler', x, y, dir: 'left',
      talk: function* (s) { s.cry('stantler'); s.say('c7.dyr.stantler'); } })),
    { id: 'dyrcard', sprite: 'obj:card', x: 31, y: 9, dir: 'down', object: true, when: f => !f('card4'), talk: card(4) },
    trainer({ id: 'dyrRanger', x: 14, y: 17, dir: 'right', sprite: 'chars/ranger', sight: 3, cls: 'Ranger', name: 'Tove',
      foes: [{ species: 'stantler', level: 34 }, { species: 'sawsbuck', level: 35 }], intro: ['c7.dyr.ranger.intro'], lose: ['c7.dyr.ranger.lose'] }),
    trainer({ id: 'dyrCamper', x: 19, y: 4, dir: 'left', sprite: 'chars/jogger', sight: 3, cls: 'Jogger', name: 'Bo',
      foes: [{ species: 'phantump', level: 34 }, { species: 'shiinotic', level: 35 }], intro: ['c7.dyr.jog.intro'], lose: ['c7.dyr.jog.lose'] }),
    itemBall('item.dyr1', 2, 12, 'ultraball', 2, 'Ultra Balls'),
    itemBall('item.dyr2', 31, 20, 'hyperpotion', 2, 'Hyper Potions')
  ],
  events: [{ x: 25, y: 8, w: 3, h: 1, on: 'step', when: f => !f('sifMet'), run: sifScene }]
};

const terminal: Script = function* (s) {
  if (s.flag('lightsOn')) { s.say('c7.term.done'); return; }
  s.say('c7.term.1');
  if (!s.hasItem('sifcodes')) { s.say('c7.term.locked'); return; }
  const c: number = yield s.ask('c7.term.ask', ['Enter codes', 'Leave it'], 1);
  if (c !== 0) return;
  s.sfx('select'); s.wait(10); s.sfx('select'); s.wait(10);
  for (let i = 0; i < 3; i++) { s.sfx('hit'); s.fade(0.6, 3); s.fade(0, 3); }
  s.takeItem('sifcodes');
  s.setFlag('lightsOn', true);
  s.say('c7.term.2'); s.say('c7.term.3'); s.say('c7.term.sif');
  s.checkpoint();
};

const SUBSTATION: MapScripts = {
  npcs: [
    { id: 'terminal', sprite: 'obj:terminal', x: 7, y: 1, dir: 'down', object: true, talk: terminal },
    trainer({ id: 'subEng1', x: 3, y: 4, dir: 'right', sprite: 'chars/engineer', sight: 4, cls: 'Engineer', name: 'Kristoffer',
      foes: [{ species: 'magneton', level: 34 }, { species: 'klang', level: 35 }], intro: ['c7.sub.eng1.intro'], lose: ['c7.sub.eng1.lose'] }),
    trainer({ id: 'subEng2', x: 11, y: 2, dir: 'left', sprite: 'chars/engineer', sight: 4, cls: 'Engineer', name: 'Lise',
      foes: [{ species: 'rotom', level: 35 }, { species: 'bellibolt', level: 35 }], intro: ['c7.sub.eng2.intro'], lose: ['c7.sub.eng2.lose'] })
  ]
};

// ---------- Bakken ----------

/** Pierrot's five lost cards: four around Bakken and Dyrehaven, one at Langelinie. */
const CARDS = ['c7.card.1', 'c7.card.2', 'c7.card.3', 'c7.card.4', 'c7.card.5'];
const cardsFound = (s: ScriptApi) => CARDS.filter((_, i) => s.flag(`card${i + 1}`)).length;
function card(n: number): Script {
  return function* (s) {
    s.setFlag(`card${n}`, true);
    s.sfx('select');
    s.say(CARDS[n - 1]);
    s.say(s.t('c7.card.found').replace('{n}', String(cardsFound(s))));
  };
}

function* bakkenArrive(s: ScriptApi): Step {
  s.setFlag('bakkenSeen', true);
  s.say('c7.bak.arrive.1');
  const p = cast(s, 'pierrot7');
  s.player.faceTo(p.x, p.y);
  s.say('c7.bak.pierrot.1'); s.say('c7.bak.pierrot.2'); s.say('c7.bak.pierrot.3');
  p.n.walk('up', 3); p.n.hide();
  s.checkpoint();
}

const BAKKEN: MapScripts = {
  onEnter: function* (s) {
    if (s.period !== 'evening' && s.period !== 'night' && !s.flag('harlequin')) { s.fade(1, 10); s.setTime('evening'); s.fade(0, 10); }
    if (!s.flag('bakkenSeen')) yield* bakkenArrive(s);
  },
  doors: {
    gym: function* (s) { s.sfx('door'); s.warp('gym6', 10, 15, 'up'); },
    pc: function* (s) { s.warp('pcbakken', 6, 5, 'up'); }
  },
  npcs: [
    { id: 'pierrot7', sprite: 'chars/juggler', x: 15, y: 6, dir: 'down', hidden: true },
    sign('baksign', 12, 19, 'obj:sign', 'c7.bak.sign'),
    sign('bakgym', 18, 5, 'obj:sign', 'c7.bak.gymsign'),
    { id: 'bakkid', sprite: 'chars/kid', x: 20, y: 12, dir: 'left', talk: talk('c7.bak.kid') },
    { id: 'bakvendor', sprite: 'chars/baker', x: 6, y: 10, dir: 'right', talk: talk('c7.bak.vendor') },
    { id: 'bakcard1', sprite: 'obj:card', x: 1, y: 20, dir: 'down', object: true, when: f => !f('card1'), talk: card(1) },
    { id: 'bakcard2', sprite: 'obj:card', x: 28, y: 1, dir: 'down', object: true, when: f => !f('card2'), talk: card(2) },
    { id: 'bakcard3', sprite: 'obj:card', x: 21, y: 14, dir: 'down', object: true, when: f => !f('card3'), talk: card(3) },
    trainer({ id: 'bakClown', x: 24, y: 10, dir: 'left', sprite: 'chars/juggler', sight: 3, cls: 'Harlequin', name: 'Benny',
      foes: [{ species: 'swirlix', level: 34 }, { species: 'mimejr', level: 34 }, { species: 'spritzee', level: 35 }], intro: ['c7.bak.clown.intro'], lose: ['c7.bak.clown.lose'] }),
    itemBall('item.bak1', 27, 18, 'hyperpotion', 1, 'a Hyper Potion')
  ]
};

// ---------- Gym 6: the Hall of Mirrors and the Rutschebanen ----------

/** Six mirrors; only the reflection that is weeping is the way through. */
const MIRRORS = [2, 5, 8, 12, 15, 18];
const TRUE_MIRROR = 12;

const mirror = (x: number, i: number): NpcDef => ({
  id: `mirror${i}`, sprite: 'obj:mirror', x, y: 11, dir: 'down', object: true, talk: function* (s) {
    if (s.flag('mirrorDone')) { s.say('c7.mirror.done'); return; }
    s.say(`c7.mirror.${i + 1}`);
    const c: number = yield s.ask('c7.mirror.ask', ['Step through', 'Look away'], 1);
    if (c !== 0) return;
    if (x === TRUE_MIRROR) {
      s.sfx('select');
      s.setFlag('mirrorDone', true);
      s.say('c7.mirror.right');
      s.checkpoint();
      return;
    }
    s.sfx('flee');
    s.say('c7.mirror.wrong');
    s.fade(1, 12); s.warp('gym6', 10, 15, 'up'); s.fade(0, 12);
  }
});

/** The coaster cars: colour, where it stands, and where it takes you. */
const CARTS: { id: string; colour: string; x: number; y: number; to: [number, number] }[] = [
  { id: 'cartP1red', colour: 'red', x: 8, y: 7, to: [3, 2] },      // P1 -> P2 (right)
  { id: 'cartP1blue', colour: 'blue', x: 12, y: 7, to: [10, 13] }, // P1 -> back down to the hall
  { id: 'cartP2green', colour: 'green', x: 5, y: 1, to: [17, 2] }, // P2 -> P3 (right)
  { id: 'cartP2yellow', colour: 'yellow', x: 1, y: 3, to: [10, 8] }, // P2 -> back to P1
  { id: 'cartP3blue', colour: 'blue', x: 15, y: 1, to: [10, 3] },  // P3 -> the stage (right)
  { id: 'cartP3purple', colour: 'purple', x: 19, y: 3, to: [3, 2] } // P3 -> back to P2
];

const cart = (c: typeof CARTS[number]): NpcDef => ({
  id: c.id, sprite: `obj:cart-${c.colour}`, x: c.x, y: c.y, dir: 'down', object: true, talk: function* (s) {
    const r: number = yield s.ask(s.t('c7.cart.ask').replace('{colour}', c.colour), ['Ride', 'Stay'], 1);
    if (r !== 0) return;
    s.sfx('door'); s.fade(1, 16);
    s.warp('gym6', c.to[0], c.to[1], 'down');
    s.fade(0, 16);
    s.say('c7.cart.ride');
  }
});

const pierrotGym: Script = function* (s) {
  if (s.flag('harlequin')) {
    if (cardsFound(s) === CARDS.length && !s.flag('laughterDone')) {
      s.say('c7.laugh.1'); s.say('c7.laugh.2');
      s.setFlag('laughterDone', true);
      s.giveItem('expcandym', 2); s.me('me_item');
      s.say('c7.laugh.got');
      s.checkpoint();
      return;
    }
    s.say('c7.pierrot.after');
    if (cardsFound(s) < CARDS.length) s.say(s.t('c7.laugh.hint').replace('{n}', String(cardsFound(s))));
    return;
  }
  s.say('c7.pierrot.gym.1'); s.say('c7.pierrot.gym.2');
  const c: number = yield s.ask('c7.pierrot.ask', ['Yes', 'Not yet'], 1);
  if (c !== 0) return;
  const r = yield s.battle({ kind: 'trainer', leader: true, ai: 3, bg: 'indoor1', trainer: { name: 'Pierrot', title: 'Leader', sprite: 'tr/pierrot' }, foes: [
    { species: 'slurpuff', level: 36, moves: ['drainingkiss', 'energyball', 'flamethrower', 'calmmind'] },
    { species: 'mrmime', level: 36, moves: ['psybeam', 'dazzlinggleam', 'reflect', 'encore'] },
    { species: 'mimikyu', level: 37, moves: ['playrough', 'shadowclaw', 'shadowsneak', 'swordsdance'] },
    { species: 'mrrime', level: 38, moves: ['freezedry', 'psybeam', 'dazzlinggleam', 'rapidspin'], item: 'sitrusberry' }
  ] });
  if (r !== 'win') { s.say('c7.pierrot.win'); return; }
  s.say('c7.pierrot.lose');
  s.setFlag('harlequin', true);
  s.giveBadge('harlequin', 'Harlequin Badge');
  s.me('me_badge');
  s.say('c7.got.badge');
  s.say('c7.pierrot.tm');
  s.giveItem('tmdazzlinggleam'); s.me('me_item');
  s.say(`${s.player.name} got TM Dazzling Gleam!`);
  s.say('c7.pierrot.snorkel');
  s.giveItem('snorkel'); s.me('me_item');
  s.say('c7.got.snorkel');
  s.say('c7.pierrot.charts.1');
  s.giveItem('ferrycharts'); s.me('me_item');
  s.say('c7.got.charts');
  s.say('c7.pierrot.charts.2');
  yield* finale(s);
};

function* finale(s: ScriptApi): Step {
  s.wait(20);
  const m = cast(s, 'maja7g');
  s.player.faceTo(m.x, m.y);
  s.say('c7.end.maja.1'); s.say('c7.end.maja.2'); s.say('c7.end.maja.3'); s.say('c7.end.maja.4'); s.say('c7.end.maja.5');
  m.n.hide();
  s.setFlag('ch7done', true);
  s.checkpoint();
  s.chapterEnd('Chapter 7 complete', 'North by Kystbanen');
  s.say('c7.end');
}

const GYM6: MapScripts = {
  npcs: [
    sign('g6card', 9, 14, 'obj:card', 'c7.g6.card.1', 'c7.g6.card.2'),
    { id: 'g6guide', sprite: 'chars/oldman', x: 12, y: 15, dir: 'left', talk: function* (s) {
      if (s.flag('harlequin')) { s.say('c7.g6.guide.after'); return; }
      s.say('c7.g6.guide.1'); s.say('c7.g6.guide.2');
    } },
    ...MIRRORS.map((x, i) => mirror(x, i)),
    { id: 'mirrorgate', sprite: 'obj:mirror', x: 10, y: 10, dir: 'down', object: true, when: f => !f('mirrorDone'), talk: talk('c7.mirror.gate') },
    ...CARTS.map(cart),
    sign('g6cardP1', 11, 9, 'obj:card', 'c7.g6.card.p1'),
    sign('g6cardP2', 2, 1, 'obj:card', 'c7.g6.card.p2'),
    sign('g6cardP3', 18, 1, 'obj:card', 'c7.g6.card.p3'),
    { id: 'pierrotg', sprite: 'chars/juggler', x: 10, y: 1, dir: 'down', talk: pierrotGym },
    { id: 'maja7g', sprite: 'chars/maja', x: 9, y: 3, dir: 'up', hidden: true },
    trainer({ id: 'g6Lady', x: 9, y: 8, dir: 'up', sprite: 'chars/lady', sight: 1, cls: 'Lady', name: 'Karoline',
      foes: [{ species: 'floette', level: 35 }, { species: 'togetic', level: 36 }], intro: ['c7.g6.lady.intro'], lose: ['c7.g6.lady.lose'] }),
    trainer({ id: 'g6Clown1', x: 4, y: 3, dir: 'up', sprite: 'chars/juggler', sight: 1, cls: 'Harlequin', name: 'Svend',
      foes: [{ species: 'azumarill', level: 36 }, { species: 'hattrem', level: 36 }], intro: ['c7.g6.clown1.intro'], lose: ['c7.g6.clown1.lose'] }),
    trainer({ id: 'g6Clown2', x: 18, y: 3, dir: 'up', sprite: 'chars/juggler', sight: 1, cls: 'Harlequin', name: 'Lotte',
      foes: [{ species: 'clefairy', level: 36 }, { species: 'morgrem', level: 36 }, { species: 'spritzee', level: 36 }], intro: ['c7.g6.clown2.intro'], lose: ['c7.g6.clown2.lose'] })
  ]
};

export const BAKKEN_SCRIPTS: Record<string, MapScripts> = {
  osterbro: OSTERBRO, pcosterbro: { npcs: centerNpcs('osterbro', 13, 6) }, kastellet: KASTELLET, route8: ROUTE8, lyngby: LYNGBY,
  dyrehaven: DYREHAVEN, substation: SUBSTATION, bakken: BAKKEN, pcbakken: { npcs: centerNpcs('bakken', 4, 8) }, gym6: GYM6
};
