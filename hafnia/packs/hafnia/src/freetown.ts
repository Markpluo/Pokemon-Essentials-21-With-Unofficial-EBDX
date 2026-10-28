// Chapter 2, second half: Route 4 (the Grid Enforcer's Overcharge), Christianshavn and Freetown
// (Old Knud, the night market, the overheard secret), Stadsgraven and Gym 2 (Alva).
import type { NpcDef, Script } from '@hafnia/core';
import { centerNpcs } from './home';
import { itemBall, sign, talk, trainer, type MapScripts } from './lib';
import { rematch } from './rematch';

// ---------- Route 4 ----------

const enforcer: Script = function* (s) {
  if (s.flag('enforcer')) { s.say('Grid Enforcer: ...Fine. Go. I didn\'t see you.'); return; }
  s.say('Grid Enforcer: Restricted area. This barrier\nis part of the Vanguard grid. Turn around.');
  if (!s.flag('copper')) { s.say('Rotom: Bzzt! That barrier is way too strong.\nA Current alone won\'t get us through!'); return; }
  s.say('Grid Enforcer: Wait. You were at the drydock.\nThe Captain\'s little helper. Let\'s see how\nyou handle real power.');
  s.say('c2.enforcer.overcharge');
  const r = yield s.battle({ kind: 'trainer', ai: 2, overcharge: true, bg: 'city', trainer: { name: 'Kragh', title: 'Grid Enforcer', sprite: 'tr/enforcer' },
    prize: 40, foes: [{ species: 'pawmi', level: 17 }, { species: 'magnemite', level: 18 }] });
  if (r !== 'win') return;
  s.setFlag('enforcer', true);
  s.say('Grid Enforcer: Overcharge burns both ways...\nTake your barrier. I\'m going for a lie-down.');
  for (const b of ['bar1', 'bar2', 'bar3', 'bar4']) s.npc(b).hide();
  s.say('Rotom: Bzzt! Barrier down! Patina and Current,\nthat\'s us. Overcharge is just... rude.');
  s.checkpoint();
};

const ROUTE4: MapScripts = {
  npcs: [
    trainer({ id: 'erik', x: 5, y: 11, dir: 'right', sprite: 'chars/fisher', sight: 3, cls: 'Fisher', name: 'Erik',
      foes: [{ species: 'magikarp', level: 14 }, { species: 'magikarp', level: 14 }, { species: 'tentacool', level: 16 }],
      intro: ['Fisher Erik: Three Magikarp and a dream.\nWell, two Magikarp. And a Tentacool.'], lose: ['Erik: The dream is over.'] }),
    trainer({ id: 'mette', x: 12, y: 5, dir: 'left', sprite: 'chars/cyclist2', sight: 5, cls: 'Cyclist', name: 'Mette',
      foes: [{ species: 'starly', level: 16 }, { species: 'wingull', level: 16 }],
      intro: ['Cyclist Mette: Knippelsbro has the best view in\nthe city. Stop and look! Then battle.'], lose: ['Mette: Okay, I\'ll stop looking.'] }),
    trainer({ id: 'bo', x: 11, y: 11, dir: 'left', sprite: 'chars/sailor', sight: 4, cls: 'Sailor', name: 'Bo',
      foes: [{ species: 'machop', level: 17 }], intro: ['Sailor Bo: Machop and I haul ropes all day.\nWant to feel the burn?'], lose: ['Bo: That burn was mine.'] }),
    trainer({ id: 'r4dh1', x: 13, y: 8, dir: 'left', sprite: 'chars/deckhand', sight: 6, cls: 'Deckhand', name: 'Søren',
      foes: [{ species: 'croagunk', level: 16 }, { species: 'shellos', level: 16 }],
      intro: ['Deckhand: Christianshavn\'s off limits. Vanguard\nput up a barrier. We don\'t like it either.'], lose: ['Deckhand: Still don\'t like it.'] }),
    trainer({ id: 'r4dh2', x: 3, y: 12, dir: 'right', sprite: 'chars/deckhand', sight: 7, cls: 'Deckhand', name: 'Agnes', battle: { ai: 2 },
      foes: [{ species: 'stunky', level: 17 }, { species: 'mareanie', level: 17 }],
      intro: ['Deckhand: The sea is in pain. Do you even\nhear it?'], lose: ['Deckhand: You\'ll hear it. Everyone will.'] }),
    trainer({ id: 'kaj', x: 13, y: 12, dir: 'left', sprite: 'chars/fisher', sight: 7, cls: 'Fisher', name: 'Kaj', period: ['night'],
      foes: [{ species: 'finizen', level: 17 }], intro: ['Fisher Kaj: Finizen only come out at night.\nSo do I.'], lose: ['Kaj: Back to the quiet.'] }),
    trainer({ id: 'mikkelr', x: 5, y: 8, dir: 'right', sprite: 'chars/rocker', sight: 3, cls: 'Raver', name: 'Mikkel', period: ['night'],
      foes: [{ species: 'joltik', level: 17 }, { species: 'tadbulb', level: 17 }],
      intro: ['Raver Mikkel: The bridge lights make the best\nstrobe! Battle in time with the beat!'], lose: ['Mikkel: Off-beat. Totally off-beat.'] }),
    { id: 'enforcer', sprite: 'chars/enforcer', x: 8, y: 14, dir: 'up', talk: enforcer },
    ...[6, 7, 8, 9].map((x, i) => ({ id: `bar${i + 1}`, sprite: 'obj:barrier', x, y: 15, dir: 'down' as const, object: true,
      when: (f: (n: string) => any) => !f('enforcer'), talk: talk('A humming Vanguard barrier. The air tastes of copper.') })),
    itemBall('item.tmwp', 15, 13, 'tmwaterpulse', 1, 'TM Water Pulse')
  ] as NpcDef[]
};

// ---------- Christianshavn & Freetown ----------

const knud: Script = function* (s) {
  if (s.flag('rod')) { s.say('Knud: Caught anything? The eel of \'79 was THIS long.\nWell. This long. Maybe this long.'); return; }
  s.say('c2.knud.1'); s.say('c2.knud.2'); s.say('c2.knud.rod');
  s.giveItem('oldrod'); s.setFlag('rod', true); s.me('me_item');
  s.say('c2.got.rod');
  s.say('(Face water and press A to fish.)');
};

const CHRISTIANSHAVN: MapScripts = {
  onEnter: function* (s) {
    if (!s.flag('chrMaja')) {
      s.setFlag('chrMaja', true);
      const m = s.npc('maja');
      m.place(s.player.x + 1, s.player.y, 'left'); m.show(); m.facePlayer();
      s.say('c2.chr.maja.1');
      m.walk('down', 3, 10); m.hide();
    }
    if (s.period === 'night') s.say('c2.night.market');
  },
  npcs: [
    { id: 'maja', sprite: 'chars/maja', x: 0, y: 0, dir: 'down', hidden: true },
    { id: 'knud', sprite: 'chars/oldman', x: 9, y: 9, dir: 'up', talk: knud },
    { id: 'eavesdeck', sprite: 'chars/deckhand', x: 18, y: 7, dir: 'down', hidden: true },
    trainer({ id: 'rosa', x: 5, y: 12, dir: 'up', sprite: 'chars/picnicker', sight: 6, cls: 'Christianite', name: 'Rosa',
      foes: [{ species: 'cutiefly', level: 16 }, { species: 'smoliv', level: 16 }],
      intro: ['Christianite Rosa: Peace and love! And battles.\nMostly battles, today.'], lose: ['Rosa: Peace restored.'] }),
    trainer({ id: 'sos', x: 15, y: 12, dir: 'up', sprite: 'chars/painter', sight: 6, cls: 'Muralist', name: 'Søs',
      foes: [{ species: 'smeargle', level: 17 }], intro: ['Muralist Søs: Every wall in Freetown is a canvas.\nYou\'re a canvas too, kind of.'], lose: ['Søs: Masterpiece. Of losing.'] }),
    trainer({ id: 'lis', x: 8, y: 6, dir: 'down', sprite: 'chars/gardener', sight: 6, cls: 'Gardener', name: 'Lis',
      foes: [{ species: 'hoppip', level: 16 }, { species: 'petilil', level: 17 }],
      intro: ['Gardener Lis: Our garden lots feed half the street.\nRespect the beans!'], lose: ['Lis: The beans are fine. I am not.'] }),
    trainer({ id: 'oskar', x: 24, y: 12, dir: 'up', sprite: 'chars/rocker', sight: 1, cls: 'Raver', name: 'Oskar', period: ['night'],
      foes: [{ species: 'pawmi', level: 17 }, { species: 'shroodle', level: 17 }],
      intro: ['Raver Oskar: Night market\'s open! Dance first,\nshop later.'], lose: ['Oskar: Shopping now. Sad shopping.'] }),
    trainer({ id: 'frdeck', x: 16, y: 3, dir: 'left', sprite: 'chars/deckhand', sight: 4, cls: 'Deckhand', name: 'Malte', period: ['night'],
      foes: [{ species: 'shellos', level: 17 }, { species: 'stunky', level: 18 }],
      intro: ['Deckhand: Nobody checks the houseboats at night.\nExcept you, apparently.'], lose: ['Deckhand: Forget you saw me.'] }),
    itemBall('item.chr1', 3, 12, 'repel', 2, 'Repels')
  ],
  doors: { pc: function* (s) { s.warp('pcchristianshavn', 6, 5, 'up'); } },
  events: [{ x: 15, y: 9, w: 5, h: 2, on: 'step', when: f => !f('overhear'), run: function* (s) {
    s.setFlag('overhear', true);
    const d = s.npc('eavesdeck');
    d.show();
    s.say('c2.overhear.1');
    d.hide();
    const m = s.npc('maja');
    m.place(s.player.x - 1, s.player.y, 'right'); m.show(); m.facePlayer(); s.player.faceTo(m.x, m.y);
    s.say('c2.overhear.2');
    m.hide();
    s.sfx('select');
    s.say('c2.orsted.scan');
    s.me('me_item');
    s.say('c2.scan.got');
    s.setFlag('scan', true);
  } }]
};

// ---------- Stadsgraven ----------

const BOOMS = [{ id: 'boom1', x: 14, y: 4 }, { id: 'boom2', x: 21, y: 6 }, { id: 'boom3', x: 18, y: 8 }];
const boomsPushed = (f: (n: string) => any) => BOOMS.filter(b => f(b.id)).length;

const alva: Script = function* (s) {
  if (s.flag('lily')) { s.say('c2.alva.secret'); return; }
  if (!s.flag('alvaMet')) { s.say('c2.alva.1'); s.say('c2.alva.2'); s.setFlag('alvaMet', true); return; }
  const n = boomsPushed(name => s.flag(name));
  if (n < BOOMS.length) { s.say(`Alva: ${n} of ${BOOMS.length} booms in place. They float\nright by the planks.`); return; }
  if (!s.flag('boomsDone')) { s.setFlag('boomsDone', true); s.say('c2.alva.done'); s.checkpoint(); return; }
  s.say('Alva: The gym is my houseboat, just there.\nCome aboard when you\'re ready.');
};

const STADSGRAVEN: MapScripts = {
  npcs: [
    { id: 'alva', sprite: 'chars/alva', x: 10, y: 5, dir: 'down', when: f => !f('boomsDone'), talk: alva },
    ...BOOMS.map(b => ({ id: b.id, sprite: 'obj:boom', x: b.x, y: b.y, dir: 'down' as const, object: true, talk: function* (s) {
      if (!s.flag('alvaMet')) { s.say('A floating boom, drifting loose in the algae.'); return; }
      if (s.flag(b.id)) { s.say('The boom is in place, holding back the algae.'); return; }
      s.sfx('select');
      s.setFlag(b.id, true);
      const n = boomsPushed(name => s.flag(name));
      s.say(`You push the boom. It drifts into line with a thunk.\n(${n} of ${BOOMS.length})`);
    } } as NpcDef)),
    itemBall('item.sg1', 3, 11, 'superpotion', 2, 'Super Potions')
  ],
  doors: { gym: function* (s) {
    if (!s.flag('boomsDone')) { s.say('c2.gym.sign'); s.say('Nobody answers. Alva must be out by the moat.'); return; }
    s.warp('gym2', 8, 8, 'up');
  } }
};

// ---------- Gym 2: Alva ----------

const mirror = (flag: string): Script => function* (s) {
  if (s.flag(flag)) { s.say('The mirror holds the sun on the lilies.'); return; }
  const c: number = yield s.ask('A solar mirror on a swivel. Turn it toward...', ['The lily pads', 'The houseboat roof', 'The sky'], 2);
  if (c !== 0) { s.say('Light splashes on the water. Nothing happens.'); return; }
  s.sfx('select');
  s.setFlag(flag, true);
  s.say('Sunlight hits the lilies. They bloom into a bridge!');
};

const alvaGym: Script = function* (s) {
  if (s.flag('champion')) { yield* rematch(s, 'alva'); return; }
  if (s.flag('lily')) { s.say('c2.alva.secret'); return; }
  s.say('c2.alva.intro.1'); s.say('c2.alva.intro.2');
  const c: number = yield s.ask('Alva: Shall we?', ['Yes', 'Not yet'], 1);
  if (c !== 0) return;
  const r = yield s.battle({ kind: 'trainer', leader: true, ai: 3, bg: 'field', trainer: { name: 'Alva', title: 'Leader', sprite: 'tr/alva' }, foes: [
    { species: 'smoliv', level: 17, moves: ['razorleaf', 'tackle', 'helpinghand', 'sweetscent'] },
    { species: 'bounsweet', level: 17, moves: ['magicalleaf', 'playnice', 'rapidspin', 'splash'] },
    { species: 'skiddo', level: 18, moves: ['razorleaf', 'takedown', 'leechseed', 'growth'] },
    { species: 'lilligant', level: 19, moves: ['magicalleaf', 'sleeppowder', 'teeterdance', 'sunnyday'], ability: 'chlorophyll', item: 'sitrusberry' }
  ] });
  if (r !== 'win') return;
  s.say('c2.alva.lose'); s.say('c2.alva.badge');
  s.setFlag('lily', true);
  s.giveBadge('lily', 'Lily Badge');
  s.me('me_badge');
  s.say('c2.got.badge');
  s.giveItem('tmmagicalleaf'); s.me('me_item');
  s.say(`${s.player.name} got TM Magical Leaf!`);
  s.say('c2.alva.net'); s.say('c2.alva.obey'); s.say('c2.alva.secret');
  s.say('Your Pokédex buzzes. A message from Maja:\n"Dronning Louises Bro. Dusk. Something\'s happening."');
  s.checkpoint();
};

const GYM2: MapScripts = {
  npcs: [
    { id: 'alvag', sprite: 'chars/alva', x: 8, y: 1, dir: 'down', talk: alvaGym },
    { id: 'guide', sprite: 'chars/oldman', x: 10, y: 9, dir: 'up', talk: function* (s) { s.say(s.flag('lily') ? 'Gym guide: Well grown indeed!' : 'c2.gym.guide'); } },
    { id: 'mirror1', sprite: 'obj:mirror', x: 5, y: 8, dir: 'down', object: true, talk: mirror('mirror1') },
    { id: 'mirror2', sprite: 'obj:mirror', x: 1, y: 5, dir: 'down', object: true, talk: mirror('mirror2') },
    { id: 'lily1', sprite: 'obj:lily', x: 3, y: 7, dir: 'down', object: true, floor: true, when: f => !!f('mirror1') },
    { id: 'lily2', sprite: 'obj:lily', x: 4, y: 4, dir: 'down', object: true, floor: true, when: f => !!f('mirror2') },
    { id: 'lily3', sprite: 'obj:lily', x: 4, y: 3, dir: 'down', object: true, floor: true, when: f => !!f('mirror2') },
    trainer({ id: 'g2gardener', x: 6, y: 6, dir: 'left', sprite: 'chars/gardener', sight: 3, cls: 'Gardener', name: 'Henrik',
      foes: [{ species: 'hoppip', level: 16 }, { species: 'combee', level: 16 }], intro: ['c2.gym.gardener.intro'], lose: ['Gardener: You grew on me.'] }),
    trainer({ id: 'g2christianite', x: 11, y: 2, dir: 'left', sprite: 'chars/picnicker', sight: 7, cls: 'Christianite', name: 'Solvej',
      foes: [{ species: 'petilil', level: 17 }], intro: ['c2.gym.christ.intro'], lose: ['Christianite: Peace out.'] }),
    sign('g2sign', 13, 9, 'obj:sign', 'c2.gym.sign')
  ]
};

export const FREETOWN: Record<string, MapScripts> = {
  route4: ROUTE4, christianshavn: CHRISTIANSHAVN, pcchristianshavn: { npcs: centerNpcs('christianshavn', 22, 11) },
  stadsgraven: STADSGRAVEN, gym2: GYM2
};
