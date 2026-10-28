// Chapter 4, Lanterns Out: back in Nørrebro at dusk, Assistens Kirkegård, the Litwick fleeing into the
// storm drain (Vanguard's intake pipe is pulling the groundwater toward the harbour), Gym 4 on Søren's
// Lantern Walk, and two side quests: the Assistens Ghost Stories and Kanelsnegl Morning.
import type { Dir, MapEvent, NpcDef, Script, ScriptApi } from '@hafnia/core';
import { itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';
import { rematch } from './rematch';

// ---------- Nørrebro: the chapter starts ----------

/** Runs after Nørrebro's own arrival script: once Chapter 3 is done, Tariq sends word about the lanterns. */
export function* norrebroCh4(s: ScriptApi): Step {
  if (!s.flag('ch3done') || s.flag('ch4')) return;
  s.setFlag('ch4', true);
  s.chapterEnd('Chapter 4', 'Lanterns Out');
  s.setTime('evening');
  s.sfx('select');
  s.say('c4.start.1'); s.say('c4.start.2'); s.say('c4.start.3');
  s.checkpoint();
}

/** The lane north to Assistens opens with Chapter 4. */
export const norrebroNorth: Script = function* (s) {
  if (s.flag('ch4')) return true;
  s.say('c4.gate.early');
  return false;
};

// ---------- Assistens Kirkegård ----------

const GRAVES: [number, number][] = [
  ...[5, 7, 9, 15, 17, 19].flatMap(y => [4, 6, 8, 10, 12].map((x): [number, number] => [x, y])),
  ...[5, 7, 9].flatMap(y => [19, 21, 23].map((x): [number, number] => [x, y])),
  [19, 15], [21, 15], [19, 17], [21, 17]
];

/** The five graves of the Ghost Stories side quest, and who rises from each at night. */
const GHOSTS = [
  { id: 'gs1', x: 6, y: 7, line: 'c4.gs.1', species: 'misdreavus' },
  { id: 'gs2', x: 10, y: 17, line: 'c4.gs.2', species: 'greavard' },
  { id: 'gs3', x: 21, y: 7, line: 'c4.gs.3', species: 'gastly' },
  { id: 'gs4', x: 4, y: 17, line: 'c4.gs.4', species: 'sinistea' },
  { id: 'gs5', x: 12, y: 5, line: 'c4.gs.5', species: 'litwick' }
];
const ghostsHeard = (s: ScriptApi) => GHOSTS.filter(g => s.flag(g.id)).length;

const ghostGrave = (i: number): Script => function* (s) {
  const g = GHOSTS[i];
  if (s.flag(g.id)) { s.say('c4.gs.done'); return; }
  if (!s.flag('ch4') || s.period !== 'night') { s.say('c4.gs.day'); return; }
  s.say(g.line);
  s.sfx('exclaim');
  s.say('c4.gs.rise');
  const r = yield s.battle({ kind: 'wild', foes: [{ species: g.species, level: 25 }], bg: 'field' });
  if (r === 'lose' || r === 'run') return;
  s.setFlag(g.id, true);
  s.say('c4.gs.calm');
  if (ghostsHeard(s) === GHOSTS.length) s.say('Every story heard. Søren will want to know.');
};

const LANTERNS: [number, number][] = [[14, 4], [17, 4], [14, 8], [17, 8], [14, 16], [17, 16], [14, 20], [17, 20]];

/** Søren in the cemetery: points you at the drain, then keeps the Ghost Stories. */
const sorenAssistens: Script = function* (s) {
  if (!s.flag('litwickBack')) { s.say('c4.soren.wait'); return; }
  if (!s.flag('lantern')) { s.say('c4.relit.5'); return; }
  if (s.flag('gsReward')) { s.say('c4.soren.after'); return; }
  const n = ghostsHeard(s);
  if (n === 0) { s.say('c4.gs.soren.hint'); return; }
  if (n < GHOSTS.length) { s.say(s.t('c4.gs.soren.progress').replace('{n}', String(n))); return; }
  s.say('c4.gs.soren.done');
  s.setFlag('gsReward', true);
  s.giveItem('duskstone'); s.giveItem('reapercloth'); s.giveItem('poembook'); s.me('me_item');
  s.say('c4.gs.got');
  s.checkpoint();
};

/** First visit: Søren, and a dim Litwick that bolts for the storm drain. */
function* meetSoren(s: ScriptApi): Step {
  s.setFlag('metSoren', true);
  s.say('c4.as.arrive');
  const so = s.npc('sorenscene');
  const [sx, sy] = s.freeSpotNear(s.player.x, s.player.y);
  so.place(sx, sy, 'down'); so.show(); so.facePlayer(); s.player.faceTo(sx, sy);
  s.say('c4.soren.1'); s.say('c4.soren.2'); s.say('c4.soren.3'); s.say('c4.soren.4');
  const lw = s.npc('litwickscene');
  const [lx, ly] = s.freeSpotNear(sx, sy);
  lw.place(lx, ly, 'right'); lw.show(); lw.exclaim();
  s.cry('litwick');
  s.say('c4.soren.litwick');
  lw.walk('right', 2); lw.hide();
  so.facePlayer();
  s.say('c4.soren.5'); s.say('c4.soren.6');
  so.hide();
  s.checkpoint();
}

/** Back from the drain: the Litwick go home to the lanterns, and the Lantern Walk opens. */
function* lanternsRelit(s: ScriptApi): Step {
  s.setFlag('lanternsLit', true);
  s.fade(1, 20); s.setTime('night'); s.fade(0, 20);
  s.say('c4.relit.1');
  const so = s.npc('sorenscene');
  const [sx, sy] = s.freeSpotNear(s.player.x, s.player.y);
  so.place(sx, sy, 'down'); so.show(); so.facePlayer(); s.player.faceTo(sx, sy);
  s.say('c4.relit.2'); s.say('c4.relit.3'); s.say('c4.relit.4'); s.say('c4.relit.5');
  so.hide();
  s.checkpoint();
}

/** The Lantern Walk gate: chained until the lanterns are lit, and only open at night. */
export const lanternGate: Script = function* (s) {
  if (!s.flag('lanternsLit')) { s.say('c4.walk.locked'); return false; }
  if (s.period === 'night') return true;
  s.say('c4.walk.night');
  const c: number = yield s.ask('c4.walk.wait', ['Wait', 'Not now'], 1);
  if (c !== 0) return false;
  s.fade(1, 20); s.setTime('night'); s.fade(0, 20);
  s.say('c4.walk.waited');
  return true;
};

const grate: Script = function* (s) {
  s.say('c4.grate');
  if (!s.flag('metSoren')) return;
  const c: number = yield s.ask('c4.grate.ask', ['Climb down', 'Not now'], 1);
  if (c !== 0) return;
  s.sfx('door');
  s.warp('stormdrain', 2, 1, 'right');
};

const ASSISTENS: MapScripts = {
  onEnter: function* (s) {
    if (!s.flag('ch4')) return;
    if (!s.flag('metSoren')) yield* meetSoren(s);
    else if (s.flag('litwickBack') && !s.flag('lanternsLit')) yield* lanternsRelit(s);
  },
  npcs: [
    ...GRAVES.filter(([x, y]) => !GHOSTS.some(g => g.x === x && g.y === y))
      .map(([x, y]) => sign(`grave${x}.${y}`, x, y, 'obj:grave', 'c4.grave')),
    ...GHOSTS.map((g, i): NpcDef => ({ id: g.id, sprite: 'obj:ghostgrave', x: g.x, y: g.y, dir: 'down', object: true, talk: ghostGrave(i) })),
    ...LANTERNS.flatMap(([x, y]): NpcDef[] => [
      { id: `lantern${x}.${y}`, sprite: 'obj:lanternout', x, y, dir: 'down', object: true, when: f => !f('lanternsLit'), talk: talk('c4.lantern.out') },
      { id: `lanternlit${x}.${y}`, sprite: 'obj:lantern', x, y, dir: 'down', object: true, when: f => !!f('lanternsLit'), talk: talk('c4.lantern.lit') }
    ]),
    { id: 'soren', sprite: 'chars/soren', x: 19, y: 11, dir: 'left', when: f => !!f('metSoren'), talk: sorenAssistens },
    { id: 'sorenscene', sprite: 'chars/soren', x: 19, y: 11, dir: 'down', hidden: true },
    { id: 'litwickscene', sprite: 'chars/litwick', x: 20, y: 12, dir: 'right', hidden: true },
    { id: 'grate', sprite: 'obj:grate', x: 24, y: 20, dir: 'down', object: true, talk: grate },
    { id: 'picnic1', sprite: 'chars/picnicker', x: 7, y: 11, dir: 'down', period: ['morning', 'day'], talk: talk('c4.as.picnic1') },
    { id: 'picnic2', sprite: 'chars/oldwoman', x: 22, y: 11, dir: 'left', period: ['morning', 'day'], talk: talk('c4.as.picnic2') },
    trainer({ id: 'asPicnic', x: 9, y: 13, dir: 'up', sprite: 'chars/picnicker', sight: 2, cls: 'Picnicker', name: 'Lærke', period: ['morning', 'day', 'evening'],
      foes: [{ species: 'cutiefly', level: 23 }, { species: 'skwovet', level: 23 }, { species: 'smoliv', level: 24 }],
      intro: ['c4.as.picnic.intro'], lose: ['c4.as.picnic.lose'] }),
    trainer({ id: 'asGhost1', x: 5, y: 11, dir: 'right', sprite: 'chars/channeler', sight: 3, cls: 'Ghost Hunter', name: 'Malthe', period: ['night'],
      foes: [{ species: 'greavard', level: 24 }, { species: 'gastly', level: 25 }], intro: ['c4.as.ghost1.intro'], lose: ['c4.as.ghost1.lose'] }),
    trainer({ id: 'asGhost2', x: 21, y: 21, dir: 'left', sprite: 'chars/channeler', sight: 6, cls: 'Ghost Hunter', name: 'Vigga', period: ['night'],
      foes: [{ species: 'misdreavus', level: 25 }, { species: 'litwick', level: 25 }], intro: ['c4.as.ghost2.intro'], lose: ['c4.as.ghost2.lose'] }),
    itemBall('item.as1', 25, 3, 'greatball', 3, 'Great Balls'),
    itemBall('item.as2', 2, 16, 'superpotion', 2, 'Super Potions')
  ]
};

// ---------- The storm drain ----------

const LITWICK_HUDDLE: [number, number][] = [[8, 14], [7, 15], [11, 15], [13, 15]];

const lampent: Script = function* (s) {
  s.say('c4.sd.huddle');
  s.sfx('exclaim');
  s.say('c4.sd.lampent');
  const r = yield s.battle({ kind: 'wild', foes: [{ species: 'lampent', level: 27, moves: ['hex', 'willowisp', 'firespin', 'astonish'] }], bg: 'indoor1' });
  if (r === 'lose' || r === 'run') return;
  s.setFlag('litwickBack', true);
  s.say('c4.sd.after.1'); s.say('c4.sd.after.2');
  s.checkpoint();
};

const backUp = (x: number, y: number, dir: Dir): Script => function* (s) {
  s.sfx('door');
  s.warp('assistens', x, y, dir);
};

const STORMDRAIN: MapScripts = {
  onEnter: function* (s) {
    if (s.flag('sdArrive')) return;
    s.setFlag('sdArrive', true);
    s.say('c4.sd.arrive');
  },
  npcs: [
    { id: 'sdladder', sprite: 'obj:ladder', x: 1, y: 1, dir: 'down', object: true, talk: function* (s) {
      s.say('c4.sd.ladder');
      const c: number = yield s.ask('Climb back up?', ['Climb up', 'Stay'], 1);
      if (c === 0) yield* backUp(24, 19, 'up')(s);
    } },
    trainer({ id: 'sdEng1', x: 12, y: 2, dir: 'left', sprite: 'chars/engineer', sight: 4, cls: 'Engineer', name: 'Henrik',
      foes: [{ species: 'magnemite', level: 24 }, { species: 'klink', level: 24 }, { species: 'voltorb', level: 25 }],
      intro: ['c4.sd.eng1.intro'], lose: ['c4.sd.eng1.lose'] }),
    trainer({ id: 'sdEng2', x: 20, y: 9, dir: 'left', sprite: 'chars/engineer', sight: 1, cls: 'Engineer', name: 'Pia',
      foes: [{ species: 'tadbulb', level: 25 }, { species: 'rolycoly', level: 25 }], intro: ['c4.sd.eng2.intro'], lose: ['c4.sd.eng2.lose'] }),
    { id: 'sdpipe1', sprite: 'obj:pipe', x: 14, y: 14, dir: 'down', object: true, talk: talk('c4.sd.pipe', 'c4.sd.pipe.2') },
    { id: 'sdpipe2', sprite: 'obj:pipe', x: 15, y: 14, dir: 'down', object: true, talk: talk('c4.sd.pipe', 'c4.sd.pipe.2') },
    { id: 'lampent', sprite: 'chars/lampent', x: 12, y: 15, dir: 'left', when: f => !f('litwickBack'), talk: lampent },
    ...LITWICK_HUDDLE.map(([x, y], i): NpcDef => ({ id: `huddle${i}`, sprite: 'chars/litwick', x, y, dir: 'down', when: f => !f('litwickBack'),
      talk: talk('The Litwick is shivering. Its flame is barely a spark.') })),
    { id: 'sdup', sprite: 'obj:ladder', x: 15, y: 15, dir: 'down', object: true, when: f => !!f('litwickBack'), talk: function* (s) {
      s.say('c4.sd.up');
      yield* backUp(24, 19, 'up')(s);
    } },
    itemBall('item.sd1', 20, 12, 'revive', 1, 'a Revive'),
    itemBall('item.sd2', 6, 15, 'fullheal', 2, 'Full Heals')
  ],
  events: [{ x: 18, y: 6, on: 'step', when: f => !f('sdIce'), run: function* (s) { s.setFlag('sdIce', true); s.say('c4.sd.ice'); } }]
};

// ---------- Gym 4: the Lantern Walk ----------

/** The true gap in each hedge, bottom to top: west, east, straight on. */
const GATES = [{ y: 12, ok: 2 }, { y: 8, ok: 12 }, { y: 4, ok: 7 }];

const gust: Script = function* (s) {
  s.sfx('flee');
  s.say('c4.gust');
  s.fade(1, 16);
  s.warp('gym4', 7, 18, 'up');
  s.fade(0, 16);
  s.say('c4.gust.back');
};

const sorenGym: Script = function* (s) {
  if (s.flag('champion')) { yield* rematch(s, 'soren'); return; }
  if (s.flag('lantern')) { s.say('c4.soren.after'); return; }
  s.say('c4.soren.gym.1'); s.say('c4.soren.gym.2'); s.say('c4.soren.gym.3');
  const c: number = yield s.ask('Søren: Shall we?', ['Yes', 'Not yet'], 1);
  if (c !== 0) return;
  const r = yield s.battle({ kind: 'trainer', leader: true, ai: 3, bg: 'field', trainer: { name: 'Søren', title: 'Leader', sprite: 'tr/soren' }, foes: [
    { species: 'greavard', level: 26, moves: ['bite', 'roar', 'dig', 'lick'] },
    { species: 'sinistea', level: 26, moves: ['megadrain', 'protect', 'suckerpunch', 'astonish'] },
    { species: 'phantump', level: 27, moves: ['hex', 'leechseed', 'confuseray', 'branchpoke'] },
    { species: 'lampent', level: 29, moves: ['hex', 'willowisp', 'firespin', 'confuseray'], item: 'sitrusberry' }
  ] });
  if (r !== 'win') { s.say('c4.soren.win'); return; }
  s.say('c4.soren.lose');
  s.setFlag('lantern', true);
  s.giveBadge('lantern', 'Lantern Badge');
  s.me('me_badge');
  s.say('c4.got.badge');
  s.say('c4.soren.tm');
  s.giveItem('tmhex'); s.me('me_item');
  s.say(`${s.player.name} got TM Hex!`);
  s.say('c4.soren.verse.1'); s.say('c4.soren.verse.2');
  s.giveItem('firstverse'); s.me('me_item');
  s.say('c4.got.verse'); s.say('c4.verse'); s.say('c4.soren.verse.3');
  // The hook: a tremor, and the news from Rundetårn.
  s.wait(20);
  for (let i = 0; i < 3; i++) { s.sfx('hit'); s.fade(0.5, 3); s.fade(0, 3); }
  s.say('c4.tremor.1'); s.say('c4.tremor.2'); s.say('c4.tremor.3');
  s.setFlag('ch4done', true);
  s.checkpoint();
  s.chapterEnd('Chapter 4 complete', 'Lanterns Out');
  s.say('c4.end');
};

const GYM4: MapScripts = {
  npcs: [
    { id: 'andersen', sprite: 'obj:andersen', x: 7, y: 1, dir: 'down', object: true, talk: function* (s) {
      s.say('HANS CHRISTIAN ANDERSEN · 1805–1875');
      if (s.flag('lantern')) s.say('c4.verse');
    } },
    { id: 'soreng', sprite: 'chars/soren', x: 7, y: 2, dir: 'down', talk: sorenGym },
    sign('g4sign', 5, 18, 'obj:sign', 'c4.gym.sign'),
    { id: 'g4guide', sprite: 'chars/oldman', x: 9, y: 17, dir: 'left', talk: function* (s) {
      if (s.flag('lantern')) { s.say('Gym guide: The lanterns burn brighter tonight.\nYou did that.'); return; }
      s.say('c4.gym.guide'); s.say('c4.gym.guide.2');
    } },
    sign('rhyme1', 8, 14, 'obj:monument', 'c4.rhyme.1', 'c4.rhyme.1b'),
    sign('rhyme2', 3, 10, 'obj:monument', 'c4.rhyme.2', 'c4.rhyme.2b'),
    sign('rhyme3', 11, 6, 'obj:monument', 'c4.rhyme.3', 'c4.rhyme.3b'),
    trainer({ id: 'g4medium1', x: 7, y: 10, dir: 'up', sprite: 'chars/channeler', sight: 2, cls: 'Medium', name: 'Edith',
      foes: [{ species: 'gastly', level: 25 }, { species: 'phantump', level: 25 }],
      intro: ['c4.gym.medium1.intro'], lose: ['c4.gym.medium1.lose'] }),
    trainer({ id: 'g4medium2', x: 2, y: 6, dir: 'up', sprite: 'chars/channeler', sight: 2, cls: 'Medium', name: 'Holger',
      foes: [{ species: 'misdreavus', level: 26 }, { species: 'greavard', level: 26 }],
      intro: ['c4.gym.medium2.intro'], lose: ['c4.gym.medium2.lose'] })
  ],
  events: GATES.flatMap(g => [2, 7, 12].filter(x => x !== g.ok)
    .map((x): MapEvent => ({ x, y: g.y, on: 'step', when: f => !f('lantern'), run: gust })))
};

// ---------- Side quest: Kanelsnegl Morning (Vesterbro bakery, before 8) ----------

/** Red letterboxes on the dawn round: two each in Vesterbro, Kødbyen and Nørrebro. */
export const MAILBOXES: { map: string; id: string; x: number; y: number }[] = [
  { map: 'vesterbro', id: 'mb1', x: 10, y: 8 }, { map: 'vesterbro', id: 'mb2', x: 21, y: 8 },
  { map: 'kodbyen', id: 'mb3', x: 11, y: 5 }, { map: 'kodbyen', id: 'mb4', x: 24, y: 8 },
  { map: 'norrebro', id: 'mb5', x: 8, y: 7 }, { map: 'norrebro', id: 'mb6', x: 19, y: 7 }
];
const delivered = (s: ScriptApi) => MAILBOXES.filter(m => s.flag(m.id)).length;

const mailbox = (id: string): Script => function* (s) {
  if (!s.flag('kanelQuest') || s.flag('kanelDone')) { s.say('c4.mb'); return; }
  if (s.flag(id)) { s.say('c4.mb.done'); return; }
  if (s.period !== 'morning') { s.say('c4.mb.late'); return; }
  s.takeItem('kanelsnegl');
  s.setFlag(id, true);
  s.sfx('select');
  s.say('c4.mb.put');
  if (delivered(s) === MAILBOXES.length) s.say('c4.mb.last');
};

export const mailboxNpc = (m: { id: string; x: number; y: number }): NpcDef =>
  ({ id: m.id, sprite: 'obj:mailbox', x: m.x, y: m.y, dir: 'down', object: true, talk: mailbox(m.id) });

const baker: Script = function* (s) {
  if (s.flag('kanelDone')) { s.say('c4.bk.after'); return; }
  if (s.flag('kanelQuest')) {
    const n = delivered(s);
    if (n < MAILBOXES.length) { s.say(s.t('c4.bk.progress').replace('{n}', String(n))); return; }
    s.say('c4.bk.done.1'); s.say('c4.bk.done.2');
    s.setFlag('kanelDone', true);
    s.giveEgg('fidough'); s.giveItem('expcandym'); s.me('me_item');
    s.say('c4.bk.got.egg');
    s.checkpoint();
    return;
  }
  if (!s.flag('ch4')) { s.say('c4.bk.closed'); return; }
  s.say('c4.bk.1'); s.say('c4.bk.2');
  const c: number = yield s.ask('c4.bk.ask', ['Yes', 'Not now'], 1);
  if (c !== 0) return;
  if (s.period !== 'morning') {
    s.say('c4.bk.late');
    const w: number = yield s.ask('c4.bk.wait', ['Wait', 'Not now'], 1);
    if (w !== 0) return;
    s.fade(1, 20); s.setTime('morning'); s.fade(0, 20);
    s.say('c4.bk.waited');
  }
  s.setFlag('kanelQuest', true);
  s.giveItem('kanelsnegl', MAILBOXES.length); s.me('me_item');
  s.say('c4.bk.got'); s.say('c4.bk.go');
  s.checkpoint();
};

const BAKERY: MapScripts = {
  npcs: [
    { id: 'birthe', sprite: 'chars/baker', x: 5, y: 1, dir: 'down', talk: baker },
    { id: 'bkcustomer', sprite: 'chars/student', x: 2, y: 4, dir: 'right', talk: talk('Student: Day-old kanelsnegle are half price.\nBreakfast of champions.') },
    sign('oven', 9, 2, 'obj:stove', 'The bread oven. It\'s been on since four.')
  ]
};

export const ASSISTENS_SCRIPTS: Record<string, MapScripts> = {
  assistens: ASSISTENS, stormdrain: STORMDRAIN, gym4: GYM4, bakery: BAKERY
};
