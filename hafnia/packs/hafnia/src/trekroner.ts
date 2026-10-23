// Chapter 8, Trekroner: the Black Fleet's briefing on Freja's houseboat (Lukas turns up uninvited), the hydrofoil
// run past Vanguard's searchlights on Pierrot's ferry charts, and Trekroner Sea Fort at night. Maja scouts ahead
// and is caught; the dead lighthouse holds the keeper's log, an old photograph and the battery keys. You free
// Maja from the gun-battery cells, and in the siphon chamber Lukas sees Langelira through the viewport.
// Lindholm on a screen, Commander Kaas, and the escape: Freja holds the corridor and is arrested.
import type { NpcDef, Script, ScriptApi } from '@hafnia/core';
import { itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';

// ---------- The chapter starts ----------

/** Runs on the next map you enter after Pierrot's tent. */
export function* ch8Start(s: ScriptApi): Step {
  if (!s.flag('ch7done') || s.flag('ch8')) return;
  s.setFlag('ch8', true);
  s.chapterEnd('Chapter 8', 'Trekroner');
  s.sfx('select');
  s.say('c8.start.1'); s.say('c8.start.2');
  s.checkpoint();
}

/** Puts a hidden scene NPC next to the player, facing them. */
function cast(s: ScriptApi, id: string, nearX = s.player.x, nearY = s.player.y) {
  const n = s.npc(id);
  const [x, y] = s.freeSpotNear(nearX, nearY);
  n.place(x, y, 'down'); n.show(); n.facePlayer();
  return { n, x, y };
}

// ---------- Christianshavn: the gangplank ----------

const gangplank: Script = function* (s) {
  if (s.period !== 'evening' && s.period !== 'night') {
    s.say('c8.deck.day');
    const c: number = yield s.ask('c8.deck.wait', ['Wait aboard', 'Not yet'], 1);
    if (c !== 0) return;
    s.fade(1, 20); s.setTime('night'); s.fade(0, 20);
  }
  s.say('c8.deck.night');
  s.sfx('door');
  s.warp('fleetboat', 5, 4, 'up');
};

export const FLEET_DECKHAND: NpcDef = {
  id: 'fleetdeck', sprite: 'chars/deckhand', x: 3, y: 6, dir: 'down', when: f => !!f('ch8') && !f('ch8done'), talk: gangplank
};

// ---------- The briefing and the hydrofoil run ----------

function* briefing(s: ScriptApi): Step {
  s.setFlag('c8brief', true);
  s.say('c8.brief.1');
  s.say('c8.brief.freja.1'); s.say('c8.brief.sif.1'); s.say('c8.brief.freja.2');
  s.say('c8.brief.maja.1'); s.say('c8.brief.sif.2');
  s.sfx('door');
  const l = cast(s, 'lukas8b', 5, 5);
  s.player.faceTo(l.x, l.y);
  s.say('c8.brief.lukas.1'); s.say('c8.brief.freja.3'); s.say('c8.brief.lukas.2'); s.say('c8.brief.maja.2'); s.say('c8.brief.freja.4');
  s.checkpoint();
}

/** Three searchlights; the ferry charts say where to go. A wrong call brings a patrol boat alongside. */
const LIGHTS: { text: string; ask: string; options: string[]; right: number }[] = [
  { text: 'c8.run.light1', ask: 'c8.run.ask1', options: ['Behind the breakwater', 'Straight across'], right: 0 },
  { text: 'c8.run.light2', ask: 'c8.run.ask2', options: ['Cut the engines', 'Full speed'], right: 0 },
  { text: 'c8.run.light3', ask: 'c8.run.ask3', options: ['The north wall', 'The south landing'], right: 1 }
];

function* hydrofoil(s: ScriptApi): Step {
  s.say('c8.run.1');
  s.fade(1, 20); s.sfx('door'); s.fade(0.5, 20);
  s.say('c8.run.2');
  for (let i = 0; i < LIGHTS.length; i++) {
    const l = LIGHTS[i];
    s.say(l.text);
    const c: number = yield s.ask(l.ask, l.options, 1);
    if (c === l.right) { s.say(`c8.run.ok${i + 1}`); continue; }
    s.sfx('exclaim');
    s.say('c8.run.spotted');
    const r = yield s.battle({ kind: 'trainer', bg: 'city', trainer: { name: 'Patrol', title: 'Grid Enforcer', sprite: 'tr/enforcer' },
      foes: [{ species: 'golbat', level: 37 + i }, { species: 'magneton', level: 37 + i }] });
    if (r !== 'win') return;
    s.say('c8.run.shook');
  }
  s.fade(1, 20);
  s.warp('trekroner', 13, 21, 'up');
  s.setRespawn('trekroner', 13, 21, 'up', 'Freja: Easy. Breathe. I patched your team up.\nThe fort is still there. So are we.');
  s.fade(0, 20);
  yield* landing(s);
}

const frejaBoat: Script = function* (s) {
  if (!s.flag('c8brief')) return;
  s.say('c8.freja.boat');
  const c: number = yield s.ask('c8.freja.ready', ['Let\'s go', 'Not yet'], 1);
  if (c !== 0) { s.say('c8.freja.wait'); return; }
  yield* hydrofoil(s);
};

const FLEETBOAT: MapScripts = {
  onEnter: function* (s) { if (!s.flag('c8brief')) yield* briefing(s); },
  npcs: [
    { id: 'freja8', sprite: 'chars/freja', x: 5, y: 1, dir: 'down', talk: frejaBoat },
    { id: 'sif8', sprite: 'chars/sif', x: 3, y: 2, dir: 'down', talk: talk('c8.sif.boat') },
    { id: 'maja8b', sprite: 'chars/maja', x: 7, y: 2, dir: 'down', talk: talk('c8.maja.boat') },
    { id: 'lukas8b', sprite: 'chars/lukas', x: 9, y: 4, dir: 'up', hidden: true },
    sign('fleetmap', 1, 2, 'obj:poster', 'c8.boat.map'),
    { id: 'fleetdeck2', sprite: 'chars/deckhand', x: 9, y: 2, dir: 'down', talk: talk('c8.boat.deckhand') }
  ]
};

// ---------- Trekroner: the yards ----------

function* landing(s: ScriptApi): Step {
  s.setFlag('c8land', true);
  s.say('c8.land.1');
  const m = cast(s, 'maja8');
  s.player.faceTo(m.x, m.y);
  s.say('c8.land.maja.1'); s.say('c8.land.lukas.1'); s.say('c8.land.maja.2');
  m.n.walk('up', 4); m.n.hide();
  s.say('c8.land.freja');
  s.checkpoint();
}

function* alarm(s: ScriptApi): Step {
  s.setFlag('c8alarm', true);
  for (let i = 0; i < 3; i++) { s.sfx('exclaim'); s.fade(0.4, 4); s.fade(0, 4); }
  s.say('c8.alarm.1'); s.say('c8.alarm.2'); s.say('c8.alarm.lukas'); s.say('c8.alarm.3');
  s.checkpoint();
}

const frejaJetty: Script = function* (s) {
  if (!s.flag('mayaFree')) s.say(s.flag('c8alarm') ? 'c8.freja.jetty.alarm' : 'c8.freja.jetty');
  else s.say('c8.freja.jetty.free');
  s.heal(); s.me('me_heal');
  s.say('c8.freja.heal');
};

const TREKRONER: MapScripts = {
  onEnter: function* (s) { if (s.period !== 'night' && !s.flag('ch8done')) s.setTime('night'); },
  doors: {
    lighthouse: function* (s) { s.sfx('door'); s.warp('tklighthouse', 4, 4, 'up'); },
    battery: function* (s) {
      if (!s.hasItem('batterykey') && !s.flag('mayaFree')) { s.say('c8.battery.locked'); return; }
      s.sfx('door'); s.warp('battery', 9, 8, 'up');
    },
    siphon: function* (s) {
      if (!s.flag('mayaFree')) { s.say('c8.siphon.locked'); return; }
      s.sfx('door'); s.warp('siphon', 8, 9, 'up');
    }
  },
  npcs: [
    { id: 'frejaj', sprite: 'chars/freja', x: 12, y: 21, dir: 'right', when: f => !f('pg5fort'), talk: frejaJetty },
    { id: 'maja8', sprite: 'chars/maja', x: 13, y: 17, dir: 'down', hidden: true },
    sign('tksign', 15, 17, 'obj:sign', 'c8.tk.sign'),
    sign('tkbeam', 7, 4, 'obj:sign', 'c8.tk.lamp'),
    trainer({ id: 'tkEnf1', x: 8, y: 13, dir: 'right', sprite: 'chars/enforcer', sight: 5, cls: 'Grid Enforcer', name: 'Bjørn',
      foes: [{ species: 'golbat', level: 38 }, { species: 'magneton', level: 38 }], intro: ['c8.tk.enf1.intro'], lose: ['c8.tk.enf1.lose'] }),
    trainer({ id: 'tkEnf2', x: 5, y: 8, dir: 'down', sprite: 'chars/enforcer', sight: 4, cls: 'Grid Enforcer', name: 'Viggo',
      foes: [{ species: 'houndoom', level: 38 }, { species: 'toxicroak', level: 39 }], intro: ['c8.tk.enf2.intro'], lose: ['c8.tk.enf2.lose'] }),
    trainer({ id: 'tkEnf3', x: 22, y: 8, dir: 'left', sprite: 'chars/enforcer', sight: 4, cls: 'Grid Enforcer', name: 'Dorte',
      foes: [{ species: 'manectric', level: 39 }, { species: 'skuntank', level: 39 }], intro: ['c8.tk.enf3.intro'], lose: ['c8.tk.enf3.lose'] }),
    trainer({ id: 'tkSci', x: 17, y: 4, dir: 'down', sprite: 'chars/scientist', sight: 3, cls: 'Vanguard Scientist', name: 'Jonas',
      foes: [{ species: 'porygon2', level: 38 }, { species: 'rotom', level: 39 }], intro: ['c8.tk.sci.intro'], lose: ['c8.tk.sci.lose'] }),
    itemBall('item.tk1', 2, 17, 'hyperpotion', 2, 'Hyper Potions'),
    itemBall('item.tk2', 23, 2, 'revive', 1, 'a Revive'),
    itemBall('item.tk3', 9, 9, 'ultraball', 3, 'Ultra Balls')
  ],
  events: [{ x: 2, y: 11, w: 22, h: 4, on: 'step', when: f => !!f('c8land') && !f('c8alarm'), run: alarm }]
};

// ---------- The dead lighthouse ----------

const photo: Script = function* (s) {
  s.say('c8.photo.1'); s.say('c8.photo.2');
  if (s.flag('photoSeen')) return;
  s.setFlag('photoSeen', true);
  s.say('c8.photo.3');
};

const keyring: Script = function* (s) {
  s.say('c8.keys.1');
  s.setFlag('keysTaken', true);
  s.giveItem('batterykey'); s.me('me_item');
  s.say('c8.keys.got');
  s.checkpoint();
};

const TKLIGHTHOUSE: MapScripts = {
  npcs: [
    { id: 'photo', sprite: 'obj:photo', x: 3, y: 1, dir: 'down', object: true, talk: photo },
    { id: 'logbook', sprite: 'obj:logbook', x: 5, y: 1, dir: 'down', object: true, talk: talk('c8.log.1', 'c8.log.2', 'c8.log.3') },
    { id: 'keyring', sprite: 'obj:keyring', x: 4, y: 3, dir: 'down', object: true, when: f => !f('keysTaken'), talk: keyring },
    { ...sign('tklamp', 1, 4, 'obj:lanternout', 'c8.lh.lamp'), when: f => !f('pg5done') }
  ]
};

// ---------- The gun battery ----------

function* corridor(s: ScriptApi): Step {
  s.sfx('exclaim');
  s.say('c8.bt.ambush');
  const l = cast(s, 'lukas8');
  s.player.faceTo(l.x, l.y);
  s.say('c8.bt.lukas.1');
  const r = yield s.battle({
    kind: 'trainer', bg: 'indoor1', prize: 0, trainer: { name: 'Bodil', title: 'Grid Enforcer', sprite: 'tr/enforcer' },
    foes: [{ species: 'magneton', level: 39 }, { species: 'houndoom', level: 39 }],
    multi: {
      // Lukas's moves only ever hit the other side, so he never catches your Pokémon in a spread move.
      partner: { name: 'Lukas', sprite: 'tr/lukas', foes: [
        { species: 'porygon2', level: 40, moves: ['triattack', 'psybeam', 'recover', 'agility'] },
        { species: 'magneton', level: 40, moves: ['thunderbolt', 'flashcannon', 'thunderwave', 'triattack'] }
      ] },
      second: { name: 'Erling', title: 'Grid Enforcer', sprite: 'tr/enforcer', foes: [{ species: 'skuntank', level: 39 }, { species: 'manectric', level: 40 }] }
    }
  });
  if (r !== 'win') { l.n.hide(); return; }
  s.setFlag('c8corridor', true);
  s.say('c8.bt.lukas.2');
  l.n.hide();
  s.checkpoint();
}

const cell = (n: number): Script => function* (s) {
  if (n < 3) { s.say(`c8.cell.${n}`); return; }
  if (!s.flag('c8corridor')) { s.say('c8.cell.guarded'); return; }
  s.sfx('door');
  s.takeItem('batterykey');
  s.setFlag('mayaFree', true);
  s.say('c8.cell.open');
  const m = cast(s, 'maja8c', 10, 2);
  s.player.faceTo(m.x, m.y);
  s.say('c8.maja.cell.1'); s.say('c8.maja.cell.2'); s.say('c8.maja.cell.3'); s.say('c8.maja.cell.4');
  s.giveItem('siphonkey'); s.me('me_item');
  s.say('c8.maja.got');
  s.say('c8.maja.cell.5');
  m.n.hide();
  s.checkpoint();
};

const BATTERY: MapScripts = {
  npcs: [
    ...[2, 6, 10].map((x, i): NpcDef => ({ id: `celldoor${i + 1}`, sprite: 'obj:grate', x, y: 3, dir: 'down', object: true,
      when: f => i < 2 || !f('mayaFree'), talk: cell(i + 1) })),
    { id: 'maja8c', sprite: 'chars/maja', x: 10, y: 1, dir: 'down', hidden: true },
    { id: 'lukas8', sprite: 'chars/lukas', x: 9, y: 8, dir: 'up', hidden: true },
    sign('btboard', 14, 1, 'obj:poster', 'c8.bt.board'),
    trainer({ id: 'btEnf1', x: 15, y: 2, dir: 'down', sprite: 'chars/enforcer', sight: 3, cls: 'Grid Enforcer', name: 'Kasper',
      foes: [{ species: 'bisharp', level: 40 }, { species: 'garbodor', level: 39 }], intro: ['c8.bt.enf1.intro'], lose: ['c8.bt.enf1.lose'] }),
    trainer({ id: 'btEnf2', x: 1, y: 5, dir: 'right', sprite: 'chars/enforcer', sight: 4, cls: 'Grid Enforcer', name: 'Mads',
      foes: [{ species: 'golbat', level: 39 }, { species: 'houndoom', level: 40 }], intro: ['c8.bt.enf2.intro'], lose: ['c8.bt.enf2.lose'] }),
    itemBall('item.bt1', 17, 8, 'fullheal', 2, 'Full Heals')
  ],
  events: [{ x: 1, y: 7, w: 17, h: 1, on: 'step', when: f => !f('c8corridor'), run: corridor }]
};

// ---------- The siphon chamber ----------

function* chamber(s: ScriptApi): Step {
  s.setFlag('c8chamber', true);
  s.say('c8.ch.1');
  s.wait(20);
  s.say('c8.ch.view.1'); s.say('c8.ch.view.2');
  const l = cast(s, 'lukas8s'), m = cast(s, 'maja8s');
  s.player.faceTo(l.x, l.y);
  s.say('c8.ch.lukas.1'); s.wait(30); s.say('c8.ch.lukas.2'); s.say('c8.ch.maja.1'); s.say('c8.ch.lukas.3');
  s.sfx('select');
  s.say('c8.ch.pin');
  s.sfx('exclaim');
  s.say('c8.ch.screen');
  s.say('c8.ch.lindholm.1'); s.say('c8.ch.lindholm.2'); s.say('c8.ch.lukas.4'); s.say('c8.ch.lindholm.3');
  s.say('c8.ch.brix.1');
  s.say('c8.ch.kaas.1');
  l.n.hide(); m.n.hide();
  s.checkpoint();
  yield* kaasBattle(s);
}

function* kaasBattle(s: ScriptApi): Step {
  s.say('c8.kaas.2');
  const r = yield s.battle({ kind: 'trainer', ai: 3, bg: 'indoor1', trainer: { name: 'Kaas', title: 'Commander', sprite: 'tr/kaas' }, foes: [
    { species: 'hariyama', level: 39, moves: ['forcepalm', 'knockoff', 'bulletpunch', 'bulkup'] },
    { species: 'luxray', level: 39, moves: ['spark', 'crunch', 'icefang', 'leer'] },
    { species: 'lucario', level: 40, moves: ['aurasphere', 'metalclaw', 'quickattack', 'detect'] },
    { species: 'electivire', level: 42, moves: ['thunderpunch', 'lowkick', 'icepunch', 'firepunch'], item: 'sitrusberry' }
  ] });
  if (r !== 'win') return;
  s.setFlag('kaasBeat', true);
  s.say('c8.kaas.lose');
  s.say('c8.ch.brix.2');
  yield* escape(s);
}

function* escape(s: ScriptApi): Step {
  for (let i = 0; i < 3; i++) { s.sfx('exclaim'); s.fade(0.4, 4); s.fade(0, 4); }
  s.say('c8.esc.1');
  const f = cast(s, 'freja8s');
  s.player.faceTo(f.x, f.y);
  s.say('c8.esc.freja.1'); s.say('c8.esc.maja.1'); s.say('c8.esc.freja.2');
  f.n.hide();
  s.fade(1, 30);
  s.say('c8.esc.2');
  s.setTime('morning');
  s.warp('christianshavn', 6, 7, 'down');
  s.setRespawn('christianshavn', 22, 11, 'down', 'Nurse: Your team is rested. Be careful out there!');
  s.fade(0, 30);
  yield* dawn(s);
}

function* dawn(s: ScriptApi): Step {
  const m = cast(s, 'maja8d'), l = cast(s, 'lukas8d');
  s.player.faceTo(m.x, m.y);
  s.say('c8.dawn.1');
  s.say('c8.dawn.radio.1'); s.say('c8.dawn.radio.2'); s.say('c8.dawn.radio.3');
  s.say('c8.dawn.maja.1'); s.say('c8.dawn.lukas.1'); s.say('c8.dawn.maja.2'); s.say('c8.dawn.lukas.2');
  m.n.hide(); l.n.hide();
  s.setFlag('ch8done', true);
  s.checkpoint();
  s.chapterEnd('Chapter 8 complete', 'Trekroner');
  s.say('c8.end');
}

const SIPHON: MapScripts = {
  npcs: [
    ...[7, 8, 9].map((x, i): NpcDef => ({ id: `viewport${i}`, sprite: 'obj:viewport', x, y: 1, dir: 'down', object: true, talk: talk('c8.viewport') })),
    { id: 'screen', sprite: 'obj:tv', x: 5, y: 1, dir: 'down', object: true, talk: talk('c8.screen') },
    { id: 'kaas8', sprite: 'chars/kaas', x: 8, y: 3, dir: 'down', when: f => !f('kaasBeat'), talk: function* (s) {
      if (!s.flag('c8chamber')) return;
      yield* kaasBattle(s);
    } },
    { id: 'brix8', sprite: 'chars/scientist', x: 12, y: 2, dir: 'left', when: f => !f('kaasBeat'), talk: talk('c8.brix.talk') },
    { id: 'lukas8s', sprite: 'chars/lukas', x: 7, y: 6, dir: 'up', hidden: true },
    { id: 'maja8s', sprite: 'chars/maja', x: 9, y: 6, dir: 'up', hidden: true },
    { id: 'freja8s', sprite: 'chars/freja', x: 8, y: 9, dir: 'up', hidden: true }
  ],
  events: [{ x: 1, y: 6, w: 15, h: 1, on: 'step', when: f => !f('c8chamber'), run: chamber }]
};

/** Christianshavn at dawn: Maja and Lukas come ashore with you. */
export const DAWN_NPCS: NpcDef[] = [
  { id: 'maja8d', sprite: 'chars/maja', x: 7, y: 7, dir: 'down', hidden: true },
  { id: 'lukas8d', sprite: 'chars/lukas', x: 5, y: 7, dir: 'down', hidden: true }
];

export const TREKRONER_SCRIPTS: Record<string, MapScripts> = {
  fleetboat: FLEETBOAT, trekroner: TREKRONER, tklighthouse: TKLIGHTHOUSE, battery: BATTERY, siphon: SIPHON
};
