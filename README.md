# Rabisco

A very light notes app. A blank page where you write, paste screenshots, resize them, format the basics and share by link. Nothing else.

Vanilla HTML, CSS and JavaScript served by PocketBase. No frameworks, no build step, no dependencies.

## Status

Stage 1 of 7 is done on the client side: writing, pasting or dropping images, resizing, moving, undo and redo, spreadsheet cells as a table, lightbox, copy and download of an image, theme and width settings, English and Portuguese. Backend schema, hooks and infrastructure exist but the app does not talk to them yet.

## Roadmap

1. Local editor: done.
2. Formatting: floating bar, line start shortcuts, `---` for a rule, date shortcut, links.
3. Backend: sign in by email code, save and load, image upload, local draft with a save indicator, shrink guard before saving, conflict detection between tabs and devices.
4. Note list: create, search, pin, delete with undo.
5. Sharing: view or edit link, optional expiry, revoke and rotate, Open Graph preview, clean reading mode, duplicate into your account.
6. Extras: print stylesheet, export to text and markdown, installable app, share target on Android.
7. After the MVP: crop and annotate a pasted screenshot, version history, find in note, markdown paste, captions and image alignment.

## Run locally

```
node tools/serve.mjs
```

Open http://localhost:8090. The dev server sends the same security headers PocketBase will send in production, so policy violations show up early in the browser console.

## Backend locally

Download the PocketBase binary for your platform from https://github.com/pocketbase/pocketbase/releases (version 0.40.4, check the sha256 against the release checksums) into the project root, then:

```
pocketbase serve --http=127.0.0.1:8091 --dir=./pb_data --migrationsDir=./pb_migrations --hooksDir=./pb_hooks --publicDir=./pb_public
pocketbase superuser upsert you@example.com "a-strong-password" --dir=./pb_data
```

Migrations in `pb_migrations/` create the collections, rules and settings on first start. Hooks in `pb_hooks/` add security headers, create users on their first sign in code and manage share tokens. The dashboard is at http://127.0.0.1:8091/_/ and the app at http://127.0.0.1:8091/.

## Tests and weight

```
node --test "tests/**/*.test.mjs"
node tools/size.mjs
```

The size report prints raw and gzip bytes per file and fails when a budget is exceeded.

## Layout

- `pb_public/`: the app. `index.html`, `style.css` and ES modules under `js/`.
- `tests/`: unit tests for pure functions, run with Node's built in test runner.
- `tools/`: dev server and size report.
- `docs/design/`: design system, tokens, icons and screens.
- `rabisco-prompt.md`: product and technical spec.
