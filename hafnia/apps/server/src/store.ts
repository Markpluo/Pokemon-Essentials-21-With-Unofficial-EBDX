// Persistence for the online world. PgStore (Postgres / Supabase) in production; MemoryStore
// for development and tests, optionally kept in a JSON file so local accounts survive restarts.
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import type { Mon, SaveData } from '@hafnia/core';

export interface Account {
  id: string;                 // Supabase auth user id
  email: string;
  trainerName: string;
  birthYear: number;
  role: 'player' | 'admin';
  invitedBy: string | null;
  createdAt: number;          // ms
  mutedUntil: number | null;  // ms
  banned: boolean;
}

export interface TradeRecord { a: string; b: string; aMon: Mon; bMon: Mon }
export interface AuditEntry { actor: string | null; action: string; target: string | null; detail: Record<string, unknown> }

export interface Store {
  account(id: string): Promise<Account | null>;
  accountByName(trainerName: string): Promise<Account | null>;
  /** Creates the account and uses up the invite in one step. Returns false if the code is unknown or used. */
  createAccount(a: Account, invite: string | null): Promise<'ok' | 'invite_invalid' | 'name_taken'>;
  updateAccount(id: string, patch: Partial<Pick<Account, 'mutedUntil' | 'banned' | 'role'>>): Promise<void>;
  createInvites(by: string | null, codes: string[]): Promise<void>;

  character(accountId: string): Promise<SaveData | null>;
  saveCharacter(accountId: string, data: SaveData): Promise<void>;
  /** Saves both characters and the trade record together: either all of it happens or none. */
  saveTrade(t: TradeRecord, aData: SaveData, bData: SaveData): Promise<void>;

  blocks(accountId: string): Promise<string[]>;
  block(accountId: string, blockedId: string): Promise<void>;
  report(reporter: string, reported: string, reason: string, chat: unknown[]): Promise<void>;
  logChat(accountId: string, channel: string, text: string): Promise<void>;
  audit(e: AuditEntry): Promise<void>;
  close(): Promise<void>;
}

interface MemoryData {
  accounts: Record<string, Account>;
  invites: Record<string, { by: string | null; usedBy: string | null }>;
  characters: Record<string, SaveData>;
  blocks: Record<string, string[]>;
  trades: (TradeRecord & { at: number })[];
  reports: { reporter: string; reported: string; reason: string; chat: unknown[]; at: number }[];
  chat: { accountId: string; channel: string; text: string; at: number }[];
  audit: (AuditEntry & { at: number })[];
}

export class MemoryStore implements Store {
  data: MemoryData = { accounts: {}, invites: {}, characters: {}, blocks: {}, trades: [], reports: [], chat: [], audit: [] };
  private timer: NodeJS.Timeout | null = null;

  /** With a file path, the data is loaded from and written back to that JSON file. */
  constructor(private file?: string) {
    if (file && existsSync(file)) this.data = { ...this.data, ...JSON.parse(readFileSync(file, 'utf8')) };
  }

  private dirty() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flushFile(); }, 500);
  }
  private flushFile() {
    if (!this.file) return;
    writeFileSync(`${this.file}.tmp`, JSON.stringify(this.data));
    renameSync(`${this.file}.tmp`, this.file);
  }

  async account(id: string) { return this.data.accounts[id] ?? null; }
  async accountByName(name: string) {
    const n = name.toLowerCase();
    return Object.values(this.data.accounts).find(a => a.trainerName.toLowerCase() === n) ?? null;
  }
  async createAccount(a: Account, invite: string | null) {
    if (await this.accountByName(a.trainerName)) return 'name_taken';
    if (invite !== null) {
      const inv = this.data.invites[invite];
      if (!inv || inv.usedBy) return 'invite_invalid';
      inv.usedBy = a.id;
      a.invitedBy = inv.by;
    }
    this.data.accounts[a.id] = a;
    this.dirty();
    return 'ok';
  }
  async updateAccount(id: string, patch: Partial<Account>) {
    const a = this.data.accounts[id];
    if (a) Object.assign(a, patch);
    this.dirty();
  }
  async createInvites(by: string | null, codes: string[]) {
    for (const c of codes) this.data.invites[c] = { by, usedBy: null };
    this.dirty();
  }
  async character(id: string) { const c = this.data.characters[id]; return c ? structuredClone(c) : null; }
  async saveCharacter(id: string, data: SaveData) { this.data.characters[id] = structuredClone(data); this.dirty(); }
  async saveTrade(t: TradeRecord, aData: SaveData, bData: SaveData) {
    this.data.characters[t.a] = structuredClone(aData);
    this.data.characters[t.b] = structuredClone(bData);
    this.data.trades.push({ ...structuredClone(t), at: Date.now() });
    this.dirty();
  }
  async blocks(id: string) { return this.data.blocks[id] ?? []; }
  async block(id: string, blocked: string) {
    const list = (this.data.blocks[id] ??= []);
    if (!list.includes(blocked)) list.push(blocked);
    this.dirty();
  }
  async report(reporter: string, reported: string, reason: string, chat: unknown[]) {
    this.data.reports.push({ reporter, reported, reason, chat, at: Date.now() }); this.dirty();
  }
  async logChat(accountId: string, channel: string, text: string) {
    this.data.chat.push({ accountId, channel, text, at: Date.now() });
    if (this.data.chat.length > 5000) this.data.chat.splice(0, 1000);
    this.dirty();
  }
  async audit(e: AuditEntry) { this.data.audit.push({ ...e, at: Date.now() }); this.dirty(); }
  async close() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } this.flushFile(); }
}
