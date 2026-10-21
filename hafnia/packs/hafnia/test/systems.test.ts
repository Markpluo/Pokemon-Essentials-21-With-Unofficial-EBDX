// Game-level systems around the story: evolution after battle, the Mart, whiteout money, Repel,
// save slots, the debug commands and content validation.
import { describe, expect, it } from 'vitest';
import {
  Content, Game, LocalServer, expForLevel, makeMon, speciesExtra, validateContent,
  type Intent, type SaveData, type SaveSlot, type Script, type ServerEvent
} from '@hafnia/core';
import { hafnia } from '../src';

const content = new Content([hafnia]);

function game(seed = 3) {
  const { game } = Game.newGame(content, seed);
  game.handle({ t: 'answer', index: 0, text: 'Mark' }); // the intro asks for a name
  game.handle({ t: 'answer', index: 0 });               // and a look
  game.state.party.push(makeMon('sprigatito', 10, game.rng, { ot: 'Mark' }));
  game.state.flags['hafnia:starter'] = 'sprigatito';
  return game;
}

/** Runs a script, answering prompts with the given indexes (then 0) and battling with the strongest move. */
function play(g: Game, script: Script, answers: number[] = []): ServerEvent[] {
  const log: ServerEvent[] = [];
  let evs = (() => { (g as any).run(script, 'hafnia'); return (g as any).flush() as ServerEvent[]; })();
  for (let guard = 0; guard < 200; guard++) {
    log.push(...evs);
    const last = [...evs].reverse().find(e => e.t === 'prompt' || e.t === 'pickSpecies' || e.t === 'askName' || e.t === 'battleRequest');
    if (!last) break;
    let intent: Intent;
    if (last.t === 'prompt' || last.t === 'pickSpecies') intent = { t: 'answer', index: answers.shift() ?? 0 };
    else if (last.t === 'askName') intent = { t: 'answer', index: 0, text: 'Pip' };
    else if (last.request.forceSwitch) intent = { t: 'battle', action: { kind: 'switch', uid: last.request.party.find(p => p.hp > 0 && p.uid !== last.request.activeUid)!.uid } };
    else {
      const best = last.request.moves.map((m, i) => ({ m, i })).filter(x => !x.m.disabled).sort((a, b) => b.m.power - a.m.power)[0];
      intent = { t: 'battle', action: { kind: 'move', index: best?.i ?? 0 } };
    }
    evs = g.handle(intent);
  }
  return log;
}
const said = (log: ServerEvent[]) => log.filter(e => e.t === 'say' || (e.t === 'battle' && e.ev.b === 'text')).map(e => (e.t === 'say' ? e.text : (e as any).ev.text) as string);

describe('game systems', () => {
  it('has no broken references in the base pack', () => {
    expect(validateContent(content)).toEqual([]);
  });

  it('evolves a Pokémon that levelled up in battle, and lets the player stop it', () => {
    for (const [answer, expected] of [[0, 'floragato'], [1, 'sprigatito']] as const) {
      const g = game();
      const m = g.state.party[0];
      m.level = 15; m.exp = expForLevel(speciesExtra('sprigatito').growth, 16) - 1;
      const log = play(g, function* (s) { return yield s.battle({ kind: 'wild', foes: [{ species: 'magikarp', level: 2, moves: ['splash'] }] }); }, [answer]);
      expect(log.some(e => e.t === 'prompt' && /is evolving/.test(e.text))).toBe(true);
      expect(m.species).toBe(expected);
      if (answer === 0) expect(said(log).some(t => /evolved into Floragato/.test(t))).toBe(true);
    }
  });

  it('sells and buys at the Mart, with stock that grows with badges', () => {
    const g = game();
    const money = g.state.money;
    const mart = function* (s: any) { yield* s.mart(['potion', 'superpotion']); } as Script;
    let log = play(g, mart, [0, 0, 1, 1, 2]); // Buy > Potion > 5, then Back (Super Potion isn't sold yet) > Done
    expect(g.state.bag.potion).toBe(5);
    expect(g.state.money).toBe(money - 1000);
    expect(log.some(e => e.t === 'prompt' && e.options.some(o => o.startsWith('Super Potion')))).toBe(false);
    g.state.badges.push('hafnia:spray');
    log = play(g, mart, [0, 2, 2]);
    expect(log.some(e => e.t === 'prompt' && e.options.some(o => o.startsWith('Super Potion')))).toBe(true);
  });

  it('takes whiteout money after a lost trainer battle, but not after a soft one', () => {
    const g = game();
    g.state.party[0].hp = 1;
    const before = g.state.money;
    const lose = (soft: boolean): Script => function* (s) { return yield s.battle({ kind: 'trainer', soft, trainer: { name: 'X', title: 'Youngster', sprite: 'tr/biker' }, foes: [{ species: 'mewtwo', level: 70 }] }); };
    play(g, lose(true));
    expect(g.state.money).toBe(before);
    g.state.party[0].hp = 1;
    const log = play(g, lose(false));
    expect(g.state.money).toBe(before - 8 * 10); // no badges: 8 × highest level (10)
    expect(said(log).some(t => /dropped 80 kr/.test(t))).toBe(true);
  });

  it('Repel keeps weaker wild Pokémon away', () => {
    const g = game();
    g.state.bag.repel = 1;
    g.handle({ t: 'useItem', item: 'repel', uid: '' });
    expect(g.state.repel).toBe(100);
    Object.assign(g.state, { map: 'hafnia:route1', x: 2, y: 3 });
    let battles = 0;
    for (let i = 0; i < 60; i++) {
      const evs = g.handle({ t: 'step', dir: i % 2 ? 'right' : 'left' });
      if (evs.some(e => e.t === 'battleStart')) battles++;
    }
    expect(battles).toBe(0);
    expect(g.state.repel).toBeLessThan(100);
  });

  it('only runs debug commands when the server allows them', () => {
    const g = game();
    g.handle({ t: 'debug', cmd: 'money' });
    expect(g.state.money).toBe(3000);
    g.debug = true;
    g.handle({ t: 'debug', cmd: 'money' });
    g.handle({ t: 'debug', cmd: 'unlockCoil' });
    g.handle({ t: 'debug', cmd: 'levelUp', arg: 5 });
    expect(g.state.money).toBe(13000);
    expect(g.state.coil).toMatchObject({ copper: true, current: true });
    expect(g.state.party[0].level).toBe(15);
  });

  it('keeps three manual save slots beside the autosave', async () => {
    const saves = new Map<SaveSlot, SaveData>();
    const server = new LocalServer(content, { load: async s => saves.get(s) ?? null, save: async (s, d) => { saves.set(s, structuredClone(d)); } }, () => 9);
    await server.handle({ t: 'newGame' });
    await server.handle({ t: 'answer', index: 0, text: 'Asta' });
    await server.handle({ t: 'answer', index: 0 });
    expect(await server.handle({ t: 'save', slot: 2 })).toEqual([{ t: 'say', text: 'There is nothing to save yet.' }]);
    (server as any).game.state.party.push(makeMon('ponyta', 5, (server as any).game.rng));
    await server.handle({ t: 'save', slot: 2 });
    await server.handle({ t: 'autosave' });
    const title = await server.handle({ t: 'title' });
    const slots = (title[0] as Extract<ServerEvent, { t: 'title' }>).slots!;
    expect(slots.map(s => !!s.summary)).toEqual([true, false, true, false]);
    const evs = await server.handle({ t: 'continue', slot: 2 });
    expect(evs.some(e => e.t === 'map')).toBe(true);
  });

  it('unlocks Current (not Copper) when Professor Ørsted hands out the starters', () => {
    const g = game();
    g.state.party.length = 0;
    delete g.state.flags['hafnia:starter'];
    Object.assign(g.state, { map: 'hafnia:palmhouse', x: 8, y: 9 });
    const log = play(g, hafnia.maps.palmhouse.npcs.find(n => n.id === 'prof')!.talk!);
    expect(log.filter(e => e.t === 'error')).toEqual([]);
    expect(g.state.coil.current).toBe(true);
    expect(g.state.coil.copper).toBeFalsy();
  });
});
