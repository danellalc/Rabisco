# Trecos

A very light workspace that is a file drive, a text editor and an infinite board at the same time. Folders hold files, documents and subfolders, and every folder has a canvas where you place those things next to text blocks, screenshots, sticky notes and links, move everything around with magnetic snapping, zoom out to see it all and share a folder, a selection, a document or a single file by link. Version 1 was called Rabisco, a single page of text; version 2 was a board per note; both migrate automatically.

Spec: `trecos-prompt.md`. Design: `docs/design/BRIEFING-TRECOS.md` and the handoff in `docs/design/trecos/`.

Vanilla HTML, CSS and JavaScript served by PocketBase. No frameworks and nothing loaded by the browser besides our own files. The only development dependency is esbuild, used to bundle and minify for deployment.

## Status

Version 3 is built: a sidebar made of a rail (My Drive, Recent, Search, Trash, account) and a panel with the folder head, one list of folders, documents and files, a selection bar and the board summary; one click opens, checkboxes select, right click menus, F2, Enter, Delete, drag and drop between the explorer, the board and the desktop; image resize with eight handles, quotes, code and a slash menu in every text, previews by file type, sharing of folders, selections, frames, documents and files, Ctrl+K with commands, recents kept in the browser, a trash that keeps deleted things for 30 days, pointer tools (select, hand, text, sticky note, frame), a native video player on cards, export of any text or document to Markdown, HTML, Word and PDF, addressable folders and documents (`/f/{id}`, `/d/{id}`), a welcome board on the first visit, a keyboard help (?) and pictures that are files of the folder. Weight of the built app: 73.5 KB gzip.

## Roadmap

1. Board: done. Pan, zoom, text blocks as items, image and link items, drag with snapping to the grid and to neighbours, lasso, tidy, undo and redo of everything, autosave of the whole board.
2. Files and quota: done. Any file as a card with an icon, upload progress, blocked executable types, 500 MB per file, 2 GB per user (100 GB on the pro plan, both adjustable per user in the dashboard), signed short lived download links, rename, video and audio playing in the card. Storage goes wherever PocketBase points (local disk or an S3 bucket such as Cloudflare R2, set in the dashboard).
3. Sharing: done. A link for a folder (view or edit), a selection (view), a document (view or edit) or a single file (download page), several active links per folder, expiry, revoke, duplicate with files.
4. Drive: done. Every folder is a board; files and documents live in exactly one folder and the canvas shows the ones you placed; move by dragging or through the folder picker; delete to the trash with undo, restore or delete for good, empty the trash; sort; search in the folder and everywhere; recents. Frames are thin rectangles that group a region of the board: they carry their contents when dragged and can be shared as a live, view only piece of the board.
5. Direct upload to the bucket for big files and paid plans.
6. Drawing: a vector sketch item.

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

For files, point PocketBase at an S3 compatible bucket in Settings, Files storage (Cloudflare R2 works with the account endpoint, the bucket name, region `auto` and an access key with object read and write). Keep bucket versioning on and back up only the database: `pb_data` without `storage`. Quotas live on each user record (`plan` and `quota_bytes`).

## Layout

- `pb_public/`: the app source. `index.html`, `style.css`, ES modules under `js/` (`drive.js` and `resources.js` are the explorer, `panel.js` the Recent and Trash views, `recent.js` the recents kept in the browser, `board.js` the canvas, `boards.js` its persistence, `document.js` the document editor, `camera.js`, `snap.js` and `items.js` the pure math), the service worker `sw.js`, `manifest.json` and the icon (`icon.svg` is the master, the PNG sizes are exported from it).
- `pb_hooks/`: server hooks. Security headers, user creation on the first sign in code, ownership, folder hierarchy, item validation and HTML sanitizing, share tokens, conflict detection with compare and set, folder listing and search index routes, the trash (`/api/trash`) and its daily purge.
- `pb_migrations/`: collections, rules and settings, applied on first start.
- `tests/`: unit tests for pure functions, run with Node's built in test runner.
- `tools/`: dev server, mail sink, build and size report.
- `docs/design/`: design system, tokens, icons and screens.
- `trecos-prompt.md`: product and technical spec. `rabisco-prompt.md`: the version 1 spec, kept for history.
