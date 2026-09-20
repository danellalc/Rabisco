# Rabisco

A very light notes app. A blank page where you write, paste screenshots, resize them, format the basics and share by link. Nothing else.

Vanilla HTML, CSS and JavaScript served by PocketBase. No frameworks and nothing loaded by the browser besides our own files. The only development dependency is esbuild, used to bundle and minify for deployment.

## Status

Stages 1 to 3 of 7 are done: editor, formatting and backend (sign in by email code, save and load, image upload, local draft, conflict detection).

## Roadmap

1. Local editor: done.
2. Formatting: done.
3. Backend: done.
4. Note list: create, search, pin, delete with undo.
5. Sharing: view or edit link, optional expiry, revoke and rotate, Open Graph preview, clean reading mode, duplicate into your account.
6. Extras: print stylesheet, export to text and markdown, installable app, share target on Android.
7. After the MVP: crop and annotate a pasted screenshot, version history, find in note, markdown paste, captions and image alignment.

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

`npm run build` bundles and minifies `pb_public/` into `build/`, which is what production serves. `npm run size` prints raw and gzip bytes per built file and fails when a budget is exceeded. To try the built files locally: `SERVE_DIR=build npm run serve`.

## Deploy

`compose.yaml` runs PocketBase and Caddy. Caddy terminates TLS, compresses and sets cache headers; PocketBase serves `build/` and the API. Copy `.env.example` to `.env`, set the domain and a 32 character encryption key, run `npm run build`, then:

```
docker compose up -d --build
docker compose exec pb /pb/pocketbase superuser upsert you@example.com "a-strong-password"
```

Then set SMTP in the dashboard, Settings, Mail settings. The container runs as an unprivileged user, so `pb_data` must be owned by uid 1001 on the host.

## Layout

- `pb_public/`: the app source. `index.html`, `style.css` and ES modules under `js/`.
- `pb_hooks/`: server hooks. Security headers, user creation on the first sign in code, ownership, HTML sanitizing, share tokens, conflict detection.
- `pb_migrations/`: collections, rules and settings, applied on first start.
- `tests/`: unit tests for pure functions, run with Node's built in test runner.
- `tools/`: dev server, mail sink, build and size report.
- `docs/design/`: design system, tokens, icons and screens.
- `rabisco-prompt.md`: product and technical spec.
