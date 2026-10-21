// Online play: login, the WebSocket connection to the game server, and the social panel under
// the game screen (players on this map, chat, trade and battle invites, the trade window).
// The game itself runs on the server; this connection implements the same GameConnection as solo.
// Settings (build-time): VITE_SERVER_URL (wss://.../ws), VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
// and VITE_DEV_AUTH=1 for a local server started with DEV_AUTH=1.
import type {
  AuthError, ChatChannel, ClientMessage, GameConnection, Intent, InviteKind, PlayerView, ServerEvent, ServerMessage, TradeView
} from '@hafnia/core';

const env = import.meta.env;
const SERVER = (env.VITE_SERVER_URL as string | undefined) ?? '';
const DEV_AUTH = env.VITE_DEV_AUTH === '1';

export const onlineAvailable = () => !!SERVER && (DEV_AUTH || !!env.VITE_SUPABASE_URL);

export interface Remote extends PlayerView { ox: number; oy: number; moving: number }

/** Shared state main.ts reads: who else is on the map, and where to send pushed game events. */
export const online = {
  active: false,
  me: null as null | { id: string; name: string; role: string },
  map: '',
  players: new Map<string, Remote>(),
  onPush: (_evs: ServerEvent[]) => {},
  /** Called every frame: slides other players towards their tiles. */
  tick() {
    for (const p of this.players.values()) {
      if (!p.ox && !p.oy) { p.moving = 0; continue; }
      const s = 32 / 12;
      p.ox = Math.sign(p.ox) * Math.max(0, Math.abs(p.ox) - s);
      p.oy = Math.sign(p.oy) * Math.max(0, Math.abs(p.oy) - s);
      p.moving++;
    }
  },
  othersOn(map: string) { return map === this.map ? [...this.players.values()] : []; }
};

// ---------- login ----------

let supabase: any = null;
async function supa() {
  if (!supabase) {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(env.VITE_SUPABASE_URL as string, env.VITE_SUPABASE_ANON_KEY as string);
  }
  return supabase;
}

/** A login token for the game server, or null when the player still has to sign in. */
async function token(): Promise<string | null> {
  if (DEV_AUTH) {
    const email = localStorage.getItem('cc-dev-email');
    return email ? `dev:${email}` : null;
  }
  const { data } = await (await supa()).auth.getSession();
  return data.session?.access_token ?? null;
}

/** Signs in (or lets the player cancel), connects and logs in to the game server. */
export async function goOnline(): Promise<(GameConnection & { mode: string }) | null> {
  const ui = dialog();
  try {
    for (;;) {
      let t = await token();
      if (!t) {
        const email = await ui.form('Play online', DEV_AUTH
          ? 'Development server: any email works.'
          : 'Online play is invite-only. Enter your email and we\'ll send you a sign-in link.', [{ name: 'email', label: 'Email', type: 'email' }]);
        if (!email) return null;
        if (DEV_AUTH) { localStorage.setItem('cc-dev-email', email.email); continue; }
        const { error } = await (await supa()).auth.signInWithOtp({ email: email.email, options: { emailRedirectTo: location.href.split('#')[0] } });
        if (error) { ui.note(`Couldn't send the link: ${error.message}`); continue; }
        ui.note('Check your email and open the sign-in link. It brings you back here; then choose Play online again.');
        await ui.wait('OK');
        return null;
      }
      ui.note('Connecting to the server...');
      const r = await connect(t, ui);
      if (r === 'retry') continue;
      if (r === 'signout') { await signOut(); continue; }
      return r;
    }
  } finally { ui.close(); }
}

async function signOut() {
  if (DEV_AUTH) localStorage.removeItem('cc-dev-email');
  else await (await supa()).auth.signOut();
}

// ---------- the connection ----------

function connect(tok: string, ui: ReturnType<typeof dialog>): Promise<(GameConnection & { mode: string }) | 'retry' | 'signout' | null> {
  return new Promise(resolve => {
    let ws: WebSocket;
    try { ws = new WebSocket(SERVER); } catch { ui.note('The server address is wrong.'); resolve(null); return; }
    const out = (m: ClientMessage) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };
    const waiting = new Map<number, (evs: ServerEvent[]) => void>();
    let next = 1, ready = false;
    ws.onopen = () => out({ s: 'auth', token: tok });
    ws.onerror = () => { if (!ready) { ui.note('Couldn\'t reach the game server. Try again later.'); ui.wait('OK').then(() => resolve(null)); } };
    ws.onclose = () => {
      for (const r of waiting.values()) r([{ t: 'error', message: 'Lost the connection to the server.' }]);
      waiting.clear();
      if (ready) lost('Lost the connection to the server. Reload the page to reconnect.');
    };
    ws.onmessage = async e => {
      const m = JSON.parse(String(e.data)) as ServerMessage;
      if ('events' in m) {
        if (m.events.some(e => e.t === 'battleEnd')) panel.battle(false);
        waiting.get(m.id)?.(m.events); waiting.delete(m.id);
        return;
      }
      if ('push' in m) {
        // Battles against people can't be run from, so the panel offers a forfeit button meanwhile.
        if (m.push.some(e => e.t === 'battleStart')) panel.battle(true);
        if (m.push.some(e => e.t === 'battleEnd')) panel.battle(false);
        online.onPush(m.push);
        return;
      }
      switch (m.s) {
        case 'authError': {
          const r = await signUp(m.reason, m.message, !!m.needsInvite, ui);
          if (r === 'cancel') { ws.close(); resolve(null); }
          else if (r === 'signout') { ws.close(); resolve('signout'); }
          else out({ s: 'auth', token: tok, ...r });
          return;
        }
        case 'hello':
          ready = true;
          online.active = true;
          online.me = m.me;
          panel.open(out, m.rules);
          resolve({
            mode: 'online',
            send(intent: Intent) {
              const id = next++;
              return new Promise(res => {
                if (ws.readyState !== WebSocket.OPEN) { res([{ t: 'error', message: 'Not connected to the server.' }]); return; }
                waiting.set(id, res); out({ id, intent });
              });
            }
          });
          return;
        case 'kicked': ready = false; lost(m.reason); ws.close(); return;
        default: panel.receive(m);
      }
    };
  });
}

function lost(text: string) {
  online.active = false;
  panel.system(text);
  const d = dialog();
  d.note(text);
  d.wait('Reload').then(() => location.reload());
}

/** First login on this server: invite code (unless the account is an admin), trainer name and birth year. */
async function signUp(reason: AuthError, message: string, needsInvite: boolean, ui: ReturnType<typeof dialog>) {
  if (reason === 'bad_token' || reason === 'banned' || reason === 'server_full') {
    ui.note(message);
    const c = await ui.choose(reason === 'bad_token' ? ['Sign in again', 'Cancel'] : ['OK']);
    return c === 0 && reason === 'bad_token' ? 'signout' as const : 'cancel' as const;
  }
  const first = reason === 'signup';
  const intro = first
    ? `${needsInvite ? 'Enter the invite code you were given, pick' : 'Pick'} your trainer name and tell us the year you were born (online play is for ages 13 and up).`
    : message;
  const r = await ui.form(first ? 'Welcome, new trainer!' : 'Almost there', intro, [
    ...(needsInvite ? [{ name: 'invite', label: 'Invite code', type: 'text' }] : []),
    { name: 'trainerName', label: 'Trainer name (3-12 letters)', type: 'text' },
    { name: 'birthYear', label: 'Year of birth', type: 'number' }
  ]);
  if (!r) return 'cancel' as const;
  return { ...(r.invite ? { invite: r.invite } : {}), trainerName: r.trainerName, birthYear: Number(r.birthYear) };
}

// ---------- a small modal dialog for login ----------

function dialog() {
  const root = document.createElement('div');
  root.className = 'ol-modal';
  root.innerHTML = '<div class="ol-box" role="dialog" aria-modal="true"><p class="ol-text"></p><div class="ol-body"></div></div>';
  document.body.append(root);
  const text = root.querySelector('.ol-text') as HTMLElement, body = root.querySelector('.ol-body') as HTMLElement;
  const buttons = (labels: string[]) => new Promise<number>(res => {
    const row = document.createElement('div'); row.className = 'ol-row';
    labels.forEach((l, i) => { const b = button(l, () => res(i)); if (i) b.classList.add('ol-quiet'); row.append(b); });
    body.replaceChildren(row);
    (row.firstChild as HTMLElement).focus();
  });
  return {
    note(t: string) { text.textContent = t; body.replaceChildren(); },
    wait(label: string) { return buttons([label]); },
    choose(labels: string[]) { return buttons(labels); },
    form(title: string, intro: string, fields: { name: string; label: string; type: string }[]) {
      text.innerHTML = '';
      const h = document.createElement('strong'); h.textContent = title;
      text.append(h, document.createElement('br'), intro);
      return new Promise<Record<string, string> | null>(res => {
        const f = document.createElement('form');
        for (const fd of fields) {
          const l = document.createElement('label'); l.textContent = fd.label;
          const inp = document.createElement('input'); inp.name = fd.name; inp.type = fd.type; inp.required = true;
          if (fd.type === 'email') inp.autocomplete = 'email';
          l.append(inp); f.append(l);
        }
        const row = document.createElement('div'); row.className = 'ol-row';
        const ok = document.createElement('button'); ok.type = 'submit'; ok.textContent = 'Continue';
        row.append(ok, button('Cancel', () => res(null), 'ol-quiet'));
        f.append(row);
        f.onsubmit = e => { e.preventDefault(); res(Object.fromEntries(new FormData(f)) as Record<string, string>); };
        body.replaceChildren(f);
        (f.querySelector('input') as HTMLInputElement).focus();
      });
    },
    close() { root.remove(); }
  };
}

function button(label: string, onClick: () => void, cls = '') {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
  if (cls) b.className = cls;
  b.onclick = onClick;
  return b;
}

// ---------- the social panel ----------

const panel = (() => {
  let send: (m: ClientMessage) => void = () => {};
  let root: HTMLElement, log: HTMLElement, list: HTMLElement, toasts: HTMLElement, tradeBox: HTMLElement;
  let channel: ChatChannel = 'map';

  function open(out: (m: ClientMessage) => void, rules: string) {
    send = out;
    root = document.createElement('section');
    root.className = 'ol-panel';
    root.setAttribute('aria-label', 'Online');
    root.innerHTML = `
      <div class="ol-toasts" aria-live="polite"></div>
      <div class="ol-trade" hidden></div>
      <div class="ol-cols">
        <div class="ol-chat">
          <div class="ol-log" role="log" aria-live="polite"></div>
          <form class="ol-say">
            <select aria-label="Chat channel"><option value="map">Map</option><option value="global">Everyone</option></select>
            <input maxlength="200" placeholder="Say something (Enter to send)" aria-label="Chat message">
          </form>
        </div>
        <div class="ol-people"><h2>On this map</h2><ul></ul></div>
      </div>`;
    document.querySelector('.screen-frame')!.after(root);
    log = root.querySelector('.ol-log')!; list = root.querySelector('.ol-people ul')!;
    toasts = root.querySelector('.ol-toasts')!; tradeBox = root.querySelector('.ol-trade')!;
    const form = root.querySelector('.ol-say') as HTMLFormElement, input = form.querySelector('input')!;
    (form.querySelector('select') as HTMLSelectElement).onchange = e => { channel = (e.target as HTMLSelectElement).value as ChatChannel; };
    form.onsubmit = e => {
      e.preventDefault();
      if (input.value.trim()) send({ s: 'chat', channel, text: input.value });
      input.value = '';
    };
    const sub = document.querySelector('h1 span');
    if (sub) sub.textContent = `Online · ${online.me!.name}`;
    const keys = document.querySelector('.keys');
    if (keys) keys.lastChild!.textContent = ' · Progress is saved on the server.';
    system(rules);
    renderPlayers();
  }

  function line(who: string | null, text: string, cls = '') {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    if (who) { const b = document.createElement('b'); b.textContent = `${who}: `; p.append(b); }
    p.append(text);
    log.append(p);
    while (log.childElementCount > 100) log.firstChild!.remove();
    log.scrollTop = log.scrollHeight;
  }
  function system(text: string) { if (log) line(null, text, 'ol-sys'); }

  function renderPlayers() {
    list.replaceChildren();
    const others = [...online.players.values()];
    if (!others.length) { const li = document.createElement('li'); li.className = 'ol-empty'; li.textContent = 'Nobody else here right now.'; list.append(li); }
    for (const p of others) {
      const li = document.createElement('li');
      const name = document.createElement('span'); name.textContent = p.name;
      const more = document.createElement('details');
      more.innerHTML = '<summary aria-label="More">⋯</summary>';
      more.append(
        button('Block', () => { if (confirm(`Block ${p.name}? You won't see their chat or invites.`)) send({ s: 'block', id: p.id }); }),
        button('Report', () => { const r = prompt(`What did ${p.name} do?`); if (r) send({ s: 'report', id: p.id, reason: r }); })
      );
      li.append(name, button('Trade', () => send({ s: 'invite', kind: 'trade', to: p.id })), button('Battle', () => send({ s: 'invite', kind: 'battle', to: p.id })), more);
      list.append(li);
    }
  }

  function invite(kind: InviteKind, from: string, name: string) {
    const t = document.createElement('div'); t.className = 'ol-toast';
    t.append(`${name} wants to ${kind === 'trade' ? 'trade' : 'battle'}!`);
    const done = (accept: boolean) => { send({ s: 'respond', kind, from, accept }); t.remove(); };
    t.append(button('Accept', () => done(true)), button('No thanks', () => done(false), 'ol-quiet'));
    toasts.append(t);
    setTimeout(() => t.remove(), 60_000);
  }

  function battle(on: boolean) {
    root.querySelector('.ol-forfeit')?.remove();
    if (!on) return;
    const b = button('Forfeit battle', () => { if (confirm('Give up this battle?')) send({ s: 'forfeit' }); }, 'ol-forfeit ol-quiet');
    toasts.before(b);
  }

  function trade(v: TradeView) {
    tradeBox.hidden = false;
    const mon = (m: TradeView['mine']) => (m ? `${m.name} Lv. ${m.level}` : 'nothing yet');
    const both = v.myLock && v.theirLock;
    tradeBox.innerHTML = `<h2>Trading with <span></span></h2>
      <div class="ol-offers"><div><h3>You offer</h3><p class="mine"></p></div><div><h3>They offer</h3><p class="theirs"></p></div></div>
      <p class="ol-state"></p><div class="ol-party"></div><div class="ol-row ol-acts"></div>`;
    (tradeBox.querySelector('h2 span') as HTMLElement).textContent = v.partner.name;
    (tradeBox.querySelector('.mine') as HTMLElement).textContent = mon(v.mine) + (v.myLock ? ' (locked)' : '');
    (tradeBox.querySelector('.theirs') as HTMLElement).textContent = mon(v.theirs) + (v.theirLock ? ' (locked)' : '');
    const state = tradeBox.querySelector('.ol-state') as HTMLElement;
    state.textContent = !both ? 'Pick a Pokémon, then lock your offer. Locked offers can\'t change.'
      : v.countdown ? `Check the offers carefully. Confirm unlocks in ${v.countdown}...`
      : v.theirConfirm ? `${v.partner.name} confirmed. Confirm to trade.` : v.myConfirm ? `Waiting for ${v.partner.name} to confirm...` : 'Confirm to trade.';
    const party = tradeBox.querySelector('.ol-party') as HTMLElement;
    if (!v.myLock && !v.theirLock) for (const m of v.myParty) {
      const b = button(`${m.name} Lv. ${m.level}`, () => send({ s: 'tradeOffer', uid: m.uid }));
      b.setAttribute('aria-pressed', String(v.mine?.uid === m.uid));
      party.append(b);
    }
    const acts = tradeBox.querySelector('.ol-acts') as HTMLElement;
    if (!v.myLock) acts.append(button('Lock offer', () => send({ s: 'tradeLock' })));
    if (both) { const c = button('Confirm trade', () => send({ s: 'tradeConfirm' })); c.disabled = !!v.countdown || v.myConfirm; acts.append(c); }
    acts.append(button('Cancel', () => send({ s: 'tradeCancel' }), 'ol-quiet'));
  }

  function receive(m: ServerMessage) {
    if (!('s' in m)) return;
    switch (m.s) {
      case 'players':
        online.map = m.map;
        online.players = new Map(m.players.map(p => [p.id, { ...p, ox: 0, oy: 0, moving: 0 }]));
        renderPlayers(); break;
      case 'join': online.players.set(m.player.id, { ...m.player, ox: 0, oy: 0, moving: 0 }); renderPlayers(); break;
      case 'leave': online.players.delete(m.id); renderPlayers(); break;
      case 'move': {
        const p = online.players.get(m.id);
        if (!p) break;
        const dx = p.x - m.x, dy = p.y - m.y;
        // One tile: slide; further (a warp inside the map): jump.
        if (Math.abs(dx) + Math.abs(dy) === 1) { p.ox = dx * 32; p.oy = dy * 32; }
        Object.assign(p, { x: m.x, y: m.y, dir: m.dir });
        break;
      }
      case 'chat': line(m.channel === 'global' ? `[All] ${m.name}` : m.name, m.text, m.from === online.me?.id ? 'ol-me' : ''); break;
      case 'system': system(m.text); break;
      case 'invite': invite(m.kind, m.from, m.name); break;
      case 'trade': trade(m.trade); break;
      case 'tradeEnd': tradeBox.hidden = true; tradeBox.replaceChildren(); system(m.text); break;
    }
  }

  return { open, receive, system, battle };
})();
