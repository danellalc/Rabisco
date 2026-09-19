# Rabisco

A very light notes app. A blank page where you write, paste screenshots, resize them, format the basics and share by link. Nothing else.

Vanilla HTML, CSS and JavaScript served by PocketBase. No frameworks, no build step, no dependencies.

## Status

Stage 1 of 6: local editor. Writing, pasting or dropping images, resizing them. No backend yet.

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
