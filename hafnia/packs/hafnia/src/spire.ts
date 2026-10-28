// Chapter 9, The Spire: Slotsholmen, where Børsen stands under scaffolding after the fire and Vanguard's lawyers are
// carting off the archive. Margrethe, the royal archivist, nearly turns you in, then reads Andersen's ledger and lets
// you into the vault to save the second ledger before it is "archived". Gym 7 is the vault: three merchants' ledger
// tokens must balance the brass scales. Then Margrethe (Steel), the Spire Badge, the Storm Shield, the second ledger,
// and Lukas waiting on Knippelsbro, on your side now but needing to know he is strong enough.
import { maxPp, type NpcDef, type Script, type ScriptApi } from '@hafnia/core';
import { centerNpcs } from './home';
import { grown, itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';
import { rematch } from './rematch';
import { lukasStarter } from './starters';

// ---------- The chapter starts ----------

/** Runs on the next map you enter after dawn in Christianshavn. */
export function* ch9Start(s: ScriptApi): Step {
  if (!s.flag('ch8done') || s.flag('ch9')) return;
  s.setFlag('ch9', true);
  s.chapterEnd('Chapter 9', 'The Spire');
  s.sfx('select');
  s.say('c9.start.1'); s.say('c9.start.2');
  s.checkpoint();
}

/** Knippelsbro's lane west to Slotsholmen opens with Chapter 9. */
export const slotsholmenGate: Script = function* (s) {
  if (s.flag('ch9')) return true;
  s.say('c9.gate.early');
  return false;
};

/** Puts a hidden scene NPC next to the player, facing them. */
function cast(s: ScriptApi, id: string, nearX = s.player.x, nearY = s.player.y) {
  const n = s.npc(id);
  const [x, y] = s.freeSpotNear(nearX, nearY);
  n.place(x, y, 'down'); n.show(); n.facePlayer();
  return { n, x, y };
}

// ---------- Slotsholmen ----------

function* arrive(s: ScriptApi): Step {
  s.setFlag('c9arrive', true);
  s.say('c9.sl.arrive.1'); s.say('c9.sl.arrive.2');
  const m = cast(s, 'maja9'), l = cast(s, 'lukas9a');
  s.player.faceTo(m.x, m.y);
  s.say('c9.sl.maja.1'); s.say('c9.sl.lukas.1'); s.say('c9.sl.maja.2'); s.say('c9.sl.lukas.2');
  m.n.walk('left', 4); m.n.hide(); l.n.walk('left', 4); l.n.hide();
  s.checkpoint();
}

const SLOTSHOLMEN: MapScripts = {
  onEnter: function* (s) { if (s.flag('ch9') && !s.flag('c9arrive')) yield* arrive(s); },
  doors: {
    borsen: function* (s) { s.sfx('door'); s.warp('borsen', 8, 7, 'up'); },
    pc: function* (s) { s.warp('pcslotsholmen', 6, 5, 'up'); }
  },
  npcs: [
    { id: 'maja9', sprite: 'chars/maja', x: 22, y: 9, dir: 'down', hidden: true },
    { id: 'lukas9a', sprite: 'chars/lukas', x: 22, y: 10, dir: 'down', hidden: true },
    sign('slsign', 24, 8, 'obj:sign', 'c9.sl.sign'),
    sign('slscaffold', 13, 6, 'obj:sign', 'c9.sl.scaffold'),
    sign('slpalace', 4, 6, 'obj:sign', 'c9.sl.palace'),
    { id: 'slvan', sprite: 'obj:container', x: 16, y: 7, dir: 'down', object: true, talk: talk('c9.sl.van') },
    { id: 'slcrowd', sprite: 'chars/oldwoman', x: 9, y: 9, dir: 'right', talk: talk('c9.sl.crowd') },
    { id: 'slguard', sprite: 'chars/guard', x: 3, y: 7, dir: 'down', talk: talk('c9.sl.guard') },
    trainer({ id: 'slLawyer1', x: 21, y: 7, dir: 'left', sprite: 'chars/lawyer', sight: 4, cls: 'Vanguard Lawyer', name: 'Henriksen',
      foes: [{ species: 'klang', level: 40 }, { species: 'bronzor', level: 41 }], intro: ['c9.sl.law1.intro'], lose: ['c9.sl.law1.lose'] }),
    trainer({ id: 'slLawyer2', x: 8, y: 12, dir: 'right', sprite: 'chars/lawyer', sight: 3, cls: 'Vanguard Lawyer', name: 'Lund',
      foes: [{ species: 'pawniard', level: 41 }, { species: 'magneton', level: 41 }], intro: ['c9.sl.law2.intro'], lose: ['c9.sl.law2.lose'] }),
    trainer({ id: 'slGuard', x: 4, y: 10, dir: 'right', sprite: 'chars/guard', sight: 3, cls: 'Royal Guard', name: 'Anders',
      foes: [{ species: 'corvisquire', level: 41 }, { species: 'skarmory', level: 42 }], intro: ['c9.sl.rg.intro'], lose: ['c9.sl.rg.lose'] }),
    itemBall('item.sl1', 1, 16, 'hyperpotion', 2, 'Hyper Potions'),
    itemBall('item.sl2', 24, 2, 'ultraball', 3, 'Ultra Balls')
  ]
};

// ---------- Børsen: Margrethe and the lawyers ----------

const margrethe: Script = function* (s) {
  if (s.flag('spire')) { s.say('c9.mar.after'); return; }
  if (s.flag('vaultOpen')) { s.say('c9.mar.go'); return; }
  if (s.hasItem('roskildepage') && s.hasItem('ledgercopy')) {
    // The Roskilde Saga: the crypt's page carries the royal archivists' seal, and Margrethe trusts you at once.
    s.say('Margrethe: Børsen is closed for restoration...\nIs that the royal crypt seal? On a page of Andersen?');
    s.say('Margrethe: Only a king\'s archivist could have hidden that\nin Roskilde. You went down into the crypt for it?');
    s.say('Margrethe: Then I don\'t need a reason. Show me the rest.');
  } else {
    s.say('c9.mar.1'); s.say('c9.mar.2'); s.say('c9.mar.3');
    if (!s.hasItem('ledgercopy')) { s.say('c9.mar.noledger'); return; }
    const c: number = yield s.ask('c9.mar.ask', ['Show Andersen\'s ledger', 'Leave'], 1);
    if (c !== 0) { s.say('c9.mar.leave'); return; }
  }
  s.say('c9.mar.read.1'); s.wait(30); s.say('c9.mar.read.2'); s.say('c9.mar.read.3'); s.say('c9.mar.read.4');
  s.setFlag('vaultOpen', true);
  s.say('c9.mar.read.5');
  s.checkpoint();
};

const hatch: Script = function* (s) {
  if (!s.flag('vaultOpen')) { s.say('c9.hatch.locked'); return; }
  s.say('c9.hatch.down');
  s.sfx('door'); s.fade(1, 12);
  s.warp('gym7', 9, 12, 'up');
  s.fade(0, 12);
};

/** The archive clerk's Torkoal lived in the spire chimney and came through the fire. Once Margrethe trusts you, the
 *  clerk sends it with you: the vault is Steel, and it is the one Pokémon in Børsen that is not afraid of it. */
const clerk: Script = function* (s) {
  if (!s.flag('vaultOpen')) { s.say('c9.bs.clerk'); return; }
  if (s.flag('torkoalGift')) { s.say('c9.bs.clerk.after'); return; }
  s.say('c9.bs.clerk.gift.1');
  s.say('c9.bs.clerk.gift.2');
  const mon = s.givePokemon('torkoal', 40);
  mon.moves = ['flamethrower', 'bodypress', 'irondefense', 'stealthrock'].map(id => ({ id, pp: maxPp(id) }));
  mon.nickname = 'Kul'; mon.gender = 'M';
  s.setFlag('torkoalGift', true);
  s.me('me_get');
  s.say('c9.bs.clerk.got');
  s.say(s.party.includes(mon) ? 'c9.bs.clerk.party' : 'c9.bs.clerk.box');
};

const BORSEN: MapScripts = {
  npcs: [
    { id: 'margrethe', sprite: 'chars/margrethe', x: 5, y: 1, dir: 'down', when: f => !f('spire'), talk: margrethe },
    { id: 'hatch', sprite: 'obj:hatch', x: 12, y: 1, dir: 'down', object: true, talk: hatch },
    sign('bsboard', 10, 1, 'obj:poster', 'c9.bs.board'),
    { id: 'bsclerk', sprite: 'chars/archivist', x: 2, y: 4, dir: 'right', talk: clerk },
    { id: 'bsmover', sprite: 'chars/deckhand', x: 14, y: 4, dir: 'left', talk: talk('c9.bs.mover') },
    trainer({ id: 'bsLawyer1', x: 6, y: 6, dir: 'right', sprite: 'chars/lawyer', sight: 3, cls: 'Vanguard Lawyer', name: 'Petersen',
      foes: [{ species: 'bisharp', level: 41 }, { species: 'klang', level: 41 }], intro: ['c9.bs.law1.intro'], lose: ['c9.bs.law1.lose'] }),
    trainer({ id: 'bsLawyer2', x: 11, y: 6, dir: 'left', sprite: 'chars/lawyer', sight: 3, cls: 'Vanguard Lawyer', name: 'Gram',
      foes: [{ species: 'magneton', level: 41 }, { species: 'corvisquire', level: 41 }, { species: 'bronzor', level: 42 }], intro: ['c9.bs.law2.intro'], lose: ['c9.bs.law2.lose'] })
  ]
};

// ---------- Gym 7: the brass scales ----------

/** The merchants' ledger tokens, by weight in marks. The left pan holds twelve. */
const TOKENS = [{ id: 'tokenShip', name: 'Ship', marks: 5 }, { id: 'tokenSpice', name: 'Spice', marks: 7 }, { id: 'tokenSalt', name: 'Salt', marks: 4 }];

const merchant = (i: number, x: number, y: number, name: string, foes: { species: string; level: number }[]): NpcDef => trainer({
  id: `g7merchant${i}`, x, y, dir: 'down', sprite: 'chars/gentleman', sight: 2, cls: 'Merchant', name,
  foes, intro: [`c9.g7.m${i}.intro`], lose: [`c9.g7.m${i}.lose`],
  reward: s => { s.setFlag(TOKENS[i].id, true); s.sfx('select'); s.say(`c9.g7.m${i}.token`); }
});

const scales: Script = function* (s) {
  if (s.flag('scalesDone')) { s.say('c9.scales.done'); return; }
  s.say('c9.scales.1');
  const have = TOKENS.filter(t => s.flag(t.id));
  if (have.length < TOKENS.length) { s.say(s.t('c9.scales.need').replace('{n}', String(have.length))); return; }
  const options = ['Ship + Spice', 'Ship + Salt', 'Spice + Salt', 'All three'];
  const c: number = yield s.ask('c9.scales.ask', options, 3);
  if (c !== 0) { s.sfx('flee'); s.say('c9.scales.wrong'); return; }
  s.sfx('select'); s.wait(10); s.sfx('door');
  s.setFlag('scalesDone', true);
  s.say('c9.scales.right');
  s.checkpoint();
};

const margretheGym: Script = function* (s) {
  if (s.flag('champion')) { yield* rematch(s, 'margrethe'); return; }
  if (s.flag('spire')) { s.say('c9.mar.gym.after'); return; }
  s.say('c9.mar.gym.1'); s.say('c9.mar.gym.2');
  const c: number = yield s.ask('c9.mar.gym.ask', ['Yes', 'Not yet'], 1);
  if (c !== 0) return;
  const r = yield s.battle({ kind: 'trainer', leader: true, ai: 2, bg: 'indoor1', trainer: { name: 'Margrethe', title: 'Leader', sprite: 'tr/margrethe' }, foes: [
    { species: 'bronzong', level: 40, moves: ['flashcannon', 'extrasensory', 'payback', 'confuseray'] },
    { species: 'corviknight', level: 40, moves: ['steelwing', 'drillpeck', 'scaryface', 'bravebird'] },
    { species: 'copperajah', level: 41, moves: ['ironhead', 'stomp', 'rockslide', 'stealthrock'] },
    { species: 'duraludon', level: 43, moves: ['flashcannon', 'dragonpulse', 'thunderbolt', 'breakingswipe'], item: 'sitrusberry' }
  ] });
  if (r !== 'win') { s.say('c9.mar.gym.win'); return; }
  s.say('c9.mar.gym.lose');
  s.setFlag('spire', true);
  s.giveBadge('spire', 'Spire Badge');
  s.me('me_badge');
  s.say('c9.got.badge');
  s.say('c9.mar.shield');
  s.giveItem('stormshield'); s.me('me_item');
  s.say('c9.got.shield');
  s.say('c9.mar.ledger.1');
  s.giveItem('ledger2'); s.me('me_item');
  s.say('c9.got.ledger');
  s.say('c9.mar.ledger.2'); s.say('c9.mar.ledger.3'); s.say('c9.mar.ledger.4');
  s.checkpoint();
};

const GYM7: MapScripts = {
  npcs: [
    { id: 'g7ladder', sprite: 'obj:ladder', x: 9, y: 13, dir: 'down', object: true, talk: function* (s) {
      s.sfx('door'); s.warp('borsen', 12, 2, 'down');
    } },
    { id: 'g7guide', sprite: 'chars/oldman', x: 15, y: 13, dir: 'left', talk: function* (s) {
      if (s.flag('spire')) { s.say('c9.g7.guide.after'); return; }
      s.say('c9.g7.guide.1'); s.say('c9.g7.guide.2');
    } },
    { id: 'scales', sprite: 'obj:scales', x: 9, y: 7, dir: 'down', object: true, talk: scales },
    ...[8, 9, 10].map((x, i): NpcDef => ({ id: `vaultgate${i}`, sprite: 'obj:grate', x, y: 4, dir: 'down', object: true,
      when: f => !f('scalesDone'), talk: talk('c9.g7.gate') })),
    sign('g7ledger1', 2, 5, 'obj:lectern', 'c9.g7.ledger.1'),
    sign('g7ledger2', 16, 5, 'obj:lectern', 'c9.g7.ledger.2'),
    merchant(0, 4, 7, 'Ole', [{ species: 'probopass', level: 41 }, { species: 'klang', level: 42 }]),
    merchant(1, 14, 7, 'Karen', [{ species: 'skarmory', level: 42 }, { species: 'magneton', level: 42 }]),
    merchant(2, 4, 12, 'Niels', [{ species: 'cufant', level: 41 }, { species: 'bronzong', level: 42 }]),
    { id: 'margretheg', sprite: 'chars/margrethe', x: 9, y: 2, dir: 'down', talk: margretheGym },
    itemBall('item.g71', 17, 1, 'revive', 1, 'a Revive')
  ]
};

// ---------- Knippelsbro: Lukas ----------

function* lukasBridge(s: ScriptApi): Step {
  const l = cast(s, 'lukas9');
  s.player.faceTo(l.x, l.y);
  s.say('c9.kb.lukas.1'); s.say('c9.kb.lukas.2'); s.say('c9.kb.lukas.3');
  s.heal(); s.me('me_heal');
  s.say('c9.kb.heal');
  const r = yield s.battle({ kind: 'trainer', soft: true, ai: 3, bg: 'city', trainer: { name: 'Lukas', title: 'Rival', sprite: 'tr/lukas' }, foes: [
    { species: 'magnezone', level: 41, moves: ['thunderbolt', 'flashcannon', 'thunderwave', 'triattack'] },
    { species: 'porygon2', level: 41, moves: ['triattack', 'psychic', 'recover', 'thunderbolt'] },
    { species: 'rotom', level: 42, moves: ['discharge', 'shadowball', 'thunderwave', 'confuseray'] },
    { species: grown(lukasStarter(s), 43), level: 43 }
  ] });
  s.setFlag('lukas9', true);
  s.say(r === 'win' ? 'c9.kb.lukas.lose' : 'c9.kb.lukas.win');
  s.say('c9.kb.lukas.4'); s.say('c9.kb.lukas.5');
  l.n.walk('down', 4); l.n.hide();
  s.setFlag('ch9done', true);
  s.checkpoint();
  s.chapterEnd('Chapter 9 complete', 'The Spire');
  s.say('c9.end');
}

/** Lukas waits on the bridge once you have the Spire Badge. */
export const ROUTE4_LUKAS: NpcDef = { id: 'lukas9', sprite: 'chars/lukas', x: 7, y: 6, dir: 'down', hidden: true };
export function* route4Enter(s: ScriptApi): Step {
  if (s.flag('spire') && !s.flag('lukas9')) yield* lukasBridge(s);
}

export const SPIRE_SCRIPTS: Record<string, MapScripts> = {
  slotsholmen: SLOTSHOLMEN, pcslotsholmen: { npcs: centerNpcs('slotsholmen', 21, 17) }, borsen: BORSEN, gym7: GYM7
};
