# First-load performance

How the client was measured and sped up for older devices: issue #223 (PR #225), then issue #226 (PR #239: text in a
worker and lazy-loaded screens). The plan #226 followed is kept below, after what it did.

The report that started it: on a four-year-old Android tablet (APK v0.23.0), opening the app and the first visit
to a screen froze for seconds. The screens it was most noticeable on were Decks & Collection, New game, Campaign and
Extras.

## Measuring

`scripts/profile-first-load.mjs` serves a built client (`pnpm --filter @mc/client build`, output in
`packages/client/dist`). It loads the build in headless Chrome with DevTools' CPU throttling, which defaults to 6x and
stands in for an older tablet. `Math.random` is seeded, so every run picks the same title art. The script reports long
tasks (over 50 ms), total blocking time (the part of each long task past 50 ms) and frames over 50 ms. Each
`--click x,y` opens a screen from Title and measures it for at least `--after` ms (default 4000).

```sh
# App start only, median of 3
node scripts/profile-first-load.mjs --runs 3
# Title → Campaign at 1280x800 (Title's buttons: New game 929,333 · Decks 929,397 · Campaign 929,459 · Extras 929,521)
node scripts/profile-first-load.mjs --click 929,459 --label Campaign --shot artifacts/qa/campaign.png
# A CPU profile to open in DevTools' Performance panel
node scripts/profile-first-load.mjs --click 929,397 --label Decks --cpuprofile ../perf/decks.cpuprofile
```

- **Compare builds interleaved** (before, after, before, after), one run each. The Windows rig is usually running
  other threads' work, so absolute numbers swing by 2x between runs, but interleaved pairs see the same load.
- **To read a profile with real function names**, build unminified into a scratch folder:
  `MC_CARD_ART=none pnpm exec vite build --minify false --outDir ../../../perf/dist-unmin` (from `packages/client`;
  `MC_CARD_ART=none` skips copying 400 MB of card art), then pass `--dist` to that folder.

## What #225 fixed

All figures are at 6x slowdown, medians of interleaved runs. "Frozen" is total blocking time.

| Moment             | Frozen before | Frozen after | Cause                                                                                                         |
| ------------------ | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| Opening the app    | 9.6 s         | 6.0 s        | Every card's ability definitions were checked as each module loaded; the title art was decoded during a frame |
| Campaign (Saga)    | 60.6 s        | 1.3 s        | The screen redrew whole once per cover as each of ten covers arrived                                          |
| Decks & Collection | 8.3 s         | 4.4 s        | Every deck re-checked for legality on each redraw, re-indexing the whole card pool per deck                   |
| Extras             | 9.0 s         | 1.9 s        | Thumbnails arriving one by one, each causing a redraw                                                         |

The changes:

- `defineAbilities` (`packages/cards/src/dsl/validate.ts`) skips its checks when `import.meta.env.PROD` is true. The
  unit tests and the dev server still run them.
- `ensurePictureLoaded` (`packages/client/src/art/pictures.ts`) fetches the file, decodes it with `createImageBitmap`
  and uploads it through a `bitmaprenderer` canvas (`art/bitmap-canvas.ts`). Pictures that load together tell their
  scenes once the last one arrives, or after `PICTURE_BATCH_MS` (300 ms). A scene that passes the same callback for
  every picture is told once.
- The Saga passes one coalescing callback for all its covers (`scenes/campaign/saga.ts`, `#onArt`).
- `indexPool` (`packages/engine/src/deck.ts`) keeps one index per pool object, and `deckOptionOf`
  (`packages/client/src/view/deck-list-model.ts`) keeps each deck's status until the deck, pool, version or
  registry changes.
- `stableStringify` (`packages/content/src/data/pool-version.ts`) is hand-written, with output byte-identical to the
  `JSON.stringify` replacer it replaced, so saved decks keep their pool version.

## What is left

After #225, two costs dominate:

1. **App start (about 3.5 s of one task on a quiet machine).** Evaluating the single 9 MB bundle: module-level card
   data and ability definitions (about 0.85 s), Phaser's own modules and `new Phaser.Game` (about 1 s), merging the
   ability registries (about 0.25 s) and the pool fingerprint (about 0.3 s). Every screen's code runs before Title
   can draw.
2. **A screen's first build is mostly text.** Each label is a Phaser `Text`: `ui/lazy-text.ts` already makes each one
   rasterize once instead of once per setter, but every label is still measured, painted on its own 2D canvas and
   uploaded as its own texture on the main thread. On Decks & Collection that is most of the remaining ~2.4 s
   freeze (`McLazyText` → `Text.updateText` → `MeasureText` / `canvasToTexture` in the profile).

Phaser can't run its renderer in a worker. It needs the page's `document`, `window` and input events, and a WebGL
texture belongs to the context that created it. So work can only move off the main thread as finished pixels: a
worker paints with `OffscreenCanvas` and hands back an `ImageBitmap`, and the main thread only uploads it. The
card-face worker (`art/card-face.worker.ts`, `card-face-baker.ts`, `card-face-bake.ts`, `card-face-protocol.ts`)
already works this way, fonts included.

## What #226 did

Medians at 6x slowdown, 1280x800, fresh profile, with the build before #225 (299b6e6c4), `main` after #225
(0ac5709d6) and #226 run interleaved in one session: 12 runs for opening the app, 3 per screen. The machine was quieter
than during #225's runs, so compare these with each other rather than with the table above.

| Moment             | Frozen before #225 | After #225 | After #226 | Longest freeze, three stages |
| ------------------ | ------------------ | ---------- | ---------- | ---------------------------- |
| Opening the app    | 3.9 s              | 2.4 s      | 1.3 s      | 3.1 s → 1.9 s → 0.9 s        |
| Campaign (Saga)    | 20.2 s             | 0.21 s     | 0.15 s     | 9.7 s → 0.23 s → 0.20 s      |
| Decks & Collection | 3.0 s              | 1.75 s     | 1.14 s     | 1.3 s → 1.2 s → 0.8 s        |
| Extras             | 2.2 s              | 0.95 s     | 0.43 s     | 0.44 s → 0.53 s → 0.34 s     |
| New game (chooser) | 26 ms              | 28 ms      | 2 ms       | 76 ms → 78 ms → 52 ms        |

- **Screens load on demand** (`scenes/scene-loader.ts`, `scene-table.ts`, `scene-order.ts`). Only Boot, Title and the
  always-on chrome are registered at start. Every other scene is a dynamic import, added on its first
  `start`/`launch`/`run` (the Scene Plugin is wrapped once, so call sites didn't change) and slotted back into the old
  draw order. Sheets a screen reads right after launching are listed in `COMPANIONS` and registered with it. After
  Title draws, the rest preload one per idle slot. The dev-only `?screen=` jumps live in `scenes/boot-dev-jump.ts`.
- **Text measured once per font, painted in a worker** (`ui/font-metrics.ts`, `text-layout.ts`, `text-painter.ts`,
  `workers/text-paint.worker.ts`). Measuring cost more than painting (about 450 ms against 170 ms on the Decks visit),
  so font metrics are cached per canvas font once the face has loaded, and line widths per font and text. Layout stays
  on the main thread, so sizes are exact at once. During a screen's first 40 frames the painting goes to the worker,
  and bitmaps are uploaded a few per frame. Later redraws, anything the worker can't paint exactly, the Canvas
  renderer, and browsers without `OffscreenCanvas` or fonts in workers paint on the main thread as before. The
  worker ends after 5 s idle, and `goToScreen` restarts it as the fade-out begins. `layoutText` copies the measuring
  half of Phaser 4.2.1's `Text.updateText`: re-check it on a Phaser upgrade.
- **Deck statuses in the search worker** (`view/deck-status-host.ts`, `DeckSearchClient.checkDecks`). The first
  visit's status pass (precons, saved and community decks) runs in #220's search worker, which loads the pool itself on
  its first status request. Rows say "Checking…" until it answers, and the screen's async loads redraw once together.
  Four or fewer unchecked decks (one just imported or saved) are checked on the main thread. Extras and the Campaign
  roster had no list preparation worth moving: their cost is text, texture uploads and drawing.

What is still on the main thread before Title draws: Phaser and rexUI, and the card pool with its ability registry,
because `session.ts` and Title import `content/pool.ts`. Deferring the pool past Title's first frame is the next
step.

## The follow-up PR (the plan #226 followed)

The user agreed on a single follow-up PR on 2026-10-17, to start from `main` after #220 merges. The tracking issue
links here.

### 1. Text rasterized in a worker

- A label worker built like the card-face worker: it loads the page's `@font-face` sources once
  (`card-face-baker.ts` already reads them), paints label text on an `OffscreenCanvas` and returns an `ImageBitmap`.
  The main thread uploads it with `canvasOf` (`art/bitmap-canvas.ts`; an `ImageBitmap` handed to Phaser directly
  comes out upside down).
- **The hard part is size.** Layout reads a label's size synchronously (`fitText`, `setOrigin`, rexUI sizers). So
  either the main thread still measures and only the painting moves (Phaser's `MeasureText` scans pixels to find a
  font's ascent and descent, so cache that per font and size), or labels get a provisional size and a relayout when
  the bitmap arrives. Measure first: if painting and uploading outweigh measuring, the first option is enough and is
  much simpler.
- Batch many labels into one atlas texture per screen build, rather than one texture per label. That would also cut
  the per-label uploads (`createTexture2D` was about 1.3 s of the Decks visit).
- Where the worker can't paint (no `OffscreenCanvas` 2D or no fonts in workers: older WebKit, which covers Safari, the
  macOS Tauri shell and iOS), fall back to today's main-thread `Text`, as the card-face baker does.
- End the worker when it is idle, as #220's search worker does (`view/deck-search-client.ts`): the user asked for
  workers to be terminated when their work is done.

### 2. Lazy-loaded screens

- Today `main.ts` imports and registers all ~70 scenes up front, so their modules (and the card data and registries
  they import) are evaluated before Title. Register Title, Boot and the always-on chrome scenes eagerly. Add the others
  with `game.scene.add(key, Scene)` after a dynamic `import()`, and route `goToScreen` through a loader that awaits the
  import before starting the scene.
- After Title has drawn, preload the other screens' chunks in idle time (`requestIdleCallback`, one at a time), so the
  first tap on Campaign or Decks doesn't wait for its file.
- On the native installs (Capacitor on Android, Tauri on desktop) the chunks ship inside the package and load from
  local storage, so nothing is downloaded and it works offline. A release replaces the whole package, so chunks never
  mix versions.
- Card data and the ability registry are the bulk of the bundle and are needed by the engine worker as well as the
  page. Check what Title actually needs from `content/pool.ts` before splitting them.
- Watch `scripts/shoot-app.mjs` and the e2e suite: dev-only `?screen=` jumps in `scenes/boot.ts` start scenes
  directly and need the same loader.

### 3. Remaining list preparation in workers

- The deck list's first status pass (`deckOptionsOf`), and sorting and filtering for the Decks, Campaign roster and
  Extras lists, can run in a worker. Card pools and decks are plain data. Check whether `EngineDeps` (the ability
  registry) is plain enough to post once, or whether the worker should import it itself (the engine worker does).
- Reuse #220's search worker and `DeckSearchClient` pattern instead of adding a second protocol for the same lists.

### Done when

- Each of the four screens and app start re-measured with `scripts/profile-first-load.mjs`, interleaved against
  `main`, with the numbers in the PR and a before/after card like #225's.
- The e2e suite passes on the Windows rig (queue on `%TEMP%\mc-e2e.lock`).
