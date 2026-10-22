// Chapter 2, first half: Indre By, Nyhavn (the Black Fleet attack), the harbour bus and the
// Refshaleøen drydock, where Freja leaves a page of the Lighthouse Log and Ivar unlocks Copper.
import type { NpcDef, Script, ScriptApi } from '@hafnia/core';
import { centerNpcs } from './home';
import { itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';
import { TOWER6 } from './rundetarn';
import { majaStarter } from './starters';

// ---------- Indre By ----------

const INDREBY: MapScripts = {
  onEnter: function* (s) {
    if (!s.flag('c1done') || s.flag('c2')) return;
    s.setFlag('c2', true);
    s.chapterEnd('Chapter 2', 'Harbour Saboteurs');
    s.say('c2.strog.sign');
  },
  npcs: [
    sign('strsign', 8, 5, 'obj:sign', 'c2.strog.sign'),
    { id: 'stall', sprite: 'chars/clerk', x: 11, y: 6, dir: 'down', talk: function* (s) {
      s.say('c2.torv.stall.1');
      if (!s.flag('recipe1')) { s.say('c2.torv.stall.2'); s.setFlag('recipe1', true); s.me('me_item'); s.say(`${s.player.name} got a recipe card!`); }
    } },
    trainer({ id: 'viggo', x: 16, y: 10, dir: 'down', sprite: 'chars/juggler', sight: 1, cls: 'Busker', name: 'Viggo',
      foes: [{ species: 'kricketot', level: 13 }, { species: 'jigglypuff', level: 14 }], intro: ['c2.busker.intro'], lose: ['c2.busker.lose'], after: ['c2.busker.line'],
      reward: s => { s.giveItem('tmround'); s.me('me_item'); s.say(`${s.player.name} got TM Round!`); } }),
    trainer({ id: 'gerd', x: 7, y: 10, dir: 'right', sprite: 'chars/tourist', sight: 2, cls: 'Tourist', name: 'Gerd',
      foes: [{ species: 'vulpix', level: 14 }], intro: ['c2.tourist.intro'], lose: ['c2.tourist.lose'] }),
    trainer({ id: 'frederik', x: 26, y: 6, dir: 'down', sprite: 'chars/guard', sight: 2, cls: 'Royal Guard', name: 'Frederik',
      foes: [{ species: 'klink', level: 15 }, { species: 'lillipup', level: 15 }], intro: ['c2.guard.intro'], lose: ['c2.guard.lose'] }),
    trainer({ id: 'anders', x: 19, y: 7, dir: 'left', sprite: 'chars/student', sight: 2, cls: 'Student', name: 'Anders',
      foes: [{ species: 'natu', level: 14 }, { species: 'ralts', level: 14 }], intro: ['c2.student.intro'], lose: ['c2.student.lose'] }),
    trainer({ id: 'nanna', x: 12, y: 9, dir: 'down', sprite: 'chars/rocker', sight: 2, cls: 'Raver', name: 'Nanna', period: ['night'],
      foes: [{ species: 'pawmi', level: 15 }, { species: 'joltik', level: 15 }],
      intro: ['Raver Nanna: Strøget at night is one long dance floor.\nKeep up!'], lose: ['Nanna: Okay, I\'m sitting this one out.'] }),
    itemBall('item.ib1', 28, 11, 'superpotion', 1, 'a Super Potion')
  ],
  doors: {
    pc: function* (s) { s.warp('pcindreby', 6, 5, 'up'); },
    tower: function* (s) { s.warp('towerin', 4, 3, 'up'); }
  }
};

const TOWER: MapScripts = {
  ...TOWER6,
  npcs: [{ id: 'tycho', sprite: 'chars/scientist', x: 6, y: 2, dir: 'down', when: f => !f('ch6'), talk: talk('c2.rund.tycho', 'c2.rund.tycho.2') }, ...TOWER6.npcs!]
};

// ---------- Nyhavn ----------

// 2.2: the buoy goes up, Freja escapes, and you and Maja fight two Deckhands.
function* nyhavnAttack(s: ScriptApi): Step {
  s.say('c2.ny.sign');
  const maja = s.npc('maja');
  maja.place(s.player.x + 1, s.player.y, 'left'); maja.show(); maja.facePlayer();
  s.say('c2.ny.maja.1');
  s.sfx('hit_super');
  s.say('c2.ny.boom');
  s.npc('buoy').hide();
  const fr = s.npc('freja');
  fr.show();
  s.say('c2.ny.freja.1');
  fr.walk('right', 6, 6, true);
  fr.hide();
  const a = s.npc('dha'), b = s.npc('dhb');
  a.place(s.player.x + 3, s.player.y, 'left'); b.place(s.player.x + 3, s.player.y + (s.player.y < 10 ? 1 : -1), 'left');
  a.show(); b.show();
  s.say('c2.ny.deck.1'); s.say('c2.ny.deck.2'); s.say('c2.ny.maja.2');
  const r = yield s.battle({
    kind: 'trainer', bg: 'city', trainer: { name: 'Sander', title: 'Deckhand', sprite: 'tr/deckhand' },
    foes: [{ species: 'mareanie', level: 14 }, { species: 'stunky', level: 15 }],
    multi: {
      partner: { name: 'Maja', sprite: 'tr/maja', foes: [{ species: majaStarter(s), level: 15 }, { species: 'skwovet', level: 14 }] },
      second: { name: 'Bo', title: 'Deckhand', sprite: 'tr/deckhand', foes: [{ species: 'croagunk', level: 14 }, { species: 'shellos', level: 15 }] }
    }
  });
  if (r !== 'win') { a.hide(); b.hide(); maja.hide(); return; }
  s.say('c2.ny.deck.lose');
  a.hide(); b.hide();
  s.say('c2.ny.maja.3'); s.say('c2.ny.maja.4');
  maja.hide();
  s.setFlag('nyAttack', true);
  s.checkpoint();
}

const bodil = (to: 'drydock' | 'nyhavn'): Script => function* (s) {
  if (!s.flag('nyAttack')) { s.say('Captain Bodil: The harbour bus is waiting for the\nall-clear. Some commotion on the canal.'); return; }
  s.say(to === 'drydock' ? 'c2.bus.bodil.1' : 'Captain Bodil: Back to Nyhavn? Hold on to your hats.');
  const c: number = yield s.ask('Take the harbour bus?', ['Yes', 'No'], 1);
  if (c !== 0) return;
  s.fade(1, 20);
  if (to === 'drydock') { s.say('c2.bus.bodil.2'); s.warp('drydock', 3, 2, 'right'); }
  else s.warp('nyhavn', 22, 10, 'down');
  s.fade(0, 20);
};

const NYHAVN: MapScripts = {
  onEnter: function* (s) { if (!s.flag('nyAttack')) yield* nyhavnAttack(s); },
  npcs: [
    sign('nysign', 3, 3, 'obj:sign', 'c2.ny.sign'),
    { id: 'buoy', sprite: 'obj:buoy', x: 10, y: 6, dir: 'down', object: true, when: f => !f('nyAttack'), talk: talk('A Vanguard sensor buoy bobs in the canal.') },
    { id: 'maja', sprite: 'chars/maja', x: 0, y: 0, dir: 'down', hidden: true },
    { id: 'freja', sprite: 'chars/freja', x: 14, y: 4, dir: 'right', hidden: true },
    { id: 'dha', sprite: 'chars/deckhand', x: 0, y: 0, dir: 'left', hidden: true },
    { id: 'dhb', sprite: 'chars/deckhand', x: 0, y: 0, dir: 'left', hidden: true },
    { id: 'bodil', sprite: 'chars/sailor', x: 22, y: 11, dir: 'up', talk: bodil('drydock') },
    trainer({ id: 'henning', x: 17, y: 4, dir: 'down', sprite: 'chars/sailor', sight: 1, cls: 'Sailor', name: 'Henning',
      foes: [{ species: 'wingull', level: 14 }, { species: 'mankey', level: 15 }],
      intro: ['Sailor Henning: You look like you could use some sea air.\nAnd a battle!'], lose: ['Henning: Blown off course.'], after: ['c2.ny.sailor.line'] }),
    trainer({ id: 'hanspeter', x: 12, y: 10, dir: 'up', sprite: 'chars/tourist', sight: 1, cls: 'Tourist', name: 'Hans-Peter',
      foes: [{ species: 'eevee', level: 15 }], intro: ['Tourist Hans-Peter: Gerd says you\'re good. Gerd says\na lot of things. Let\'s see!'],
      lose: ['Hans-Peter: Gerd was right. Don\'t tell Gerd.'], after: ['c2.ny.tourist.line'] }),
    trainer({ id: 'line', x: 23, y: 6, dir: 'left', sprite: 'chars/swimmer', sight: 1, cls: 'Swimmer', name: 'Line',
      foes: [{ species: 'finizen', level: 15 }], intro: ['Harbour Swimmer Line: I swim here every morning.\nToday it nearly froze my toes off! Battle to warm up?'],
      lose: ['Line: Brr. Still cold. Still worth it.'] }),
    trainer({ id: 'nydeck', x: 4, y: 4, dir: 'right', sprite: 'chars/deckhand', sight: 3, cls: 'Deckhand', name: 'Ulf', when: f => !!f('nyAttack'),
      foes: [{ species: 'mareanie', level: 15 }, { species: 'carvanha', level: 15 }],
      intro: ['Deckhand: You again! The Captain said to\nleave you be. I didn\'t hear her.'], lose: ['Deckhand: I\'ll hear her next time.'] })
  ],
  doors: { cafe: function* (s) { s.warp('cafein', 5, 4, 'up'); } }
};

const CAFE: MapScripts = {
  npcs: [
    { id: 'barista', sprite: 'chars/clerk', x: 5, y: 1, dir: 'down', talk: function* (s) {
      s.say('Barista: Welcome in! Candles, blankets, hot cocoa.\nPeak hygge.');
      const c: number = yield s.ask('Stay a while?', ['Until evening', 'Until morning', 'No thanks'], 2);
      if (c === 2) return;
      s.fade(1, 20); s.setTime(c === 0 ? 'evening' : 'morning'); s.heal(); s.fade(0, 20);
      s.say('You lose track of time. Your team naps by the fire.');
    } },
    { id: 'regular', sprite: 'chars/oldman', x: 2, y: 4, dir: 'right',
      talk: talk('Regular: They say the harbour used to freeze over\nevery winter. Not in June, mind you.') }
  ]
};

// ---------- Refshaleøen drydock ----------

// 2.3 and 2.4: Ivar, then Freja and the Copper unlock.
function* afterIvar(s: ScriptApi): Step {
  s.say('c2.ivar.lose');
  const fr = s.npc('freja');
  fr.show(); fr.facePlayer(); s.player.faceTo(fr.x, fr.y);
  s.say('c2.freja.1'); s.say('c2.freja.2'); s.say('c2.freja.3'); s.say('c2.freja.4');
  fr.walk('up', 1, 10); fr.hide();
  s.say('c2.log.1');
  s.giveItem('lighthouselog'); s.me('me_item');
  s.say('c2.log.got');
  const iv = s.npc('ivar');
  iv.facePlayer(); s.player.faceTo(iv.x, iv.y);
  s.say('c2.nail.1'); s.say('c2.nail.2');
  s.giveItem('coppernail'); s.me('me_item');
  s.say(`${s.player.name} got the Copper Hull Nail!`);
  s.say('c2.nail.3');
  s.unlockCoil('copper'); s.setFlag('copper', true); s.me('me_item');
  s.say('c2.coil.got');
  s.checkpoint();
}

const DRYDOCK: MapScripts = {
  onEnter: function* (s) { if (!s.flag('dockSign')) { s.setFlag('dockSign', true); s.say('c2.dock.sign'); } },
  npcs: [
    { id: 'bodil2', sprite: 'chars/sailor', x: 1, y: 2, dir: 'right', talk: bodil('nyhavn') },
    trainer({ id: 'dd1', x: 8, y: 2, dir: 'down', sprite: 'chars/deckhand', sight: 2, cls: 'Deckhand', name: 'Rasmus',
      foes: [{ species: 'shellos', level: 15 }, { species: 'croagunk', level: 15 }], intro: ['c2.dock.deck.intro'], lose: ['c2.dock.deck.lose'] }),
    trainer({ id: 'dd2', x: 6, y: 6, dir: 'right', sprite: 'chars/deckhand', sight: 3, cls: 'Deckhand', name: 'Kirsten',
      foes: [{ species: 'carvanha', level: 16 }], intro: ['Deckhand: The Captain\'s busy. Go home, kid.'], lose: ['c2.dock.deck.lose'] }),
    trainer({ id: 'dd3', x: 16, y: 5, dir: 'down', sprite: 'chars/deckhand', sight: 2, cls: 'Deckhand', name: 'Bjarne',
      foes: [{ species: 'stunky', level: 16 }, { species: 'mareanie', level: 16 }], intro: ['c2.dock.deck.intro'], lose: ['Deckhand: Fine. FINE. The crane\'s broken anyway.'] }),
    trainer({ id: 'dd4', x: 19, y: 8, dir: 'down', sprite: 'chars/deckhand', sight: 1, cls: 'Deckhand', name: 'Tove', battle: { ai: 2 },
      foes: [{ species: 'croagunk', level: 17 }, { species: 'carvanha', level: 17 }],
      intro: ['Deckhand: Nobody touches the crane. Nobody!'], lose: ['Deckhand: ...Somebody touched the crane.'] }),
    { id: 'crane', sprite: 'obj:crane', x: 20, y: 9, dir: 'down', object: true, talk: function* (s) {
      if (s.flag('crane')) { s.say('The crane hook sways gently.'); return; }
      s.say('c2.dock.crane');
      const c: number = yield s.ask('Slide the hook where?', ['Left', 'Centre', 'Right, over the stuck container'], 1);
      if (c !== 2) { s.sfx('hit_weak'); s.say('The hook swings over empty concrete and back.'); return; }
      s.sfx('hit_super');
      s.say('c2.dock.crane.ok');
      s.setFlag('crane', true);
      s.npc('container').hide();
    } },
    { id: 'container', sprite: 'obj:container', x: 21, y: 7, dir: 'down', object: true, when: f => !f('crane'),
      talk: talk('A shipping container blocks the gap.\nThe crane console might move it.') },
    { id: 'ivar', sprite: 'chars/ivar', x: 24, y: 6, dir: 'left', trainer: { sight: 3, flag: 'ivar' }, talk: function* (s) {
      if (s.flag('ivar')) { s.say('Ivar: Mind how you go. And mind that nail.'); return; }
      s.say('c2.ivar.1'); s.say('c2.ivar.2');
      const r = yield s.battle({ kind: 'trainer', ai: 2, bg: 'city', trainer: { name: 'Ivar', title: 'Bosun', sprite: 'tr/ivar' }, prize: 80, foes: [
        { species: 'crabrawler', level: 16 }, { species: 'poliwag', level: 16 },
        { species: 'machop', level: 17, moves: ['karatechop', 'lowkick', 'focusenergy', 'leer'] }
      ] });
      if (r !== 'win') return;
      s.setFlag('ivar', true);
      yield* afterIvar(s);
    } },
    { id: 'freja', sprite: 'chars/freja', x: 25, y: 3, dir: 'down', hidden: true },
    itemBall('item.dd1', 26, 9, 'greatball', 2, 'Great Balls')
  ] as NpcDef[]
};

export const CITY: Record<string, MapScripts> = {
  indreby: INDREBY, towerin: TOWER, pcindreby: { npcs: centerNpcs('indreby', 5, 5) },
  nyhavn: NYHAVN, cafein: CAFE, drydock: DRYDOCK
};
