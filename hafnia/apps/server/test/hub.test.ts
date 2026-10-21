// The online server end to end, without sockets: accounts and invites, a new online character
// played through the intro, seeing each other, chat, a trade, a PvP battle, moderation, and
// logging back in to the saved character.
import { describe, expect, it } from 'vitest';
import { Content, Rng, makeMon, type ClientMessage, type Intent, type ServerEvent, type ServerMessage } from '@hafnia/core';
import { hafnia } from '@hafnia/pack-hafnia';
import { makeVerifier } from '../src/auth';
import { Hub } from '../src/hub';
import { MemoryStore } from '../src/store';

const content = new Content([hafnia]);

function makeHub() {
  const store = new MemoryStore();
  let seed = 1234;
  const hub = new Hub({
    store, content, admins: ['mark@example.com'], verify: makeVerifier({ devAuth: true }),
    seed: () => seed++, tradeCountdownMs: 0, turnTimerMs: 60_000, log: () => {}
  });
  return { hub, store };
}

class Client {
  inbox: ServerMessage[] = [];
  closed = false;
  conn: ReturnType<Hub['connect']>;
  private next = 1;
  constructor(public hub: Hub) {
    this.conn = hub.connect({ send: m => this.inbox.push(structuredClone(m)), close: () => { this.closed = true; } });
  }
  async msg(m: ClientMessage) { this.conn.receive(m); await this.conn.idle; }
  async auth(email: string, extra: Partial<Extract<ClientMessage, { s: 'auth' }>> = {}) {
    await this.msg({ s: 'auth', token: `dev:${email}`, ...extra });
    return this.inbox[this.inbox.length - 1];
  }
  /** Sends an intent and returns its reply events. */
  async intent(intent: Intent): Promise<ServerEvent[]> {
    const id = this.next++;
    await this.msg({ id, intent });
    const r = this.inbox.find(m => 'id' in m && m.id === id) as { events: ServerEvent[] };
    return r.events;
  }
  /** Answers prompts with the first option and battles with the first move until nothing is asked. */
  async drive(events: ServerEvent[]) {
    for (let guard = 0; guard < 500; guard++) {
      const ask = [...events].reverse().find(e => e.t === 'prompt' || e.t === 'pickSpecies' || e.t === 'battleRequest');
      if (!ask) return;
      events = await this.intent(this.answer(ask));
    }
    throw new Error('drive: too many steps');
  }
  answer(e: ServerEvent): Intent {
    if (e.t !== 'battleRequest') return { t: 'answer', index: 0 };
    const r = e.request;
    if (r.forceSwitch) return { t: 'battle', action: { kind: 'switch', uid: r.party.find(p => p.hp > 0 && p.uid !== r.activeUid)!.uid } };
    return { t: 'battle', action: { kind: 'move', index: Math.max(0, r.moves.findIndex(m => !m.disabled)) } };
  }
  of<K extends string>(s: K) { return this.inbox.filter(m => 's' in m && m.s === s) as Extract<ServerMessage, { s: K }>[]; }
  pushes() { return this.inbox.filter(m => 'push' in m).flatMap(m => (m as { push: ServerEvent[] }).push); }
  clear() { this.inbox = []; }
}

async function newPlayer(hub: Hub, email: string, name: string, invite?: string) {
  const c = new Client(hub);
  const hello = await c.auth(email, { trainerName: name, birthYear: 1990, ...(invite ? { invite } : {}) });
  expect(hello).toMatchObject({ s: 'hello', me: { name } });
  expect(await c.intent({ t: 'title' })).toEqual([expect.objectContaining({ t: 'title', hasSave: false })]);
  await c.drive(await c.intent({ t: 'newGame' }));
  // The starter comes later in the story (the playthrough test covers that): hand out a team here.
  const game = hub.sessions.get(c.of('hello')[0].me.id)!.game!, rng = new Rng(name.length);
  game.state.party.push(makeMon('sprigatito', 12, rng, { ot: name }), makeMon('popplio', 11, rng, { ot: name }));
  await c.intent({ t: 'save' });
  return c;
}

describe('online server', () => {
  it('runs accounts, presence, chat, trades, PvP and saves', async () => {
    const { hub, store } = makeHub();

    // Invite-only: strangers are turned away, admins get in and can make codes.
    const stranger = new Client(hub);
    expect(await stranger.auth('eve@example.com', { trainerName: 'Eve', birthYear: 1990 })).toMatchObject({ s: 'authError', reason: 'invite_required' });
    expect(await stranger.auth('eve@example.com', { trainerName: 'Eve', birthYear: 1990, invite: 'NOPE-NOPE' })).toMatchObject({ reason: 'invite_invalid' });
    expect(await stranger.auth('kid@example.com', { trainerName: 'Kid', birthYear: new Date().getUTCFullYear() - 10, invite: 'X' })).toMatchObject({ reason: 'too_young' });
    expect(await new Client(hub).auth('x@example.com')).toMatchObject({ reason: 'signup', needsInvite: true });
    expect(await new Client(hub).auth('mark@example.com')).toMatchObject({ reason: 'signup', needsInvite: false });

    const mark = await newPlayer(hub, 'mark@example.com', 'Mark');
    await mark.msg({ s: 'chat', channel: 'map', text: '/invite 2' });
    const codes = mark.of('system').at(-1)!.text.replace('Invite codes: ', '').split(' ');
    expect(codes).toHaveLength(2);

    const ida = await newPlayer(hub, 'ida@example.com', 'Ida', codes[0]);
    expect(await new Client(hub).auth('bo@example.com', { trainerName: 'Bodil', birthYear: 1990, invite: codes[0] })).toMatchObject({ reason: 'invite_invalid' });
    expect(await new Client(hub).auth('bo@example.com', { trainerName: 'mark', birthYear: 1990, invite: codes[1] })).toMatchObject({ reason: 'name_taken' });
    expect(store.data.accounts[ida.of('hello')[0].me.id].invitedBy).toBe(mark.of('hello')[0].me.id);

    // Both finished the intro, on the same map, and see each other.
    const mg = hub.sessions.get(mark.of('hello')[0].me.id)!.game!, ig = hub.sessions.get(ida.of('hello')[0].me.id)!.game!;
    expect(mg.state.name).toBe('Mark');
    expect(mg.state.party.length).toBeGreaterThan(0);
    expect(ig.state.party.length).toBeGreaterThan(0);
    expect(ig.state.map).toBe(mg.state.map);
    const markId = mark.of('hello')[0].me.id, idaId = ida.of('hello')[0].me.id;
    expect(mark.of('join').some(j => j.player.id === idaId) || mark.of('move').some(m => m.id === idaId)).toBe(true);
    expect(ida.of('players').at(-1)!.players.map(p => p.id)).toContain(markId);

    // Walking is broadcast.
    mark.clear(); ida.clear();
    for (const dir of ['left', 'right', 'up', 'down'] as const) await ida.intent({ t: 'step', dir });
    expect(mark.of('move').length + mark.of('players').length + mark.of('leave').length + mark.of('join').length).toBeGreaterThan(0);
    // Put them back on one map for the rest.
    Object.assign(ig.state, { map: mg.state.map, x: mg.state.x + 1, y: mg.state.y });
    await ida.intent({ t: 'turn', dir: 'left' });

    // Chat reaches the map, rude words are masked.
    await mark.msg({ s: 'chat', channel: 'map', text: 'hej Ida, what the fuck' });
    expect(ida.of('chat').at(-1)).toMatchObject({ name: 'Mark', text: 'hej Ida, what the ****' });

    // Trade: invite, accept, offer, lock, confirm.
    const mOffer = mg.state.party[0], iOffer = ig.state.party[0];
    await mark.msg({ s: 'invite', kind: 'trade', to: idaId });
    expect(ida.of('invite').at(-1)).toMatchObject({ kind: 'trade', from: markId });
    await ida.msg({ s: 'respond', kind: 'trade', from: markId, accept: true });
    await mark.msg({ s: 'tradeOffer', uid: mOffer.uid });
    await ida.msg({ s: 'tradeOffer', uid: iOffer.uid });
    expect(ida.of('trade').at(-1)!.trade.theirs?.uid).toBe(mOffer.uid);
    await mark.msg({ s: 'tradeConfirm' });
    expect(mark.of('system').at(-1)!.text).toMatch(/countdown/);
    await mark.msg({ s: 'tradeLock' });
    await ida.msg({ s: 'tradeLock' });
    await ida.msg({ s: 'tradeOffer', uid: null });
    expect(ida.of('system').at(-1)!.text).toMatch(/locked/);
    await mark.msg({ s: 'tradeConfirm' });
    await ida.msg({ s: 'tradeConfirm' });
    expect(mark.of('tradeEnd').at(-1)).toMatchObject({ done: true });
    expect(mg.state.party[0].uid).toBe(iOffer.uid);
    expect(ig.state.party[0].uid).toBe(mOffer.uid);
    expect(store.data.trades).toHaveLength(1);
    expect(store.data.characters[idaId].party[0].uid).toBe(mOffer.uid);

    // PvP: both sides pick moves until someone wins. Teams are copies, so HP is untouched afterwards.
    const hpBefore = mg.state.party.map(m => m.hp);
    mark.clear(); ida.clear();
    await mark.msg({ s: 'invite', kind: 'battle', to: idaId });
    await ida.msg({ s: 'respond', kind: 'battle', from: markId, accept: true });
    expect(mark.pushes().find(e => e.t === 'battleStart')).toMatchObject({ battle: { trainer: { name: 'Ida' } } });
    const results: Record<string, string> = {};
    const seen = new Map<Client, number>([[mark, 0], [ida, 0]]);
    for (let turn = 0; turn < 300 && Object.keys(results).length < 2; turn++) {
      for (const c of [mark, ida]) {
        // Everything this client has received since we last looked, pushes and replies alike.
        const fresh = c.inbox.slice(seen.get(c)!);
        seen.set(c, c.inbox.length);
        const evs = fresh.flatMap(m => ('push' in m ? m.push : 'events' in m ? m.events : []));
        for (const e of evs) if (e.t === 'battleEnd') results[c === mark ? 'mark' : 'ida'] = e.result;
        const req = [...evs].reverse().find(e => e.t === 'battleRequest' || e.t === 'battleEnd');
        if (req?.t === 'battleRequest') await c.intent(c.answer(req));
      }
    }
    expect(Object.values(results).sort()).toEqual(['lose', 'win']);
    expect(mg.state.party.map(m => m.hp)).toEqual(hpBefore);
    expect(hub.sessions.get(markId)!.pvp).toBeNull();

    // Moderation: an admin mute stops chat; a block hides chat.
    await mark.msg({ s: 'chat', channel: 'map', text: '/mute Ida 5' });
    await ida.msg({ s: 'chat', channel: 'global', text: 'hello?' });
    expect(ida.of('system').at(-1)!.text).toMatch(/muted/);
    await ida.msg({ s: 'chat', channel: 'map', text: '/who' });
    expect(ida.of('system').at(-1)!.text).toMatch(/Mark/);

    // Logging back in finds the saved character, with the traded Pokémon.
    await ida.conn.closed();
    expect(hub.sessions.has(idaId)).toBe(false);
    const again = new Client(hub);
    expect(await again.auth('ida@example.com')).toMatchObject({ s: 'hello', me: { name: 'Ida' } });
    expect(await again.intent({ t: 'title' })).toEqual([expect.objectContaining({ hasSave: true })]);
    await again.intent({ t: 'continue' });
    expect(hub.sessions.get(idaId)!.game!.state.party[0].uid).toBe(mOffer.uid);
    expect(await again.intent({ t: 'newGame' })).toEqual([expect.objectContaining({ t: 'error' })]);

    // A second login kicks the first.
    const twice = new Client(hub);
    await twice.auth('ida@example.com');
    expect(again.closed).toBe(true);
    await hub.stop();
  }, 60_000);
});
