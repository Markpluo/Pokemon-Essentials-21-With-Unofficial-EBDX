// Postgres persistence (Supabase in production). Schema: db/001_init.sql.
import pg from 'pg';
import type { SaveData } from '@hafnia/core';
import type { Account, AuditEntry, Store, TradeRecord } from './store';

const toAccount = (r: any): Account => ({
  id: r.id, email: r.email, trainerName: r.trainer_name, birthYear: r.birth_year, role: r.role, invitedBy: r.invited_by,
  createdAt: new Date(r.created_at).getTime(), mutedUntil: r.muted_until ? new Date(r.muted_until).getTime() : null, banned: r.banned
});

export class PgStore implements Store {
  private pool: pg.Pool;

  constructor(url: string) {
    // Supabase requires TLS; its pooler certificate is not in Node's default CA list.
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    this.pool = new pg.Pool({ connectionString: url, max: 5, ...(local ? {} : { ssl: { rejectUnauthorized: false } }) });
  }

  async account(id: string) {
    const r = await this.pool.query('select * from accounts where id = $1', [id]);
    return r.rows[0] ? toAccount(r.rows[0]) : null;
  }
  async accountByName(name: string) {
    const r = await this.pool.query('select * from accounts where lower(trainer_name) = lower($1)', [name]);
    return r.rows[0] ? toAccount(r.rows[0]) : null;
  }
  async createAccount(a: Account, invite: string | null) {
    const c = await this.pool.connect();
    try {
      await c.query('begin');
      let invitedBy: string | null = null;
      if (invite !== null) {
        const r = await c.query('select created_by, used_by from invites where code = $1 for update', [invite]);
        if (!r.rows[0] || r.rows[0].used_by) { await c.query('rollback'); return 'invite_invalid' as const; }
        invitedBy = r.rows[0].created_by;
      }
      try {
        await c.query(
          'insert into accounts (id, email, trainer_name, birth_year, role, invited_by) values ($1, $2, $3, $4, $5, $6)',
          [a.id, a.email, a.trainerName, a.birthYear, a.role, invitedBy]);
      } catch (e: any) {
        await c.query('rollback');
        if (e.code === '23505') return 'name_taken' as const;
        throw e;
      }
      if (invite !== null) await c.query('update invites set used_by = $1, used_at = now() where code = $2', [a.id, invite]);
      await c.query('commit');
      a.invitedBy = invitedBy;
      return 'ok' as const;
    } catch (e) {
      await c.query('rollback').catch(() => {});
      throw e;
    } finally { c.release(); }
  }
  async updateAccount(id: string, patch: Partial<Pick<Account, 'mutedUntil' | 'banned' | 'role'>>) {
    if ('mutedUntil' in patch) await this.pool.query('update accounts set muted_until = $2 where id = $1', [id, patch.mutedUntil ? new Date(patch.mutedUntil) : null]);
    if ('banned' in patch) await this.pool.query('update accounts set banned = $2 where id = $1', [id, patch.banned]);
    if ('role' in patch) await this.pool.query('update accounts set role = $2 where id = $1', [id, patch.role]);
  }
  async createInvites(by: string | null, codes: string[]) {
    for (const code of codes) await this.pool.query('insert into invites (code, created_by) values ($1, $2)', [code, by]);
  }
  async character(id: string) {
    const r = await this.pool.query('select data from characters where account_id = $1', [id]);
    return (r.rows[0]?.data as SaveData) ?? null;
  }
  async saveCharacter(id: string, data: SaveData) {
    await this.pool.query(
      'insert into characters (account_id, data, updated_at) values ($1, $2, now()) on conflict (account_id) do update set data = excluded.data, updated_at = now()',
      [id, data]);
  }
  async saveTrade(t: TradeRecord, aData: SaveData, bData: SaveData) {
    const c = await this.pool.connect();
    try {
      await c.query('begin');
      for (const [id, data] of [[t.a, aData], [t.b, bData]] as const)
        await c.query('update characters set data = $2, updated_at = now() where account_id = $1', [id, data]);
      await c.query('insert into trades (a, b, a_mon, b_mon) values ($1, $2, $3, $4)', [t.a, t.b, t.aMon, t.bMon]);
      await c.query('commit');
    } catch (e) {
      await c.query('rollback').catch(() => {});
      throw e;
    } finally { c.release(); }
  }
  async blocks(id: string) {
    const r = await this.pool.query('select blocked_id from blocks where account_id = $1', [id]);
    return r.rows.map(x => x.blocked_id as string);
  }
  async block(id: string, blocked: string) {
    await this.pool.query('insert into blocks (account_id, blocked_id) values ($1, $2) on conflict do nothing', [id, blocked]);
  }
  async report(reporter: string, reported: string, reason: string, chat: unknown[]) {
    await this.pool.query('insert into reports (reporter, reported, reason, chat) values ($1, $2, $3, $4)', [reporter, reported, reason, JSON.stringify(chat)]);
  }
  async logChat(accountId: string, channel: string, text: string) {
    await this.pool.query('insert into chat_log (account_id, channel, text) values ($1, $2, $3)', [accountId, channel, text]);
  }
  async audit(e: AuditEntry) {
    await this.pool.query('insert into audit_log (actor, action, target, detail) values ($1, $2, $3, $4)', [e.actor, e.action, e.target, e.detail]);
  }
  async close() { await this.pool.end(); }
}
