// PvP battles: two people, events from each point of view, turn timer and forfeits.
import { describe, expect, it } from 'vitest';
import { PvpBattle, Rng, makeMon, type ServerEvent } from '../src';

function teams(seed: number) {
  const rng = new Rng(seed);
  return [
    { name: 'Ana', party: [makeMon('sprigatito', 14, rng, { ot: 'Ana' }), makeMon('popplio', 12, rng, { ot: 'Ana' })] },
    { name: 'Bo', party: [makeMon('ponyta', 14, rng, { ot: 'Bo' }), makeMon('psyduck', 12, rng, { ot: 'Bo' })] }
  ];
}
const lastRequest = (evs: ServerEvent[]) => [...evs].reverse().find(e => e.t === 'battleRequest');

describe('PvP battle', () => {
  it('plays to the end from both sides', () => {
    const [a, b] = teams(3);
    const hp = a.party.map(m => m.hp);
    const battle = new PvpBattle([a, b], new Rng(9));
    let out = battle.start();
    expect(out[0].find(e => e.t === 'battleStart')).toMatchObject({ battle: { trainer: { name: 'Bo' } } });
    expect(out[1].find(e => e.t === 'battle' && e.ev.b === 'switch' && e.ev.side === 'ally')).toMatchObject({ ev: { mon: { species: 'ponyta' } } });
    const firstReq = lastRequest(out[0]);
    expect(firstReq?.t === 'battleRequest' && firstReq.request.moves[0].pp).toBe(firstReq?.t === 'battleRequest' && firstReq.request.moves[0].maxpp);
    const reqs: (ServerEvent | undefined)[] = [lastRequest(out[0]), lastRequest(out[1])];
    const ends: string[] = [];
    for (let guard = 0; guard < 200 && !battle.over; guard++) {
      for (const i of [0, 1] as const) {
        const r = reqs[i];
        if (r?.t !== 'battleRequest') continue;
        reqs[i] = undefined;
        const q = r.request;
        const action = q.forceSwitch
          ? { kind: 'switch' as const, uid: q.party.find(p => p.hp > 0 && p.uid !== q.activeUid)!.uid }
          : { kind: 'move' as const, index: Math.max(0, q.moves.findIndex(m => m.category !== 'Status' && !m.disabled)) };
        out = battle.choose(i, action);
        for (const j of [0, 1] as const) {
          reqs[j] = lastRequest(out[j]) ?? reqs[j];
          for (const e of out[j]) if (e.t === 'battleEnd') ends[j] = e.result;
        }
      }
    }
    expect(battle.over).toBe(true);
    expect([...ends].sort()).toEqual(['lose', 'win']);
    expect(a.party.map(m => m.hp)).toEqual(hp); // the real Pokémon are untouched
  });

  it('times out and forfeits', () => {
    const [a, b] = teams(4);
    const battle = new PvpBattle([a, b], new Rng(1));
    battle.start();
    expect(battle.waiting()).toEqual([0, 1]);
    const r = battle.choose(0, { kind: 'move', index: 1 });
    expect(r[0]).toContainEqual({ t: 'notice', text: 'Waiting for Bo...' });
    expect(battle.waiting()).toEqual([1]);
    battle.timeout();
    expect(battle.waiting()).toEqual([0, 1]);
    const f = battle.forfeit(1);
    expect(battle.winner).toBe(0);
    expect(f[0]).toContainEqual({ t: 'battleEnd', result: 'win' });
  });
});
