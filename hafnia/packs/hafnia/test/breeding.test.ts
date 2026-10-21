// Breeding and the Vuggestuen daycare (design/breeding-and-daycare.md): who can breed, what the
// egg inherits, eggs laid by walking, collecting them from Jens, hatching, and eggs in battles and saves.
import { describe, expect, it } from 'vitest';
import {
  Content, Game, Rng, breed, compatibility, eggMoves, eggSpecies, hatchSteps, makeMon, migrate, monView,
  type Dir, type Mon, type SaveData, type ServerEvent
} from '@hafnia/core';
import { hafnia } from '../src';

const content = new Content([hafnia]);
const rng = () => new Rng(42);

function mon(species: string, gender: Mon['gender'], ot = 'Mark', r = rng()): Mon {
  const m = makeMon(species, 20, r, { ot });
  m.gender = gender;
  return m;
}

describe('breeding rules', () => {
  it('pairs by egg group and gender, with Ditto as the wildcard', () => {
    expect(compatibility(mon('pidgey', 'M'), mon('pidgey', 'F', 'Asta'))).toBe(70);
    expect(compatibility(mon('pidgey', 'M'), mon('pidgey', 'F'))).toBe(50);
    expect(compatibility(mon('pidgey', 'M'), mon('wingull', 'F'))).toBe(20);   // both Flying group
    expect(compatibility(mon('pidgey', 'M'), mon('pidgey', 'M'))).toBe(0);     // same gender
    expect(compatibility(mon('pidgey', 'M'), mon('grimer', 'F'))).toBe(0);     // no shared group
    expect(compatibility(mon('toxel', 'M'), mon('ditto', ''))).toBe(0);        // Undiscovered
    expect(compatibility(mon('ditto', ''), mon('ditto', ''))).toBe(0);
    expect(compatibility(mon('magnemite', ''), mon('ditto', ''))).toBe(20);    // genderless needs Ditto
    expect(compatibility(mon('magnemite', ''), mon('ditto', '', 'Asta'))).toBe(50);
    expect(compatibility(mon('magnemite', ''), mon('pidgey', 'F'))).toBe(0);
  });

  it('hatches the first stage of the mother\'s line', () => {
    expect(eggSpecies(mon('marill', 'F'), rng())).toBe('azurill');
    expect(eggSpecies(mon('pidgeot', 'F'), rng())).toBe('pidgey');
    const nido = new Set(Array.from({ length: 20 }, (_, i) => eggSpecies(mon('nidoqueen', 'F'), new Rng(i))));
    expect(nido).toEqual(new Set(['nidoranf', 'nidoranm']));
    const egg = breed(mon('pidgey', 'M'), mon('lotad', 'F'), rng(), { ot: 'Mark' });
    expect(egg.species).toBe('lotad');
    expect(breed(mon('ditto', ''), mon('psyduck', 'M'), rng(), { ot: 'Mark' }).species).toBe('psyduck');
  });

  it('passes the nature with an Everstone and 5 IVs with a Destiny Knot', () => {
    const dad = mon('pidgey', 'M'), mum = mon('pidgey', 'F');
    dad.nature = 'Adamant'; mum.nature = 'Timid';
    dad.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
    mum.ivs = { hp: 30, atk: 30, def: 30, spa: 30, spd: 30, spe: 30 };
    for (let seed = 0; seed < 30; seed++) {
      const egg = breed(dad, mum, new Rng(seed), { ot: 'Mark', items: ['everstone', 'destinyknot'] });
      expect(egg.nature).toBe('Adamant');
      expect(Object.values(egg.ivs).filter(v => v >= 30).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('teaches egg moves either parent knows and keeps the mother\'s ball', () => {
    const egg = [...eggMoves('pidgey')][0];
    const dad = mon('pidgey', 'M'), mum = mon('pidgey', 'F');
    dad.moves = [{ id: egg, pp: 10 }];
    mum.ball = 'greatball'; dad.ball = 'greatball';
    const kid = breed(dad, mum, rng(), { ot: 'Mark' });
    expect(kid.moves.map(m => m.id)).toContain(egg);
    expect(kid.ball).toBe('greatball');
    expect(kid.level).toBe(1);
    expect(kid.egg?.steps).toBe(hatchSteps('pidgey'));
  });

  it('shows eggs without giving the species away', () => {
    const egg = breed(mon('pidgey', 'M'), mon('pidgey', 'F'), rng(), { ot: 'Mark' });
    const v = monView(egg);
    expect(v.name).toBe('Egg');
    expect(v.key).toBe('EGG');
    expect(JSON.stringify(v)).not.toMatch(/pidgey/i);
    expect(v.egg?.hint).toBeTruthy();
  });
});

// ---------- the daycare in the game ----------

/** A game in Dragør with 3 badges and a few Pokémon, ready to talk to Bodil. */
function dragor() {
  const { game } = Game.newGame(content, 7);
  game.handle({ t: 'answer', index: 0, text: 'Mark' }); // the intro asks for a name
  game.handle({ t: 'answer', index: 0 });               // and a look
  const s = game.state;
  s.party = [mon('sprigatito', 'M'), mon('pidgey', 'M', 'Mark', new Rng(1)), mon('pidgey', 'F', 'Asta', new Rng(2))];
  s.badges = ['hafnia:a', 'hafnia:b', 'hafnia:c'];
  s.money = 5000;
  Object.assign(s, { map: 'hafnia:dragor', x: 6, y: 9, dir: 'up' as Dir });
  return game;
}

/** Walks up to an NPC tile and talks, answering prompts in order (then the cancel/last option). */
function talkTo(g: Game, x: number, y: number, answers: number[]): ServerEvent[] {
  const s = g.state;
  const dir: Dir = s.x === x ? (s.y > y ? 'up' : 'down') : s.x > x ? 'left' : 'right';
  s.dir = dir;
  const log: ServerEvent[] = [];
  let evs = g.handle({ t: 'interact' });
  for (let guard = 0; guard < 50; guard++) {
    log.push(...evs);
    for (const e of evs) if (e.t === 'error') throw new Error(e.message);
    const p = [...evs].reverse().find(e => e.t === 'prompt');
    if (!p || p.t !== 'prompt') break;
    evs = g.handle({ t: 'answer', index: answers.length ? answers.shift()! : p.options.length - 1 });
  }
  return log;
}
const said = (log: ServerEvent[]) => log.filter(e => e.t === 'say' || e.t === 'prompt').map(e => (e as { text: string }).text);

/** Paces left and right on Strandgade. */
function walk(g: Game, n: number): ServerEvent[] {
  const log: ServerEvent[] = [];
  for (let i = 0; i < n; i++) {
    const evs = g.handle({ t: 'step', dir: i % 2 ? 'left' : 'right' });
    log.push(...evs);
    // say-only events need no answer; prompts would (none expected while walking)
    if (evs.some(e => e.t === 'prompt')) throw new Error('unexpected prompt while walking');
  }
  return log;
}

describe('Vuggestuen', () => {
  it('turns trainers away before Badge 3', () => {
    const g = dragor();
    g.state.badges = [];
    expect(said(talkTo(g, 6, 8, [])).join(' ')).toMatch(/three badges/);
  });

  it('takes two Pokémon, lays eggs while you walk, and Jens hands them over', () => {
    const g = dragor(), s = g.state;
    // Leave the two Pidgey (party indexes 1, then 1 again), no toy for the first, Everstone for the second.
    let log = talkTo(g, 6, 8, [0, 1, 1, 0, 1, 0, 2]);
    expect(said(log).some(t => /received an Everstone/.test(t))).toBe(true);
    expect(s.daycare.slots.map(d => d.mon.species)).toEqual(['pidgey', 'pidgey']);
    expect(s.daycare.slots[1].item).toBe('everstone');
    expect(s.money).toBe(5000 - 1000);
    expect(said(log).some(t => /very well/.test(t))).toBe(true);   // same species, different OT
    expect(s.party.length).toBe(1);

    // Walk until an egg is laid (70 % per 90 steps), then fetch it from the pram yard.
    s.x = 12; s.y = 9;
    log = [];
    for (let i = 0; i < 40 && !s.daycare.eggs.length; i++) log.push(...walk(g, 90));
    expect(s.daycare.eggs.length).toBeGreaterThan(0);
    expect(said(log).some(t => /Egg is waiting in the pram/.test(t))).toBe(true);
    const mother = s.daycare.slots[1].mon;
    Object.assign(s, { x: 5, y: 13 });
    log = talkTo(g, 4, 13, [0, 1]);
    expect(said(log).some(t => /received an Egg/.test(t))).toBe(true);
    const egg = s.party.find(m => m.egg)!;
    expect(egg.species).toBe('pidgey');
    expect(egg.nature).toBe(mother.nature);   // the Everstone

    // Eggs never battle.
    const battle = (g as any).battleHost().party as Mon[];
    expect(battle.some(m => m.egg)).toBe(false);

    // Hatch it by walking.
    s.x = 12; s.y = 9;
    log = [];
    for (let i = 0; i < 60 && egg.egg; i++) log.push(...walk(g, 100));
    expect(egg.egg).toBeUndefined();
    expect(egg.hp).toBeGreaterThan(0);
    expect(log.some(e => e.t === 'hatch' && e.key === 'PIDGEY')).toBe(true);
    expect(said(log).some(t => /Pidgey hatched from the Egg/.test(t))).toBe(true);
    expect(s.hatched).toBe(1);

    // Pick both parents up again; the Everstone comes back.
    s.x = 6; s.y = 9;
    talkTo(g, 6, 8, [1, 0, 1, 0, 2]);
    expect(s.daycare.slots.length).toBe(0);
    expect(s.bag.everstone).toBe(1);
  });

  it('won\'t take your last Pokémon that can battle', () => {
    const g = dragor(), s = g.state;
    s.party = [s.party[0]];
    const log = talkTo(g, 6, 8, [0, 0]);
    expect(said(log).some(t => /no Pokémon to walk home with/.test(t))).toBe(true);
    expect(s.daycare.slots.length).toBe(0);
  });

  it('keeps the daycare and eggs in saves, and migrates v2 saves', () => {
    const g = dragor();
    g.state.daycare.slots.push({ mon: mon('pidgey', 'M') });
    (g as any).api('hafnia').giveEgg('azurill', { perfectIvs: 3, hiddenAbility: true });
    const save = g.toSave();
    const back = Game.load(content, JSON.parse(JSON.stringify(save)) as SaveData);
    expect(back.state.daycare.slots.length).toBe(1);
    const gift = back.state.party.find(m => m.egg)!;
    expect(gift.species).toBe('azurill');
    expect(gift.ability).toBe('Sap Sipper');
    expect(Object.values(gift.ivs).filter(v => v === 31).length).toBeGreaterThanOrEqual(3);

    const old = { ...save, v: 2 } as Partial<SaveData>;
    delete old.daycare; delete old.steps; delete old.hatched;
    const m = migrate(old as SaveData);
    expect(m.daycare).toEqual({ slots: [], eggs: [], counter: 0 });
    expect(m.steps).toBe(0);
  });
});
