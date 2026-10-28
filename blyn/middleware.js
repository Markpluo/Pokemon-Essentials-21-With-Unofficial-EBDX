// Vercel Routing Middleware: keeps Copper & Current (and its assets) behind an invite code and
// answers the game homepage's POST ./api/invite. The portal and the game's homepage, credits and
// privacy pages stay open. Codes come from the env vars INVITE_CODES and INVITE_SECRET.
import { COOKIE, readCookie, validToken } from '../hafnia/apps/client/server/invite.js';
import { onRequestPost as invite } from '../hafnia/apps/client/functions/api/invite.js';

export const config = { matcher: ['/copper-current/:path*'] };

const PLAY = /^\/copper-current\/play(\.html)?\/?$/;
const GATED = [PLAY, /^\/copper-current\/assets\//, /^\/copper-current\/game-assets\//];

export default async function middleware(request) {
  const url = new URL(request.url);
  const env = { INVITE_CODES: process.env.INVITE_CODES, INVITE_SECRET: process.env.INVITE_SECRET };
  if (url.pathname === '/copper-current/api/invite') {
    return request.method === 'POST' ? invite({ request, env }) : new Response('Method not allowed', { status: 405 });
  }
  if (GATED.some(re => re.test(url.pathname)) && !(await validToken(env.INVITE_SECRET, readCookie(request, COOKIE)))) {
    if (PLAY.test(url.pathname)) return Response.redirect(`${url.origin}/copper-current/?invite`, 302);
    return new Response('Invite required', { status: 403 });
  }
}
