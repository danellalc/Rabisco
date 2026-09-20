# Rabisco

A very light notes app. A blank page where you write, paste screenshots, resize them, format the basics and share by link. Nothing else.

Version 2, named Trecos, turns the page into an infinite board that also holds files: see `trecos-prompt.md` for the spec and `docs/design/BRIEFING-TRECOS.md` for the design brief. The code below is version 1, complete and deployable.

Vanilla HTML, CSS and JavaScript served by PocketBase. No frameworks and nothing loaded by the browser besides our own files. The only development dependency is esbuild, used to bundle and minify for deployment.

## Status

Stages 1 to 6 of 7 are done: editor, formatting, backend (sign in by email code, save and load, image upload, local draft, conflict detection), note list, sharing by link, export, print and the installable app with the Android share target.

## Roadmap

1. Local editor: done.
2. Formatting: done.
3. Backend: done.
4. Note list: done.
5. Sharing: done. View or edit link, optional expiry, revoke and rotate, clean reading mode, duplicate into your account.
6. Extras: done. Print stylesheet, export to text and markdown, installable app that opens from the cache, share target on Android.
7. Drawing: a vector sketch board loaded on demand (pen with pressure, highlighter, line, arrow, rectangle, ellipse, text, select and move, undo, zoom) that becomes an image in the note and can be reopened for editing; the same board annotates and crops a pasted screenshot. Then version history, find in note, markdown paste, captions and image alignment.

## Run locally

You need Node 22 or newer and the PocketBase 0.40.4 binary for your platform from https://github.com/pocketbase/pocketbase/releases in the project root (check its sha256 against the release checksums).

```
npm install
pocketbase serve --http=127.0.0.1:8091 --dir=./pb_data --migrationsDir=./pb_migrations --hooksDir=./pb_hooks --publicDir=./pb_public
pocketbase superuser upsert you@example.com "a-strong-password" --dir=./pb_data
npm run serve
```

Open http://localhost:8090. The dev server serves the readable source in `pb_public/`, sends the production security headers and proxies `/api` and `/_` to PocketBase, so policy violations show up early in the browser console. The dashboard is at http://localhost:8090/_/.

Sign in codes go out by email. For local work, run `npm run mail` and point PocketBase at it in Settings, Mail settings: host 127.0.0.1, port 2525, no authentication, no TLS. Every code and magic link is printed in the terminal.

## Tests, build and weight

```
npm test
npm run build
npm run size
```

`npm run build` bundles and minifies `pb_public/` into `build/`, which is what production serves, and stamps the service worker with a content hash so every deploy gets a fresh cache. `npm run size` prints raw and gzip bytes per built file and fails when a budget is exceeded.

The service worker is registered in development too, but it only serves from its cache in a build. To try offline opening, installing and the share target, serve the build on its own port: `SERVE_DIR=build PORT=8092 npm run serve`.

## Deploy

`compose.yaml` runs PocketBase and Caddy. Caddy terminates TLS, compresses and sets cache headers; PocketBase serves `build/` and the API. Copy `.env.example` to `.env`, set the domain and a 32 character encryption key, run `npm run build`, then:

```
docker compose up -d --build
docker compose exec pb /pb/pocketbase superuser upsert you@example.com "a-strong-password"
```

Then set SMTP in the dashboard, Settings, Mail settings. The container runs as an unprivileged user, so `pb_data` must be owned by uid 1001 on the host.

## Layout

- `pb_public/`: the app source. `index.html`, `style.css`, ES modules under `js/`, the service worker `sw.js`, `manifest.json` and the icon (`icon.svg` is the master, the PNG sizes are exported from it).
- `pb_hooks/`: server hooks. Security headers, user creation on the first sign in code, ownership, HTML sanitizing, share tokens, conflict detection.
- `pb_migrations/`: collections, rules and settings, applied on first start.
- `tests/`: unit tests for pure functions, run with Node's built in test runner.
- `tools/`: dev server, mail sink, build and size report.
- `docs/design/`: design system, tokens, icons and screens.
- `rabisco-prompt.md`: product and technical spec of version 1. `trecos-prompt.md`: version 2.
