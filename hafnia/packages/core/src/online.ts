// The online envelope around the game protocol. One WebSocket per player carries:
//  - game intents and their events, exactly as in solo play ({ id, intent } -> { id, events }),
//  - pushed game events the player didn't ask for (PvP turns resolved by the opponent),
//  - social messages: who is on the map, chat, trade and battle invites.
// The server (apps/server) is authoritative for all of it. JSON over the socket.
import type { Dir, Intent, MonView, ServerEvent } from './protocol';

export interface PlayerView { id: string; name: string; sprite: string; x: number; y: number; dir: Dir }
export type ChatChannel = 'map' | 'global';
export type InviteKind = 'trade' | 'battle';

/** Shared trade state, sent to both players after every change. "me" is always the receiver. */
export interface TradeView {
  partner: { id: string; name: string };
  myParty: MonView[];
  mine: MonView | null; theirs: MonView | null;
  myLock: boolean; theirLock: boolean;
  myConfirm: boolean; theirConfirm: boolean;
  /** Seconds left of the final countdown, once both have locked their offers. */
  countdown?: number;
}

export type ClientMessage =
  | { s: 'auth'; token: string; invite?: string; trainerName?: string; birthYear?: number }
  | { id: number; intent: Intent }
  | { s: 'chat'; channel: ChatChannel; text: string }
  | { s: 'invite'; kind: InviteKind; to: string }
  | { s: 'respond'; kind: InviteKind; from: string; accept: boolean }
  | { s: 'tradeOffer'; uid: string | null }
  | { s: 'tradeLock' }
  | { s: 'tradeConfirm' }
  | { s: 'tradeCancel' }
  | { s: 'forfeit' }
  | { s: 'block'; id: string }
  | { s: 'report'; id: string; reason: string };

export type AuthError = 'bad_token' | 'signup' | 'invite_required' | 'invite_invalid' | 'name_invalid' | 'name_taken' | 'too_young' | 'banned' | 'server_full';

export type ServerMessage =
  | { s: 'hello'; me: { id: string; name: string; role: string }; rules: string }
  /** `needsInvite` is set while signing up a new account that has to give an invite code. */
  | { s: 'authError'; reason: AuthError; message: string; needsInvite?: boolean }
  | { id: number; events: ServerEvent[] }
  | { push: ServerEvent[] }
  | { s: 'players'; map: string; players: PlayerView[] }
  | { s: 'join'; player: PlayerView }
  | { s: 'move'; id: string; x: number; y: number; dir: Dir }
  | { s: 'leave'; id: string }
  | { s: 'chat'; channel: ChatChannel; from: string; name: string; text: string; at: number }
  | { s: 'system'; text: string }
  | { s: 'invite'; kind: InviteKind; from: string; name: string }
  | { s: 'trade'; trade: TradeView }
  | { s: 'tradeEnd'; done: boolean; text: string }
  | { s: 'kicked'; reason: string };
