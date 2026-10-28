# blyn.dk

Mark's portal: a front page with six boxes, one per game or tool, each in its own folder.

| Path | What it is |
|---|---|
| `public/` | The portal page, its images and `robots.txt` |
| `middleware.js` | Vercel Routing Middleware: the invite gate for `/copper-current/` and its `/copper-current/api/invite` |
| `vercel.json` | Vercel build (from the whole repo, Root Directory `blyn`), clean URLs, noindex headers |
| `build.mjs` | Copies `public/` to `dist/` and each project's build into `dist/<project>/` |

Copper & Current lives at `/copper-current/` (built from `hafnia/`). Its invite codes come from the
Vercel env vars `INVITE_CODES` and `INVITE_SECRET` (see `hafnia/README.md`).

To add a project: give it a folder in `projects` in `build.mjs` (or copy static files into
`public/<name>/`), and turn one of the placeholder boxes in `public/index.html` into a link.

Hosted on Vercel (project `blyn`, Git integration, Root Directory `blyn`): every push to `main`
deploys blyn.dk. The site that used to be on blyn.dk (Vercel project `eventspace`) lives on
event.blyn.dk.
