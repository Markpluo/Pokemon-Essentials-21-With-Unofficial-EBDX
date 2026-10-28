# blyn.dk

Mark's portal: a front page with six boxes, one per game or tool, each in its own folder.

| Path | What it is |
|---|---|
| `public/` | The portal page, its images, `robots.txt` and `_headers` (everything noindex for now) |
| `functions/` | Cloudflare Pages Functions: the invite gate for `/copper-current/` and its `/copper-current/api/invite` |
| `build.mjs` | Copies `public/` to `dist/` and each project's build into `dist/<project>/` |

Copper & Current lives at `/copper-current/` (built from `hafnia/`). Its invite codes come from the
Pages env vars `INVITE_CODES` and `INVITE_SECRET` (see `hafnia/README.md`).

To add a project: give it a folder in `projects` in `build.mjs` (or copy static files into
`public/<name>/`), and turn one of the placeholder boxes in `public/index.html` into a link.

`.github/workflows/deploy-pages.yml` builds everything and deploys `dist/` to the Pages project
`blyn` on every push to `main`.
