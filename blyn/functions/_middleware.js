// Keeps Copper & Current (and its assets) behind an invite code. The portal and the game's
// homepage, credits and privacy pages stay open. Every response is marked noindex.
import { COOKIE, readCookie, validToken } from '../../hafnia/apps/client/server/invite.js';

const GAME = '/copper-current';
const GATED = [/^\/copper-current\/play(\.html)?\/?$/, /^\/copper-current\/assets\//, /^\/copper-current\/game-assets\//];

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (GATED.some(re => re.test(url.pathname)) && !(await validToken(env.INVITE_SECRET, readCookie(request, COOKIE)))) {
    if (GATED[0].test(url.pathname)) return Response.redirect(`${url.origin}${GAME}/?invite`, 302);
    return new Response('Invite required', { status: 403 });
  }
  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return out;
}
