// Chapter 11, The Rising Tide: Lindholm pushes the reactor to 120% and the Little Mermaid cracks. Langelira rises
// from the Sound, silent, and the storm surge floods Nyhavn. Ivar's hydrofoil picks up Fru Jensen, the pølsevogn
// man and Captain Bodil; the M-Ring tunnels lead to Slotsholmen, where Maja hijacks every billboard in the city with
// Astrid's data and the ledgers, and Vinther resigns on air. Absalon's ruins under Christiansborg read the eight
// badges and give up Kronvakt's key. Then Kystbanen north in the storm, Kronborg's casemates, Maja beside you against
// Commander Kaas, and Holger Danske, the Sleeper, opens his eyes.
import type { NpcDef, Script, ScriptApi } from '@hafnia/core';
import { centerNpcs } from './home';
import { grown, itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';
import { majaStarter } from './starters';

// ---------- The chapter starts: the Mermaid ----------

/** Runs on the next map you enter after Lindholm's broadcast: the statue cracks and the sea comes in. */
export function* ch11Start(s: ScriptApi): Step {
  if (!s.flag('ch10done') || s.flag('ch11')) return;
  s.setFlag('ch11', true);
  s.chapterEnd('Chapter 11', 'The Rising Tide');
  s.say('c11.start.1'); s.say('c11.start.2'); s.say('c11.start.3'); s.say('c11.start.4');
  s.sfx('hit_super');
  s.say('c11.start.5'); s.say('c11.start.6');
  s.fade(1, 16);
  s.warp('floodnyhavn', 2, 10, 'right');
  s.fade(0, 16);
  s.say('c11.fl.ivar.1');
  s.checkpoint();
}

/** Puts a hidden scene NPC next to the player, facing them. */
function cast(s: ScriptApi, id: string, nearX = s.player.x, nearY = s.player.y) {
  const n = s.npc(id);
  const [x, y] = s.freeSpotNear(nearX, nearY);
  n.place(x, y, 'down'); n.show(); n.facePlayer();
  return { n, x, y };
}

// ---------- Nyhavn under water ----------

const RESCUES = ['resJensen', 'resPolse', 'resBodil'];

const rescue = (flag: string, key: string): Script => function* (s) {
  if (s.flag(flag)) { s.say(`${key}.after`); return; }
  s.say(`${key}.1`); s.say(`${key}.2`);
  s.setFlag(flag, true);
  s.sfx('select');
  s.say('c11.fl.aboard');
  if (RESCUES.every(f => s.flag(f))) {
    s.say('c11.fl.mum.1'); s.say('c11.fl.mum.2'); s.say('c11.fl.mum.3');
    s.say('c11.fl.ivar.done');
    s.checkpoint();
  }
};

const FLOODNYHAVN: MapScripts = {
  npcs: [
    { id: 'flJensen', sprite: 'chars/oldwoman', x: 3, y: 3, dir: 'down', when: f => !f('resJensen'), talk: rescue('resJensen', 'c11.fl.jensen') },
    { id: 'flPolse', sprite: 'chars/chef', x: 13, y: 6, dir: 'up', when: f => !f('resPolse'), talk: rescue('resPolse', 'c11.fl.polse') },
    { id: 'flBodil', sprite: 'chars/bodil', x: 22, y: 3, dir: 'left', when: f => !f('resBodil'), talk: rescue('resBodil', 'c11.fl.bodil') },
    { id: 'flIvar', sprite: 'chars/ivar', x: 1, y: 10, dir: 'right', talk: function* (s) {
      if (!RESCUES.every(f => s.flag(f))) { s.say('c11.fl.ivar.2'); return; }
      s.say('c11.fl.ivar.after'); s.heal(); s.me('me_heal');
    } },
    { id: 'metrostair', sprite: 'obj:stairs', x: 12, y: 12, dir: 'down', object: true, talk: function* (s) {
      if (!RESCUES.every(f => s.flag(f))) { s.say('c11.fl.stair.early'); return; }
      s.say('c11.fl.stair'); s.sfx('door');
      s.warp('metro', 1, 1, 'down');
    } },
    trainer({ id: 'flEnf', x: 15, y: 7, dir: 'down', sprite: 'chars/enforcer', sight: 1, cls: 'Grid Enforcer', name: 'Kasper',
      foes: [{ species: 'pelipper', level: 48 }, { species: 'magnezone', level: 48 }], intro: ['c11.fl.enf.intro'], lose: ['c11.fl.enf.lose'] })
  ]
};

// ---------- The M-Ring ----------

const METRO: MapScripts = {
  onEnter: function* (s) { if (!s.flag('c11metro')) { s.setFlag('c11metro', true); s.say('c11.mt.enter'); s.setRespawn('metro', 1, 2, 'down', s.t('c11.mt.respawn')); } },
  npcs: [
    trainer({ id: 'mtEnf1', x: 8, y: 5, dir: 'right', sprite: 'chars/enforcer', sight: 4, cls: 'Grid Enforcer', name: 'Lone',
      foes: [{ species: 'luxray', level: 49 }, { species: 'klinklang', level: 49 }], intro: ['c11.mt.enf1.intro'], lose: ['c11.mt.enf1.lose'] }),
    trainer({ id: 'mtEnf2', x: 17, y: 8, dir: 'left', sprite: 'chars/enforcer', sight: 4, cls: 'Grid Enforcer', name: 'Palle',
      foes: [{ species: 'electivire', level: 49 }, { species: 'crobat', level: 49 }, { species: 'magnezone', level: 50 }], intro: ['c11.mt.enf2.intro'], lose: ['c11.mt.enf2.lose'] }),
    { id: 'mtmedic', sprite: 'chars/nurse', x: 1, y: 8, dir: 'right', talk: function* (s) { s.say('c11.mt.medic'); s.heal(); s.me('me_heal'); } },
    itemBall('item.mt1', 12, 4, 'hyperpotion', 2, 'Hyper Potions'),
    itemBall('item.mt2', 26, 9, 'revive', 2, 'Revives'),
    { id: 'mtstair', sprite: 'obj:stairs', x: 26, y: 1, dir: 'down', object: true, talk: function* (s) {
      s.say('c11.mt.out'); s.sfx('door');
      s.warp('slotsholmen', 8, 7, 'down');
    } }
  ]
};

// ---------- Slotsholmen: Maja's broadcast ----------

export function* broadcast(s: ScriptApi): Step {
  s.setFlag('c11broadcast', true);
  s.say('c11.bc.arrive');
  const m = cast(s, 'maja11');
  s.player.faceTo(m.x, m.y);
  s.say('c11.bc.maja.1'); s.say('c11.bc.maja.2');
  s.sfx('select');
  s.say('c11.bc.screens'); s.say('c11.bc.data'); s.say('c11.bc.ledger');
  s.say('c11.bc.vinther.1'); s.say('c11.bc.vinther.2'); s.say('c11.bc.vinther.3'); s.say('c11.bc.vinther.4');
  s.say('c11.bc.maja.3');
  const f = cast(s, 'freja11');
  s.player.faceTo(f.x, f.y);
  s.say('c11.bc.freja.1'); s.say('c11.bc.freja.2'); s.say('c11.bc.maja.4');
  m.n.hide();
  s.setRespawn('pcslotsholmen', 6, 5, 'up', s.t('c11.bc.respawn'));
  s.checkpoint();
}

export const SLOTSHOLMEN_CH11: NpcDef[] = [
  { id: 'maja11', sprite: 'chars/maja', x: 11, y: 9, dir: 'down', hidden: true },
  { id: 'freja11', sprite: 'chars/freja', x: 7, y: 8, dir: 'right', when: f => !!f('c11broadcast') && !f('c11ruins'), talk: function* (s) {
    s.say('c11.bc.freja.go');
  } },
  { id: 'ruinsstair', sprite: 'obj:stairs', x: 8, y: 6, dir: 'down', object: true, when: f => !!f('c11broadcast'), talk: function* (s) {
    s.say('c11.ru.down'); s.sfx('door');
    s.warp('ruins', 2, 4, 'up');
  } }
];

// ---------- Absalon's ruins: the badge doors ----------

const BADGES = ['Spray', 'Lily', 'Frost', 'Lantern', 'Orrery', 'Harlequin', 'Spire', 'Turbine'];
/** Each door shows a riddle for one badge; the plaque's answer is its index in BADGES. */
const DOORS: { x: number; answer: number; options: number[] }[] = [
  { x: 4, answer: 0, options: [0, 2, 6, 7] },
  { x: 8, answer: 3, options: [1, 3, 5, 6] },
  { x: 12, answer: 4, options: [2, 4, 5, 7] },
  { x: 16, answer: 7, options: [0, 3, 6, 7] }
];

const badgeDoor = (i: number): Script => function* (s) {
  const d = DOORS[i];
  s.say(`c11.ru.door${i + 1}`);
  const c: number = yield s.ask('c11.ru.ask', [...d.options.map(o => `${BADGES[o]} Badge`), 'Leave it'], 4);
  if (c >= d.options.length) return;
  if (d.options[c] !== d.answer) { s.sfx('hit_weak'); s.say('c11.ru.wrong'); return; }
  s.sfx('door');
  s.setFlag(`ruinsDoor${i}`, true);
  s.say('c11.ru.right');
};

const altar: Script = function* (s) {
  if (s.flag('c11ruins')) { s.say('c11.ru.altar.after'); return; }
  s.say('c11.ru.altar.1'); s.say('c11.ru.altar.2');
  s.sfx('select'); s.wait(20);
  s.say('c11.ru.altar.3');
  s.giveItem('kronkey'); s.me('me_item');
  s.say('c11.got.kronkey');
  s.setFlag('c11ruins', true);
  const f = cast(s, 'freja11r');
  s.player.faceTo(f.x, f.y);
  s.say('c11.ru.freja.1'); s.say('c11.ru.freja.2');
  s.fade(1, 20);
  s.warp('helsingor', 3, 6, 'right');
  s.fade(0, 20);
  s.say('c11.hg.arrive.1'); s.say('c11.hg.arrive.2');
  s.checkpoint();
};

const RUINS: MapScripts = {
  npcs: [
    { id: 'rustair', sprite: 'obj:stairs', x: 1, y: 4, dir: 'down', object: true, talk: function* (s) { s.sfx('door'); s.warp('slotsholmen', 8, 7, 'down'); } },
    ...DOORS.map((d, i): NpcDef => ({ id: `ruinsdoor${i}`, sprite: 'obj:grate', x: d.x, y: 2, dir: 'down', object: true, when: f => !f(`ruinsDoor${i}`), talk: badgeDoor(i) })),
    sign('rutablet', 2, 1, 'obj:lectern', 'c11.ru.tablet'),
    { id: 'rualtar', sprite: 'obj:monument', x: 18, y: 1, dir: 'down', object: true, talk: altar },
    { id: 'freja11r', sprite: 'chars/freja', x: 17, y: 3, dir: 'up', hidden: true },
    itemBall('item.ru1', 10, 4, 'ultraball', 3, 'Ultra Balls')
  ]
};

// ---------- Helsingør and Kronborg ----------

const HELSINGOR: MapScripts = {
  doors: {
    kronborg: function* (s) { s.sfx('door'); s.warp('casemates', 4, 9, 'up'); },
    pc: function* (s) { s.warp('pchelsingor', 6, 5, 'up'); }
  },
  npcs: [
    { id: 'hgtrain', sprite: 'obj:train', x: 1, y: 6, dir: 'down', object: true, when: f => !f('ch12done'), talk: talk('c11.hg.train') },
    { id: 'hgfreja', sprite: 'chars/freja', x: 14, y: 8, dir: 'up', when: f => !f('kronvakt'), talk: talk('c11.hg.freja') },
    sign('hgsign', 9, 8, 'obj:sign', 'c11.hg.sign'),
    trainer({ id: 'hgSailor', x: 18, y: 7, dir: 'left', sprite: 'chars/sailor', sight: 3, cls: 'Sailor', name: 'Aksel',
      foes: [{ species: 'kingler', level: 49 }, { species: 'gyarados', level: 50 }], intro: ['c11.hg.sailor.intro'], lose: ['c11.hg.sailor.lose'] }),
    trainer({ id: 'hgAce', x: 11, y: 7, dir: 'right', sprite: 'chars/acef', sight: 4, cls: 'Ace Trainer', name: 'Ida',
      battle: { trainer: { name: 'Ida', title: 'Ace Trainer', sprite: 'tr/acef' } },
      foes: [{ species: 'lapras', level: 50 }, { species: 'skarmory', level: 49 }], intro: ['c11.hg.ace.intro'], lose: ['c11.hg.ace.lose'] }),
    itemBall('item.hg1', 20, 14, 'hyperpotion', 2, 'Hyper Potions')
  ]
};

/** Commander Kaas and an Enforcer hold the hall; Maja comes down the stair behind you. */
function* kaas(s: ScriptApi): Step {
  const k = cast(s, 'kaas11', 16, 4);
  s.say('c11.cm.kaas.1');
  const m = cast(s, 'maja11c');
  s.say('c11.cm.maja.1'); s.say('c11.cm.kaas.2');
  const r = yield s.battle({
    kind: 'trainer', ai: 3, bg: 'indoor1', prize: 0, trainer: { name: 'Kaas', title: 'Commander', sprite: 'tr/kaas' },
    foes: [{ species: 'hariyama', level: 50, moves: ['closecombat', 'knockoff', 'bulletpunch', 'heavyslam'] }, { species: 'electivire', level: 52, moves: ['wildcharge', 'icepunch', 'crosschop', 'protect'], item: 'sitrusberry' }],
    multi: {
      // Maja's moves only ever hit the other side.
      partner: { name: 'Maja', sprite: 'tr/maja', foes: [
        { species: 'kilowattrel', level: 49, moves: ['airslash', 'thunderbolt', 'roost', 'uturn'] },
        { species: grown(majaStarter(s), 50), level: 50 }
      ] },
      second: { name: 'Bjørn', title: 'Grid Enforcer', sprite: 'tr/enforcer', foes: [{ species: 'luxray', level: 50 }, { species: 'klinklang', level: 50 }] }
    }
  });
  if (r !== 'win') { k.n.hide(); m.n.hide(); return; }
  s.setFlag('c11kaas', true);
  s.say('c11.cm.kaas.3'); s.say('c11.cm.kaas.4');
  k.n.walk('down', 1); k.n.hide();
  s.say('c11.cm.maja.2');
  m.n.hide();
  s.checkpoint();
}

const holger: Script = function* (s) {
  if (s.flag('kronvakt')) { s.say('c11.cm.holger.after'); return; }
  s.say('c11.cm.holger.1');
  if (!s.hasItem('kronkey')) { s.say('c11.cm.holger.nokey'); return; }
  s.say('c11.cm.holger.2'); s.sfx('select'); s.wait(30);
  s.say('c11.cm.holger.3'); s.say('c11.cm.holger.4');
  s.setFlag('kronvakt', true);
  const f = cast(s, 'freja11c');
  s.player.faceTo(f.x, f.y);
  s.say('c11.cm.freja.1'); s.say('c11.cm.freja.2');
  s.giveItem('pactsong'); s.me('me_item');
  s.say('c11.got.song');
  s.say('c11.cm.freja.3');
  f.n.hide();
  s.setFlag('ch11done', true);
  s.checkpoint();
  s.chapterEnd('Chapter 11 complete', 'The Rising Tide');
  s.say('c11.end');
};

const CASEMATES: MapScripts = {
  npcs: [
    { id: 'holger', sprite: 'obj:knight', x: 16, y: 1, dir: 'down', object: true, talk: holger },
    { id: 'kaas11', sprite: 'chars/kaas', x: 16, y: 3, dir: 'down', hidden: true },
    { id: 'maja11c', sprite: 'chars/maja', x: 13, y: 5, dir: 'right', hidden: true },
    { id: 'freja11c', sprite: 'chars/freja', x: 15, y: 3, dir: 'up', hidden: true },
    trainer({ id: 'cmEnf1', x: 9, y: 8, dir: 'up', sprite: 'chars/enforcer', sight: 3, cls: 'Grid Enforcer', name: 'Gorm',
      foes: [{ species: 'magnezone', level: 50 }, { species: 'hariyama', level: 50 }], intro: ['c11.cm.enf1.intro'], lose: ['c11.cm.enf1.lose'] }),
    itemBall('item.cm1', 1, 5, 'revive', 1, 'a Revive')
  ],
  events: [{ x: 14, y: 5, w: 1, h: 4, on: 'step', when: f => !f('c11kaas'), run: kaas }]
};

export const KRONBORG_SCRIPTS: Record<string, MapScripts> = {
  floodnyhavn: FLOODNYHAVN, metro: METRO, ruins: RUINS, helsingor: HELSINGOR, pchelsingor: { npcs: centerNpcs('helsingor', 5, 14) }, casemates: CASEMATES
};
