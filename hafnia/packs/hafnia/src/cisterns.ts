// Chapter 5, The Cisterns: after the tremor, Ørsted takes all three of you under Søndermarken
// to the old royal reservoir. A mirror pool shows the false wall, two sluice wheels lower the water,
// Brix's survey drones are scanning the walls, and the Sunken Archive holds Andersen's ledgers and
// Ørsted's confession. Lukas storms off and battles you at the pyramid. Side quest: the Zoo Night Shift.
import type { NpcDef, Script, ScriptApi } from '@hafnia/core';
import { centerNpcs } from './home';
import { grown, itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';
import { lukasStarter, majaStarter } from './starters';

// ---------- The chapter starts ----------

/** Runs on arrival in Assistens, Nørrebro or Den Grønne Sti once the Lantern Badge is won. */
export function* ch5Start(s: ScriptApi): Step {
  if (!s.flag('ch4done') || s.flag('ch5')) return;
  s.setFlag('ch5', true);
  s.chapterEnd('Chapter 5', 'The Cisterns');
  s.sfx('select');
  s.say('c5.start.1'); s.say('c5.start.2'); s.say('c5.start.3');
  s.checkpoint();
}

/** The overpass stairs up from Den Grønne Sti open with Chapter 5. */
export const frederiksbergGate: Script = function* (s) {
  if (s.flag('ch5')) return true;
  s.say('c5.gate.early');
  return false;
};

// ---------- Frederiksberg ----------

/** Puts a hidden scene NPC next to the player, facing them. */
function cast(s: ScriptApi, id: string, nearX = s.player.x, nearY = s.player.y) {
  const n = s.npc(id);
  const [x, y] = s.freeSpotNear(nearX, nearY);
  n.place(x, y, 'down'); n.show(); n.facePlayer();
  return { n, x, y };
}

function* briefing(s: ScriptApi): Step {
  s.setFlag('ch5met', true);
  s.say('c5.fb.arrive');
  const o = cast(s, 'orsted5');
  s.player.faceTo(o.x, o.y);
  s.say('c5.brief.1'); s.say('c5.brief.2');
  const l = cast(s, 'lukas5', o.x, o.y);
  const m = cast(s, 'maja5', o.x, o.y);
  s.say('c5.brief.lukas.1'); s.say('c5.brief.maja.1');
  s.say('c5.brief.3'); s.say('c5.brief.4');
  s.say('c5.brief.lukas.2'); s.say('c5.brief.maja.2');
  s.say('c5.brief.5');
  m.n.walk('right', 3); m.n.hide();
  l.n.hide(); o.n.hide();
  s.say('c5.brief.6');
  s.checkpoint();
}

/** Out of the Cisterns: Lukas is waiting at the pyramid, and he wants to win this one. */
function* lukasAtExit(s: ScriptApi): Step {
  const l = cast(s, 'lukas5');
  s.player.faceTo(l.x, l.y);
  s.say('c5.lukas.1'); s.say('c5.lukas.2'); s.say('c5.lukas.3');
  // Straight out of a long dungeon: he wants a fair fight, so he patches your team up first.
  s.say('Lukas: ...You look like the Cisterns chewed you up.\nHere. I\'m not beating you on a technicality.');
  s.heal(); s.me('me_heal');
  const r = yield s.battle({ kind: 'trainer', soft: true, ai: 2, bg: 'field', trainer: { name: 'Lukas', title: 'Rival', sprite: 'tr/lukas' }, foes: [
    { species: 'magneton', level: 28, moves: ['thunderbolt', 'flashcannon', 'thunderwave', 'triattack'] },
    { species: 'porygon2', level: 29, moves: ['triattack', 'psybeam', 'recover', 'agility'] },
    { species: 'rotom', level: 29, moves: ['discharge', 'hex', 'thunderwave', 'confuseray'] },
    { species: grown(lukasStarter(s), 30), level: 30 }
  ] });
  s.say(r === 'win' ? 'c5.lukas.lose' : 'c5.lukas.win');
  s.say('c5.lukas.4');
  l.n.walk('down', 4); l.n.hide();
  s.setFlag('lukas5', true);
  s.heal();
  const o = cast(s, 'orsted5');
  const m = cast(s, 'maja5', o.x, o.y);
  s.player.faceTo(o.x, o.y);
  s.say('c5.after.maja.1'); s.say('c5.after.orsted.1'); s.say('c5.after.maja.2'); s.say('c5.after.orsted.2');
  m.n.hide(); o.n.hide();
  s.wait(20);
  s.sfx('select');
  s.say('c5.hook.1'); s.say('c5.hook.2');
  s.setFlag('ch5done', true);
  s.checkpoint();
  s.chapterEnd('Chapter 5 complete', 'The Cisterns');
  s.say('c5.end');
}

// The Zoo Night Shift: three escapees wander Frederiksberg after dark.
const ESCAPEES = [
  { id: 'zoo1', species: 'phanpy', x: 24, y: 20, line: 'c5.zoo.phanpy' },
  { id: 'zoo2', species: 'pancham', x: 5, y: 4, line: 'c5.zoo.pancham' },
  { id: 'zoo3', species: 'skiddo', x: 19, y: 12, line: 'c5.zoo.skiddo' }
];
const found = (s: ScriptApi) => ESCAPEES.filter(e => s.flag(e.id)).length;

const keeper: Script = function* (s) {
  if (s.flag('zooDone')) { s.say('c5.zoo.after'); return; }
  if (!s.flag('ch5')) { s.say('c5.zoo.closed'); return; }
  if (s.flag('zooQuest')) {
    const n = found(s);
    if (n < ESCAPEES.length) { s.say(s.t('c5.zoo.progress').replace('{n}', String(n))); return; }
    s.say('c5.zoo.done.1'); s.say('c5.zoo.done.2');
    s.setFlag('zooDone', true);
    s.giveEgg('phanpy'); s.giveItem('ultraball', 3); s.me('me_item');
    s.say('c5.zoo.got');
    s.checkpoint();
    return;
  }
  s.say('c5.zoo.1'); s.say('c5.zoo.2');
  const c: number = yield s.ask('c5.zoo.ask', ['Yes', 'Not now'], 1);
  if (c !== 0) return;
  if (s.period !== 'night') {
    const w: number = yield s.ask('c5.zoo.wait', ['Wait', 'Not now'], 1);
    if (w !== 0) return;
    s.fade(1, 20); s.setTime('night'); s.fade(0, 20);
  }
  s.setFlag('zooQuest', true);
  s.say('c5.zoo.go');
  s.checkpoint();
};

const escapee = (i: number): NpcDef => {
  const e = ESCAPEES[i];
  return {
    id: e.id, sprite: `chars/${e.species}`, x: e.x, y: e.y, dir: 'down', period: ['night'], when: f => !!f('zooQuest') && !f(e.id),
    talk: function* (s) {
      s.cry(e.species);
      s.say(e.line);
      s.setFlag(e.id, true);
      s.sfx('select');
      s.say('c5.zoo.back');
      if (found(s) === ESCAPEES.length) s.say('c5.zoo.all');
    }
  };
};

const FREDERIKSBERG: MapScripts = {
  onEnter: function* (s) {
    if (!s.flag('ch5')) return;
    if (!s.flag('ch5met')) yield* briefing(s);
    else if (s.flag('archiveDone') && !s.flag('lukas5')) yield* lukasAtExit(s);
  },
  doors: {
    cisterns: function* (s) {
      if (!s.flag('ch5met')) { s.say('c5.pyramid.locked'); return; }
      s.sfx('door');
      s.warp('cisterns', 2, 1, 'right');
    },
    pc: function* (s) { s.warp('pcfrederiksberg', 6, 5, 'up'); }
  },
  npcs: [
    { id: 'orsted5', sprite: 'chars/prof', x: 13, y: 20, dir: 'down', hidden: true },
    { id: 'lukas5', sprite: 'chars/lukas', x: 14, y: 20, dir: 'down', hidden: true },
    { id: 'maja5', sprite: 'chars/maja', x: 12, y: 20, dir: 'down', hidden: true },
    sign('fbsign', 15, 21, 'obj:sign', 'c5.fb.sign'),
    sign('palacesign', 12, 7, 'obj:sign', 'c5.fb.palace'),
    sign('pyramidsign', 19, 15, 'obj:sign', 'c5.fb.pyramid'),
    sign('zoosign', 11, 18, 'obj:sign', 'c5.fb.zoo'),
    { id: 'surveyor', sprite: 'chars/scientist', x: 23, y: 15, dir: 'left', when: f => !f('ch5done'), talk: talk('c5.fb.surveyor') },
    { id: 'fbbench', sprite: 'chars/oldman', x: 16, y: 12, dir: 'down', talk: talk('c5.fb.oldman', 'c5.fb.oldman.2') },
    { id: 'zookeeper', sprite: 'chars/ranger', x: 11, y: 16, dir: 'left', talk: keeper },
    ...ESCAPEES.map((_, i) => escapee(i)),
    trainer({ id: 'fbcadet1', x: 10, y: 14, dir: 'left', sprite: 'chars/guard', sight: 5, cls: 'Cadet', name: 'Oskar',
      foes: [{ species: 'pawmo', level: 26 }, { species: 'staravia', level: 26 }], intro: ['c5.fb.cadet1.intro'], lose: ['c5.fb.cadet1.lose'] }),
    trainer({ id: 'fbcadet2', x: 17, y: 7, dir: 'down', sprite: 'chars/guard', sight: 3, cls: 'Cadet', name: 'Liva',
      foes: [{ species: 'machop', level: 26 }, { species: 'murkrow', level: 26 }, { species: 'pawmo', level: 27 }],
      intro: ['c5.fb.cadet2.intro'], lose: ['c5.fb.cadet2.lose'] }),
    trainer({ id: 'fbjogger', x: 25, y: 15, dir: 'left', sprite: 'chars/jogger', sight: 4, cls: 'Jogger', name: 'Mikkel',
      foes: [{ species: 'deerling', level: 26 }, { species: 'fletchinder', level: 27 }], intro: ['c5.fb.jogger.intro'], lose: ['c5.fb.jogger.lose'] }),
    trainer({ id: 'fbpicnic', x: 21, y: 17, dir: 'up', sprite: 'chars/picnicker', sight: 2, cls: 'Picnicker', name: 'Sofie', period: ['morning', 'day'],
      foes: [{ species: 'dolliv', level: 26 }, { species: 'skwovet', level: 25 }, { species: 'hoppip', level: 25 }],
      intro: ['c5.fb.picnic.intro'], lose: ['c5.fb.picnic.lose'] }),
    itemBall('item.fb1', 25, 3, 'ultraball', 2, 'Ultra Balls'),
    itemBall('item.fb2', 2, 12, 'hyperpotion', 1, 'a Hyper Potion')
  ]
};

// ---------- The Cisterns ----------

/** Water level: 0 at first; each sluice wheel lowers it one step and a causeway surfaces. */
const level = (f: (n: string) => any) => (f('cisLevel') as number) ?? 0;
const CAUSEWAY_A: [number, number][] = Array.from({ length: 14 }, (_, i): [number, number] => [15 + i, 2]);
const CAUSEWAY_B: [number, number][] = [
  ...Array.from({ length: 7 }, (_, i): [number, number] => [26, 3 + i]),
  ...Array.from({ length: 5 }, (_, i): [number, number] => [21 + i, 9]),
  [21, 10]
];
const SWARM: [number, number][] = [[12, 16], [13, 15], [13, 17]];

function* arrival(s: ScriptApi): Step {
  s.setFlag('cisArrive', true);
  s.say('c5.cis.arrive');
  const o = cast(s, 'orsted5c');
  const l = cast(s, 'lukas5c', o.x, o.y);
  s.player.faceTo(o.x, o.y);
  s.say('c5.cis.1'); s.say('c5.cis.2'); s.say('c5.cis.lukas'); s.say('c5.cis.3'); s.say('c5.cis.4');
  o.n.hide(); l.n.hide();
  s.checkpoint();
}

const mirrorPool: Script = function* (s) {
  if (s.flag('cisMirror')) { s.say('c5.pool.after'); return; }
  s.say('c5.pool.1'); s.say('c5.pool.2');
  const sb = cast(s, 'sableye');
  s.sfx('exclaim'); sb.n.exclaim();
  s.cry('sableye');
  s.say('c5.pool.sableye');
  const r = yield s.battle({ kind: 'wild', bg: 'indoor1', foes: [{ species: 'sableye', level: 28, moves: ['shadowclaw', 'fakeout', 'knockoff', 'confuseray'] }] });
  sb.n.hide();
  if (r === 'lose' || r === 'run') return;
  s.setFlag('cisMirror', true);
  s.say('c5.pool.3');
  s.checkpoint();
};

const wheel = (step: 1 | 2): Script => function* (s) {
  const now = level(s.flag.bind(s));
  if (now >= step) { s.say('c5.wheel.done'); return; }
  if (now < step - 1) { s.say('c5.wheel.stuck'); return; }
  s.say('c5.wheel');
  const c: number = yield s.ask('c5.wheel.ask', ['Turn it', 'Leave it'], 1);
  if (c !== 0) return;
  s.sfx('shake'); s.wait(10); s.sfx('shake');
  s.fade(0.6, 10); s.fade(0, 10);
  s.setFlag('cisLevel', step);
  s.say(step === 1 ? 'c5.wheel.1' : 'c5.wheel.2');
  s.checkpoint();
};

function* swarmScene(s: ScriptApi): Step {
  s.sfx('exclaim');
  s.say('c5.swarm.1'); s.say('c5.swarm.2');
  const m = cast(s, 'maja5c');
  s.player.faceTo(m.x, m.y);
  s.say('c5.swarm.maja.1'); s.say('c5.swarm.maja.2');
  const r = yield s.battle({
    kind: 'trainer', bg: 'indoor1', prize: 0, trainer: { name: 'VG-01', title: 'Survey Drone', sprite: 'tr/scientist' },
    foes: [{ species: 'magnemite', level: 28 }, { species: 'magneton', level: 29 }],
    multi: {
      partner: { name: 'Maja', sprite: 'tr/maja', foes: [{ species: 'kilowattrel', level: 28 }, { species: grown(majaStarter(s), 29), level: 29 }] },
      second: { name: 'VG-02', title: 'Survey Drone', sprite: 'tr/scientist', foes: [{ species: 'bronzor', level: 28 }, { species: 'rotom', level: 30, moves: ['discharge', 'hex', 'thunderwave', 'confuseray'] }] }
    }
  });
  if (r !== 'win') { m.n.hide(); return; }
  s.setFlag('swarmDone', true);
  s.say('c5.swarm.3');
  s.say('c5.swarm.maja.3'); s.say('c5.swarm.maja.4');
  m.n.hide();
  s.checkpoint();
}

function* archiveScene(s: ScriptApi): Step {
  s.setFlag('archiveDone', true);
  s.say('c5.ar.arrive');
  const m = cast(s, 'maja5c');
  const o = cast(s, 'orsted5c', m.x, m.y);
  const l = cast(s, 'lukas5c', o.x, o.y);
  s.player.faceTo(o.x, o.y);
  s.say('c5.ar.1'); s.say('c5.ar.maja.1');
  s.say('c5.ar.ledger.1'); s.say('c5.ar.ledger.2'); s.say('c5.ar.ledger.3'); s.say('c5.ar.ledger.4');
  s.say('c5.ar.maja.2');
  s.say('c5.ar.schematic.1'); s.say('c5.ar.schematic.2');
  s.say('c5.ar.orsted.1');
  s.wait(30);
  s.say('c5.ar.confess.1'); s.say('c5.ar.confess.2'); s.say('c5.ar.confess.3');
  s.say('c5.ar.lukas.1'); s.say('c5.ar.lukas.2'); s.say('c5.ar.lukas.3');
  l.n.walk('right', 3); l.n.hide();
  s.say('c5.ar.maja.3'); s.say('c5.ar.maja.4');
  s.say('c5.ar.orsted.2');
  s.giveItem('ledgercopy'); s.me('me_item');
  s.say('c5.ar.got');
  s.say('c5.ar.orsted.3');
  m.n.hide(); o.n.hide();
  s.checkpoint();
}

const LEDGERS: [number, number, string][] = [[3, 15, 'c5.ledger.1'], [6, 15, 'c5.ledger.2'], [9, 15, 'c5.ledger.3']];

const CISTERNS: MapScripts = {
  onEnter: function* (s) { if (!s.flag('cisArrive')) yield* arrival(s); },
  npcs: [
    { id: 'cisup', sprite: 'obj:stairs', x: 1, y: 1, dir: 'down', object: true, talk: function* (s) {
      const c: number = yield s.ask('c5.cis.up', ['Climb up', 'Stay'], 1);
      if (c === 0) { s.sfx('door'); s.warp('frederiksberg', 21, 15, 'down'); }
    } },
    { id: 'orsted5c', sprite: 'chars/prof', x: 3, y: 1, dir: 'down', hidden: true },
    { id: 'lukas5c', sprite: 'chars/lukas', x: 4, y: 1, dir: 'down', hidden: true },
    { id: 'maja5c', sprite: 'chars/maja', x: 5, y: 1, dir: 'down', hidden: true },
    { id: 'sableye', sprite: 'chars/sableye', x: 11, y: 5, dir: 'left', hidden: true },
    { id: 'pool', sprite: 'obj:mirrorpool', x: 6, y: 5, dir: 'down', object: true, talk: mirrorPool },
    { id: 'fakewall', sprite: 'obj:fakewall', x: 12, y: 5, dir: 'down', object: true, when: f => !f('cisMirror'), talk: talk('c5.wall') },
    { id: 'wheel1', sprite: 'obj:wheel', x: 13, y: 1, dir: 'down', object: true, talk: wheel(1) },
    { id: 'wheel2', sprite: 'obj:wheel', x: 28, y: 1, dir: 'down', object: true, talk: wheel(2) },
    ...CAUSEWAY_A.map(([x, y]): NpcDef => ({ id: `floodA${x}`, sprite: 'obj:flood', x, y, dir: 'down', object: true, when: f => level(f) < 1, talk: talk('c5.flood') })),
    ...CAUSEWAY_B.map(([x, y]): NpcDef => ({ id: `floodB${x}.${y}`, sprite: 'obj:flood', x, y, dir: 'down', object: true, when: f => level(f) < 2, talk: talk('c5.flood') })),
    ...SWARM.map(([x, y], i): NpcDef => ({ id: `swarm${i}`, sprite: 'obj:drone', x, y, dir: 'down', object: true, when: f => !f('swarmDone'), talk: talk('c5.swarm.idle') })),
    trainer({ id: 'cisExplorer', x: 11, y: 8, dir: 'up', sprite: 'chars/ranger', sight: 3, cls: 'Explorer', name: 'Bjørk',
      foes: [{ species: 'golbat', level: 27 }, { species: 'wooper', level: 26 }], intro: ['c5.cis.explorer.intro'], lose: ['c5.cis.explorer.lose'] }),
    trainer({ id: 'cisDrone1', x: 27, y: 12, dir: 'left', sprite: 'obj:drone', sight: 6, cls: 'Survey Drone', name: 'VG-07',
      foes: [{ species: 'magnemite', level: 27 }, { species: 'voltorb', level: 27 }], intro: ['c5.drone.intro'], lose: ['c5.drone.lose'] }),
    trainer({ id: 'cisDrone2', x: 17, y: 16, dir: 'left', sprite: 'obj:drone', sight: 3, cls: 'Survey Drone', name: 'VG-11',
      foes: [{ species: 'klink', level: 27 }, { species: 'bronzor', level: 27 }, { species: 'magnemite', level: 28 }], intro: ['c5.drone.intro'], lose: ['c5.drone.lose'] }),
    ...LEDGERS.map(([x, y, line], i): NpcDef => sign(`ledger${i}`, x, y, 'obj:lectern', line)),
    sign('schematic', 6, 18, 'obj:schematic', 'c5.ar.schematic.1', 'c5.ar.schematic.2'),
    { id: 'cisexit', sprite: 'obj:stairs', x: 1, y: 20, dir: 'down', object: true, talk: function* (s) {
      s.say('c5.ar.exit');
      s.sfx('door');
      s.warp('frederiksberg', 21, 15, 'down');
    } },
    itemBall('item.cis1', 11, 1, 'thunderstone', 1, 'a Thunder Stone'),
    itemBall('item.cis2', 1, 9, 'revive', 1, 'a Revive'),
    itemBall('item.cis3', 28, 20, 'hyperpotion', 1, 'a Hyper Potion'),
    itemBall('item.cis4', 10, 20, 'ultraball', 2, 'Ultra Balls')
  ],
  events: [
    ...Array.from({ length: 9 }, (_, i) => ({ x: 14, y: 12 + i, on: 'step' as const, when: (f: (n: string) => any) => !f('swarmDone'), run: swarmScene })),
    { x: 11, y: 16, on: 'step', when: f => !f('archiveDone'), run: archiveScene }
  ]
};

export const CISTERNS_SCRIPTS: Record<string, MapScripts> = {
  frederiksberg: FREDERIKSBERG, pcfrederiksberg: { npcs: centerNpcs('frederiksberg', 5, 14) }, cisterns: CISTERNS
};
