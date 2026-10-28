// The story route, chapter by chapter, as a first-time player would take it: goals in story order,
// each one retried after training if the player loses. Each chapter starts from the previous
// chapter's save, so a run can resume anywhere (npm run playthrough -- --from ch3).
import type { Player } from './driver';
import { goto, plan } from './nav';

type P = Player;

// ---------- shared ----------

/** Where the player can heal, once the story has taken them there (the flag). */
const HEALERS: [string, number, number, string][] = [
  ['flat', 6, 2, 'starter'], ['pcnorrebro', 2, 2, 'starter'], ['pcindreby', 2, 2, 'c2'], ['pcchristianshavn', 2, 2, 'chrMaja'],
  ['pcvesterbro', 2, 2, 'vbArrive'], ['pcfrederiksberg', 2, 2, 'ch5met'],
  ['pcosterbro', 2, 2, 'c7met'], ['pcbakken', 2, 2, 'bakkenSeen'], ['trekroner', 12, 21, 'c8land'], ['pcslotsholmen', 2, 2, 'c9arrive'],
  ['shipyards', 2, 4, 'c10arrive'], ['pccopenhill', 2, 2, 'c10hill'],
  ['floodnyhavn', 1, 10, 'ch11'], ['metro', 1, 8, 'c11metro'], ['pchelsingor', 2, 2, 'c11ruins'],
  ['stormhill', 3, 22, 'ch12'], ['leaguehall', 3, 1, 'ch13']
];

/** Walks to the nearest open Pokémon Center (or Mum) and heals. */
export function heal(p: P) {
  const best = HEALERS.filter(h => p.flag(h[3])).map(([m, x, y]) => ({ m, x, y, route: plan(p.mapId, m) })).filter(h => h.route)
    .sort((a, b) => a.route!.length - b.route!.length)[0];
  if (!best) throw new Error(`no healer reachable from ${p.mapId}`);
  goto(p, best.m);
  if (best.m === 'flat') p.talkTo(...p.npcPos('mum')); else p.talkTo(best.x, best.y);
}

/** Maps with wild Pokémon the player trains on, by chapter. */
let grindMaps: string[] = ['route1'];

/** Trains on the nearest grind map until the whole team's top level reaches `level`. */
export function train(p: P, level: number, why: string) {
  // Like a player: train towards the foe's level, but not past the soft cap (Exp is a trickle beyond it),
  // and bring the rest of the team along to within two levels.
  const rules = p.game.content.rules;
  const cap = rules.levelCaps[p.s.badges.length + (rules.capFlags ?? []).filter(f => p.s.flags[f]).length] ?? Infinity;
  level = Math.min(level, cap);
  const ok = () => p.leadLevel >= level && p.minLevel >= level - 2;
  const before = `${p.minLevel}-${p.leadLevel}`;
  if (ok()) return;
  const map = grindMaps.map(m => ({ m, route: plan(p.mapId, m) })).filter(x => x.route).sort((a, b) => a.route!.length - b.route!.length)[0]?.m;
  if (!map) throw new Error('nowhere to train');
  const b0 = p.battles.length;
  for (let round = 0; round < 12 && !ok(); round++) {
    if (process.env.PT_TRACE) console.error(`[train] round ${round} team ${p.minLevel}-${p.leadLevel} -> ${level} on ${map}`);
    heal(p);
    goto(p, map);
    p.grind(() => ok() || p.hurt(), 40);
  }
  heal(p);
  p.notes.push(`trained ${before} -> ${p.minLevel}-${p.leadLevel} on ${map} (${p.battles.length - b0} wild battles) for ${why}`);
}

function goal(p: P, name: string, done: () => boolean, act: () => void) {
  for (let attempt = 0; attempt < 6; attempt++) {
    if (done()) return;
    if (p.flag("starter") && p.hurt()) heal(p);       // a careful player heals before moving on
    if (process.env.PT_TRACE) console.error(`[goal] ${name} (try ${attempt + 1}) at ${p.mapId} ${p.s.x},${p.s.y} team ${p.s.party.map(m => `${m.species} ${m.level} ${m.hp}`).join(', ')}`);
    const l0 = p.losses;
    try { act(); } catch (e) { if (p.losses === l0) throw new Error(`${name}: ${(e as Error).message}`); }
    if (done()) return;
    if (p.losses === l0) throw new Error(`${name}: did not happen`);
    const lost = p.battles.filter(b => b.result === 'lose').at(-1)!;
    const top = Math.max(...lost.foes.split(', ').map(f => Number(f.split(' ').at(-1)) || 0));
    p.notes.push(`lost to ${lost.trainer || `wild ${lost.foes}`} (${lost.foes}) with [${lost.team}] during "${name}"`);
    train(p, Math.max(p.leadLevel + 2, top + 2), name);
  }
  throw new Error(`${name}: gave up after 6 tries`);
}

/** Like a player with a new Pokémon in the box: at a Center PC, put the weakest team member away and take it out. */
function swapIn(p: P, pc: string, species: string) {
  const mon = p.s.box.find(m => m.species === species);
  if (!mon) return;
  goto(p, pc);
  p.talkTo(6, 1);
  const weakest = [...p.s.party].filter(m => !m.egg).sort((a, b) => a.level - b.level)[0];
  p.send({ t: 'pc', op: 'deposit', uid: weakest.uid });
  p.send({ t: 'pc', op: 'withdraw', uid: mon.uid });
  p.send({ t: 'pc', op: 'close' });
  if (!p.s.party.includes(mon)) throw new Error(`could not swap in ${species}`);
  p.notes.push(`swapped ${weakest.species} ${weakest.level} out for ${species} ${mon.level}`);
}

/** Before a big fight, a careful player tops up: heal and buy balls/potions with spare money. */
function shopAndHeal(p: P, pc: string) {
  goto(p, pc);
  const balls = p.s.badges.length >= 2 ? 'Great Ball' : 'Poké Ball';
  const money = p.s.money;
  const buys: [string, 1 | 5 | 10][] = [];
  if ((p.s.bag.potion ?? 0) + (p.s.bag.superpotion ?? 0) < 5 && money > 2000) buys.push([p.s.badges.length >= 1 ? 'Super Potion' : 'Potion', 5]);
  if ((p.s.bag.pokeball ?? 0) + (p.s.bag.greatball ?? 0) < 6 && money > 4000) buys.push([balls, 5]);
  if (buys.length) p.buy(buys);
  p.talkTo(2, 2);
}

// ---------- Prologue ----------

export function prologue(p: P) {
  grindMaps = ['route1'];
  p.answers.push({ when: /^Choose /, pick: 'Yes' }, { when: /nickname/i, pick: 'No' });
  goal(p, 'starter', () => !!p.flag('beatLukas'), () => goto(p, 'palmhouse'));
  p.catchAll = true;                      // a new player catches what they meet
  goal(p, 'Maja on Route 1', () => !!p.flag('beatMaja'), () => { goto(p, 'route1'); p.walkTo(12, 24); });
  goal(p, 'home for Chapter 1', () => !!p.flag('ch1'), () => goto(p, 'flat'));
}

// ---------- Chapter 1: The Red Streak ----------

export function chapter1(p: P) {
  grindMaps = ['route1', 'garden', 'norrebro'];
  goal(p, 'Kaas at Superkilen', () => !!p.flag('kaas'), () => { goto(p, 'norrebro'); p.walkTo(7, 15); });
  goal(p, 'Ørsted sends you to the tunnels', () => !!p.flag('tunnelQuest'), () => { goto(p, 'palmhouse'); p.talkTo(8, 7); });
  goal(p, 'open the valve', () => !!p.flag('valve'), () => { goto(p, 'tunnels'); p.talkTo(20, 13); });
  goal(p, 'the Grimer swarm', () => !!p.flag('swarm'), () => { goto(p, 'tunnels'); p.walkTo(17, 11); p.walkTo(18, 13); p.walkTo(17, 11); });
  goal(p, 'back to Ørsted', () => !!p.flag('tunnelsDone'), () => { goto(p, 'palmhouse'); p.talkTo(8, 7); });
  goal(p, 'Tariq: the mural quest', () => !!p.flag('muralQuest'), () => { goto(p, 'norrebro'); p.talkTo(6, 13); });
  goal(p, 'green paint', () => !!p.flag('paintGreen'), () => { goto(p, 'norrebro'); p.talkTo(3, 9); });
  goal(p, 'silver paint', () => !!p.flag('paintSilver'), () => { goto(p, 'norrebro'); p.talkTo(16, 9); });
  goal(p, 'purple paint', () => !!p.flag('paintPurple'), () => {
    goto(p, 'norrebro');
    if (!p.s.bag.oranberry) { if (!p.flag('item.nb1')) p.talkTo(2, 5); else { goto(p, 'flat'); p.talkTo(2, 5); goto(p, 'norrebro'); } }
    p.talkTo(25, 6);
  });
  goal(p, 'gold paint', () => !!p.flag('paintGold'), () => {
    goto(p, 'norrebro'); p.talkTo(19, 15);
    if (!p.flag('paintGold') && p.flag('tr.yusuf')) throw new Error('BLOCKER: Yusuf was beaten before the mural quest, so the gold paint can never be found');
  });
  goal(p, 'finish the mural', () => !!p.flag('mural'), () => { goto(p, 'norrebro'); p.talkTo(6, 13); });
  shopAndHeal(p, 'pcnorrebro');
  goal(p, 'gym 1 vents', () => !!p.flag('vents'), () => {
    goto(p, 'gym1');
    for (const x of [4, 10, 12, 2]) p.talkTo(x, 5);
  });
  goal(p, 'Tariq', () => !!p.flag('badge'), () => { goto(p, 'gym1'); p.talkTo(7, 2); });
  goal(p, 'Lukas and the blackout', () => !!p.flag('c1done'), () => { goto(p, 'norrebro'); });
}


// ---------- Chapter 2: Harbour Saboteurs ----------

export function chapter2(p: P) {
  grindMaps = ['garden', 'route4', 'christianshavn', 'stadsgraven'];
  goal(p, 'Indre By', () => !!p.flag('c2'), () => goto(p, 'indreby'));
  goal(p, 'the Nyhavn attack', () => !!p.flag('nyAttack'), () => goto(p, 'nyhavn'));
  shopAndHeal(p, 'pcindreby');
  goal(p, 'harbour bus to the drydock', () => p.mapId === 'drydock' || !!p.flag('ivar'), () => goto(p, 'drydock'));
  p.answers.push({ when: /Slide the hook/, pick: /^Right/ });
  goal(p, 'the crane', () => !!p.flag('crane'), () => { goto(p, 'drydock'); p.talkTo(20, 9); });
  goal(p, 'Ivar and Copper', () => !!p.flag('copper'), () => { goto(p, 'drydock'); p.talkTo(...p.npcPos('ivar')); });
  goal(p, 'the Grid Enforcer', () => !!p.flag('enforcer'), () => { goto(p, 'route4'); p.talkTo(8, 14); });
  goal(p, 'Christianshavn', () => !!p.flag('chrMaja'), () => goto(p, 'christianshavn'));
  goal(p, 'Old Knud\'s rod', () => !!p.flag('rod'), () => { goto(p, 'christianshavn'); p.talkTo(9, 9); });
  goal(p, 'the overheard secret', () => !!p.flag('overhear'), () => { goto(p, 'christianshavn'); p.walkTo(16, 9); });
  goal(p, 'meet Alva', () => !!p.flag('alvaMet'), () => { goto(p, 'stadsgraven'); p.talkTo(10, 5); });
  for (const [id, x, y] of [['boom1', 14, 4], ['boom2', 21, 6], ['boom3', 18, 8]] as const) {
    goal(p, id, () => !!p.flag(id), () => { goto(p, 'stadsgraven'); p.talkTo(x, y); });
  }
  goal(p, 'booms done', () => !!p.flag('boomsDone'), () => { goto(p, 'stadsgraven'); p.talkTo(10, 5); });
  shopAndHeal(p, 'pcchristianshavn');
  goal(p, 'mirror 1', () => !!p.flag('mirror1'), () => { goto(p, 'gym2'); p.talkTo(5, 8); });
  goal(p, 'mirror 2', () => !!p.flag('mirror2'), () => { goto(p, 'gym2'); p.talkTo(1, 5); });
  goal(p, 'Alva', () => !!p.flag('lily'), () => { goto(p, 'gym2'); p.talkTo(8, 1); });
  goal(p, 'the bridge at dusk', () => !!p.flag('demoEnd'), () => goto(p, 'bridge'));
}

// ---------- Chapter 3: The White Butchery ----------

export function chapter3(p: P) {
  grindMaps = ['route2', 'islandsbrygge', 'christianshavn'];
  goal(p, 'Den Grønne Sti', () => !!p.flag('ch3'), () => goto(p, 'route2'));
  goal(p, 'Vesterbro', () => !!p.flag('vbArrive'), () => goto(p, 'vesterbro'));
  goal(p, 'Kasper\'s dinner quest', () => !!p.flag('dinnerQuest'), () => { goto(p, 'kitchen'); p.talkTo(6, 1); });
  goal(p, 'ice salt', () => !!p.s.bag.icesalt || !!p.flag('dinnerDone'), () => { goto(p, 'kodbyen'); p.talkTo(7, 11); });
  goal(p, 'mussels', () => !!p.s.bag.mussels || !!p.flag('dinnerDone'), () => { goto(p, 'islandsbrygge'); p.talkTo(7, 3); });
  goal(p, 'sea buckthorn', () => !!p.s.bag.buckthorn || !!p.flag('dinnerDone'), () => { goto(p, 'islandsbrygge'); p.talkTo(19, 17); });
  goal(p, 'the Empty-Sea Dinner', () => !!p.flag('dinnerDone'), () => { goto(p, 'kitchen'); p.talkTo(6, 1); });
  shopAndHeal(p, 'pcvesterbro');
  goal(p, 'gym 3 valves', () => !!p.flag('steam'), () => {
    goto(p, 'gym3');
    if (p.s.x !== 7 || p.s.y !== 10) { p.walkTo(7, 11); goto(p, 'gym3'); }
    for (const d of ['up', 'right', 'down', 'left', 'up', 'right'] as const) p.step(d);
    p.face('right'); p.send({ t: 'interact' });
    for (const d of ['left', 'up', 'left', 'up', 'left', 'down'] as const) p.step(d);
    p.face('left'); p.send({ t: 'interact' });
    for (const d of ['up', 'right', 'down', 'right', 'up', 'right'] as const) p.step(d);
    p.face('right'); p.send({ t: 'interact' });
  });
  goal(p, 'Kasper', () => !!p.flag('frost'), () => {
    goto(p, 'gym3');
    if (p.s.y > 3) { if (p.s.x !== 7 || p.s.y !== 10) { p.walkTo(7, 11); goto(p, 'gym3'); } for (const d of ['up', 'right', 'down', 'left', 'up', 'right'] as const) p.step(d); for (const d of ['left', 'up', 'left', 'up', 'left', 'down'] as const) p.step(d); for (const d of ['up', 'right', 'down', 'right', 'up', 'right'] as const) p.step(d); for (const d of ['left', 'down', 'left', 'up', 'left', 'up', 'right', 'up'] as const) p.step(d); }
    p.talkTo(7, 1);
  });
  // Side trip: the ferry down to Dragør and Vuggestuen (needs three badges).
  goal(p, 'Vuggestuen', () => !!p.flag('vuggestuen'), () => { goto(p, 'dragor'); p.queue.push('Goodbye'); p.enter('vuggestuen'); });
  goto(p, 'islandsbrygge');
  goal(p, 'Maja on Cykelslangen', () => !!p.flag('ch3done'), () => goto(p, 'route3'));
}

// ---------- Chapter 4: Lanterns Out ----------

export function chapter4(p: P) {
  grindMaps = ['assistens', 'route2', 'islandsbrygge'];
  goal(p, 'Tariq\'s message', () => !!p.flag('ch4'), () => goto(p, 'norrebro'));
  goal(p, 'Søren at Assistens', () => !!p.flag('metSoren'), () => goto(p, 'assistens'));
  goal(p, 'the storm drain Lampent', () => !!p.flag('litwickBack'), () => { goto(p, 'stormdrain'); p.talkTo(12, 15); });
  goal(p, 'back up the ladder', () => !!p.flag('lanternsLit'), () => { goto(p, 'stormdrain'); p.talkTo(15, 15); });
  shopAndHeal(p, 'pcnorrebro');
  const traps: [number, number][] = [[7, 12], [12, 12], [2, 8], [7, 8], [2, 4], [12, 4]];
  goal(p, 'Søren', () => !!p.flag('lantern'), () => { goto(p, 'gym4'); p.walkTo(7, 3, traps); p.talkTo(7, 2); });
}

// ---------- Chapter 5: The Cisterns ----------

export function chapter5(p: P) {
  grindMaps = ['frederiksberg', 'assistens', 'route2'];
  goal(p, 'Ørsted\'s call', () => !!p.flag('ch5'), () => goto(p, 'norrebro'));
  goal(p, 'the briefing', () => !!p.flag('ch5met'), () => goto(p, 'frederiksberg'));
  shopAndHeal(p, 'pcfrederiksberg');
  goal(p, 'into the Cisterns', () => !!p.flag('cisArrive'), () => goto(p, 'cisterns'));
  goal(p, 'the mirror pool', () => !!p.flag('cisMirror'), () => { goto(p, 'cisterns'); p.talkTo(6, 5); });
  goal(p, 'wheel 1', () => (p.flag('cisLevel') as number) >= 1, () => { goto(p, 'cisterns'); p.talkTo(13, 1); });
  goal(p, 'wheel 2', () => (p.flag('cisLevel') as number) >= 2, () => { goto(p, 'cisterns'); p.talkTo(28, 1); });
  goal(p, 'the drone swarm', () => !!p.flag('swarmDone'), () => { goto(p, 'cisterns'); p.walkTo(21, 12); p.walkTo(14, 16); });
  goal(p, 'the Sunken Archive', () => !!p.flag('archiveDone'), () => { goto(p, 'cisterns'); p.walkTo(11, 16); });
  goal(p, 'Lukas at the pyramid', () => !!p.flag('ch5done'), () => { goto(p, 'cisterns'); p.talkTo(1, 20); });
}

// ---------- Chapter 6 ----------

export function chapter6(p: P) {
  grindMaps = ['frederiksberg', 'assistens', 'route2'];
  goal(p, 'Tycho\'s message', () => !!p.flag('ch6'), () => goto(p, 'route2'));
  goal(p, 'the Rundetårn lobby', () => !!p.flag('ch6met'), () => goto(p, 'towerin'));
  shopAndHeal(p, 'pcindreby');
  goal(p, 'the objective lens', () => !!p.flag('lens1Got'), () => { goto(p, 'bibliotek'); p.talkTo(1, 6); });
  goal(p, 'the eyepiece lens', () => !!p.flag('lens2Got'), () => { goto(p, 'trinitatis'); p.talkTo(12, 1); });
  // The star chart: north the Great Bear, east the Swan, west the Lion.
  goal(p, 'the brass rings', () => !!p.flag('ringsDone'), () => {
    goto(p, 'rundetarn');
    p.talkTo(7, 15);
    for (const [x, y, sign] of [[8, 11, 'Lion'], [12, 8, 'Great Bear'], [14, 11, 'Swan']] as const) { p.queue.push(sign); p.talkTo(x, y); }
  });
  goal(p, 'Tycho', () => !!p.flag('orrery'), () => { goto(p, 'rundetarn'); p.walkTo(11, 12); p.talkTo(11, 11); });
}

// ---------- Chapter 7: North by Kystbanen ----------

export function chapter7(p: P) {
  grindMaps = ['osterbro', 'route8', 'lyngby', 'dyrehaven'];
  goal(p, 'the chapter opens', () => !!p.flag('ch7'), () => goto(p, 'indreby'));
  goal(p, 'Maja at Langelinie', () => !!p.flag('c7met'), () => goto(p, 'osterbro'));
  goal(p, 'the Little Mermaid', () => !!p.flag('statueHeard'), () => { goto(p, 'osterbro'); p.talkTo(22, 13); });
  shopAndHeal(p, 'pcosterbro');
  goal(p, 'the Kastellet gauntlet', () => !!p.flag('gauntletDone'), () => { goto(p, 'kastellet'); p.talkTo(11, 2); });
  goal(p, 'Ingrid\'s legend', () => !!p.flag('ingridTold'), () => { goto(p, 'lyngby'); p.talkTo(9, 8); });
  goal(p, 'Dyrehaven at sundown', () => !!p.flag('dyrehavenSeen'), () => goto(p, 'dyrehaven'));
  goal(p, 'Sif', () => !!p.flag('sifMet'), () => { goto(p, 'dyrehaven'); p.walkTo(26, 8); });
  goal(p, 'the substation', () => !!p.flag('lightsOn'), () => { goto(p, 'substation'); p.talkTo(7, 1); });
  goal(p, 'Bakken', () => !!p.flag('bakkenSeen'), () => goto(p, 'bakken'));
  shopAndHeal(p, 'pcbakken');
  // The weeping mirror is the true one; then red, green and blue carts to the stage.
  goal(p, 'the mirror', () => !!p.flag('mirrorDone'), () => { goto(p, 'gym6'); p.talkTo(12, 11); });
  goal(p, 'Pierrot', () => !!p.flag('harlequin'), () => {
    goto(p, 'gym6');
    if (p.s.y > 9) p.walkTo(10, 9);
    if (p.s.y > 3 || p.s.x !== 10) { p.talkTo(8, 7); p.talkTo(5, 1); p.talkTo(15, 1); }
    p.talkTo(10, 1);
  });
  goal(p, 'Maja after the show', () => !!p.flag('ch7done'), () => goto(p, 'bakken'));
}

// ---------- Chapter 8: Trekroner ----------

export function chapter8(p: P) {
  grindMaps = ['dyrehaven', 'route8', 'osterbro', 'trekroner'];
  // Pierrot's charts: behind the breakwater, engines off, the south landing.
  p.answers.push({ when: /Which way/, pick: 'Behind' }, { when: /Speed or silence/, pick: 'Cut' }, { when: /Where do we land/, pick: /south/ });
  if (p.mapId === 'gym6' && p.s.y <= 9) p.talkTo(12, 1);    // the yellow car down from Pierrot's stage
  goal(p, 'the chapter opens', () => !!p.flag('ch8'), () => goto(p, 'bakken'));
  shopAndHeal(p, 'pcbakken');
  goal(p, 'the briefing', () => !!p.flag('c8brief'), () => goto(p, 'fleetboat'));
  goal(p, 'the hydrofoil run', () => !!p.flag('c8land'), () => { goto(p, 'fleetboat'); p.talkTo(5, 1); });
  goal(p, 'Maja is caught', () => !!p.flag('c8alarm'), () => { goto(p, 'trekroner'); p.walkTo(13, 14); });
  goal(p, 'the battery keys', () => !!p.flag('keysTaken'), () => { goto(p, 'tklighthouse'); p.talkTo(4, 3); });
  goal(p, 'the old photograph', () => !!p.flag('photoSeen'), () => { goto(p, 'tklighthouse'); p.talkTo(3, 1); });
  goal(p, 'the battery corridor', () => !!p.flag('c8corridor'), () => { goto(p, 'battery'); p.walkTo(9, 6); });
  goal(p, 'Maja', () => !!p.flag('mayaFree'), () => { goto(p, 'battery'); p.talkTo(10, 3); });
  goal(p, 'the siphon chamber', () => !!p.flag('c8chamber'), () => { goto(p, 'siphon'); p.walkTo(8, 6); });
  goal(p, 'Kaas', () => !!p.flag('ch8done'), () => { goto(p, 'siphon'); p.talkTo(8, 3); });
}

// ---------- Chapter 9: The Spire ----------

export function chapter9(p: P) {
  grindMaps = ['slotsholmen', 'dyrehaven', 'route8'];
  // The wall ledgers: ship five, salt four, spice seven; twelve in the left pan.
  p.answers.push({ when: /Which tokens/, pick: 'Ship + Spice' });
  goal(p, 'the chapter opens', () => !!p.flag('ch9'), () => goto(p, 'route4'));
  goal(p, 'Slotsholmen', () => !!p.flag('c9arrive'), () => goto(p, 'slotsholmen'));
  shopAndHeal(p, 'pcslotsholmen');
  goal(p, 'Margrethe reads the ledger', () => !!p.flag('vaultOpen'), () => { goto(p, 'borsen'); p.talkTo(5, 1); });
  goal(p, 'the clerk\'s Torkoal', () => !!p.flag('torkoalGift'), () => { goto(p, 'borsen'); p.talkTo(2, 4); });
  swapIn(p, 'pcslotsholmen', 'torkoal');
  for (const [id, x, y] of [['tokenShip', 4, 7], ['tokenSpice', 14, 7], ['tokenSalt', 4, 12]] as const) {
    goal(p, id, () => !!p.flag(id), () => { goto(p, 'gym7'); p.talkTo(x, y); });
  }
  goal(p, 'the scales', () => !!p.flag('scalesDone'), () => { goto(p, 'gym7'); p.talkTo(9, 7); });
  goal(p, 'Margrethe', () => !!p.flag('spire'), () => { goto(p, 'gym7'); p.walkTo(9, 3); p.talkTo(9, 2); });
  goal(p, 'Lukas on Knippelsbro', () => !!p.flag('ch9done'), () => { goto(p, 'slotsholmen'); goto(p, 'route4'); });
}

export function chapter10(p: P) {
  grindMaps = ['shipyards', 'eastquay', 'copenhill', 'slotsholmen'];
  goal(p, 'the chapter opens', () => !!p.flag('ch10'), () => goto(p, 'indreby'));
  goal(p, 'the shipyards', () => !!p.flag('c10arrive'), () => goto(p, 'shipyards'));
  goal(p, 'Brix on the east quay', () => !!p.flag('c10brix'), () => goto(p, 'eastquay'));
  goal(p, 'Lukas on the great crane', () => !!p.flag('c10lukas'), () => { goto(p, 'cranetop'); p.talkTo(12, 2); });
  goal(p, 'CopenHill', () => !!p.flag('c10hill'), () => goto(p, 'copenhill'));
  shopAndHeal(p, 'pccopenhill');
  // The board: A feeds 1+2, B feeds 2+3, C feeds 1+3. Relays 1 and 3 live, 2 dark: turbine C alone.
  goal(p, 'the summit lift', () => !!p.flag('liftOn'), () => { goto(p, 'gym8'); p.talkTo(14, 8); });
  goal(p, 'Astrid', () => !!p.flag('turbine'), () => { goto(p, 'gym8'); p.walkTo(9, 3); p.talkTo(9, 2); });
  goal(p, 'the broadcast', () => !!p.flag('ch10done'), () => goto(p, 'copenhill'));
}

export function chapter11(p: P) {
  grindMaps = ['metro', 'ruins', 'helsingor'];
  // the Mermaid cutscene carries the player off the quay mid-walk
  goal(p, 'the chapter opens', () => !!p.flag('ch11'), () => { try { goto(p, 'eastquay'); } catch (e) { if (!p.flag('ch11')) throw e; } });
  goal(p, 'Fru Jensen', () => !!p.flag('resJensen'), () => { goto(p, 'floodnyhavn'); p.talkTo(3, 3); });
  goal(p, 'the pølse man', () => !!p.flag('resPolse'), () => { goto(p, 'floodnyhavn'); p.talkTo(13, 6); });
  goal(p, 'Captain Bodil', () => !!p.flag('resBodil'), () => { goto(p, 'floodnyhavn'); p.talkTo(22, 3); });
  goal(p, 'the M-Ring', () => !!p.flag('c11metro'), () => goto(p, 'metro'));
  goal(p, "Maja's broadcast", () => !!p.flag('c11broadcast'), () => goto(p, 'slotsholmen'));
  // Absalon's ruins: each plaque is a gym (the Spray, the Lantern walk, the Rundetårn orrery, the turbines)
  ([[4, 'Spray'], [8, 'Lantern'], [12, 'Orrery'], [16, 'Turbine']] as const).forEach(([x, badge], i) =>
    goal(p, `the ${badge} door`, () => !!p.flag(`ruinsDoor${i}`), () => { goto(p, 'ruins'); p.queue.push(badge); p.talkTo(x, 2); }));
  goal(p, "Absalon's altar", () => !!p.flag('c11ruins'), () => { goto(p, 'ruins'); p.talkTo(18, 1); });
  shopAndHeal(p, 'pchelsingor');
  goal(p, 'Kaas in the casemates', () => !!p.flag('c11kaas'), () => { goto(p, 'casemates'); p.walkTo(14, 8); });
  goal(p, 'Holger Danske', () => !!p.flag('ch11done'), () => { goto(p, 'casemates'); p.talkTo(16, 1); });
}

export function chapter12(p: P) {
  grindMaps = ['copenhill', 'helsingor'];
  // The last train south leaves as you step out of Kronborg (no healing first: the way to a Center is through it).
  if (!p.flag('ch12')) try { goto(p, 'helsingor'); } catch (e) { if (!p.flag('ch12')) throw e; }
  // Kronvakt breaks the three walls of black ice on the switchbacks
  for (const [id, y] of [['A', 18], ['B', 12], ['C', 6]] as const)
    goal(p, `the ice wall ${id}`, () => !!p.flag(`c12ice${id}`), () => { goto(p, 'stormhill'); p.talkTo(1, y); });
  goal(p, 'the lift, with Lukas', () => !!p.flag('c12lift'), () => { goto(p, 'stormhill'); p.walkTo(7, 2); });
  shopAndHeal(p, 'pccopenhill');
  goal(p, 'Lindholm on the Smokestack Ring', () => !!p.flag('c12song'), () => goto(p, 'smokestack'));
  // A player brings a bag of Ultra Balls for a legend.
  if ((p.s.bag.ultraball ?? 0) < 15) { goto(p, 'pccopenhill'); p.buy([['Ultra Ball', 10], ['Ultra Ball', 10]]); }
  p.wanted.add('langelira');
  goal(p, 'Langelira', () => !!p.flag('ch12done'), () => {
    for (let i = 0; i < 4 && !p.flag('ch12done'); i++) {    // knocked out by mistake: she rises again
      if ((p.s.bag.ultraball ?? 0) < 5) { goto(p, 'pccopenhill'); p.buy([['Ultra Ball', 10]]); }
      goto(p, 'smokestack'); p.talkTo(12, 1);
    }
  });
}

export function chapter13(p: P) {
  grindMaps = ['helsingor', 'copenhill'];
  // The dark night starts on the way down from the Ring and ends at home.
  if (!p.flag('ch13')) try { goto(p, 'copenhill'); } catch (e) { if (!p.flag('ch13')) throw e; }
  shopAndHeal(p, 'pcslotsholmen');
  // Like a player: Karla's Exp. Candy on the weakest, then sparring rounds with her (healing at the palace nurse)
  // until the team is near the League's levels.
  goto(p, 'leaguehall');
  p.talkTo(10, 4);
  for (let i = 0; i < 3 && p.s.bag.expcandyl; i++) {
    const weakest = p.s.party.filter(m => !m.egg).sort((a, b) => a.level - b.level)[0];
    p.send({ t: 'useItem', item: 'expcandyl', uid: weakest.uid });
  }
  for (let i = 0; i < 20 && (p.leadLevel < 60 || p.minLevel < 56); i++) { p.talkTo(3, 1); p.talkTo(10, 4); }
  p.talkTo(3, 1);
  p.notes.push(`sparred with Karla: team ${p.minLevel}-${p.leadLevel} before the Elite Four`);
  for (const [m, map] of [['valdemar', 'stables'], ['clara', 'admiral'], ['nikolai', 'greathall'], ['freja', 'towerstairs']] as const)
    goal(p, `Elite Four ${m}`, () => !!p.flag(`e4${m}`), () => { goto(p, map); e4Puzzle(p, m); p.talkTo(5, 2); });
  goal(p, 'the Champions', () => !!p.flag('ch13done'), () => goto(p, 'towerroof'));
}

/** The puzzle that opens each Elite Four hall's gap, solved like a player who has read the signs. */
function e4Puzzle(p: P, m: string) {
  if (p.flag(`e4p${m}`)) return;
  if (m === 'valdemar') for (const [x, y] of [[2, 5], [8, 5], [8, 7]]) p.talkTo(x, y);   // eldest first, by the stable board
  if (m === 'clara') for (const x of [2, 4, 6]) p.talkTo(x, 6);                           // lamps 1-3 light all four
  if (m === 'nikolai') {
    p.answers.push({ when: /squares loud/, pick: 'Tariq', once: true }, { when: /captains the Black Fleet/, pick: 'Freja', once: true },
      { when: /storm on CopenHill/, pick: 'Langelira', once: true });
    p.talkTo(5, 4);
  }
  if (m === 'freja') { p.talkTo(2, 6); p.talkTo(8, 6); p.talkTo(5, 4); }
}

export function postgame1(p: P) {
  grindMaps = ['route1', 'copenhill'];
  // The morning after: P1 starts the first time you step outside after the credits.
  if (!p.flag('pg1')) try { goto(p, 'norrebro'); } catch (e) { if (!p.flag('pg1')) throw e; }
  goal(p, 'Ørsted and Brix', () => !!p.flag('pg1palm'), () => goto(p, 'palmhouse'));
  goal(p, 'the Mermaid\'s Tear', () => !!p.flag('pg1harmony'), () => { goto(p, 'osterbro'); p.talkTo(22, 13); });
  p.answers.push({ when: /Touch it with the charged Coil/, pick: 'Touch it' });
  goal(p, 'the first Resonance Rift', () => !!p.flag('pg1done'), () => { goto(p, 'route1'); p.talkTo(14, 11); });
}

export function postgame2(p: P) {
  grindMaps = ['casemates', 'route1'];
  // The Guardian's Oath starts on the way into Helsingør.
  if (!p.flag('pg2')) try { goto(p, 'helsingor'); } catch (e) { if (!p.flag('pg2')) throw e; }
  shopAndHeal(p, 'pchelsingor');
  goal(p, 'the Trial of Copper', () => !!p.flag('oathCopper'), () => { goto(p, 'casemates'); p.talkTo(13, 1); });
  goal(p, 'the Trial of Current', () => !!p.flag('oathCurrent'), () => { goto(p, 'casemates'); p.talkTo(13, 3); });
  p.answers.push({ when: /Start the Trial of the Oath/, pick: 'Begin' });
  goal(p, 'the Trial of the Oath', () => !!p.flag('oathOath'), () => { goto(p, 'casemates'); p.talkTo(20, 3); });
  if ((p.s.bag.ultraball ?? 0) < 15) { goto(p, 'pchelsingor'); p.buy([['Ultra Ball', 10], ['Ultra Ball', 10]]); }
  p.wanted.add('kronvakt');
  goal(p, 'Kronvakt', () => !!p.flag('pg2done'), () => {
    for (let i = 0; i < 4 && !p.flag('pg2done'); i++) {    // knocked out by mistake: it stands up again
      if ((p.s.bag.ultraball ?? 0) < 5) { goto(p, 'pchelsingor'); p.buy([['Ultra Ball', 10]]); }
      goto(p, 'casemates'); p.talkTo(18, 1);
    }
  });
}

export function postgame3(p: P) {
  grindMaps = ['oresund', 'peberholm'];
  goal(p, 'the bridge toll', () => !!p.flag('pg3'), () => goto(p, 'oresund'));
  goal(p, 'Bjørk\'s permit', () => !!p.flag('pg3permit'), () => { goto(p, 'oresund'); p.talkTo(22, 6); });
  goal(p, 'Lumen Nord\'s field lead', () => !!p.flag('pg3lead'), () => { goto(p, 'peberholm'); p.talkTo(14, 3); p.talkTo(12, 13); });
  p.answers.push({ when: /Touch it with the charged Coil/, pick: 'Touch it' });
  goal(p, 'the great Echo', () => !!p.flag('pg3done'), () => { goto(p, 'peberholm'); p.talkTo(14, 3); p.talkTo(12, 16); });
}

export function postgame4(p: P) {
  grindMaps = ['route14', 'hammerdeep'];
  goal(p, 'the Bornholm ferry', () => !!p.flag('pg4'), () => goto(p, 'ronne'));
  shopAndHeal(p, 'pcronne');
  const shrines: [string, string, string][] = [['nyker', 'shrineNyker', 'Copper'], ['nylars', 'shrineNylars', 'Current'],
    ['olsker', 'shrineOlsker', 'Harmony'], ['osterlars', 'shrineOsterlars', 'Current']];
  for (const [door, flag, pick] of shrines) goal(p, `the ${door} shrine`, () => !!p.flag(flag), () => {
    goto(p, 'route14');
    coilAnswer(p, pick);
    p.enter(door);
  });
  goal(p, 'Vinther', () => !!p.flag('pg4vinther'), () => { goto(p, 'hammershus'); p.talkTo(5, 10); goto(p, 'hammerdeep'); p.talkTo(11, 4); });
  if ((p.s.bag.ultraball ?? 0) < 15) { goto(p, 'pcronne'); p.buy([['Ultra Ball', 10], ['Ultra Ball', 10]]); }
  p.wanted.add('kronikon');
  goal(p, 'Krønikon', () => !!p.flag('pg4done'), () => {
    for (let i = 0; i < 4 && !p.flag('pg4done'); i++) {    // knocked out by mistake: it settles back into the stone
      if ((p.s.bag.ultraball ?? 0) < 5) { goto(p, 'pcronne'); p.buy([['Ultra Ball', 10]]); }
      goto(p, 'hammershus'); p.talkTo(5, 10); goto(p, 'hammerdeep'); p.talkTo(11, 1);
    }
  });
}

export function postgame5(p: P) {
  grindMaps = ['trekroner', 'deepsound'];
  // Freja calls on the way into any hub once P2-P4 are done.
  goal(p, 'Freja\'s call', () => !!p.flag('pg5'), () => { goto(p, 'pcchristianshavn'); goto(p, 'christianshavn'); });
  goal(p, 'the hydrofoil', () => !!p.flag('pg5fort'), () => goto(p, 'trekroner'));
  p.answers.push({ when: /Touch it with the charged Coil/, pick: 'Touch it' });
  goal(p, 'the last Echo', () => !!p.flag('pg5echo'), () => { goto(p, 'trekroner'); p.talkTo(12, 21); goto(p, 'siphon'); p.talkTo(8, 4); });
  goal(p, 'the dive', () => p.mapId === 'deepsound' || !!p.flag('pg5song'), () => {
    goto(p, 'osterbro');
    p.answers.push({ when: /Dive down to the Deep Sound/, pick: 'Dive', once: true });
    p.talkTo(22, 16);
  });
  const notes: [number, number, string, string][] = [[1, 7, 'noteLow', 'Copper'], [17, 7, 'noteHigh', 'Current'], [9, 6, 'noteBoth', 'Harmony']];
  for (const [x, y, flag, pick] of notes) goal(p, `the ${flag} stone`, () => !!p.flag(flag) || !!p.flag('pg5song'), () => {
    if (p.mapId !== 'deepsound') { goto(p, 'osterbro'); p.answers.push({ when: /Dive down/, pick: 'Dive', once: true }); p.talkTo(22, 16); }
    coilAnswer(p, pick);
    p.talkTo(x, y);
  });
  goal(p, 'the concert', () => !!p.flag('pg5song'), () => {
    if (p.mapId !== 'deepsound') { goto(p, 'osterbro'); p.answers.push({ when: /Dive down/, pick: 'Dive', once: true }); p.talkTo(22, 16); }
    p.sing = true;
    try { p.talkTo(9, 1); } finally { p.sing = false; }
  });
  p.answers.push({ when: /Charge the lamp/, pick: 'Charge it' });
  goal(p, 'the lamp', () => !!p.flag('pg5done'), () => { goto(p, 'tklighthouse'); p.talkTo(2, 4); });
  goal(p, 'Lindholm\'s letter', () => !!p.flag('pg5letter'), () => goto(p, 'flat'));
  // The Champion's Gym Leader rematches: one a day, and they pay.
  const money = p.s.money;
  goal(p, 'Tariq\'s rematch', () => p.flag('rematch.tariq') !== undefined, () => { heal(p); goto(p, 'gym1'); p.talkTo(7, 2); });
  p.talkTo(7, 2);
  if (!/One round a day/.test(p.said.slice(-3).join('\n'))) throw new Error('Tariq took a second rematch on the same day');
  p.notes.push(`Tariq's rematch paid ${p.s.money - money} kr.`);
}

// ---------- Side areas (npm run playthrough -- --side) ----------
// Each starts from a saved chapter: the Wilds and the Last Singers after Chapter 3 (three badges), the Roskilde
// Saga after Chapter 7 (six), Tivoli after the post-game. They don't feed back into the story run.

/** Answers the next Coil prompt (shrines, note stones). Drops an unused answer left by a retried goal first, or it
 *  would answer the wrong stone. */
function coilAnswer(p: P, pick: string) {
  for (let i = p.answers.length - 1; i >= 0; i--) if (String(p.answers[i].when) === String(/How do you charge the Coil/)) p.answers.splice(i, 1);
  p.answers.push({ when: /How do you charge the Coil/, pick, once: true });
}

/** Six hours pass (a player would wait it out; the bot uses the debug clock). */
function passTime(p: P) {
  p.game.debug = true;
  p.send({ t: 'debug', cmd: 'time' });
  p.game.debug = false;
}

const KALVEBOD_WILD = ['tauros', 'mudbray', 'wooloo', 'starly', 'lotad', 'poliwag', 'phanpy', 'flamigo', 'girafarig', 'hoothoot', 'stunky', 'chewtle', 'wiglett', 'buizel', 'rolycoly', 'silicobra', 'cufant', 'rufflet', 'orthworm'];

export function sideKalvebod(p: P) {
  p.eagerCatch = true;
  grindMaps = ['kalvebod'];
  HEALERS.push(['rangerhut', 1, 1, 'kalvebodArrive']);
  goal(p, 'the skiff to Kalvebod', () => p.mapId === 'kalvebod', () => goto(p, 'kalvebod'));
  p.talkTo(21, 2);                                           // Ranger Ebbe's first task
  if ((p.s.bag.pokeball ?? 0) + (p.s.bag.greatball ?? 0) < 15) { goto(p, 'pcvesterbro'); p.buy([['Great Ball', 10], ['Great Ball', 10]]); }
  for (const sp of KALVEBOD_WILD) p.wanted.add(sp);
  const caught = () => KALVEBOD_WILD.filter(sp => p.s.dex.caught[sp]).length;
  for (let round = 0; round < 8 && caught() < 10; round++) {
    heal(p);
    goto(p, round % 2 ? 'kalvebodrange' : 'kalvebod');
    p.grind(() => caught() >= 10 || p.hurt() || (p.s.bag.greatball ?? 0) + (p.s.bag.pokeball ?? 0) < 2, 40);
    if ((p.s.bag.greatball ?? 0) + (p.s.bag.pokeball ?? 0) < 2) { goto(p, 'pcvesterbro'); p.buy([['Great Ball', 10]]); }
  }
  goal(p, 'Ebbe\'s first two tasks', () => !!p.flag('ebbe2'), () => { goto(p, 'kalvebod'); p.talkTo(21, 2); });
  goal(p, 'the giant Orthworm', () => !!p.flag('orthwormDone'), () => { heal(p); goto(p, 'kalvebodrange'); p.talkTo(15, 14); });
  goal(p, 'Ebbe\'s last task', () => !!p.flag('ebbe3'), () => { goto(p, 'kalvebod'); p.talkTo(21, 2); });
  goal(p, 'the Titan Store Mor', () => !!p.flag('titan.storemor'), () => { heal(p); goto(p, 'kalvebod'); p.talkTo(37, 20); });
  p.notes.push(`Kalvebod: ${caught()} of ${KALVEBOD_WILD.length} kinds caught, Exp. Charm ${p.s.bag.expcharm ? 'yes' : 'no'}`);
}

const TITAN_SPOTS = [{ id: 'storemor', map: 'kalvebod', x: 37, y: 20 }, { id: 'pia', map: 'dragor', x: 2, y: 17 },
  { id: 'ulf', map: 'dyrehaven', x: 32, y: 1 }, { id: 'lilletom', map: 'drydock', x: 26, y: 8 },
  { id: 'hjalte', map: 'route10', x: 27, y: 5 }, { id: 'gamleknas', map: 'route14', x: 41, y: 15 }];
/** The Six Forgotten Trolls: battle each Titan where it sleeps, then Store Mor sends Lille Tom along. */
export function sideTrolls(p: P) {
  grindMaps = ['kalvebod', 'route14'];
  for (const t of TITAN_SPOTS) {
    goal(p, `the Titan ${t.id}`, () => !!p.flag(`titan.${t.id}`), () => { heal(p); goto(p, t.map); p.talkTo(t.x, t.y); });
  }
  const mor = TITAN_SPOTS.find(t => t.id === 'storemor')!;
  goal(p, 'Lille Tom joins', () => !!p.flag('trollGift'), () => { goto(p, mor.map); p.talkTo(mor.x, mor.y); });
  p.notes.push(`Trolls: ${TITAN_SPOTS.filter(t => p.flag(`titan.${t.id}`)).length}/6 woken, Titan Herbs ${p.s.bag.titanherb ?? 0}, Lille Tom ${[...p.s.party, ...p.s.box].some(m => m.nickname === 'Lille Tom') ? 'yes' : 'no'}`);
}

/** Gækkebrev (Ella's eight snowdrop letters) and the Winter Bathers' Relay, both from Chapter 3. */
export function sideSmall(p: P) {
  grindMaps = ['kalvebod', 'islandsbrygge'];
  goal(p, 'Gækkebrev', () => !!p.flag('gaekDone'), () => {
    goto(p, 'christianshavn');
    p.queue.push('Read', 'Tariq', 'Kasper', 'Ørsted', 'Maja', 'Lukas', 'Lene', 'Freja', 'Knud');
    p.talkTo(7, 11);
  });
  goal(p, 'the bath swimmers', () => !!p.flag('tr.ibswim1') && !!p.flag('tr.ibswim2'), () => { goto(p, 'islandsbrygge'); p.talkTo(5, 3); p.talkTo(10, 7); });
  goal(p, 'the Winter Bathers\' Relay', () => !!p.flag('relayDone'), () => { heal(p); goto(p, 'islandsbrygge'); p.talkTo(11, 4); });
  p.notes.push(`Gækkebrev ${p.flag('gaekDone') ? 'done' : 'not done'} (egg ${[...p.s.party, ...p.s.box].some(m => m.egg && m.species === 'togepi') ? 'yes' : 'no'}), relay ${p.flag('relayDone') ? 'won' : 'not won'}, TM Scald ${p.s.bag.tmscald ? 'yes' : 'no'}`);
}

export function sideSingers(p: P) {
  p.eagerCatch = true;
  grindMaps = ['kalvebod', 'islandsbrygge'];
  const elder = (id: string, x: number, y: number) => { goto(p, 'dragor'); p.talkTo(x, y); void id; };
  goal(p, 'Ingeborg\'s errand', () => !!p.flag('sing.ingeborg'), () => elder('ingeborg', 12, 10));
  goal(p, 'the net float', () => !!p.s.bag.netfloat || p.flag('sing.ingeborg') === 2, () => { goto(p, 'islandsbrygge'); p.talkTo(2, 17); });
  goal(p, 'Ingeborg\'s verse', () => p.flag('sing.ingeborg') === 2, () => elder('ingeborg', 12, 10));
  goal(p, 'Henning\'s errand', () => !!p.flag('sing.henning'), () => elder('henning', 20, 14));
  goal(p, 'beat Oluf', () => !!p.flag('tr.oluf'), () => elder('oluf', 19, 11));
  goal(p, 'Henning\'s verse', () => p.flag('sing.henning') === 2, () => elder('henning', 20, 14));
  p.answers.push({ when: /Battle Elder Asta/, pick: 'Yes' });
  goal(p, 'Asta\'s verse', () => p.flag('sing.asta') === 2, () => { heal(p); elder('asta', 16, 7); });
  goal(p, 'Poul\'s errand', () => !!p.flag('sing.poul'), () => elder('poul', 17, 16));
  if (!p.s.party.some(m => m.species === 'wiglett')) {
    p.wanted.add('wiglett');
    if ((p.s.bag.pokeball ?? 0) + (p.s.bag.greatball ?? 0) < 10) { goto(p, 'pcvesterbro'); p.buy([['Great Ball', 10]]); }
    // Fish off the Dragør quay until a Wiglett bites (it has to be in the party to show Poul).
    const has = () => [...p.s.party, ...p.s.box].some(m => m.species === 'wiglett');
    for (let i = 0; i < 60 && !has(); i++) {
      if (p.hurt()) heal(p);
      goto(p, 'dragor');
      p.walkTo(20, 12); p.face('right'); p.send({ t: 'interact' });
    }
    swapIn(p, 'pcvesterbro', 'wiglett');     // a full team sends it to the box: take it out at a PC
  }
  goal(p, 'Poul\'s verse', () => p.flag('sing.poul') === 2, () => elder('poul', 17, 16));
  goal(p, 'Karen at night', () => !!p.flag('dragorMelody'), () => {
    goto(p, 'dragor');
    for (let i = 0; i < 4 && p.game.period !== 'night'; i++) passTime(p);
    p.talkTo(11, 16);
  });
  goal(p, 'the safehouse', () => p.mapId === 'safehouse', () => goto(p, 'safehouse'));
  p.notes.push(`Last Singers: melody ${p.flag('dragorMelody') ? 'learned' : 'missing'}, Lapras ${[...p.s.party, ...p.s.box].some(m => m.species === 'lapras') ? 'received' : 'missing'}`);
}

export function sideRoskilde(p: P) {
  grindMaps = ['route10'];
  HEALERS.push(['pcroskilde', 2, 2, 'roskildeArrive']);
  goal(p, 'Roskilde', () => !!p.flag('roskildeArrive'), () => goto(p, 'roskilde'));
  shopAndHeal(p, 'pcroskilde');
  goal(p, 'the crypt grunt', () => !!p.flag('tr.crEnf1'), () => { goto(p, 'crypt'); p.talkTo(10, 7); });
  goal(p, 'Enforcer Ravn', () => !!p.flag('roskildePage'), () => { heal(p); goto(p, 'crypt'); p.talkTo(10, 1); });
  goal(p, 'the museum Dhelmise', () => !!p.flag('museumGift'), () => { goto(p, 'museum'); p.talkTo(6, 1); });
  goal(p, 'the Titan Hjalte', () => !!p.flag('titan.hjalte'), () => { heal(p); goto(p, 'route10'); p.talkTo(27, 5); });
  p.notes.push(`Roskilde: page ${p.s.bag.roskildepage ? 'found' : 'missing'}, Dhelmise ${[...p.s.party, ...p.s.box].some(m => m.species === 'dhelmise') ? 'received' : 'missing'}`);
}

export function sideTivoli(p: P) {
  grindMaps = ['peberholm', 'route14'];
  HEALERS.push(['tivoli', 18, 13, 'tivoliOpen']);
  p.answers.push({ when: /Buy æbleskiver/, pick: 'Yes (200 kr.)' });
  const m0 = p.s.money;
  goal(p, 'Tivoli', () => p.mapId === 'tivoli', () => goto(p, 'tivoli'));
  p.answers.push({ when: /Start the Tower Challenge/, pick: 'Start' });
  goal(p, 'the Tower Challenge', () => Number(p.flag('tower.wins') ?? 0) >= 1, () => { heal(p); goto(p, 'daemonentower'); p.talkTo(5, 2); if (!p.flag('tower.wins')) for (let i = 0; i < 4; i++) passTime(p); });
  for (const [map, x, y, key] of [['concerthall', 6, 2, 'valdemar'], ['tivoli', 12, 18, 'clara'], ['pantomimehall', 5, 2, 'freja']] as const) {
    goal(p, `${key}'s rematch`, () => p.flag(`rematch.${key}`) !== undefined, () => { heal(p); goto(p, map); p.queue.push('Yes'); p.talkTo(x, y); p.queue = []; });
  }
  p.notes.push(`Tivoli: tower wins ${p.flag('tower.wins') ?? 0}, money ${m0} -> ${p.s.money} kr.`);
}
