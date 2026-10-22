// Chapter 6, Look Up: Rundetårn reopens after the tremor, but the telescope has lost both lenses.
// The spiral ramp is Tycho's gym: Trick Room floors (every step goes backwards), the library hall and the
// Trinitatis loft for the lenses, three brass rings to set to the right constellations, and Tycho in the
// observatory. He plays his seismic charts as sound: the tremors are a song. Then Sif's message reaches Maja.
import { OPPOSITE, type NpcDef, type Script, type ScriptApi } from '@hafnia/core';
import { itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';

// ---------- The chapter starts ----------

/** Runs on the next map you enter after the Cisterns. */
export function* ch6Start(s: ScriptApi): Step {
  if (!s.flag('ch5done') || s.flag('ch6')) return;
  s.setFlag('ch6', true);
  s.chapterEnd('Chapter 6', 'Look Up');
  s.sfx('select');
  s.say('c6.start.1'); s.say('c6.start.2'); s.say('c6.start.3');
  s.checkpoint();
}

/** Puts a hidden scene NPC next to the player, facing them. */
function cast(s: ScriptApi, id: string, nearX = s.player.x, nearY = s.player.y) {
  const n = s.npc(id);
  const [x, y] = s.freeSpotNear(nearX, nearY);
  n.place(x, y, 'down'); n.show(); n.facePlayer();
  return { n, x, y };
}

// ---------- The lobby ----------

function* lobby(s: ScriptApi): Step {
  s.setFlag('ch6met', true);
  s.say('c6.lobby.1');
  s.say('c6.tycho.1'); s.say('c6.tycho.2'); s.say('c6.tycho.3'); s.say('c6.tycho.4'); s.say('c6.tycho.5');
  s.checkpoint();
}

const rampEntry: Script = function* (s) {
  const back = OPPOSITE[s.player.dir];
  if (!s.flag('ch6')) { s.say('c6.ramp.closed'); s.player.walk(back); return; }
  if (!s.flag('ch6met')) { yield* lobby(s); s.player.walk(back); return; }
  if (s.flag('orrery')) {
    // Once you hold the badge, Tycho lets you take the staff stairs straight up to the observatory.
    const c: number = yield s.ask('c6.ramp.which', ['The ramp', 'Staff stairs', 'Stay'], 2);
    if (c === 2) { s.player.walk(back); return; }
    s.sfx('door');
    if (c === 1) { s.warp('rundetarn', 11, 12, 'up'); return; }
  } else s.sfx('door');
  s.warp('rundetarn', 11, 20, 'up');
};

const tychoLobby: Script = function* (s) {
  if (s.flag('orrery')) { s.say('c6.tycho.lobby.after'); return; }
  s.say('c6.tycho.lobby');
};

const TOWER6: MapScripts = {
  onEnter: function* (s) { if (s.flag('ch6') && !s.flag('ch6met')) yield* lobby(s); },
  npcs: [{ id: 'tycho6', sprite: 'chars/scientist', x: 5, y: 2, dir: 'right', when: f => !!f('ch6') && !f('orrery'), talk: tychoLobby }],
  events: [{ tile: 'd', on: 'step', run: rampEntry }]
};

// ---------- The ramp ----------

/** The three brass rings of the orrery gate and what each must be set to (the star chart gives it away). */
const RINGS = [
  { id: 'ringW', x: 8, y: 11, want: 'Lion', line: 'c6.ring.west' },
  { id: 'ringN', x: 12, y: 8, want: 'Great Bear', line: 'c6.ring.north' },
  { id: 'ringE', x: 14, y: 11, want: 'Swan', line: 'c6.ring.east' }
];
const SIGNS = ['Great Bear', 'Swan', 'Lion', 'Scorpion'];
const aligned = (f: (n: string) => any) => RINGS.every(r => f(r.id) === r.want);

const brassRing = (i: number): NpcDef => {
  const r = RINGS[i];
  return {
    id: r.id, sprite: 'obj:brassring', x: r.x, y: r.y, dir: 'down', object: true, talk: function* (s) {
      if (s.flag('ringsDone')) { s.say('c6.ring.done'); return; }
      s.say(r.line);
      const now = s.flag(r.id) as string | undefined;
      s.say(now ? s.t('c6.ring.now').replace('{sign}', now) : 'c6.ring.blank');
      const c: number = yield s.ask('c6.ring.ask', [...SIGNS, 'Leave it'], SIGNS.length);
      if (c >= SIGNS.length) return;
      s.sfx('shake');
      s.setFlag(r.id, SIGNS[c]);
      s.say(s.t('c6.ring.set').replace('{sign}', SIGNS[c]));
      if (aligned(s.flag.bind(s))) {
        s.setFlag('ringsDone', true);
        s.wait(10); s.sfx('select');
        s.say('c6.ring.open');
        s.checkpoint();
      }
    }
  };
};

const BRONZOR_MOVES = ['confusion', 'irondefense', 'hypnosis', 'payback'];

/** A lens and the Pokémon guarding it: beat the guard (or have beaten it), then pick the lens up. */
const lens = (id: string, item: string, guard: { npc: string; species: string; moves: string[]; lines: string[] }, lines: { find: string; got: string; after: string }): Script => function* (s) {
  if (s.hasItem(item) || s.flag(`${id}Got`)) { s.say(lines.after); return; }
  s.say(lines.find);
  if (!s.flag(`${id}Guard`)) {
    const g = cast(s, guard.npc);
    s.sfx('exclaim'); g.n.exclaim();
    s.cry(guard.species);
    for (const l of guard.lines) s.say(l);
    const r = yield s.battle({ kind: 'wild', bg: 'indoor1', foes: [{ species: guard.species, level: 31, moves: guard.moves }] });
    g.n.hide();
    if (r === 'lose') return;
    s.setFlag(`${id}Guard`, true);
  }
  s.setFlag(`${id}Got`, true);
  s.giveItem(item); s.me('me_item');
  s.say(lines.got);
  s.checkpoint();
};

const tychoGym: Script = function* (s) {
  if (s.flag('orrery')) { s.say('c6.tycho.after'); return; }
  const lenses = s.hasItem('lensobjective') + s.hasItem('lenseyepiece');
  if (!s.flag('tychoLenses')) {
    if (lenses < 2) { s.say(lenses ? 'c6.tycho.onelens' : 'c6.tycho.nolens'); return; }
    s.say('c6.tycho.lenses.1');
    s.takeItem('lensobjective'); s.takeItem('lenseyepiece');
    s.setFlag('tychoLenses', true);
    s.sfx('select'); s.fade(0.5, 10); s.fade(0, 10);
    s.say('c6.tycho.lenses.2'); s.say('c6.tycho.lenses.3');
  }
  s.say('c6.tycho.gym.1'); s.say('c6.tycho.gym.2');
  const c: number = yield s.ask('c6.tycho.ask', ['Yes', 'Not yet'], 1);
  if (c !== 0) return;
  const r = yield s.battle({ kind: 'trainer', leader: true, ai: 3, bg: 'indoor1', trainer: { name: 'Tycho', title: 'Leader', sprite: 'tr/tycho' }, foes: [
    { species: 'espathra', level: 31, moves: ['luminacrash', 'aerialace', 'quickattack', 'featherdance'] },
    { species: 'kirlia', level: 31, moves: ['psybeam', 'drainingkiss', 'calmmind', 'disarmingvoice'] },
    { species: 'bronzor', level: 31, moves: ['extrasensory', 'gyroball', 'hypnosis', 'irondefense'] },
    { species: 'starmie', level: 33, moves: ['psyshock', 'cosmicpower', 'waterpulse', 'rapidspin'], item: 'sitrusberry' }
  ] });
  if (r !== 'win') { s.say('c6.tycho.win'); return; }
  s.say('c6.tycho.lose');
  s.setFlag('orrery', true);
  s.giveBadge('orrery', 'Orrery Badge');
  s.me('me_badge');
  s.say('c6.got.badge');
  s.say('c6.tycho.tm');
  s.giveItem('tmpsyshock'); s.me('me_item');
  s.say(`${s.player.name} got TM Psyshock!`);
  s.say('c6.tycho.gyro');
  s.giveItem('gyro'); s.me('me_item');
  s.say('c6.got.gyro');
  yield* melody(s);
};

/** Tycho plays the seismic charts as sound, and Maja brings Sif's message. */
function* melody(s: ScriptApi): Step {
  s.wait(20);
  s.say('c6.song.1'); s.say('c6.song.2'); s.say('c6.song.3');
  for (let i = 0; i < 3; i++) { s.sfx('select'); s.wait(18); }
  s.say('c6.song.4'); s.say('c6.song.5'); s.say('c6.song.6');
  const m = cast(s, 'maja6');
  s.player.faceTo(m.x, m.y);
  s.say('c6.maja.1'); s.say('c6.maja.2'); s.say('c6.maja.3'); s.say('c6.maja.4'); s.say('c6.maja.5');
  s.say('c6.maja.tycho'); s.say('c6.maja.6');
  m.n.hide();
  s.say('c6.orrery.hint');
  s.setFlag('ch6done', true);
  s.checkpoint();
  s.chapterEnd('Chapter 6 complete', 'Look Up');
  s.say('c6.end');
}

/** Tycho's orrery: from Badge 5 on, it turns the city's clock to any time of day. */
const orrery: Script = function* (s) {
  if (!s.flag('orrery')) { s.say('c6.orrery.locked'); return; }
  s.say('c6.orrery.1');
  const periods = ['morning', 'day', 'evening', 'night'] as const;
  const c: number = yield s.ask('c6.orrery.ask', ['Morning', 'Day', 'Evening', 'Night', 'Leave it'], 4);
  if (c >= periods.length) return;
  s.fade(1, 20); s.setTime(periods[c]); s.fade(0, 20);
  s.say('c6.orrery.done');
};

const RAMP: MapScripts = {
  npcs: [
    { id: 'rampguide', sprite: 'chars/oldman', x: 10, y: 21, dir: 'right', talk: function* (s) {
      if (s.flag('orrery')) { s.say('c6.guide.after'); return; }
      s.say('c6.guide.1'); s.say('c6.guide.2');
    } },
    sign('rampsign', 12, 20, 'obj:sign', 'c6.ramp.sign'),
    sign('starchart', 7, 15, 'obj:starchart', 'c6.chart.1', 'c6.chart.2', 'c6.chart.3'),
    ...RINGS.map((_, i) => brassRing(i)),
    { id: 'orrerygate', sprite: 'obj:orrerygate', x: 11, y: 13, dir: 'down', object: true, when: f => !f('ringsDone'), talk: talk('c6.gate') },
    { id: 'staffstairs', sprite: 'obj:stairs', x: 10, y: 10, dir: 'down', object: true, talk: function* (s) {
      const c: number = yield s.ask('c6.staff', ['Go down', 'Stay'], 1);
      if (c === 0) { s.sfx('door'); s.warp('towerin', 6, 3, 'down'); }
    } },
    { id: 'tychog', sprite: 'chars/scientist', x: 11, y: 11, dir: 'down', talk: tychoGym },
    { id: 'telescope', sprite: 'obj:telescope', x: 11, y: 10, dir: 'down', object: true, talk: talk('c6.telescope') },
    { id: 'orrerydesk', sprite: 'obj:orrery', x: 12, y: 10, dir: 'down', object: true, talk: orrery },
    { id: 'maja6', sprite: 'chars/maja', x: 10, y: 12, dir: 'down', hidden: true },
    trainer({ id: 'rtPsy1', x: 1, y: 16, dir: 'right', sprite: 'chars/psychic', sight: 1, cls: 'Psychic', name: 'Ida',
      foes: [{ species: 'espurr', level: 30 }, { species: 'drowzee', level: 30 }], intro: ['c6.psy1.intro'], lose: ['c6.psy1.lose'] }),
    trainer({ id: 'rtPsy2', x: 21, y: 7, dir: 'left', sprite: 'chars/psychicm', sight: 1, cls: 'Psychic', name: 'Viggo',
      foes: [{ species: 'natu', level: 30 }, { species: 'kirlia', level: 31 }, { species: 'xatu', level: 31 }], intro: ['c6.psy2.intro'], lose: ['c6.psy2.lose'] }),
    trainer({ id: 'rtPsy3', x: 4, y: 10, dir: 'right', sprite: 'chars/psychic', sight: 1, cls: 'Psychic', name: 'Saga',
      foes: [{ species: 'hypno', level: 31 }, { species: 'meowstic', level: 32 }], intro: ['c6.psy3.intro'], lose: ['c6.psy3.lose'] }),
    trainer({ id: 'rtPsy4', x: 15, y: 9, dir: 'left', sprite: 'chars/psychicm', sight: 1, cls: 'Psychic', name: 'Aksel',
      foes: [{ species: 'bronzor', level: 31 }, { species: 'espathra', level: 32 }], intro: ['c6.psy4.intro'], lose: ['c6.psy4.lose'] }),
    itemBall('item.rt1', 20, 21, 'hyperpotion', 1, 'a Hyper Potion'),
    itemBall('item.rt2', 4, 4, 'revive', 1, 'a Revive')
  ]
};

const BIBLIOTEK: MapScripts = {
  npcs: [
    { id: 'bronzorg', sprite: 'chars/bronzor', x: 3, y: 4, dir: 'right', hidden: true },
    { id: 'lens1', sprite: 'obj:lens', x: 1, y: 6, dir: 'down', object: true, when: f => !f('lens1Got'), talk: lens('lens1', 'lensobjective',
      { npc: 'bronzorg', species: 'bronzor', moves: BRONZOR_MOVES, lines: ['c6.lib.bronzor'] },
      { find: 'c6.lib.find', got: 'c6.lib.got', after: 'c6.lib.after' }) },
    { id: 'librarian', sprite: 'chars/oldman', x: 12, y: 2, dir: 'down', talk: talk('c6.lib.librarian', 'c6.lib.librarian.2') },
    sign('libbooks', 3, 1, 'obj:sign', 'c6.lib.books'),
    itemBall('item.lib1', 12, 6, 'ultraball', 2, 'Ultra Balls')
  ]
};

const TRINITATIS: MapScripts = {
  npcs: [
    { id: 'murkrowg', sprite: 'chars/murkrow', x: 11, y: 2, dir: 'down', hidden: true },
    { id: 'lens2', sprite: 'obj:lens', x: 12, y: 1, dir: 'down', object: true, when: f => !f('lens2Got'), talk: lens('lens2', 'lenseyepiece',
      { npc: 'murkrowg', species: 'murkrow', moves: ['nightshade', 'wingattack', 'assurance', 'haze'], lines: ['c6.loft.murkrow'] },
      { find: 'c6.loft.find', got: 'c6.loft.got', after: 'c6.loft.after' }) },
    { id: 'sexton', sprite: 'chars/gentleman', x: 2, y: 2, dir: 'down', talk: talk('c6.loft.sexton', 'c6.loft.sexton.2') },
    itemBall('item.loft1', 6, 6, 'fullheal', 2, 'Full Heals')
  ]
};

export const RUNDETARN_SCRIPTS: Record<string, MapScripts> = { rundetarn: RAMP, bibliotek: BIBLIOTEK, trinitatis: TRINITATIS };
export { TOWER6 };
