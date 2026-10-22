// Chapter 3, The White Butchery: Route 2 (Den Grønne Sti), Vesterbro and its Hygge café, Kødbyen (Kasper's
// Empty-Sea Dinner, the neon square at night, Gym 3 on sea ice), Cykelslangen and Islands Brygge.
import type { NpcDef, Script, ScriptApi } from '@hafnia/core';
import { centerNpcs } from './home';
import { ferry } from './dragor';
import { findItem, grown, itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';
import { majaStarter } from './starters';

// ---------- Nørrebro → Route 2 ----------

/** Den Grønne Sti opens once Chapter 2 is over. */
export const norrebroWest: Script = function* (s) {
  if (s.flag('demoEnd')) return true;
  s.say('c3.gate.closed');
  return false;
};

const ROUTE2: MapScripts = {
  onEnter: function* (s) {
    if (s.flag('ch3')) return;
    s.setFlag('ch3', true);
    s.chapterEnd('Chapter 3', 'The White Butchery');
    s.checkpoint();
  },
  npcs: [
    sign('r2sign', 26, 2, 'obj:sign', 'c3.r2.sign'),
    sign('r2overpass', 24, 6, 'obj:sign', 'c3.r2.overpass'),
    trainer({ id: 'r2cyclist', x: 13, y: 3, dir: 'right', sprite: 'chars/biker', sight: 4, cls: 'Cyclist', name: 'Emil',
      foes: [{ species: 'starly', level: 18 }, { species: 'wattrel', level: 19 }], intro: ['c3.r2.cyclist.intro'], lose: ['c3.r2.cyclist.lose'] }),
    trainer({ id: 'r2jogger', x: 4, y: 8, dir: 'up', sprite: 'chars/jogger', sight: 4, cls: 'Jogger', name: 'Ida',
      foes: [{ species: 'lillipup', level: 18 }, { species: 'skwovet', level: 19 }], intro: ['c3.r2.jogger.intro'], lose: ['c3.r2.jogger.lose'] }),
    trainer({ id: 'r2student', x: 10, y: 11, dir: 'left', sprite: 'chars/student', sight: 3, cls: 'Student', name: 'Noah',
      foes: [{ species: 'combee', level: 18 }, { species: 'shroodle', level: 18 }, { species: 'nickit', level: 19 }],
      intro: ['c3.r2.student.intro'], lose: ['c3.r2.student.lose'] }),
    { id: 'r2picker', sprite: 'chars/oldwoman', x: 9, y: 2, dir: 'down', talk: function* (s) {
      s.say('c3.r2.picker');
      if (!s.flag('r2berries')) yield* findItem(s, 'r2berries', 'oranberry', 3, 'Oran Berries');
    } },
    itemBall('item.r2a', 26, 12, 'superpotion', 1, 'a Super Potion'),
    itemBall('item.r2b', 2, 10, 'greatball', 3, 'Great Balls')
  ]
};

// ---------- Vesterbro ----------

const VESTERBRO: MapScripts = {
  onEnter: function* (s) {
    if (s.flag('vbArrive')) return;
    s.setFlag('vbArrive', true);
    s.say('c3.vb.arrive');
    const m = s.npc('maja');
    const [mx, my] = s.freeSpotNear(s.player.x, s.player.y);
    m.place(mx, my, 'down'); m.show(); m.facePlayer(); s.player.faceTo(mx, my);
    s.say('c3.vb.maja.1'); s.say('c3.vb.maja.2'); s.say('c3.vb.maja.3');
    m.hide();
    s.checkpoint();
  },
  npcs: [
    { id: 'maja', sprite: 'chars/maja', x: 13, y: 3, dir: 'down', hidden: true },
    { id: 'vbtourist', sprite: 'chars/tourist', x: 9, y: 12, dir: 'down', talk: talk('c3.vb.tourist') },
    { id: 'vbkid', sprite: 'chars/kid', x: 15, y: 6, dir: 'left', talk: talk('c3.vb.kid') },
    { id: 'vboldman', sprite: 'chars/oldman', x: 22, y: 11, dir: 'left', talk: talk('c3.vb.oldman') }
  ],
  doors: {
    cafe: function* (s) { s.warp('cafevb', 5, 4, 'up'); },
    pc: function* (s) { s.warp('pcvesterbro', 6, 5, 'up'); }
  }
};

/** Hygge: a cocoa by the stove rests the team. */
const barista: Script = function* (s) {
  s.say('c3.cafe.1');
  const c: number = yield s.ask('c3.cafe.ask', ['Yes, please', 'Not now'], 1);
  if (c !== 0) { s.say('c3.cafe.no'); return; }
  s.fade(1, 12); s.heal(); s.me('me_heal'); s.fade(0, 12);
  s.say('c3.cafe.rest'); s.say('c3.cafe.2');
  s.checkpoint();
};

const CAFE: MapScripts = {
  npcs: [
    { id: 'barista', sprite: 'chars/barista', x: 5, y: 1, dir: 'down', talk: barista },
    sign('stove', 9, 2, 'obj:stove', 'A cast-iron stove, ticking with heat. A Pokémon could nap here for hours.')
  ]
};

// ---------- Kødbyen ----------

const INGREDIENTS = ['buckthorn', 'mussels', 'icesalt'] as const;
const hasAll = (s: ScriptApi) => INGREDIENTS.every(i => s.hasItem(i));

const LOCKERS: [number, string][] = [[3, 'c3.locker.1'], [4, 'c3.locker.2'], [5, 'c3.locker.3'], [6, 'c3.locker.4'], [8, 'c3.locker.5']];

const kasperLocker: Script = function* (s) {
  if (s.flag('saltFound')) { s.say('c3.locker.3'); return; }
  s.say('c3.locker.hum');
  if (!s.flag('dinnerQuest')) return;
  s.sfx('select');
  s.say('c3.locker.open');
  s.setFlag('saltFound', true);
  s.giveItem('icesalt'); s.me('me_item');
  s.say('c3.got.salt');
};

/** The DJ's Neon Nights gauntlet: three tag battles in a row with Signe as your partner. */
const ROUNDS: { a: [string, string, [string, number][]]; b: [string, string, [string, number][]] }[] = [
  { a: ['Kim', 'Raver', [['croagunk', 21], ['shroodle', 21]]], b: ['Lou', 'Raver', [['stunky', 21], ['poliwag', 21]]] },
  { a: ['Bjørn', 'Bouncer', [['machop', 22], ['rolycoly', 22]]], b: ['Nanna', 'Bouncer', [['mankey', 22], ['crabrawler', 22]]] },
  { a: ['Neon', 'DJ', [['joltik', 23], ['tadbulb', 23]]], b: ['Nova', 'DJ', [['voltorb', 23], ['magnemite', 23]]] }
];
const SPRITE: Record<string, string> = { Raver: 'tr/rocker', Bouncer: 'tr/bouncer', DJ: 'tr/juggler' };
const foes = (l: [string, number][]) => l.map(([species, level]) => ({ species, level }));

const signe: Script = function* (s) {
  if (s.period !== 'night') { s.say('c3.dj.day'); return; }
  if (s.flag('neonDone')) { s.say('c3.dj.after'); return; }
  s.say('c3.dj.1');
  const c: number = yield s.ask('c3.dj.ask', ['Let\'s go', 'Later'], 1);
  if (c !== 0) return;
  for (const [i, r] of ROUNDS.entries()) {
    const res = yield s.battle({
      kind: 'trainer', bg: 'city', prize: i === 2 ? undefined : 0,
      trainer: { name: r.a[0], title: r.a[1], sprite: SPRITE[r.a[1]] }, foes: foes(r.a[2]),
      multi: {
        partner: { name: 'Signe', sprite: 'tr/signe', foes: [{ species: 'pawmi', level: 22 }, { species: 'tadbulb', level: 22 }] },
        second: { name: r.b[0], title: r.b[1], sprite: SPRITE[r.b[1]], foes: foes(r.b[2]) }
      }
    });
    if (res !== 'win') return;
    if (i < ROUNDS.length - 1) { s.heal(); s.say('c3.dj.break'); }
  }
  s.setFlag('neonDone', true);
  s.say('c3.dj.done');
  s.giveItem('pearl', 2); s.giveMoney(3000); s.me('me_item');
  s.say(`${s.player.name} got 2 Pearls and 3,000 kr.!`);
  s.checkpoint();
};

const KODBYEN: MapScripts = {
  onEnter: function* (s) {
    if (s.flag('kbArrive')) return;
    s.setFlag('kbArrive', true);
    s.say('c3.kb.arrive');
  },
  npcs: [
    ...LOCKERS.map(([x, line]) => sign(`locker${x}`, x, 11, 'obj:locker', line)),
    { id: 'locker7', sprite: 'obj:locker', x: 7, y: 11, dir: 'down', object: true, talk: kasperLocker },
    { id: 'signe', sprite: 'chars/signe', x: 18, y: 11, dir: 'down', talk: signe },
    sign('speaker1', 14, 11, 'obj:speaker', 'A speaker stack, taller than you. It thumps.'),
    sign('speaker2', 23, 11, 'obj:speaker', 'A speaker stack. Your ribs are humming.'),
    { id: 'raver1', sprite: 'chars/raver', x: 16, y: 14, dir: 'right', period: ['night'], talk: talk('c3.raver.1') },
    { id: 'raver2', sprite: 'chars/rocker', x: 21, y: 14, dir: 'left', period: ['night'], talk: talk('c3.raver.2') },
    itemBall('item.kb1', 24, 17, 'revive', 1, 'a Revive')
  ],
  doors: {
    kitchen: function* (s) { s.warp('kitchen', 6, 5, 'up'); },
    gym: function* (s) {
      if (!s.flag('dinnerDone')) { s.say('c3.kb.gym.closed'); return; }
      s.warp('gym3', 7, 10, 'up');
    }
  }
};

// ---------- Kasper's kitchen: the Empty-Sea Dinner ----------

function* dinner(s: ScriptApi): Step {
  s.say('c3.kit.back.1');
  for (const i of INGREDIENTS) s.takeItem(i);
  s.fade(1, 20); s.wait(30); s.say('c3.kit.back.2');
  const kid = s.npc('child');
  kid.place(6, 3, 'up'); kid.show();
  s.fade(0, 20);
  s.say('c3.kit.child.1'); s.say('c3.kit.child.2'); s.say('c3.kit.ali.2'); s.say('c3.kit.back.3');
  kid.hide();
  s.setFlag('dinnerDone', true);
  s.setTime('night');
  s.say('c3.kit.night');
  s.checkpoint();
}

const kasperKitchen: Script = function* (s) {
  if (s.flag('dinnerDone')) { s.say(s.flag('frost') ? 'c3.kasper.after' : 'c3.kit.after'); return; }
  if (!s.flag('dinnerQuest')) {
    s.say('c3.kit.1'); s.say('c3.kit.2'); s.say('c3.kit.3'); s.say('c3.kit.4'); s.say('c3.kit.5'); s.say('c3.kit.6'); s.say('c3.kit.7');
    s.setFlag('dinnerQuest', true);
    s.checkpoint();
    return;
  }
  if (!hasAll(s)) { s.say('c3.kit.wait'); return; }
  yield* dinner(s);
};

const KITCHEN: MapScripts = {
  npcs: [
    { id: 'kasper', sprite: 'chars/kasper', x: 6, y: 1, dir: 'down', when: f => !f('dinnerDone'), talk: kasperKitchen },
    { id: 'kasperafter', sprite: 'chars/kasper', x: 6, y: 1, dir: 'down', when: f => !!f('dinnerDone'), talk: kasperKitchen },
    { id: 'ali', sprite: 'chars/chef', x: 2, y: 2, dir: 'right', talk: talk('c3.kit.ali') },
    { id: 'sofie', sprite: 'chars/chef', x: 10, y: 2, dir: 'left', talk: talk('c3.kit.sofie') },
    { id: 'child', sprite: 'chars/kid', x: 6, y: 3, dir: 'up', hidden: true },
    sign('stove1', 1, 4, 'obj:stove', 'A stockpot the size of a bathtub, simmering.'),
    sign('stove2', 11, 4, 'obj:stove', 'A row of burners, all lit. It\'s very warm in here.')
  ]
};

// ---------- Gym 3: Kasper, on sea ice ----------

/** Valves in menu order: forret (starter), hovedret (main), dessert. */
const VALVES = [
  { id: 'vforret', x: 14, y: 7, label: 'FORRET' },
  { id: 'vhoved', x: 0, y: 7, label: 'HOVEDRET' },
  { id: 'vdessert', x: 14, y: 4, label: 'DESSERT' }
];

const valve = (i: number): Script => function* (s) {
  const v = VALVES[i];
  if (s.flag('steam')) { s.say(`A steam valve marked ${v.label}. Steam hisses gently.`); return; }
  if (s.flag(v.id)) { s.say('c3.valve.open'); return; }
  const c: number = yield s.ask(`A steam valve marked ${v.label}. Open it?`, ['Open it', 'Leave it'], 1);
  if (c !== 0) return;
  const done = VALVES.slice(0, i).every(p => s.flag(p.id));
  if (!done) {
    s.sfx('exclaim');
    for (const p of VALVES) s.setFlag(p.id, false);
    s.say('c3.valve.wrong');
    return;
  }
  s.sfx('select');
  s.setFlag(v.id, true);
  s.say('c3.valve.ok');
  if (i === VALVES.length - 1) {
    s.setFlag('steam', true);
    s.say('c3.valve.melt');
    s.checkpoint();
  }
};

const kasperGym: Script = function* (s) {
  if (s.flag('frost')) { s.say('c3.kasper.after'); return; }
  s.say('c3.kasper.intro.1'); s.say('c3.kasper.intro.2');
  const c: number = yield s.ask('Kasper: Ready to be plated?', ['Yes', 'Not yet'], 1);
  if (c !== 0) return;
  const r = yield s.battle({ kind: 'trainer', leader: true, bg: 'indoor1', trainer: { name: 'Kasper', title: 'Leader', sprite: 'tr/kasper' }, foes: [
    { species: 'snorunt', level: 22, moves: ['icywind', 'bite', 'headbutt', 'leer'] },
    { species: 'cetoddle', level: 22, moves: ['icywind', 'rollout', 'bodyslam', 'growl'] },
    { species: 'cryogonal', level: 24, moves: ['aurorabeam', 'rapidspin', 'recover', 'acidarmor'], item: 'sitrusberry' }
  ] });
  if (r !== 'win') { s.say('c3.kasper.win'); return; }
  s.say('c3.kasper.lose');
  s.setFlag('frost', true);
  s.giveBadge('frost', 'Frost Badge');
  s.me('me_badge');
  s.say('c3.got.badge');
  s.say('c3.kasper.tm');
  s.giveItem('tmicywind'); s.me('me_item');
  s.say(`${s.player.name} got TM Icy Wind!`);
  s.say('c3.kasper.bike');
  s.giveItem('bikelamp'); s.giveItem('hydrofoils'); s.me('me_item');
  s.say('c3.got.bike'); s.say('c3.kasper.bike.2');
  s.say('c3.maja.text');
  s.checkpoint();
};

const GYM3: MapScripts = {
  npcs: [
    { id: 'kasperg', sprite: 'chars/kasper', x: 7, y: 1, dir: 'down', talk: kasperGym },
    { id: 'iceblock', sprite: 'obj:iceblock', x: 7, y: 3, dir: 'down', object: true, when: f => !f('steam'),
      talk: talk('A block of sea ice plugs the gap. Steam would shift it.') },
    ...VALVES.map((v, i): NpcDef => ({ id: v.id, sprite: 'obj:valve', x: v.x, y: v.y, dir: 'down', object: true, talk: valve(i) })),
    sign('g3sign', 9, 12, 'obj:sign', 'c3.gym.sign'),   // on the wall by the door
    { id: 'g3guide', sprite: 'chars/oldman', x: 2, y: 10, dir: 'right', talk: function* (s) { s.say(s.flag('frost') ? 'Gym guide: Chef smiled! I saw it! I think.' : 'c3.gym.guide'); } },
    trainer({ id: 'g3mette', x: 3, y: 2, dir: 'right', sprite: 'chars/chef', sight: 4, cls: 'Sous-chef', name: 'Mette',
      foes: [{ species: 'spheal', level: 21 }, { species: 'snorunt', level: 21 }], intro: ['c3.gym.mette.intro'], lose: ['c3.gym.mette.lose'] }),
    trainer({ id: 'g3rasmus', x: 12, y: 1, dir: 'down', sprite: 'chars/chef', sight: 1, cls: 'Commis', name: 'Rasmus',
      foes: [{ species: 'cubchoo', level: 21 }, { species: 'bergmite', level: 22 }], intro: ['c3.gym.rasmus.intro'], lose: ['c3.gym.rasmus.lose'] })
  ]
};

// ---------- Route 3: Cykelslangen, and Maja ----------

function* majaRace(s: ScriptApi): Step {
  s.setFlag('majaRace', true);
  const m = s.npc('majar');
  const [mx, my] = s.freeSpotNear(s.player.x, s.player.y);
  m.place(mx, my, 'down'); m.show(); m.facePlayer(); s.player.faceTo(mx, my);
  s.say('c3.maja.1'); s.say('c3.maja.2');
  const r = yield s.battle({ kind: 'trainer', soft: true, ai: 2, bg: 'city', trainer: { name: 'Maja', title: 'Rival', sprite: 'tr/maja' }, foes: [
    { species: 'mareanie', level: 21 },
    { species: 'stunky', level: 21 },
    { species: 'wattrel', level: 22, moves: ['tailwind', 'spark', 'wingattack', 'quickattack'] },
    { species: grown(majaStarter(s), 23), level: 23 }
  ] });
  s.say(r === 'win' ? 'c3.maja.lose' : 'c3.maja.win');
  s.heal();
  s.say('c3.maja.3'); s.say('c3.maja.4'); s.say('c3.maja.5'); s.say('c3.maja.6');
  s.say('c3.maja.7');
  m.hide();
  s.wait(20);
  s.sfx('select');
  s.say('c3.orsted.1'); s.say('c3.orsted.2'); s.say('c3.orsted.3');
  s.setFlag('ch3done', true);
  s.checkpoint();
  s.chapterEnd('Chapter 3 complete', 'The White Butchery');
  s.say('c3.end');
}

const ROUTE3: MapScripts = {
  onEnter: function* (s) { if (s.flag('frost') && !s.flag('majaRace')) yield* majaRace(s); },
  npcs: [
    { id: 'majar', sprite: 'chars/maja', x: 12, y: 2, dir: 'down', hidden: true },
    trainer({ id: 'r3cyclist', x: 13, y: 3, dir: 'up', sprite: 'chars/biker', sight: 1, cls: 'Cyclist', name: 'Freja B.',
      foes: [{ species: 'wattrel', level: 20 }, { species: 'starly', level: 20 }],
      intro: ['Cyclist: The tailwind up here is free speed!\nBattle me before it changes!'], lose: ['Cyclist: Headwind. Emotionally.'] })
  ]
};

// ---------- Islands Brygge and the Kalvebod edge ----------

const ISLANDSBRYGGE: MapScripts = {
  onEnter: function* (s) {
    if (s.flag('ibArrive')) return;
    s.setFlag('ibArrive', true);
    s.say('c3.ib.arrive');
  },
  npcs: [
    { id: 'lifeguard', sprite: 'chars/lifeguard', x: 11, y: 4, dir: 'left', talk: talk('c3.ib.guard', 'c3.ib.guard.2') },
    trainer({ id: 'ibswim1', x: 5, y: 3, dir: 'left', sprite: 'chars/swimmer', sight: 2, cls: 'Swimmer', name: 'Lone',
      foes: [{ species: 'finizen', level: 20 }, { species: 'shellos', level: 20 }], intro: ['c3.ib.swim1.intro'], lose: ['c3.ib.swim1.lose'] }),
    trainer({ id: 'ibswim2', x: 10, y: 7, dir: 'up', sprite: 'chars/swimmer', sight: 3, cls: 'Swimmer', name: 'Viggo',
      foes: [{ species: 'tentacool', level: 20 }, { species: 'spheal', level: 21 }], intro: ['c3.ib.swim2.intro'], lose: ['c3.ib.swim2.lose'] }),
    { id: 'ladder', sprite: 'obj:ladder', x: 7, y: 3, dir: 'down', object: true, talk: function* (s) {
      if (s.hasItem('mussels') || s.flag('dinnerDone')) { s.say('Mussels cling to the ladder. You have plenty.'); return; }
      s.say('c3.ib.ladder');
      s.giveItem('mussels'); s.me('me_item');
      s.say('c3.got.mussels');
    } },
    { id: 'buckthorn', sprite: 'obj:bush', x: 19, y: 17, dir: 'down', object: true, talk: function* (s) {
      if (s.hasItem('buckthorn') || s.flag('dinnerDone')) { s.say('A sea buckthorn bush. You\'ve picked enough for now.'); return; }
      s.say('c3.ib.bush');
      s.giveItem('buckthorn'); s.me('me_item');
      s.say('c3.got.buckthorn');
    } },
    sign('wildssign', 13, 19, 'obj:sign', 'c3.ib.wilds'),
    { id: 'ranger', sprite: 'chars/ranger', x: 20, y: 12, dir: 'left', talk: talk('c3.ib.ranger') },
    { id: 'skipper', sprite: 'chars/sailor', x: 2, y: 11, dir: 'right', talk: ferry('dragor') },
    itemBall('item.ib3', 21, 19, 'revive', 1, 'a Revive'),
    itemBall('item.ib2', 3, 18, 'netball', 2, 'Net Balls')
  ]
};

export const VESTERBRO_SCRIPTS: Record<string, MapScripts> = {
  route2: ROUTE2, vesterbro: VESTERBRO, cafevb: CAFE, pcvesterbro: { npcs: centerNpcs('vesterbro', 18, 8) },
  kodbyen: KODBYEN, kitchen: KITCHEN, gym3: GYM3, route3: ROUTE3, islandsbrygge: ISLANDSBRYGGE
};
