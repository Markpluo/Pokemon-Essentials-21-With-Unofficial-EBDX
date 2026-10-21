// The online world. Each connected player has a Session holding their account and their
// character's Game (the same game-core class solo play runs in a Web Worker), so encounters,
// battles, items and story all resolve here. On top of that the hub adds what only exists
// online: seeing other players on your map, chat, trades and PvP battles.
// Transport-free: main.ts plugs WebSockets in, tests plug in plain functions.
import {
  Game, PvpBattle, Rng, SaveError, checkMon, monView,
  type ChatChannel, type ClientMessage, type Content, type Intent, type InviteKind, type Mon, type PlayerView,
  type ServerEvent, type ServerMessage, type TradeView
} from '@hafnia/core';
import type { Verifier } from './auth';
import { Bucket, cleanText, hasLink, maskProfanity, nameProblem } from './moderation';
import type { Account, Store } from './store';

export interface Link { send(msg: ServerMessage): void; close(reason: string): void }

export interface HubOptions {
  store: Store;
  verify: Verifier;
  content: Content;
  /** Emails that become admins on first login and need no invite code. */
  admins?: string[];
  maxPlayers?: number;
  /** Local development only (DEV_AUTH): enables the client's debug menu commands. */
  debug?: boolean;
  seed?: () => number;
  now?: () => number;
  tradeCountdownMs?: number;
  turnTimerMs?: number;
  saveEveryMs?: number;
  log?: (msg: string) => void;
}

const RULES = 'Be kind. No cheating, no real-money trading, and never share personal info. Reports go to the admins.';
const DAY = 86_400_000;
const INVITE_TTL = 60_000;
const MIN_AGE = 13;

interface ChatLine { from: string; name: string; channel: ChatChannel; text: string; at: number }

export class Hub {
  readonly sessions = new Map<string, Session>();
  readonly chatHistory: ChatLine[] = [];
  readonly opts: Required<Omit<HubOptions, 'admins'>> & { admins: Set<string> };
  private saver: NodeJS.Timeout | null = null;

  constructor(o: HubOptions) {
    this.opts = {
      maxPlayers: 200, debug: false, seed: () => (Math.random() * 2 ** 32) >>> 0, now: Date.now, tradeCountdownMs: 10_000,
      turnTimerMs: 90_000, saveEveryMs: 60_000, log: m => console.log(m), ...o,
      admins: new Set((o.admins ?? []).map(e => e.toLowerCase()))
    };
  }

  get store() { return this.opts.store; }
  get content() { return this.opts.content; }
  log(m: string) { this.opts.log(m); }
  admins(email: string) { return !!email && this.opts.admins.has(email.toLowerCase()); }

  /** Starts the periodic character saves. */
  start() {
    this.saver = setInterval(() => { for (const s of this.sessions.values()) void s.save(); }, this.opts.saveEveryMs);
    this.saver.unref?.();
  }

  /** Saves everyone and stops (on deploys and shutdown). */
  async stop() {
    if (this.saver) clearInterval(this.saver);
    await Promise.all([...this.sessions.values()].map(s => s.disconnect('The server is restarting. Your progress was saved.')));
  }

  /** A new connection. Feed it messages with `receive`, and call `closed` when the socket closes. */
  connect(link: Link) { return new Connection(this, link); }

  onMap(map: string) { return [...this.sessions.values()].filter(s => s.game && s.game.state.map === map); }
  byName(name: string) { const n = name.toLowerCase(); return [...this.sessions.values()].find(s => s.account.trainerName.toLowerCase() === n); }

  rememberChat(line: ChatLine) {
    this.chatHistory.push(line);
    if (this.chatHistory.length > 500) this.chatHistory.splice(0, 100);
  }
}

/** One socket. Before login it only accepts `auth`; afterwards it forwards everything to its Session. */
class Connection {
  private session: Session | null = null;
  private authing = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(private hub: Hub, private link: Link) {}

  receive(raw: unknown) {
    // Messages are handled strictly in order, one at a time.
    this.queue = this.queue.then(async () => { await this.handle(raw); }).catch(e => {
      this.hub.log(`error: ${e?.stack ?? e}`);
      this.link.send({ s: 'system', text: 'Something went wrong on the server.' });
    });
  }

  /** Resolves once every message received so far has been handled. */
  get idle() { return this.queue; }

  async closed() {
    await this.queue;
    if (this.session) await this.session.disconnect();
  }

  private async handle(raw: unknown) {
    const msg = raw as ClientMessage;
    if (!msg || typeof msg !== 'object') return;
    if (this.session) return this.session.handle(msg);
    if ('s' in msg && msg.s === 'auth' && !this.authing) {
      this.authing = true;
      try { this.session = await this.auth(msg); } finally { this.authing = false; }
    }
  }

  private async auth(m: Extract<ClientMessage, { s: 'auth' }>): Promise<Session | null> {
    const hub = this.hub, store = hub.store;
    let needsInvite: boolean | undefined;
    const fail = (reason: Extract<ServerMessage, { s: 'authError' }>['reason'], message: string) => {
      this.link.send({ s: 'authError', reason, message, ...(needsInvite !== undefined ? { needsInvite } : {}) });
      return null;
    };
    const who = await hub.opts.verify(m.token);
    if (!who) return fail('bad_token', 'Your login has expired. Please sign in again.');
    let account = await store.account(who.id);
    if (!account) {
      const admin = hub.admins(who.email);
      needsInvite = !admin;
      if (!m.trainerName && !m.invite) return fail('signup', 'Welcome, new trainer! Pick your trainer name.');
      const invite = admin ? null : cleanText(m.invite, 40).toUpperCase();
      if (invite === '') return fail('invite_required', 'This server is invite-only. Enter your invite code.');
      const name = cleanText(m.trainerName, 12);
      const bad = nameProblem(name);
      if (bad) return fail('name_invalid', bad);
      const year = Number(m.birthYear), thisYear = new Date(hub.opts.now()).getUTCFullYear();
      if (!Number.isInteger(year) || year < 1900 || year > thisYear) return fail('too_young', 'Please enter the year you were born.');
      if (thisYear - year < MIN_AGE) return fail('too_young', `Online play is for players aged ${MIN_AGE} and up.`);
      account = {
        id: who.id, email: who.email, trainerName: name, birthYear: year, role: admin ? 'admin' : 'player',
        invitedBy: null, createdAt: hub.opts.now(), mutedUntil: null, banned: false
      };
      const r = await store.createAccount(account, invite);
      if (r === 'invite_invalid') return fail('invite_invalid', 'That invite code is not valid or has been used.');
      if (r === 'name_taken') return fail('name_taken', 'That trainer name is taken.');
      await store.audit({ actor: account.id, action: 'account.create', target: account.id, detail: { invite, name } });
      hub.log(`new account ${name} (${account.id})`);
    }
    if (account.banned) return fail('banned', 'This account is banned.');
    const old = hub.sessions.get(account.id);
    if (old) await old.disconnect('You logged in somewhere else.');
    else if (hub.sessions.size >= hub.opts.maxPlayers) return fail('server_full', 'The server is full. Try again in a few minutes.');
    const s = new Session(hub, this.link, account, new Set(await store.blocks(account.id)));
    hub.sessions.set(account.id, s);
    this.link.send({ s: 'hello', me: { id: account.id, name: account.trainerName, role: account.role }, rules: RULES });
    return s;
  }
}

interface Trade {
  a: Session; b: Session;
  offer: [string | null, string | null];
  lock: [boolean, boolean];
  confirm: [boolean, boolean];
  countdownEnd: number | null;
  timer: NodeJS.Timeout | null;
}
interface Pvp { battle: PvpBattle; players: [Session, Session]; timer: NodeJS.Timeout | null }

export class Session {
  game: Game | null = null;
  trade: Trade | null = null;
  pvp: Pvp | null = null;
  private invites = new Map<string, number>(); // "kind:fromId" -> expiry
  private chatBucket: Bucket;
  private stepBucket: Bucket;
  private seen: { map: string; x: number; y: number; dir: string } | null = null;
  private gone = false;
  private lastTick: number;

  constructor(private hub: Hub, private link: Link, public account: Account, private blocked: Set<string>) {
    this.chatBucket = new Bucket(1, 5, hub.opts.now);
    this.stepBucket = new Bucket(10, 10, hub.opts.now);
    this.lastTick = hub.opts.now();
  }

  get id() { return this.account.id; }
  get name() { return this.account.trainerName; }
  send(m: ServerMessage) { if (!this.gone) this.link.send(m); }
  push(events: ServerEvent[]) { if (events.length) this.send({ push: events }); }
  system(text: string) { this.send({ s: 'system', text }); }
  blocks(other: Session) { return this.blocked.has(other.id) || other.blocked.has(this.id); }
  get free() { return !!this.game && !this.game.busy && !this.trade && !this.pvp; }

  async handle(m: ClientMessage) {
    if ('intent' in m) return this.send({ id: m.id, events: await this.intent(m.intent) });
    switch (m.s) {
      case 'chat': return this.chat(m.channel, m.text);
      case 'invite': return this.invite(m.kind, m.to);
      case 'respond': return this.respond(m.kind, m.from, m.accept);
      case 'tradeOffer': return this.tradeOffer(m.uid);
      case 'tradeLock': return this.tradeLock();
      case 'tradeConfirm': return this.tradeConfirm();
      case 'tradeCancel': return this.endTrade(false, `${this.name} cancelled the trade.`);
      case 'forfeit': return this.pvp && this.pvpResult(this.pvp, this.pvp.battle.forfeit(this.pvp.players.indexOf(this) as 0 | 1));
      case 'block': {
        const other = this.hub.sessions.get(String(m.id));
        if (!other || other === this) return;
        this.blocked.add(other.id);
        await this.hub.store.block(this.id, other.id);
        return this.system(`You blocked ${other.name}. You won't see their chat or invites.`);
      }
      case 'report': {
        const other = this.hub.sessions.get(String(m.id));
        if (!other) return;
        const chat = this.hub.chatHistory.filter(l => l.from === other.id).slice(-50);
        await this.hub.store.report(this.id, other.id, cleanText(m.reason, 500), chat);
        this.hub.log(`report: ${this.name} reported ${other.name}`);
        return this.system(`Thanks. Your report about ${other.name} was sent to the admins.`);
      }
    }
  }

  // ---------- the game ----------

  private async intent(intent: Intent): Promise<ServerEvent[]> {
    const store = this.hub.store, content = this.hub.content;
    switch (intent?.t) {
      case 'title': case 'slots': {
        const save = await store.character(this.id);
        let summary: string | null = null;
        if (save) { try { summary = Game.load(content, save).summary(); } catch { summary = null; } }
        if (intent.t === 'slots') return [{ t: 'slots', slots: [{ slot: 'auto', summary }] }];
        return [{ t: 'title', hasSave: !!save, ...(summary ? { summary } : {}), slots: [{ slot: 'auto', summary }] }];
      }
      case 'newGame': {
        if (this.game || await store.character(this.id)) return [{ t: 'error', message: 'You already have an online character. Choose Continue.' }];
        const { game, events } = Game.newGame(content, this.hub.opts.seed(), { name: this.name });
        game.debug = this.hub.opts.debug;
        this.game = game;
        this.announce();
        return events;
      }
      case 'continue': {
        if (!this.game) {
          const save = await store.character(this.id);
          if (!save) return [{ t: 'error', message: 'No online character yet. Choose New game.' }];
          try { this.game = Game.load(content, save); this.game.debug = this.hub.opts.debug; }
          catch (e) { return [{ t: 'error', message: e instanceof SaveError ? e.message : 'Your character could not be loaded.' }]; }
        }
        const events = this.game.resumeEvents();
        this.seen = null;
        this.announce();
        return events;
      }
      case 'save': case 'autosave': {
        const ok = await this.save();
        return intent.t === 'autosave' ? [] : [{ t: 'sfx', name: ok ? 'select' : 'cursor' }, { t: 'say', text: ok ? 'Your progress is saved on the server.' : 'You can\'t save right now.' }];
      }
      case 'debug': if (!this.hub.opts.debug) return []; break;
    }
    const g = this.game;
    if (!g) return [{ t: 'error', message: 'No game running.' }];
    if (this.pvp) {
      if (intent.t !== 'battle') return [];
      const p = this.pvp, side = p.players.indexOf(this) as 0 | 1;
      const out = p.battle.choose(side, intent.action);
      this.pvpResult(p, out, side);
      return out[side];
    }
    if (this.trade) return [];
    if (intent.t === 'step' && !this.stepBucket.take()) return [];
    if (intent.t === 'tick') { // the world clock follows real time on the server, whatever the client claims
      const now = this.hub.opts.now();
      intent = { t: 'tick', seconds: Math.min(60, (now - this.lastTick) / 1000) };
      this.lastTick = now;
    }
    const events = g.handle(intent);
    if (events.some(e => e.t === 'checkpoint')) await this.save();
    this.announce();
    return events;
  }

  /** Writes the character to the database. Skipped mid-battle or mid-cutscene, like solo autosaves. */
  async save(): Promise<boolean> {
    const g = this.game;
    if (!g || g.busy || this.trade || !g.state.party.length) return false;
    try { await this.hub.store.saveCharacter(this.id, g.toSave()); return true; }
    catch (e) { this.hub.log(`save failed for ${this.name}: ${e}`); return false; }
  }

  async disconnect(reason?: string) {
    if (this.gone) return;
    if (this.trade) this.endTrade(false, `${this.name} left.`);
    if (this.pvp) this.pvpResult(this.pvp, this.pvp.battle.forfeit(this.pvp.players.indexOf(this) as 0 | 1));
    await this.save();
    if (this.seen) for (const s of this.hub.onMap(this.seen.map)) if (s !== this) s.send({ s: 'leave', id: this.id });
    if (reason) { this.send({ s: 'kicked', reason }); this.link.close(reason); }
    this.gone = true;
    if (this.hub.sessions.get(this.id) === this) this.hub.sessions.delete(this.id);
  }

  // ---------- presence ----------

  view(): PlayerView | null {
    const s = this.game?.state;
    return s ? { id: this.id, name: this.name, sprite: s.look === 'girl' ? 'chars/player_girl' : 'chars/player', x: s.x, y: s.y, dir: s.dir } : null;
  }

  /** Tells the players on this map (and the old one) where this player is now. */
  private announce() {
    const v = this.view();
    if (!v) return;
    const map = this.game!.state.map, prev = this.seen;
    if (prev && prev.map === map && prev.x === v.x && prev.y === v.y && prev.dir === v.dir) return;
    const others = this.hub.onMap(map).filter(s => s !== this);
    if (!prev || prev.map !== map) {
      if (prev) for (const s of this.hub.onMap(prev.map)) if (s !== this) s.send({ s: 'leave', id: this.id });
      for (const s of others) s.send({ s: 'join', player: v });
      this.send({ s: 'players', map, players: others.map(s => s.view()!) });
      if (this.trade) this.endTrade(false, 'Trades only work on the same map.');
    } else for (const s of others) s.send({ s: 'move', id: this.id, x: v.x, y: v.y, dir: v.dir });
    this.seen = { map, x: v.x, y: v.y, dir: v.dir };
  }

  // ---------- chat ----------

  private async chat(channel: ChatChannel, raw: string) {
    const text = cleanText(raw);
    if (!text) return;
    if (text.startsWith('/')) return this.command(text);
    if (!this.game) return;
    const now = this.hub.opts.now();
    if (this.account.mutedUntil && this.account.mutedUntil > now) return this.system(`You are muted for ${Math.ceil((this.account.mutedUntil - now) / 60_000)} more minutes.`);
    if (!this.chatBucket.take()) return this.system('Slow down a little.');
    if (hasLink(text) && now - this.account.createdAt < 7 * DAY && this.account.role !== 'admin') return this.system('New accounts can\'t post links yet.');
    const ch: ChatChannel = channel === 'global' ? 'global' : 'map';
    const line = { s: 'chat' as const, channel: ch, from: this.id, name: this.name, text: maskProfanity(text), at: now };
    const to = ch === 'global' ? [...this.hub.sessions.values()] : this.hub.onMap(this.game.state.map);
    for (const s of to) if (!s.blocks(this)) s.send(line);
    this.hub.rememberChat(line);
    await this.hub.store.logChat(this.id, ch, text);
  }

  /** Slash commands. Everyone: /help, /who. Admins also: /invite, /mute, /unmute, /kick, /ban, /unban. */
  private async command(text: string) {
    const [cmd, target = '', arg = ''] = text.slice(1).split(' ');
    const hub = this.hub, store = hub.store, admin = this.account.role === 'admin';
    switch (cmd.toLowerCase()) {
      case 'help': return this.system(`Commands: /who${admin ? ', /invite [n], /mute name [minutes], /unmute name, /kick name, /ban name, /unban name' : ''}`);
      case 'who': return this.system(`Online (${hub.sessions.size}): ${[...hub.sessions.values()].map(s => s.name).join(', ')}`);
    }
    if (!admin) return this.system('Unknown command. Try /help.');
    const audit = (action: string, t: string | null, detail: Record<string, unknown> = {}) => store.audit({ actor: this.id, action, target: t, detail });
    if (cmd === 'invite') {
      const n = Math.min(20, Math.max(1, Number(target) || 1));
      const codes = Array.from({ length: n }, () => inviteCode());
      await store.createInvites(this.id, codes);
      await audit('invite.create', null, { count: n });
      return this.system(`Invite codes: ${codes.join(' ')}`);
    }
    const acc = await store.accountByName(target);
    if (!acc) return this.system(`No trainer called "${target}".`);
    const live = hub.sessions.get(acc.id);
    switch (cmd) {
      case 'mute': {
        const minutes = Math.min(7 * 24 * 60, Math.max(1, Number(arg) || 60));
        const until = hub.opts.now() + minutes * 60_000;
        await store.updateAccount(acc.id, { mutedUntil: until });
        if (live) { live.account.mutedUntil = until; live.system(`You were muted for ${minutes} minutes.`); }
        await audit('mute', acc.id, { minutes });
        return this.system(`${acc.trainerName} is muted for ${minutes} minutes.`);
      }
      case 'unmute':
        await store.updateAccount(acc.id, { mutedUntil: null });
        if (live) live.account.mutedUntil = null;
        await audit('unmute', acc.id);
        return this.system(`${acc.trainerName} can chat again.`);
      case 'kick':
        await live?.disconnect('An admin removed you from the server.');
        await audit('kick', acc.id);
        return this.system(`${acc.trainerName} was kicked.`);
      case 'ban':
        await store.updateAccount(acc.id, { banned: true });
        await live?.disconnect('This account is banned.');
        await audit('ban', acc.id);
        return this.system(`${acc.trainerName} is banned.`);
      case 'unban':
        await store.updateAccount(acc.id, { banned: false });
        await audit('unban', acc.id);
        return this.system(`${acc.trainerName} is no longer banned.`);
    }
    return this.system('Unknown command. Try /help.');
  }

  // ---------- trade and battle invites ----------

  private invite(kind: InviteKind, to: string) {
    const other = this.hub.sessions.get(String(to));
    if (kind !== 'trade' && kind !== 'battle') return;
    if (!other || other === this || !other.game || !this.game) return this.system('That player is not online.');
    if (this.blocks(other)) return this.system('You can\'t invite that player.');
    if (other.game.state.map !== this.game.state.map) return this.system(`${other.name} needs to be on the same map.`);
    if (!this.free) return this.system('Finish what you are doing first.');
    if (!other.free) return this.system(`${other.name} is busy right now.`);
    if (!this.game.state.party.length || !other.game.state.party.length) return this.system('Both trainers need a Pokémon first.');
    other.invites.set(`${kind}:${this.id}`, this.hub.opts.now() + INVITE_TTL);
    other.send({ s: 'invite', kind, from: this.id, name: this.name });
    this.system(`You asked ${other.name} to ${kind === 'trade' ? 'trade' : 'battle'}.`);
  }

  private respond(kind: InviteKind, from: string, accept: boolean) {
    const key = `${kind}:${from}`, expiry = this.invites.get(key);
    this.invites.delete(key);
    const other = this.hub.sessions.get(String(from));
    if (!other || !expiry || expiry < this.hub.opts.now()) return this.system('That invite has expired.');
    if (!accept) return other.system(`${this.name} said no to your ${kind} request.`);
    if (!this.free || !other.free || other.game!.state.map !== this.game!.state.map) {
      this.system('The invite can\'t be accepted right now.');
      return other.system(`${this.name} couldn't accept right now.`);
    }
    if (kind === 'trade') this.startTrade(other);
    else this.startBattle(other);
  }

  // ---------- trading (online-ops.md §3: two-step confirm with a countdown) ----------

  private startTrade(other: Session) {
    const t: Trade = { a: other, b: this, offer: [null, null], lock: [false, false], confirm: [false, false], countdownEnd: null, timer: null };
    this.trade = other.trade = t;
    this.sendTrade();
  }

  private sendTrade() {
    const t = this.trade;
    if (!t) return;
    const now = this.hub.opts.now();
    for (const [i, s] of [t.a, t.b].entries()) {
      const j = 1 - i, mine = s.game!.state.party, theirs = t[j === 0 ? 'a' : 'b'].game!.state.party;
      const find = (party: Mon[], uid: string | null) => { const m = uid ? party.find(x => x.uid === uid) : undefined; return m ? monView(m) : null; };
      const view: TradeView = {
        partner: { id: t[j === 0 ? 'a' : 'b'].id, name: t[j === 0 ? 'a' : 'b'].name },
        myParty: mine.map(monView),
        mine: find(mine, t.offer[i]), theirs: find(theirs, t.offer[j]),
        myLock: t.lock[i], theirLock: t.lock[j], myConfirm: t.confirm[i], theirConfirm: t.confirm[j],
        ...(t.countdownEnd ? { countdown: Math.max(0, Math.ceil((t.countdownEnd - now) / 1000)) } : {})
      };
      s.send({ s: 'trade', trade: view });
    }
  }

  private tradeSide() { const t = this.trade!; return t.a === this ? 0 : 1; }

  private tradeOffer(uid: string | null) {
    const t = this.trade;
    if (!t) return;
    const i = this.tradeSide();
    if (t.lock[i] || t.lock[1 - i]) return this.system('Offers are locked. Cancel the trade to change your offer.');
    if (uid !== null && !this.game!.state.party.some(m => m.uid === uid)) return;
    t.offer[i] = uid;
    this.sendTrade();
  }

  private tradeLock() {
    const t = this.trade;
    if (!t) return;
    const i = this.tradeSide();
    if (!t.offer[i]) return this.system('Pick a Pokémon to offer first.');
    t.lock[i] = true;
    if (t.lock[0] && t.lock[1] && t.offer[0] && t.offer[1] && !t.countdownEnd) {
      t.countdownEnd = this.hub.opts.now() + this.hub.opts.tradeCountdownMs;
      // Tick once a second so both players see the countdown.
      t.timer = setInterval(() => {
        if (this.trade !== t) { clearInterval(t.timer!); return; }
        this.sendTrade();
        if (this.hub.opts.now() >= t.countdownEnd!) clearInterval(t.timer!);
      }, 1000);
      t.timer.unref?.();
    }
    this.sendTrade();
  }

  private async tradeConfirm() {
    const t = this.trade;
    if (!t) return;
    if (!t.countdownEnd || this.hub.opts.now() < t.countdownEnd) return this.system('Wait for the countdown to finish.');
    t.confirm[this.tradeSide()] = true;
    if (!(t.confirm[0] && t.confirm[1])) return this.sendTrade();
    await this.executeTrade(t);
  }

  private async executeTrade(t: Trade) {
    const [a, b] = [t.a, t.b], pa = a.game!.state.party, pb = b.game!.state.party;
    const ia = pa.findIndex(m => m.uid === t.offer[0]), ib = pb.findIndex(m => m.uid === t.offer[1]);
    const problem = ia < 0 || ib < 0 ? 'missing' : checkMon(pa[ia]) ?? checkMon(pb[ib]);
    if (problem) {
      await this.hub.store.audit({ actor: a.id, action: 'trade.rejected', target: b.id, detail: { problem } });
      return this.endTrade(false, 'The trade was cancelled: one of the Pokémon could not be checked.');
    }
    const ma = pa[ia], mb = pb[ib];
    pa[ia] = mb; pb[ib] = ma;
    try {
      await this.hub.store.saveTrade({ a: a.id, b: b.id, aMon: ma, bMon: mb }, a.game!.toSave(), b.game!.toSave());
    } catch (e) {
      pa[ia] = ma; pb[ib] = mb; // nothing was written, so undo the swap
      this.hub.log(`trade failed: ${e}`);
      return this.endTrade(false, 'The trade failed on the server. Nothing changed.');
    }
    await this.hub.store.audit({ actor: a.id, action: 'trade', target: b.id, detail: { gave: ma.species, got: mb.species } });
    this.hub.log(`trade: ${a.name} ${ma.species} <-> ${b.name} ${mb.species}`);
    this.endTrade(true, 'Trade complete!');
  }

  private endTrade(done: boolean, text: string) {
    const t = this.trade;
    if (!t) return;
    if (t.timer) clearInterval(t.timer);
    for (const s of [t.a, t.b]) {
      s.trade = null;
      s.send({ s: 'tradeEnd', done, text });
      if (done) s.push([{ t: 'me', name: 'me_get' }, { t: 'view', view: s.game!.view() }]);
    }
  }

  // ---------- PvP battles ----------

  private startBattle(other: Session) {
    const players: [Session, Session] = [other, this];
    const battle = new PvpBattle(players.map(s => ({ name: s.name, party: s.game!.state.party, sprite: `tr/player_${s.game!.state.look === 'girl' ? 'girl' : 'boy'}` })) as any, new Rng(this.hub.opts.seed()));
    const p: Pvp = { battle, players, timer: null };
    this.pvp = other.pvp = p;
    this.hub.log(`battle: ${other.name} vs ${this.name}`);
    const out = battle.start();
    this.pvpResult(p, out);
  }

  /** Delivers both players' events (except `skip`, whose events go back as its reply), runs the turn timer and cleans up. */
  private pvpResult(p: Pvp, out: [ServerEvent[], ServerEvent[]], skip?: 0 | 1) {
    p.players.forEach((s, i) => { if (i !== skip) s.push(out[i]); });
    if (p.timer) { clearTimeout(p.timer); p.timer = null; }
    if (p.battle.over) {
      const [a, b] = p.players, w = p.players[p.battle.winner!];
      for (const s of p.players) { s.pvp = null; s.push([{ t: 'view', view: s.game!.view() }]); }
      void this.hub.store.audit({ actor: a.id, action: 'pvp', target: b.id, detail: { winner: w.id } });
      return;
    }
    if (p.battle.waiting().length) {
      p.timer = setTimeout(() => { if (p.players[0].pvp === p) this.pvpResult(p, p.battle.timeout()); }, this.hub.opts.turnTimerMs);
      p.timer.unref?.();
    }
  }
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function inviteCode() {
  let s = '';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) s += CODE_CHARS[b % CODE_CHARS.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}
