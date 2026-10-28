// The Roskilde Saga (from Badge 6): the old king's road west from Frederiksberg, Roskilde's cathedral and the
// royal crypt under it, where Vinther's Enforcers are hunting a page of Andersen's ledger hidden among the kings.
// The page makes Margrethe trust you at once in Chapter 9; the Viking Ship Museum gives you a Dhelmise.
import type { Script } from '@hafnia/core';
import { centerNpcs } from './home';
import { capLevel } from './kalvebod';
import { itemBall, sign, talk, trainer, type MapScripts } from './lib';

const ROSKILDE_BADGES = 6;

/** Roskildevej out of Frederiksberg opens with six badges. */
export const roskildeGate: Script = function* (s) {
  if (s.badges >= ROSKILDE_BADGES) return true;
  s.say('A farmer\'s tractor blocks Roskildevej.\n"Harvest! Nobody through without six badges. Wild Tauros out there."');
  return false;
};

const ROUTE10: MapScripts = {
  npcs: [
    trainer({ id: 'r10cyc', x: 9, y: 8, dir: 'right', sprite: 'chars/cyclist1', sight: 4, cls: 'Cyclist', name: 'Jesper',
      foes: [{ species: 'staravia', level: 38 }, { species: 'zebstrika', level: 39 }],
      intro: ['Cyclist Jesper: Thirty kilometres of headwind to Roskilde.\nA battle is a rest stop.'], lose: ['Cyclist Jesper: Back to the headwind.'] }),
    trainer({ id: 'r10gard', x: 20, y: 7, dir: 'down', sprite: 'chars/gardener', sight: 1, cls: 'Gardener', name: 'Birthe',
      foes: [{ species: 'dubwool', level: 39 }, { species: 'mudsdale', level: 40 }],
      intro: ['Gardener Birthe: Mind my wheat! Or battle me.\nBoth, actually.'], lose: ['Gardener Birthe: The wheat forgives you.'] }),
    trainer({ id: 'r10ranger', x: 33, y: 9, dir: 'left', sprite: 'chars/ranger', sight: 3, cls: 'Ranger', name: 'Søs',
      foes: [{ species: 'tauros', level: 40 }, { species: 'rufflet', level: 39 }, { species: 'girafarig', level: 40 }],
      intro: ['Ranger Søs: The Tauros run the road at harvest.\nShow me you can handle them.'], lose: ['Ranger Søs: You\'ll do. Roskilde\'s just ahead.'] }),
    sign('r10sign', 41, 7, 'obj:sign', 'ROSKILDEVEJ. West: Roskilde, 4 km.\nEast: Frederiksberg. Beware of the Tauros.'),
    itemBall('item.r10a', 4, 3, 'hyperpotion', 1, 'a Hyper Potion'),
    itemBall('item.r10b', 38, 12, 'ultraball', 3, 'Ultra Balls')
  ]
};

const ROSKILDE: MapScripts = {
  onEnter: function* (s) {
    if (s.flag('roskildeArrive')) return;
    s.setFlag('roskildeArrive', true);
    s.say('Twin green spires over red brick, and the fjord beyond.\nROSKILDE, where the old kings sleep.');
  },
  npcs: [
    { id: 'rkguide', sprite: 'chars/tourist', x: 15, y: 10, dir: 'down', talk: talk('Tourist: The cathedral has forty kings and queens\nin it. Forty! Copenhagen only has traffic.') },
    { id: 'rkkid', sprite: 'chars/kid', x: 5, y: 12, dir: 'right', talk: talk('Kid: Men in grey coats went into the cathedral\nand didn\'t come out. My dad says it\'s "renovation".') },
    trainer({ id: 'rkviking', x: 12, y: 17, dir: 'right', sprite: 'chars/biker', sight: 7, cls: 'Viking Reenactor', name: 'Ulf',
      foes: [{ species: 'braviary', level: 40 }, { species: 'dhelmise', level: 39 }],
      intro: ['Viking Reenactor Ulf: Hold, traveller! None pass the longships\nwithout a battle. Museum rules.'], lose: ['Viking Reenactor Ulf: Valhalla can wait. I\'m on shift till five.'] }),
    itemBall('item.rk1', 27, 16, 'revive', 2, 'Revives')
  ],
  doors: {
    pc: function* (s) { s.warp('pcroskilde', 6, 5, 'up'); },
    cathedral: function* (s) { s.warp('domkirke', 6, 5, 'up'); },
    museum: function* (s) { s.warp('museum', 6, 4, 'up'); }
  }
};

const DOMKIRKE: MapScripts = {
  npcs: [
    { id: 'verger', sprite: 'chars/oldman', x: 9, y: 2, dir: 'down', talk: function* (s) {
      if (s.flag('roskildePage')) { s.say('Verger: The crypt is quiet again. The kings thank you.\nSo do I. My knees don\'t do stairs.'); return; }
      s.say('Verger: Some "inspectors" went down to the royal crypt with\ncrowbars. Grid Enforcers, if you ask me.');
      s.say('Verger: There\'s an old story that Andersen hid a page of\nhis ledger with the kings. I fear they\'ve heard it too.');
    } },
    { id: 'cryptstairs', sprite: 'obj:stairs', x: 6, y: 1, dir: 'down', object: true, talk: function* (s) {
      s.say('Worn stone steps lead down to the royal crypt.');
      s.sfx('door'); s.fade(1, 12);
      s.warp('crypt', 10, 8, 'up');
      s.fade(0, 12);
    } }
  ]
};

const tomb = (id: string, x: number, y: number, ...lines: string[]) => sign(id, x, y, 'obj:lectern', ...lines);

const ravn: Script = function* (s) {
  if (s.flag('roskildePage')) { s.say('An empty niche where the ledger page was hidden.\nThe kings keep their other secrets.'); return; }
  s.say('Enforcer Ravn: The kid from the radio. Of course.\nVinther wants this page burned, and I want my bonus.');
  const lv = Math.max(42, capLevel(s) - 1);
  const r = yield s.battle({ kind: 'trainer', ai: 3, bg: 'indoor1', trainer: { name: 'Ravn', title: 'Grid Enforcer', sprite: 'tr/enforcer' }, foes: [
    { species: 'skuntank', level: lv - 2, moves: ['crunch', 'poisonjab', 'suckerpunch', 'flamethrower'] },
    { species: 'magneton', level: lv - 1, moves: ['thunderbolt', 'flashcannon', 'triattack', 'thunderwave'] },
    { species: 'houndoom', level: lv, moves: ['darkpulse', 'flamethrower', 'suckerpunch', 'nastyplot'], item: 'sitrusberry' }
  ] });
  if (r !== 'win') return;
  s.say('Enforcer Ravn: Fine. Keep the scrap of paper.\nThe grid doesn\'t care about old songs anyway.');
  s.npc('ravn').hide();
  s.say('Behind a loose stone in Margrethe I\'s tomb, a folded page,\nin Andersen\'s spidery hand.');
  s.setFlag('roskildePage', true);
  s.giveItem('roskildepage'); s.me('me_item');
  s.say(`${s.player.name} found the Roskilde ledger page!`);
  s.say(s.flag('spire') ? 'The page names the Pact\'s keepers: "the archivist at Børsen,\nthe singer in the Sound." You know both.'
    : 'The page names the Pact\'s keepers: "the archivist at Børsen,\nthe singer in the Sound." Børsen is on Slotsholmen.');
  s.checkpoint();
};

const CRYPT: MapScripts = {
  npcs: [
    trainer({ id: 'crEnf1', x: 10, y: 7, dir: 'down', sprite: 'chars/enforcer', sight: 1, cls: 'Grid Enforcer', name: 'Grunt',
      foes: [{ species: 'stunky', level: 40 }, { species: 'magneton', level: 41 }],
      intro: ['Enforcer: This crypt is closed for "inspection".\nInspect this!'], lose: ['Enforcer: Ugh. Ravn\'s going to dock my pay.'] }),
    trainer({ id: 'crEnf2', x: 1, y: 5, dir: 'down', sprite: 'chars/enforcer', sight: 3, cls: 'Grid Enforcer', name: 'Grunt',
      foes: [{ species: 'golbat', level: 41 }, { species: 'klang', level: 41 }],
      intro: ['Enforcer: I\'ve been reading tomb lids for three hours.\nThe kings had terrible handwriting.'], lose: ['Enforcer: Back to the lids.'] }),
    trainer({ id: 'crEnf3', x: 17, y: 6, dir: 'up', sprite: 'chars/enforcer', sight: 3, cls: 'Grid Enforcer', name: 'Grunt',
      foes: [{ species: 'murkrow', level: 41 }, { species: 'skuntank', level: 42 }],
      intro: ['Enforcer: You hear that? The kings don\'t like us.\nI don\'t like it down here either!'], lose: ['Enforcer: Can I go home now?'] }),
    { id: 'ravn', sprite: 'chars/enforcer', x: 10, y: 1, dir: 'down', when: f => !f('roskildePage'), talk: ravn },
    tomb('tombHarald', 1, 4, 'A worn pillar: "HARALD BLUETOOTH".\nThe guidebook says he\'s probably here. Probably.'),
    tomb('tombChr4', 19, 4, 'A black marble tomb: "CHRISTIAN IV".\nHe built half of Copenhagen, and Rundetårn.'),
    tomb('tombMarg', 8, 1, 'The tomb of MARGRETHE I, who united the North.\nOne stone at its foot has been prised loose.'),
    itemBall('item.cr1', 4, 6, 'ultraball', 2, 'Ultra Balls'),
    itemBall('item.cr2', 17, 4, 'duskstone', 1, 'a Dusk Stone')
  ],
  events: [{ x: 13, y: 1, on: 'interact', run: ravn, when: f => !!f('roskildePage') }]
};

const MUSEUM: MapScripts = {
  npcs: [
    { id: 'curator', sprite: 'chars/archivist', x: 6, y: 1, dir: 'down', talk: function* (s) {
      if (s.flag('museumGift')) { s.say('Curator: Skuldelev 2 sailed to Ireland a thousand years ago.\nThe Dhelmise never forgot the way.'); return; }
      if (!s.flag('roskildePage')) {
        s.say('Curator: Five longships, sunk on purpose in the fjord\nto block raiders. We raised them in 1962.');
        s.say('Curator: The cathedral verger looks worried today.\nSomething about the crypt. Could you look in on him?');
        return;
      }
      s.say('Curator: You chased the Enforcers out of the crypt? The\nwhole town is talking. Let me give you something.');
      s.say('Curator: When we raised the ships, a Dhelmise came up\nwith one of the anchors. It has lived here ever since.');
      s.say('Curator: It gets restless. It wants to sail.');
      s.cry('dhelmise');
      s.givePokemon('dhelmise', Math.max(40, capLevel(s) - 4));
      s.me('me_get');
      s.say(`${s.player.name} received Dhelmise!`);
      s.setFlag('museumGift', true);
    } },
    sign('shipsign1', 1, 2, 'obj:sign', 'SKULDELEV 1: a sturdy trading ship.\nOak planks, Norwegian pine, Danish patience.'),
    sign('shipsign2', 11, 4, 'obj:sign', 'SKULDELEV 2: a warship, 30 metres long, 60 oars.\nBuilt near Dublin around 1042.')
  ]
};

export const ROSKILDE_SCRIPTS: Record<string, MapScripts> = {
  route10: ROUTE10, roskilde: ROSKILDE, pcroskilde: { npcs: centerNpcs('roskilde', 22, 7) },
  domkirke: DOMKIRKE, crypt: CRYPT, museum: MUSEUM
};
