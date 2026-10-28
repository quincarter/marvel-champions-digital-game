# Custom content packs: design proposal

Status: **proposal, for the owner's review.** Nothing here is built yet. The aim is to agree on the shape before any
code lands.

## 1. What we want

Fan-made heroes and scenarios (and later modular sets, campaigns, alt art) that:

- live in this repo, in a folder of their own, so they are reviewed, versioned and scripted like the base game;
- are **never part of the app build**: not in `dist/`, so not in the web bundle and not embedded in the Tauri binary
  or the Android APK;
- are a **separate download** in the native apps (a "pack" the player chooses to install), and stream on demand on the
  web;
- carry their own card data and scripts, since MarvelCDB knows nothing about them.

## 2. How art reaches the client today

What the proposal has to fit into, read from the code:

- **Card scans are a build input.** `packages/client/vite-card-art.ts` serves `assets/card-art/` at `/card-art/` in
  dev and copies the pool's share of it (`src/art/bundled-art.ts`, `poolArtPaths`) into `dist/card-art/` at build.
  The web deploy, Tauri (`frontendDist`) and Capacitor (`webDir`) all wrap that one `dist/`. Nothing is fetched at
  runtime.
- **Art must be same-origin** (or CORS-clean): `src/art/art-source.ts` says so, because WebGL refuses a cross-origin
  image as a texture. `artFor(card, face)` turns a card's `ArtRef` / `ImageRef` into `{ key, url }`, and
  `src/art/card-art.ts` (`CardArt`) loads it lazily through Phaser's loader, with an LRU budget and a remembered 404
  that falls back to the generated frame.
- **Full-bleed pictures** (`art/heroes/`, `art/scenarios/`, `art/packs/`, …) are found by `import.meta.glob` in
  `src/art/*-art.ts`, so they are bundled by Vite: every file in those folders ships.
- **Size is already the constraint.** `assets/card-art/` is ~540 MB (5,400+ files), `art/` ~220 MB, `music/` ~1.2 GB.
  `carriedLanguagesOf` notes that a native installer carries one language because two sets would pass GitHub's 2 GiB
  limit on a release asset.
- **Native HTTP exists.** `src/platform/native-http.ts` (`nativeGet`) does GETs through Tauri's HTTP plugin or
  CapacitorHttp, outside webview CORS. Tauri's capability allows only `https://marvelcdb.com/*` today
  (`src-tauri/capabilities/`).
- **IndexedDB is in use** for saves, decks and campaigns (`src/engine/idb-*.ts`), on every platform.
- **Card data and scripts are code-bundled.** The pool is `POOL_CARDS` (`src/content/pool-cards.ts`), a static list;
  abilities are the `AbilityRegistry` from `@mc/cards`. But an `AbilityDefinition` is **plain data**:
  `packages/cards/src/dsl/validate.ts` (`checkPlain`) already rejects anything that isn't JSON. That is what makes
  downloadable scripts possible at all (§6).

## 3. The content folder

A new top-level folder, outside every glob and every Vite root, so the build cannot pick it up by accident:

```
content-packs/
  README.md                       how to author a pack
  <pack-id>/                      e.g. fan-moon-knight, fan-scenario-kingpin-rising
    pack.json                     the manifest (§5), hand-written
    cards.ts                      card records, typed against @mc/content's AnyCard
    abilities/*.ts                ability scripts, written with @mc/cards' DSL
    scenario.ts                   optional: Scenario record(s) for a scenario pack
    images/                       source art, any size or format
      cards/<code>.png
      hero.png, villain.png, …    full-bleed pictures, named like art/README.md's slots
    CREDITS.md                    who made the art and text, and under what terms
    *.test.ts                     the pack's own tests (a smoke game at least)
```

Nothing in `packages/` imports from `content-packs/`. A guard test (like `campaign-art.test.ts`'s) fails if one
does, and `bundled-art.ts` never sees these cards because they are not in `POOL_CARDS`.

**Card codes** are namespaced so they can never collide with MarvelCDB's: `x.<pack-id>.<nn>[a|b]`
(`x.fan-moon-knight.01a`). The `x.` prefix is how every layer can tell a custom card from an official one.

## 4. Hosting

A pack is published as two shapes of the same files, built by one script (§4.3):

- a **zip** (`<pack-id>-<version>.zip`), what the native apps download and unpack;
- an **unpacked tree** (`<pack-id>/<version>/…`), what the web streams file by file.

### 4.1 Options compared

| Host                       | Limits that matter                                                                                            | CORS for the web                                                                        | Fit                                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **jsDelivr** (from GitHub) | 150 MB per package (a repo at a ref), 20 MB per file, unless raised by request; meant for "open-source files" | Yes (`*`)                                                                               | Not from **this** repo: at several GB it is far over the 150 MB package cap. Works only from a small separate repo (or one npm package per pack), and every pack together must stay under 150 MB per tag. Fragile. |
| **GitHub Releases**        | 2 GiB per asset; GitHub states no limit on total size or bandwidth                                            | **No**: the download redirects to a host without CORS headers, so a webview fetch fails | Ideal for the **native zip**: same place the installers already live, free, unlimited. Fetched with `nativeGet`, which ignores CORS. Not usable for web streaming.                                                 |
| **Netlify** (this site)    | Counts against the site's bandwidth plan; deploy size grows with every pack                                   | Not needed: **same origin** as the web app                                              | Ideal for **web streaming**: `/packs/<id>/<ver>/…` is same-origin, so WebGL takes it with no CORS at all, and `netlify.toml`'s immutable caching applies. Deployed beside the app, never inside `dist/`'s bundle.  |
| **Cloudflare R2**          | 10 GB storage and 10M reads a month free; **egress is free**; $0.015/GB-month beyond                          | Yes, configured per bucket                                                              | The best single host for both shapes once packs or traffic grow. Costs an account, a bucket, a custom domain and a CI secret, and the Tauri/Android HTTP scope would need its domain.                              |

### 4.2 Recommendation

Start with what the project already runs, with no new accounts:

1. **Native: GitHub Releases.** Each pack version is a release tagged `pack-<pack-id>-v<version>` (marked as a
   prerelease so `update-check.ts`'s "latest release" never sees it), with the zip as its asset.
2. **Web: Netlify, same origin.** The deploy workflow copies the built pack trees into `dist/packs/` **after** the
   app build, so they are files on the site but not part of the app bundle. The native shells never get them, since
   `scripts/build-desktop.mjs` and `build-android.mjs` build `dist/` without that step.
3. **One catalog** at `https://<site>/packs/index.json` (also attached to a `pack-catalog` release for native) lists
   every pack, its versions and both URLs (§5.2). The client only ever reads URLs from the catalog, so moving to R2
   later is a catalog change, not a client change.

Move to R2 when Netlify bandwidth becomes a cost, or when the catalog outgrows a deploy.

### 4.3 The pack build

`scripts/build-content-packs.mjs` (run in CI on `content-packs/**` changes):

1. Type-checks and runs the pack's tests.
2. Compiles `cards.ts`, `scenario.ts` and `abilities/*.ts` to JSON by importing them and serialising what they export.
   The DSL's builders already produce plain data; `validate.ts` runs on every definition.
3. Re-encodes images to WebP at the size the game draws (the same `fetch_card_art.py compress` settings the base scans
   use) and hashes each file.
4. Writes the manifest's `files` list, the zip, the unpacked tree, and the catalog entry.

## 5. Manifest format

### 5.1 `pack.json` (one per pack, in the zip and the tree)

```jsonc
{
  "schema": 1,
  "id": "fan-moon-knight",
  "version": "1.2.0",
  "kind": "hero", // hero | scenario | modular | campaign | art
  "name": "Moon Knight",
  "authors": ["…"],
  "description": "A fan-made hero pack.",
  "requires": {
    "app": ">=0.40.0", // the oldest client whose engine has every primitive the scripts use
    "dslFeatures": ["form-change-cost", "find-with-choice"], // checked against the client's own list
    "packs": [], // other packs this one needs (a scenario that uses a fan modular set)
  },
  "contents": {
    "cards": "data/cards.json",
    "abilities": "data/abilities.json",
    "scenarios": "data/scenarios.json", // scenario packs only
    "decks": "data/decks.json", // the precon, in the app's own deck format
  },
  "pictures": { "hero": { "x.fan-moon-knight.01a": "pictures/hero.webp" } },
  "files": [
    { "path": "cards/x.fan-moon-knight.01a.webp", "bytes": 182044, "sha256": "…" },
    // every file, so a download can be verified and resumed file by file
  ],
  "totalBytes": 6120345,
  "license": "Fan-made, non-commercial; see CREDITS.md",
}
```

### 5.2 `packs/index.json` (the catalog)

```jsonc
{
  "schema": 1,
  "generated": "2026-11-01T00:00:00Z",
  "packs": [
    {
      "id": "fan-moon-knight",
      "kind": "hero",
      "name": "Moon Knight",
      "latest": "1.2.0",
      "versions": {
        "1.2.0": {
          "manifest": "https://<site>/packs/fan-moon-knight/1.2.0/pack.json",
          "base": "https://<site>/packs/fan-moon-knight/1.2.0/",
          "zip": "https://github.com/quincarter/marvel-champions-digital-game/releases/download/pack-fan-moon-knight-v1.2.0/fan-moon-knight-1.2.0.zip",
          "zipBytes": 6240012,
          "zipSha256": "…",
          "requires": { "app": ">=0.40.0" },
        },
      },
      "cover": "https://<site>/packs/fan-moon-knight/1.2.0/pictures/cover.webp",
    },
  ],
}
```

Versions are immutable once published; a fix is a new version. Paths under a version are content-addressed by that
version, so `max-age=31536000, immutable` is safe.

## 6. Scripting custom cards

**Packs ship data, never code.** A downloaded pack carries JSON: card records, `AbilityDefinition`s, scenario records
and deck lists. The client never `import()`s or `eval`s anything from a pack. This is what keeps it safe, keeps the
engine deterministic and replayable, and keeps the Android (and any future iOS/store) build inside store rules
against downloading executable code.

That works because the engine already takes abilities as data (`EngineDeps.abilities`, an `AbilityRegistry` of plain
objects). An author writes a pack's scripts in TypeScript with the same DSL builders `@mc/cards` uses, so they get
types, `validate.ts` and the same tests; the pack build serialises the result.

What this means in practice:

- **A card that needs only existing primitives** is pure pack work: no app release.
- **A card that needs a new primitive** (a new effect kind, cost or trigger the engine doesn't have) needs that
  primitive built in `@mc/engine` first, by the usual specialists, and shipped in an app release. The pack then
  declares `requires.app` and the `dslFeatures` it uses, and an older client shows the pack as "needs an update"
  instead of loading it.
- The client keeps a list of the DSL features it supports (generated from the engine's effect/cost/trigger kinds),
  and refuses a pack whose scripts use a kind it doesn't know, by walking the JSON before the game starts.
- **Scenarios** are `Scenario` records from `@mc/content` plus the encounter cards' scripts. A scenario whose setup
  fits the generic builder is pure data; one that needs a bespoke builder (like the Civil War leaders) needs app code
  first, the same rule as a new primitive.
- **Rules authority** for custom cards is the pack's own text, then the RRG and FFG rulings for everything the text
  doesn't override. Questions go to the `rules-expert` the same way; the pack's `CREDITS.md` or a `RULINGS.md` holds
  the author's own answers.

## 7. In the client

### 7.1 One `PackStore`, the same on every platform

Installed packs are stored in **IndexedDB** as `Blob`s (one object store for manifests, one for files keyed by
`<pack-id>@<version>/<path>`). IndexedDB already works in WebView2, WebKitGTK, WKWebView and Android's WebView, so the
first version needs no new native code. The client calls `navigator.storage.persist()` before the first install so
the browser or webview doesn't evict it under pressure, and Settings shows each pack's size with a Remove button.

A file served from the store is a `blob:` URL created from the stored Blob, which is **same-origin**, so WebGL takes
it as a texture with no CORS question at all.

If IndexedDB ever proves too small or too slow for large packs on a platform, a native backend can replace it behind
the same interface: Tauri's fs plugin with a custom URI scheme, or Capacitor's Filesystem with `convertFileSrc` (which
is same-origin on Android). That is deliberately not in the first version.

### 7.2 Native: download as a pack

1. **Extras ▸ Packs** (or a section of the hero and scenario pickers) reads the catalog, filters out packs whose
   `requires` this client can't meet, and shows each with its size.
2. **Download** fetches the zip with `nativeGet` (adding the release-download hosts to the Tauri HTTP scope), checks
   `zipSha256`, and unzips **in a worker** (offload-the-main-thread rule) with a small library such as `fflate`,
   checking each file's `sha256` from the manifest.
3. Files go into the `PackStore`; the pack is registered (§7.4). A failed or interrupted download leaves nothing
   half-installed: the manifest is written last.
4. On launch, a newer version in the catalog offers an update the same way `update-check.ts` offers app updates.

### 7.3 Web: stream, with optional offline

The web never has to download a pack. Turning a pack **on** fetches only its `pack.json` and data JSON (small), and
each card's art is fetched on demand from the same-origin tree by the existing lazy `CardArt` loader, exactly as base
scans are, cached by the browser and Netlify's edge. A "Keep offline" toggle can run the native install path (§7.2,
fetching the tree's files instead of the zip) for players who want it.

### 7.4 Wiring a pack into the game

- **Art:** a custom card's `ImageRef` is `pack:<pack-id>/cards/<code>.webp`. `artFor` sends `pack:` refs to a
  `packArtUrl` resolver: the `blob:` URL when the file is in the `PackStore`, otherwise the pack's same-origin web URL.
  The texture key stays `art:pack:<pack-id>@<version>/…`, so the `CardArt` cache, LRU and 404 fallback work unchanged.
  Full-bleed pictures (hero select, villain art, Game Over) get a matching lookup beside the `import.meta.glob`
  catalogs.
- **Card pool:** `POOL_CARDS` stays the base pool. A `poolWithPacks()` adds the enabled packs' cards, and the deck
  builder, pickers and engine worker read through it. The engine worker receives the packs' cards and abilities with
  the game setup, merged into its `AbilityRegistry`.
- **Saves and replays** record the packs (id and version) a game used, beside its fingerprint. Loading a save whose
  pack is missing or a different version says so and offers the download, rather than starting a game with cards
  that don't exist.
- **Decks** that include custom cards are marked as such and are not offered to MarvelCDB export.

## 8. Phasing

1. **Spike (one PR):** the `content-packs/` folder with one small sample pack (a test hero with two or three
   existing-primitive cards and placeholder art), the pack build script, the `pack:` art resolver and `PackStore`, and
   a dev-only toggle that installs it from a local folder. Proves art, data and scripts end to end without any
   hosting.
2. **Hosting:** the catalog, the release workflow for pack zips, and copying pack trees into the Netlify deploy.
3. **Player-facing UI:** the Packs screen, download progress, sizes, remove, updates; the save/replay pack check.
4. **First real pack**, scripted and QA'd like a wave.

## 9. Questions for the owner

1. **Hosting to start with:** GitHub Releases for native + Netlify same-origin for web (recommended), or go straight
   to Cloudflare R2 for both?
2. **Where packs are authored:** this repo's `content-packs/` (recommended, reviewed like the game), or a separate
   repo so outside authors can contribute without touching the game?
3. **Who can publish:** only packs merged into this repo appear in the catalog (recommended), or should players be
   able to add a catalog URL or sideload a zip?
4. **Web offline:** stream only at first (recommended), or build "Keep offline" in the first player-facing version?
5. **Licensing of fan art:** each pack's `CREDITS.md` states the artist's permission; is that enough, or do you want a
   standard grant the artist signs off on in the PR?

## Sources

- jsDelivr's restrictions: [github.com/jsdelivr/jsdelivr](https://github.com/jsdelivr/jsdelivr) ("Packages larger
  than 150 MB or single files larger than 20 MB (in the case of GitHub) are not supported by default").
- GitHub release asset limits: [About large files on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).
- Cloudflare R2 pricing: [developers.cloudflare.com/r2/pricing](https://developers.cloudflare.com/r2/pricing/) (10
  GB-month free, free egress; figures checked against third-party summaries, confirm before committing).
