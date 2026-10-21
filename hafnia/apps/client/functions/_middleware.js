// Keeps the game (and its assets) behind an invite code. The homepage, credits and privacy pages stay open.
import { COOKIE, readCookie, validToken } from '../server/invite.js';

const GATED = [/^\/play(\.html)?\/?$/, /^\/assets\//, /^\/game-assets\//];

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (GATED.some(re => re.test(url.pathname)) && !(await validToken(env.INVITE_SECRET, readCookie(request, COOKIE)))) {
    if (/^\/play/.test(url.pathname)) return Response.redirect(`${url.origin}/?invite`, 302);
    return new Response('Invite required', { status: 403 });
  }
  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return out;
}
