// South of Nørrebro: Dronning Louises Bro (bike rush and the demo finale), Route 1 along the Lakes,
// the Botanical Garden, the Palm House (starters, first rival battle, the Coil) and the Steam Tunnels.
import { speciesName, type Dir, type NpcDef, type Script, type ScriptApi } from '@hafnia/core';
import { grown, itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';
import { LUKAS_PICK, MAJA_PICK, STARTERS, lukasStarter, majaStarter } from './starters';

const BACK: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

// ---------- Dronning Louises Bro ----------

const LANES: { y: number; dir: Dir; xs: number[] }[] = [
  { y: 5, dir: 'right', xs: [4, 8, 12] }, { y: 6, dir: 'left', xs: [6, 11] },
  { y: 8, dir: 'right', xs: [5, 10, 14] }, { y: 9, dir: 'left', xs: [4, 9, 13] }
];

const bumped: Script = function* (s) {
  s.sfx('exclaim');
  s.say('p.bridge.hit');
  if (s.player.y <= 6) s.warp('bridge', 9, 3, 'down');
  else s.warp('bridge', 9, 7, 'down');
};

const riders: NpcDef[] = LANES.flatMap((l, li) => l.xs.map((x, i) => ({
  id: `rider${li}${i}`, sprite: (li + i) % 2 ? 'chars/cyclist2' : 'chars/cyclist1', x, y: l.y, dir: l.dir,
  patrol: { dir: l.dir, min: 4, max: 15 }, bump: bumped, when: (f: (n: string) => any) => !f('finale'),
  talk: talk('Commuter: Ding ding! Can\'t stop, late for work!')
})));

// 2.8: the bridge at dusk. Freja, then an angry Lukas, then the end of the demo.
function* finale(s: ScriptApi): Step {
  s.setFlag('finale', true);
  s.fade(1, 20);
  s.setTime('evening');
  s.fade(0, 30);
  s.say('c2.dusk.1');
  const fr = s.npc('freja');
  const [fx, fy] = s.freeSpotNear(s.player.x, s.player.y);
  fr.place(fx, fy, 'down'); fr.show(); fr.facePlayer(); s.player.faceTo(fx, fy);
  s.say('c2.dusk.freja.1'); s.say('c2.dusk.freja.2'); s.say('c2.dusk.freja.3');
  let r = yield s.battle({ kind: 'trainer', soft: true, prize: 0, ai: 2, bg: 'city', trainer: { name: 'Freja', title: 'Captain', sprite: 'tr/freja' }, foes: [
    { species: 'stunky', level: 17, moves: ['poisongas', 'bite', 'screech', 'feint'] },
    { species: 'carvanha', level: 18, moves: ['bite', 'aquajet', 'leer', 'rage'] },
    { species: 'qwilfishhisui', level: 19, moves: ['barbbarrage', 'watergun', 'pinmissile', 'spikes'] }
  ] });
  s.say(r === 'win' ? 'c2.freja.lose' : 'c2.freja.win');
  s.heal();
  const lu = s.npc('lukas');
  const [lx, ly] = s.freeSpotNear(s.player.x, s.player.y);
  lu.place(lx, ly, 'down'); lu.show(); lu.facePlayer();
  s.say('c2.dusk.lukas.1');
  s.say('Freja vaults the rail and is gone.');
  fr.hide();
  s.player.faceTo(lx, ly);
  s.say('c2.dusk.lukas.2'); s.say('c2.dusk.lukas.3');
  const ls = lukasStarter(s);
  r = yield s.battle({ kind: 'trainer', soft: true, ai: 2, bg: 'city', trainer: { name: 'Lukas', title: 'Rival', sprite: 'tr/lukas' }, foes: [
    { species: 'magnemite', level: 16 }, { species: 'porygon', level: 16 }, { species: grown(ls, 18), level: 18 }
  ] });
  s.say(r === 'win' ? 'c2.lukas2.lose' : 'c2.lukas2.win');
  lu.hide();
  const mj = s.npc('maja');
  const [mx, my] = s.freeSpotNear(s.player.x, s.player.y);
  mj.place(mx, my, 'down'); mj.show(); mj.facePlayer(); s.player.faceTo(mx, my);
  s.say('c2.dusk.maja.1'); s.say('c2.dusk.maja.2');
  mj.hide();
  s.say('c2.end.1');
  s.heal();
  s.setFlag('demoEnd', true);
  s.checkpoint();
  s.chapterEnd('Copper & Current', 'End of the demo. Thank you for playing!');
  s.say('c2.end.3');
}

const bridgeEnter: Script = function* (s) {
  if (s.flag('lily') && !s.flag('demoEnd')) { yield* finale(s); return; }
  if (!s.flag('bridgeTut')) { s.setFlag('bridgeTut', true); s.say('p.bridge.sign'); s.say('p.bridge.tut.1'); }
};

const BRIDGE: MapScripts = {
  onEnter: bridgeEnter,
  npcs: [
    ...riders,
    sign('bsign', 7, 2, 'obj:sign', 'p.bridge.sign'),
    sign('billboard', 12, 2, 'obj:billboard', 'p.bridge.billboard'),
    { id: 'freja', sprite: 'chars/freja', x: 0, y: 0, dir: 'down', hidden: true },
    { id: 'lukas', sprite: 'chars/lukas', x: 0, y: 0, dir: 'down', hidden: true },
    { id: 'maja', sprite: 'chars/maja', x: 0, y: 0, dir: 'down', hidden: true }
  ],
  events: [{ x: 4, y: 11, w: 12, h: 1, on: 'step', when: f => !f('bridgeDone'), run: function* (s) {
    s.setFlag('bridgeDone', true);
    s.say('p.bridge.billboard'); s.say('p.bridge.maja');
  } }]
};

// ---------- Route 1 ----------

const majaBattle: Script = function* (s) {
  s.say('p.maja.challenge');
  const r = yield s.battle({ kind: 'trainer', soft: true, ai: 1, bg: 'field', trainer: { name: 'Maja', title: 'Rival', sprite: 'tr/maja' },
    foes: [{ species: majaStarter(s), level: 6 }] });
  s.setFlag('beatMaja', true);
  s.say(r === 'win' ? 'p.maja.win' : 'p.maja.lose');
  s.heal();
  s.say('p.maja.after.1'); s.say('p.maja.after.2');
  s.say('Maja: It\'s getting dark. Go home before your mum\nsends out a search party. See you tomorrow!');
  s.npc('maja2').hide();
  s.setTime('evening');
  s.checkpoint();
};

const terminal: Script = function* (s) {
  if (s.flag('barrier')) { s.say('The terminal blinks green. "Lane open."'); return; }
  s.say('c1.terminal.1');
  if (!s.flag('coil')) { s.say('It needs a jolt of power you don\'t have yet.'); return; }
  s.say('c1.terminal.2');
  s.sfx('select');
  s.setFlag('barrier', true);
  s.npc('barrier').hide();
  s.say('The barrier lifts!');
};

const trainerWhen = (f: (n: string) => any) => !!f('starter');

const ROUTE1: MapScripts = {
  npcs: [
    sign('r1sign', 9, 2, 'obj:sign', 'p.r1.sign'),
    { id: 'mads0', sprite: 'chars/biker', x: 10, y: 19, dir: 'down', when: f => !f('starter'), talk: talk('p.r1.mads.1', 'p.r1.mads.2') },
    trainer({ id: 'mads', x: 10, y: 19, dir: 'down', sprite: 'chars/biker', sight: 5, cls: 'Cyclist', name: 'Mads', when: trainerWhen,
      foes: [{ species: 'lillipup', level: 5 }, { species: 'pidgey', level: 6 }], intro: ['r1.mads.challenge'], lose: ['r1.mads.lose'], after: ['r1.mads.after'] }),
    trainer({ id: 'emil', x: 12, y: 6, dir: 'left', sprite: 'chars/jogger', sight: 2, cls: 'Jogger', name: 'Emil', when: trainerWhen, period: ['morning'],
      foes: [{ species: 'lillipup', level: 4 }], intro: ['r1.jogger.intro'], lose: ['r1.jogger.lose'], after: ['r1.jogger.line'] }),
    trainer({ id: 'sofie', x: 15, y: 7, dir: 'left', sprite: 'chars/cyclist2', sight: 3, cls: 'Cyclist', name: 'Sofie', when: trainerWhen,
      foes: [{ species: 'pidgey', level: 4 }, { species: 'pidgey', level: 4 }], intro: ['r1.cyclist.intro'], lose: ['r1.cyclist.lose'], after: ['r1.cyclist.line'] }),
    trainer({ id: 'bent', x: 9, y: 10, dir: 'right', sprite: 'chars/fisher', sight: 1, cls: 'Fisher', name: 'Bent', when: trainerWhen,
      foes: [{ species: 'psyduck', level: 5 }], intro: ['r1.fisher.intro'], lose: ['r1.fisher.lose'], after: ['r1.fisher.line'] }),
    trainer({ id: 'ole', x: 9, y: 13, dir: 'right', sprite: 'chars/fisher', sight: 1, cls: 'Fisher', name: 'Ole', when: trainerWhen, period: ['night'],
      foes: [{ species: 'lotad', level: 6 }], intro: ['r1.n.fisher.intro'], lose: ['r1.n.fisher.lose'] }),
    trainer({ id: 'ida', x: 14, y: 20, dir: 'left', sprite: 'chars/student', sight: 2, cls: 'Student', name: 'Ida', when: trainerWhen, period: ['night'],
      foes: [{ species: 'buneary', level: 6 }], intro: ['r1.n.student.intro'], lose: ['r1.n.student.lose'] }),
    { id: 'maja2', sprite: 'chars/maja', x: 12, y: 27, dir: 'left', trainer: { sight: 3, flag: 'beatMaja' },
      when: f => !!f('beatLukas') && !f('beatMaja'), talk: majaBattle },
    { id: 'sensor', sprite: 'chars/deckhand', x: 8, y: 14, dir: 'left', talk: talk('r1.sensor') },
    { id: 'terminal', sprite: 'obj:terminal', x: 13, y: 25, dir: 'down', object: true, talk: terminal },
    { id: 'barrier', sprite: 'obj:barrier', x: 14, y: 26, dir: 'down', object: true, when: f => !f('barrier'), talk: terminal },
    itemBall('item1', 16, 12, 'potion', 2, 'Potions'),
    itemBall('item2', 3, 26, 'pokeball', 3, 'Poké Balls'),
    itemBall('item.r1pearl', 16, 26, 'pearl', 1, 'a Pearl')
  ],
  events: [{ tile: 'g', on: 'step', when: f => !f('starter'), run: function* (s) {
    s.say('p.r1.grass');
    s.player.walk(BACK[s.player.dir]);
  } }]
};

// ---------- Botanical Garden ----------

const hatch: Script = function* (s) {
  if (!s.flag('tunnelQuest')) { s.say('A maintenance hatch stamped VANGUARD.\nIt\'s locked.'); return; }
  s.say('The hatch is open. A ladder leads down into warm, damp dark.');
  s.warp('tunnels', 2, 1, 'right');
};

const GARDEN: MapScripts = {
  npcs: [
    { id: 'gardener', sprite: 'chars/sailor', x: 22, y: 7, dir: 'down',
      talk: talk('Gardener: Lotad love the Lakes up north.\nThe Palm House is far too warm for them.') },
    trainer({ id: 'malou', x: 5, y: 10, dir: 'up', sprite: 'chars/student', sight: 2, cls: 'Student', name: 'Malou', when: f => !!f('ch1'),
      foes: [{ species: 'bounsweet', level: 10 }, { species: 'combee', level: 10 }],
      intro: ['Student Malou: I\'m cataloguing every flower in the\nGarden. You\'re not a flower. Battle!'], lose: ['Malou: Note to self: not a flower. A storm.'] }),
    trainer({ id: 'poul', x: 17, y: 17, dir: 'left', sprite: 'chars/gardener', sight: 3, cls: 'Gardener', name: 'Poul', when: f => !!f('ch1'),
      foes: [{ species: 'smoliv', level: 11 }], intro: ['Gardener Poul: Mind the beds! Smoliv, show them\nwhat a well-watered Pokémon can do.'],
      lose: ['Poul: Well. Back to weeding.'] }),
    { id: 'hatch', sprite: 'obj:hatch', x: 23, y: 10, dir: 'down', object: true, talk: hatch },
    itemBall('item3', 24, 17, 'potion', 2, 'Potions')
  ],
  doors: { palm: function* (s) { if (!s.flag('starter')) s.say('p.palm.door'); s.warp('palmhouse', 8, 9, 'up'); } }
};

// ---------- The Palm House ----------

const LUKAS_FIRST_MOVES: Record<string, string[]> = {
  charmander: ['scratch', 'growl'], popplio: ['pound', 'growl'], sprigatito: ['scratch', 'tailwhip']
};

function* pickStarter(s: ScriptApi): Step {
  let sp = '';
  for (;;) {
    const i: number = yield s.pickSpecies(STARTERS);
    sp = STARTERS[i].species;
    s.cry(sp);
    const c: number = yield s.ask(`Choose ${speciesName(sp)}?`, ['Yes', 'No'], 1);
    if (c === 0) break;
  }
  const mon = s.givePokemon(sp, 5);
  s.setFlag('starter', sp);
  s.me('me_get');
  s.say('p.got');
  const n: number = yield s.ask('p.nick', ['Yes', 'No'], 1);
  if (n === 0) {
    const nick: string = yield s.askName(`Nickname for ${speciesName(sp)}?`, [speciesName(sp)]);
    if (nick !== speciesName(sp)) mon.nickname = nick;
  }
  s.setFlag('lukasStarter', LUKAS_PICK[sp]); s.setFlag('majaStarter', MAJA_PICK[sp]);
}

// P5 and P6: the starters, Lukas's first battle (an easy one), the Cargo-Bike and the Coil.
function* starterScene(s: ScriptApi): Step {
  const prof = s.npc('prof'), lukas = s.npc('lukas'), maja = s.npc('maja');
  s.player.walk('up');
  s.say('p.palm.maja');
  s.say('p.orsted.1'); s.say('p.orsted.2'); s.say('p.orsted.3');
  s.say('p.orsted.grass'); s.say('p.orsted.fire'); s.say('p.orsted.water');
  s.say('p.orsted.normal'); s.say('p.orsted.electric');
  yield* pickStarter(s);
  lukas.facePlayer(); s.player.faceTo(lukas.x, lukas.y);
  s.say(s.flag('starter') === 'eevee' ? 'p.lukas.pick.even' : 'p.lukas.pick');
  maja.facePlayer();
  s.say('p.maja.pick');
  s.player.faceTo(prof.x, prof.y);
  s.say('p.orsted.dex'); s.say('p.orsted.items');
  s.giveItem('pokeball', 5); s.giveItem('potion', 2); s.me('me_item');
  lukas.facePlayer(); s.player.faceTo(lukas.x, lukas.y);
  s.say('p.lukas.challenge');
  const ls = lukasStarter(s);
  const r = yield s.battle({ kind: 'trainer', soft: true, tutorial: true, bg: 'field', trainer: { name: 'Lukas', title: 'Rival', sprite: 'tr/lukas' },
    foes: [{ species: ls, level: 5, moves: LUKAS_FIRST_MOVES[ls] ?? ['tackle', 'growl'] }] });
  s.say(r === 'win' ? 'p.lukas.win' : 'p.lukas.lose');
  s.setFlag('beatLukas', true);
  s.player.faceTo(prof.x, prof.y);
  s.say('p.orsted.heal');
  s.heal(); s.me('me_heal');
  // P6: the Rotom Cargo-Bike and the Resonance Coil
  s.say('p.bike.1'); s.say('p.bike.2'); s.say('p.bike.rotom');
  s.giveItem('bike'); s.me('me_item');
  s.say('p.bike.got');
  s.say('p.coil.1'); s.say('p.coil.2');
  s.unlockCoil('current'); s.setFlag('coil', true); s.me('me_item');
  s.say('p.coil.got');
  s.say('p.coil.tut');
  s.cry('bounsweet');
  yield s.battle({ kind: 'wild', bg: 'field', foes: [{ species: 'bounsweet', level: 3 }] });
  s.heal();
  s.say('p.orsted.readings');
  lukas.facePlayer();
  s.say('p.lukas.leave');
  lukas.walk('down', 2, 10); lukas.hide();
  maja.facePlayer();
  s.say('Maja: I\'m going to have a look around the Lakes.\nCatch you on the path, {player}!');
  maja.walk('down', 2, 10); maja.hide();
  s.setFlag('majaLeft', true);
  s.checkpoint();
}

const profTalk: Script = function* (s) {
  if (!s.flag('starter')) { yield* starterScene(s); return; }
  if (s.flag('kaas') && !s.flag('tunnelQuest')) { s.say('c1.orsted.cold'); s.say('c1.orsted.tunnels'); s.setFlag('tunnelQuest', true); return; }
  if (s.flag('tunnelQuest') && !s.flag('valve')) { s.say('c1.orsted.tunnels'); return; }
  if (s.flag('valve') && !s.flag('tunnelsDone')) {
    s.say('c1.orsted.back'); s.say('c1.orsted.tm');
    s.giveItem('tmbulletseed'); s.me('me_item');
    s.say(`${s.player.name} got TM Bullet Seed!`);
    s.setFlag('tunnelsDone', true);
    s.say('Ørsted: Tariq rang again, by the way. Something\nabout paint. He sounded... urgent.');
    s.checkpoint();
    return;
  }
  s.heal(); s.me('me_heal');
  s.say(s.flag('badge') ? 'Ørsted: A badge! Splendid. Those harbour readings\nstill worry me. Two degrees, in June...' : 'Ørsted: There, your team is rested. Mind the Bounsweet.');
};

const PALMHOUSE: MapScripts = {
  onEnter: function* (s) { if (!s.flag('starter')) yield* starterScene(s); },
  npcs: [
    { id: 'prof', sprite: 'chars/prof', x: 8, y: 7, dir: 'down', talk: profTalk },
    { id: 'lukas', sprite: 'chars/lukas', x: 10, y: 8, dir: 'left', when: f => !f('beatLukas'), talk: talk('p.lukas.challenge') },
    { id: 'maja', sprite: 'chars/maja', x: 6, y: 8, dir: 'right', when: f => !f('majaLeft'), talk: talk('p.palm.maja') },
    { id: 'bounsweet', sprite: 'chars/bounsweet', x: 3, y: 2, dir: 'down', object: true,
      talk: function* (s) { s.cry('bounsweet'); s.say('Bounsweet: Swee! (It sprays you. It smells lovely.)'); } }
  ]
};

// ---------- Steam Tunnels ----------

const TUNNELS: MapScripts = {
  npcs: [
    trainer({ id: 'eng1', x: 12, y: 1, dir: 'down', sprite: 'chars/engineer', sight: 1, cls: 'Engineer', name: 'Holm',
      foes: [{ species: 'magnemite', level: 11 }, { species: 'klink', level: 12 }], intro: ['c1.eng1.intro'], lose: ['c1.eng1.lose'] }),
    trainer({ id: 'eng2', x: 8, y: 6, dir: 'up', sprite: 'chars/engineer', sight: 1, cls: 'Engineer', name: 'Brandt', battle: { ai: 2 },
      foes: [{ species: 'voltorb', level: 12 }, { species: 'tadbulb', level: 13 }], intro: ['c1.eng2.intro'], lose: ['c1.eng2.lose'] }),
    { id: 'valve', sprite: 'obj:valve', x: 20, y: 13, dir: 'down', object: true, talk: function* (s) {
      if (s.flag('valve')) { s.say('The valve is open. Warm steam rushes toward the Garden.'); return; }
      const c: number = yield s.ask('c1.tunnel.valve', ['Yes', 'No'], 1);
      if (c !== 0) return;
      s.sfx('select');
      s.say('c1.tunnel.valve.ok');
      s.setFlag('valve', true);
    } },
    sign('pipe', 15, 14, 'obj:pipe', 'c1.tunnel.pipe'),
    itemBall('item.tun1', 22, 9, 'antidote', 2, 'Antidotes')
  ],
  events: [{ x: 17, y: 12, w: 2, h: 1, on: 'step', when: f => !!f('valve') && !f('swarm'), run: function* (s) {
    s.say('c1.swarm');
    s.cry('grimer');
    const r = yield s.battle({ kind: 'wild', ai: 2, bg: 'indoor1', foes: [{ species: 'grimer', level: 13 }] });
    if (r !== 'lose') s.setFlag('swarm', true);
  } }]
};

export const LAKES: Record<string, MapScripts & { exitGuards?: Partial<Record<Dir, Script>> }> = {
  bridge: BRIDGE, route1: ROUTE1, palmhouse: PALMHOUSE, tunnels: TUNNELS,
  garden: { ...GARDEN, exitGuards: { right: function* (s) {
    if (s.flag('c1done')) return true;
    s.say('The east gate is shut. A sign: "Closed for Vanguard\ngrid works. Indre By diversion via... nowhere."');
    return false;
  } } }
};
