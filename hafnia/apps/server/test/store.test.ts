// Both stores behave the same. The Postgres one runs when TEST_DATABASE_URL points at a database
// with db/001_init.sql applied (CI skips it).
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Game, Content, Rng, makeMon } from '@hafnia/core';
import { hafnia } from '@hafnia/pack-hafnia';
import { PgStore } from '../src/pg-store';
import { MemoryStore, type Account, type Store } from '../src/store';

const content = new Content([hafnia]);
const pgUrl = process.env.TEST_DATABASE_URL;
const account = (name: string): Account => ({
  id: randomUUID(), email: `${name}@example.com`, trainerName: name, birthYear: 1990, role: 'player',
  invitedBy: null, createdAt: Date.now(), mutedUntil: null, banned: false
});

const cases: [string, () => Store][] = [['memory', () => new MemoryStore()]];
if (pgUrl) cases.push(['postgres', () => new PgStore(pgUrl)]);

describe.each(cases)('%s store', (_, make) => {
  it('keeps accounts, invites, characters and trades', async () => {
    const store = make(), tag = Math.random().toString(36).slice(2, 7);
    const admin = account(`Ad${tag}`);
    expect(await store.createAccount(admin, null)).toBe('ok');
    await store.createInvites(admin.id, [`T-${tag}`]);
    const a = account(`Al${tag}`), b = account(`Bo${tag}`);
    expect(await store.createAccount(a, `T-${tag}`)).toBe('ok');
    expect(a.invitedBy).toBe(admin.id);
    expect(await store.createAccount(b, `T-${tag}`)).toBe('invite_invalid');
    expect(await store.createAccount({ ...b, trainerName: a.trainerName.toUpperCase() }, null)).toBe('name_taken');
    expect(await store.createAccount(b, null)).toBe('ok');
    expect((await store.accountByName(a.trainerName.toLowerCase()))?.id).toBe(a.id);

    await store.updateAccount(a.id, { mutedUntil: 1_900_000_000_000, banned: true });
    expect(await store.account(a.id)).toMatchObject({ mutedUntil: 1_900_000_000_000, banned: true });

    const ga = Game.newGame(content, 1, { name: a.trainerName }).game, gb = Game.newGame(content, 2, { name: b.trainerName }).game;
    const rng = new Rng(5);
    ga.state.party.push(makeMon('sprigatito', 10, rng, { ot: 'A' }));
    gb.state.party.push(makeMon('popplio', 10, rng, { ot: 'B' }));
    await store.saveCharacter(a.id, ga.toSave());
    await store.saveCharacter(b.id, gb.toSave());
    expect((await store.character(a.id))?.party[0].species).toBe('sprigatito');

    const [ma, mb] = [ga.state.party[0], gb.state.party[0]];
    ga.state.party[0] = mb; gb.state.party[0] = ma;
    await store.saveTrade({ a: a.id, b: b.id, aMon: ma, bMon: mb }, ga.toSave(), gb.toSave());
    expect((await store.character(a.id))?.party[0].species).toBe('popplio');
    expect((await store.character(b.id))?.party[0].species).toBe('sprigatito');

    await store.block(a.id, b.id);
    await store.block(a.id, b.id);
    expect(await store.blocks(a.id)).toEqual([b.id]);
    await store.report(a.id, b.id, 'test', [{ text: 'hi' }]);
    await store.logChat(a.id, 'map', 'hello');
    await store.audit({ actor: a.id, action: 'test', target: b.id, detail: { ok: true } });
    await store.close();
  });
});
