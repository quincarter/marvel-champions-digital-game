# Custom content packs: design proposal

Status: **unparked by the owner on 2026-11-10 (§10), with a mod store layer added (§11, issue #677).** The owner is
buying a domain and setting up R2 (§11.8) while the code is built against a local catalog.

**What changed in this pass (2026-11-10):** the owner approved Cloudflare R2 for packs and asked for a **mod store**: an
in-game browser of approved community packs, and a **creator template** that authors fork to build a pack and submit it
for approval. Packs are now authored in creators' own repos, not this one; the store lists only packs the owner has
approved; the mod SDK is published to npm and as a tarball on each release; and every platform installs a pack as one
zip download (§11).

**What changed in this pass (2026-10-30):** media left git for release bundles in the content repo (#495), so pack
images follow them there (§3). Netlify is near its bandwidth limit after a Reddit post, so the site's own hosting is
now part of the question: §4.1 recommends moving the site to Cloudflare, and §4.2 moves packs to Cloudflare R2 on every
platform. jsDelivr is dropped.

## 1. What we want

Fan-made heroes and scenarios (and later modular sets, campaigns, alt art) that:

- are reviewed, versioned and scripted like the base game: text and scripts in this repo, images in the content
  repo, the way the base game's media is split since #495;
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
- **Media lives in release bundles (#495).** Card art, music and art are zips on the releases of
  `quincarter/marvel-champions-content`. `assets/manifest.json` names each one's release, size and sha256;
  `pnpm assets:fetch` installs them and `pnpm assets:pack <bundle>` uploads a changed one. Zips are deterministic and
  each upload gets its own release, tagged `<bundle>-<first 12 hex of its sha256>`.
- **Size is already the constraint.** The bundles hold about 406 MB of English card art, 451 MB of Spanish, 234 MB of
  art and 1.19 GB of music. `carriedLanguagesOf` notes that a native installer carries one language because two sets
  would pass GitHub's 2 GiB limit on a release asset.
- **The web deploy is Netlify, on a `netlify.app` address.** `netlify-deploy.yml` uploads a built `dist/`, and
  `netlify.toml` adds the MarvelCDB proxy, the SPA fallback and immutable cache headers.
- **There is already a Cloudflare account.** The `mc-sync` Worker (`packages/sync-worker`) runs save transfer and device
  sync on Cloudflare's free plan.
- **Native HTTP exists.** `src/platform/native-http.ts` (`nativeGet`) does GETs through Tauri's HTTP plugin or
  CapacitorHttp, outside webview CORS. Tauri's capability allows only `https://marvelcdb.com/*` today
  (`src-tauri/capabilities/`).
- **IndexedDB is in use** for saves, decks and campaigns (`src/engine/idb-*.ts`), on every platform.
- **Card data and scripts are code-bundled.** The pool is `POOL_CARDS` (`src/content/pool-cards.ts`), a static list;
  abilities are the `AbilityRegistry` from `@mc/cards`. But an `AbilityDefinition` is **plain data**:
  `packages/cards/src/dsl/validate.ts` (`checkPlain`) already rejects anything that isn't JSON. That is what makes
  downloadable scripts possible at all (§6).

## 3. The content folder

A new top-level folder for what git should hold, outside every glob and every Vite root, so the build cannot pick it
up by accident:

```
content-packs/
  README.md                       how to author a pack
  <pack-id>/                      e.g. fan-moon-knight, fan-scenario-kingpin-rising
    pack.json                     the manifest (§5), hand-written
    cards.ts                      card records, typed against @mc/content's AnyCard
    abilities/*.ts                ability scripts, written with @mc/cards' DSL
    scenario.ts                   optional: Scenario record(s) for a scenario pack
    images/                       gitignored; a bundle on the content repo fills it
      cards/<code>.png
      hero.png, villain.png, …    full-bleed pictures, named like art/README.md's slots
    CREDITS.md                    who made the art and text, and under what terms
    *.test.ts                     the pack's own tests (a smoke game at least)
```

A pack's source images are a bundle in `assets/manifest.json`, in the optional `pack-art` group: `pnpm assets:pack
pack-art-<id>` uploads them like any other bundle, and a plain `pnpm assets:fetch` skips the group, so the app build
and a fresh checkout never download them (`pnpm assets:fetch pack-art` does).

Nothing in `packages/` imports from `content-packs/`. A guard test (like `campaign-art.test.ts`'s) fails if one
does, and `bundled-art.ts` never sees these cards because they are not in `POOL_CARDS`.

**Card codes** are namespaced so they can never collide with MarvelCDB's: `x.<pack-id>.<nn>[a|b]`
(`x.fan-moon-knight.01a`). The `x.` prefix is how every layer can tell a custom card from an official one.

## 4. Hosting

Two questions share one answer. The site needs a host that doesn't charge for traffic, and packs need a host that any
client can read. Prices below are from each provider's own pricing page on 2026-10-30 unless noted. The monthly figures
assume **1 TB a month of traffic**, ten times this month's, from North America and Europe, with 10 GB stored.

### 4.1 Where the site lives

**Recommendation: move the site from Netlify to Cloudflare Workers static assets.** Cloudflare's docs say "Requests to
static assets are free and unlimited", and that storing them costs nothing. That is the closest thing to unlimited
egress on offer, and the project already has the account.

| Host                                 | Cost at 1 TB   | What limits it                                                                                     |
| ------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------- |
| **Cloudflare Workers static assets** | **$0**         | 20,000 files and 25 MiB per file on the free plan; 100,000 files on a paid plan                    |
| Cloudflare Pages                     | $0             | The same file limits. Its limits page states no bandwidth cap, but doesn't promise none in writing |
| AWS CloudFront flat-rate Pro         | $15            | 50 TB and 10M requests, "no overage charges". 1 TB of ~100 KB scans is about 10M requests          |
| AWS CloudFront flat-rate Free        | over its limit | 100 GB and 1M requests: no better than today                                                       |
| Vercel Pro                           | $20            | 1 TB and 10M requests included, then from $0.15/GB. Hobby is non-commercial, capped at 100 GB      |
| Netlify Pro (credit plan)            | ~$130          | 20 credits per GB, 3,000 credits included, about $0.13/GB beyond                                   |
| Azure Static Web Apps                | not usable     | 100 GB included. The free plan stops serving past it; Standard's overage rate didn't render        |
| GitHub Pages                         | not usable     | 1 GB site, soft 100 GB a month                                                                     |

**We fit the limits.** The last `en,es` build has about 9,500 card-art and asset files, under half of the 20,000. The
largest file on disk is an 8.4 MB picture, far under 25 MiB. A third card language adds thousands of files, and that is
when a paid plan's 100,000 would be needed.

**"Unlimited" has one caveat.** Cloudflare's Developer Platform terms say it "can be used to host content", which the
ordinary CDN does not allow for "a disproportionate percentage of pictures, audio files, or other large files". The
same terms let Cloudflare "temporarily limit" requests or storage that "put an undue burden" on its network, and give
no number. A viral month of a card game is unlikely to get there, but it is a policy, not a guarantee.

**Why Workers rather than Pages.** Both would work. Workers has the written statement above, and a Worker in the same
project can answer the one route that needs code. Pages' PR previews are closer to today's flow, so it is the fallback
if Workers' previews fall short.

**What moving involves:**

- **The MarvelCDB proxy needs code.** `_redirects` on Cloudflare can't proxy an external domain ("You cannot proxy
  external domains"), so `/api/marvelcdb-import/*` becomes a few lines of Worker, with `run_worker_first` on that path
  only. Those requests count toward the free plan's 100,000 a day, which `mc-sync` also spends. Everything else stays
  free, and past the limit only the proxy fails.
- **Saves don't follow the site.** IndexedDB and `localStorage` belong to an origin, so **every web player's saves stay
  behind on `netlify.app`** when the address changes. This is the real cost of the move. The old address has to become
  a small page, not a plain redirect, that lifts saves across using what exists (`exportSaveData` /
  `importSaveData` and the `mc-sync` transfer), and only then forwards the player. It should stay up for months, since
  it costs almost no bandwidth.
- **Buy a domain first, so this is the last move.** On a domain we own, a future host change never strands saves again,
  and R2 needs one anyway (§4.2). Moving to a `workers.dev` address would mean doing the save migration twice. Marvel's
  name in a fan project's own domain is a trademark risk the `netlify.app` subdomain doesn't carry, so the name should
  leave it out. Candidate names and where the choice stands are in §10.
- **Smaller pieces:** port the cache headers and SPA fallback, rewrite `netlify-deploy.yml`, including PR preview URLs
  and the deploy secrets, and update the site address in four client files, the Tauri capability and the README.
  Installed apps still link to the old address, which is one more reason to keep it answering.

### 4.2 Where packs live

**Recommendation: Cloudflare R2 for every platform, behind a subdomain of the new domain (`packs.<domain>`).** With the
site on Cloudflare too, there is one vendor and one bill, and R2's egress is free at any volume.

| Host                          | Cost at 1 TB | Stored price                | Notes                                                                                                                                 |
| ----------------------------- | ------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Cloudflare R2**             | **$0**       | 10 GB free, then $0.015/GB  | 10M reads a month free, then $0.36 per million. `r2.dev` is rate-limited and "development" only, so it needs a domain                 |
| Backblaze B2 + Bunny CDN      | ~$10         | 10 GB free, then ~$0.007/GB | The best non-Cloudflare pick. B2 to Bunny is free; Bunny is $0.01/GB here, $0.03 to $0.06 elsewhere, or $0.005 on its smaller network |
| DigitalOcean Spaces           | $5           | 250 GiB included            | 1 TiB of transfer included, then $0.01/GiB                                                                                            |
| Tigris                        | ~$5          | 5 GB free, then $0.02/GB    | "Zero egress fees", but reads cost $0.50 per million. A newer company                                                                 |
| AWS S3 + CloudFront flat-rate | $15          | 50 GB included              | The cheapest way to stay on AWS, and shares the 10M request ceiling above                                                             |
| Azure Blob direct             | ~$78         | ~$0.018/GB                  | First 100 GB free, then $0.087/GB                                                                                                     |
| AWS S3 direct                 | ~$81         | ~$0.023/GB                  | First 100 GB free, then about $0.09/GB. The tier table didn't load, so $0.09 is AWS's own worked example                              |
| Azure Blob + Front Door       | ~$118        | ~$0.018/GB                  | $35 a month base, plus $0.083/GB                                                                                                      |
| Wasabi                        | not usable   | 1 TB minimum, $7.99         | Free egress only while it doesn't exceed storage, 90-day minimum: built for backups, not for serving a website                        |

S3 and Azure aren't bad services. They are priced for egress as a profit line, which is the exact thing to avoid here,
and neither offers unmetered traffic at any list price. CloudFront's flat rate is the only real competitor from either,
and it trades a bandwidth ceiling for a request ceiling. Nothing on the page says what happens past 10M requests.

**Fit for packs:** the 30 packs on the community list come to about 150–200 MB, so they sit inside R2's free 10 GB. Even
the whole media set (about 2.3 GB) would.

**Why not the others from the first pass:**

- **GitHub Releases** remains the source of record, not the delivery host. A `curl` of a content repo asset shows the
  redirect target sends no CORS headers, so the web can't read it. It stays as the native fallback (§5.2).
- **jsDelivr** serves files in a repo or npm package, not release assets, so it can't read the content repo's zips at
  all. Its caps of 150 MB per package and 20 MB per file would also be spent by this first batch of packs.

**Cross-origin art.** R2 on `packs.<domain>` isn't the site's origin, and WebGL refuses a cross-origin texture without
CORS. So the bucket's CORS rule allows the site's origin, and the client fetches each picture and hands Phaser a
`blob:` URL (§7.3), rather than the loader reading the URL itself. Nothing in the client sets `crossOrigin` today.
Zips need a Cache Rule, since R2 custom domains only cache certain file types by default.

**If we'd rather not buy a domain yet:** a Worker on the site's own address can read the bucket through a binding, which
is same-origin and needs no CORS at all. But every picture is then a Worker request against the 100,000 a day, so it
needs a paid Workers plan to survive another Reddit day.

### 4.3 How a pack is published

`scripts/build-content-packs.mjs` (run in CI on `content-packs/**` changes):

1. Fetches the pack's image bundle, type-checks and runs the pack's tests.
2. Compiles `cards.ts`, `scenario.ts` and `abilities/*.ts` to JSON by importing them and serialising what they export.
   The DSL's builders already produce plain data; `validate.ts` runs on every definition.
3. Re-encodes images to WebP at the size the game draws (the same `fetch_card_art.py compress` settings the base scans
   use) and hashes each file.
4. Writes the manifest's `files` list, then the pack in two shapes: a **zip**, which native downloads, built with the
   same deterministic `writeZip` as the bundles, and an **unpacked tree**, which the web reads file by file.
5. Uploads both to R2 under `<pack-id>/<version>/`, attaches the zip to a `pack-<pack-id>-v<version>` release on the
   content repo, and updates the catalog.

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
    "scenarios": "data/scenarios.json", // Scenario records (scenario packs): villain, main scheme, set choices
    "encounterSets": "data/encounter-sets.json", // EncounterSet records: id "<pack-id>-<name>", a display name, a nemesis link
    "decks": "data/decks.json", // the precon, in the app's own deck format
    "campaigns": "data/campaigns.json", // PackCampaign records: the engine's CampaignDefinition plus a display record and an optional story (§11.10)
  },
  "pictures": { "hero": { "x.fan-moon-knight.01a": "pictures/hero.webp" } },
  // optional, added 2026-11-10 so community packs in several languages convert:
  "languages": { "base": "en", "available": ["en", "es"], "text": "en" }, // card pictures are cards/<lang>/<code>.webp; a missing language falls back to base
  // `text` is the language of the card records. Packs ship one language of card text today; per-language text (names,
  // rules text, traits) follows the game's translation layer (PR #664) once it covers card text, as a later additive field.
  "altArt": { "en": { "01088": "alt-art/en/01088.webp" } }, // alternate art for base-game cards (or the pack's own); any kind, an art pack is only this
  "permission": {
    "by": "Neptune",
    "evidence": "DM, 2026-11-05",
    "date": "2026-11-05",
    "scope": "inclusion and translation",
  },
  "templateCredit": "Hitch",
  "translators": { "es": "Francisco Merchán" },
  "files": [
    { "path": "cards/x.fan-moon-knight.01a.webp", "bytes": 182044, "sha256": "…" },
    // every file, so a download can be verified and resumed file by file
  ],
  "totalBytes": 6120345,
  "license": "Fan-made, non-commercial; see CREDITS.md",
}
```

**Picture naming (multi-stage cards).** A card's picture is `cards/<lang>/<code>.webp`. A card with several printed
pictures letters them in order from its own code, derived from the card record's stage data, with no extra manifest
field:

- A **villain**'s stages are its pictures in order (every side's stages, side by side). A code without a face letter
  is its own first picture: stage I is `<code>`, then `<code>b`, `<code>c`... (`x.p.01`, `01b`, `01c`).
- A **main scheme**'s stage n side A and side B are two pictures each, in order: A then B. A code ending in a letter
  starts the run: 1A `<code>` (`02a`), 1B `02b`, 2A `02c`, 2B `02d`, 3A `02e`, 3B `02f`.
- A double-sided card's flip side (`03a`/`03b`) and a hero identity's alter-ego face (`01a`/`01b`) are the `b` sibling.
- Anything else has one picture. The client tries the stage's own picture, then the card's own code, then draws the
  generated face. `validatePack` requires that a pack which ships any picture of a villain or main scheme with more
  than one picture ships all of them; a pack with none is fine.

### 5.2 `index.json` (the catalog)

Served from `https://packs.<domain>/index.json` with a short cache. Only this file's address is built into the client;
every other URL comes from it, so a host change is a catalog change.

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
          "manifest": "https://packs.<domain>/fan-moon-knight/1.2.0/pack.json",
          "base": "https://packs.<domain>/fan-moon-knight/1.2.0/",
          "zip": "https://packs.<domain>/fan-moon-knight/1.2.0/fan-moon-knight-1.2.0.zip",
          "zipFallback": "https://github.com/quincarter/marvel-champions-content/releases/download/pack-fan-moon-knight-v1.2.0/fan-moon-knight-1.2.0.zip", // native only
          "zipBytes": 6240012,
          "zipSha256": "…",
          "requires": { "app": ">=0.40.0" },
        },
      },
      "cover": "https://packs.<domain>/fan-moon-knight/1.2.0/pictures/cover.webp",
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
  first, the same rule as a new primitive. The generic builder takes the plain `Scenario` fields only (the ids and
  names, the villain and main scheme, the set lists, `villainStages`, the modular set count); `validatePack` lists any
  other field. A pack's **encounter sets** (its scenario's own set, a modular set, a nemesis set) are `EncounterSet`
  records with ids `<pack-id>-<name>`; every encounter set id on a pack card that starts with the pack id, and every
  hero's nemesis set (which also carries `nemesisOfIdentityId`), must have one. A pack modular set may be picked at a
  base scenario, and a pack scenario may name base or pack sets. `scenarioWithPacks` in `@mc/mod-sdk` builds the game.
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
2. **Download** fetches the zip with `nativeGet` (adding `packs.<domain>` and the release-download hosts to the Tauri
   HTTP scope), falls back to `zipFallback` if that fails, checks `zipSha256`, and unzips **in a worker** (offload-the-main-thread rule) with a small library such as `fflate`,
   checking each file's `sha256` from the manifest.
3. Files go into the `PackStore`; the pack is registered (§7.4). A failed or interrupted download leaves nothing
   half-installed: the manifest is written last.
4. On launch, a newer version in the catalog offers an update the same way `update-check.ts` offers app updates.

### 7.3 Web: stream, with optional offline

The web never has to download a pack. Turning a pack **on** fetches only its `pack.json` and data JSON (small). Each
card's art is then fetched on demand from R2 when the existing lazy `CardArt` loader asks for it, in a worker with CORS,
and handed to Phaser as a `blob:` URL. The browser's cache and Cloudflare's edge cover repeat visits. The URL is revoked
when `CardArt`'s budget evicts the texture. A "Keep offline" toggle can run the native install path (§7.2, fetching the
zip) for players who want it.

### 7.4 Wiring a pack into the game

- **Art:** a custom card's `ImageRef` is `pack:<pack-id>/cards/<code>.webp`. `artFor` sends `pack:` refs to a
  `packArtUrl` resolver: the `blob:` URL when the file is in the `PackStore`, otherwise one fetched from R2 (§7.3).
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

Step 1 stands alone, and doesn't wait for any pack work. It is the urgent one.

1. **Move the site:** buy the domain, serve the site from Cloudflare Workers static assets at that address, add the
   MarvelCDB proxy and PR previews, and turn the Netlify address into the save-carrying page (§4.1).
2. **Spike (one PR):** the `content-packs/` folder with one small sample pack (a test hero with two or three
   existing-primitive cards and placeholder art), the pack build script, the `pack:` art resolver and `PackStore`, and
   a dev-only toggle that installs it from a local folder. Proves art, data and scripts end to end without any
   hosting.
3. **Hosting:** the R2 bucket with its CORS and cache rules, the catalog, and the pack publish workflow.
4. **Player-facing UI:** the Packs screen, download progress, sizes, remove, updates; the save/replay pack check.
5. **First real pack**, scripted and QA'd like a wave.

The same pipeline could later slim the native installers by making Spanish card art or music a download. That is out of
scope here, but nothing above blocks it.

## 9. Questions for the owner

1. **Site and pack hosting:** Cloudflare Workers static assets for the site and R2 for packs (recommended), or Backblaze
   B2 + Bunny for packs if you'd rather not put everything with one vendor?
2. **Where packs are authored:** this repo's `content-packs/` (recommended, reviewed like the game), or a separate
   repo so outside authors can contribute without touching the game?
3. **Who can publish:** only packs merged into this repo appear in the catalog (recommended), or should players be
   able to add a catalog URL or sideload a zip?
4. **Domain:** which name, and are you happy to buy one (recommended)? It avoids a second save migration, and a
   custom domain is how R2 is meant to be served.
5. **Web offline:** stream only at first (recommended), or build "Keep offline" in the first player-facing version?
6. **Licensing of fan art:** each pack's `CREDITS.md` states the artist's permission; is that enough, or do you want a
   standard grant the artist signs off on in the PR?

## 10. Decisions and discussion so far

**Unparked, with a mod store (2026-11-10).** The owner approved Cloudflare R2 for packs. He's buying a domain, will put
the store on R2, and will do the Cloudflare and npm setup (§11.8) while the code is built. He asked for a mod store and
a creator template (§11, issue #677). He decided the following:

- All of this work goes on #489's branch.
- Create the template repo `marvel-champions-mod-template` and the registry repo `marvel-champions-mods`.
- Publish the mod SDK to npm, and also attach it as a tarball to each release.

**Domain and npm scope (2026-11-10).** The owner bought `champions-digital-game.com`, created the R2 bucket with
`packs.champions-digital-game.com` as its custom domain, and created the npm organization `@champions-digital-game`.
The mod SDK publishes as `@champions-digital-game/mod-sdk`. The client reads `https://packs.champions-digital-game.com/index.json`
(a dev server reads the local `public/packs/index.json`). Packaged apps fetch packs through native HTTP, so only the
web needs the bucket's CORS entry. This settles §9.4 for packs; moving the site itself to the domain (§4.1) is a
separate step.

This settles §9.1 (R2) and §9.2, §9.3 and §9.5 (§11.1). §9.4 (the domain name) and §9.6 (fan-art licensing) stay open,
though §11.4's permission record covers the store side of §9.6.

**Parked (2026-10-31).** The owner hasn't chosen a domain and can't move hosts yet, so the work is on hold. Nothing
gets built, and the site stays on Netlify, until a domain is picked. Cloudflare for both the site and packs (§9.1)
is still the recommendation but isn't approved yet. The other §9 questions are still open.

**Domain (§9.4), open.** The owner suggested `marvel-champions-digital-game.app` and `marvel-champions-digital.game`.
The recommendation is against both. A fan project's own domain with "marvel" in it can be claimed outright by the
trademark holder through a domain dispute, and losing the address would strand web saves again, which is the problem
the domain is meant to solve. The `netlify.app` address is only a subdomain, so it doesn't carry that risk. Names that
hint at the game without naming it are safer, for example `champions-digital.app`, `champsdigital.game` or
`mcdigital.app`, since "Champions" alone is a common word. Their availability hasn't been checked, and this is not
legal advice. Either ending works: `.app` is HTTPS-only, which the site needs anyway. Wherever it's bought, the
domain's DNS has to run on Cloudflare for R2 to serve from it.

**Netlify's limit.** The pricing pages read for §4.1 don't say what the site's current plan does at 100 GB. Check
Netlify's usage page for that before the limit is reached.

**Pack size (2026-10-28).** A precon hero pack fits comfortably: base scans average about 100 KB each, so a 40-card
hero with its art comes to roughly 4–6 MB as one zip. The per-file size is not what ruled out jsDelivr; its 150 MB
cap per package is (§4.2).

**The community list (2026-10-28).** BluefireF5ran's list of fan content, grouped by the official expansions, has 30
packs, three per expansion:

- **20 heroes:** Agent Coulson, Dum Dum Dugan, Gwenpool, Mantis, Ebony Maw, Quasar, Spiderling, Spiders-Man, Ink,
  Dazzler, Deathlok, Sunspot, Blink, Sabretooth (counted as a hero by the list's pattern; it doesn't say), Quake,
  Mockingbird, Night Thrasher, Kate Bishop, Howard the Duck and Black Cat.
- **9 scenarios:** Baron Zemo, Escape the Church, The Magus, The Lizard (with its own modular set), Black King,
  Sentinel City, Hellfire Gala, Secret Invasion and The Rose.
- **1 PvP pack:** Magneto & Professor X, in two Drive folders.

The list also links JustATuna's whole campaign as an option, and suggests unlocking packs as "secret" heroes and
scenarios tied to each expansion's progression. **Only Gwenpool has its creator's permission** (PatataSaurio); each of
the other 29 needs its creator's permission before it ships (§9.6). The set comes to about 150–200 MB.

## 11. The mod store (issue #677, 2026-11-10)

The owner's ask: a store inside the game that lists the custom packs available to pull in, and a sample project
creators use as a template to make their own pack and submit it to the community store for approval. This section
builds on §3 to §8 and wins where it differs from them.

### 11.1 What changes from §3 to §8

- **Packs are authored outside this repo.** Each pack lives in its creator's own repo, made from the template
  (§11.3). This repo keeps the engine, the mod SDK (§11.2), the client's `PackStore` and store screen, and one sample
  pack under `content-packs/` for its tests to build. This answers §9.2: a separate repo per pack.
- **Only approved packs are listed.** The store reads one catalog, and a pack gets into it only through the registry
  repo's review (§11.4). There's no sideloading in the first version. A developer toggle, off by default, installs a
  pack from a local folder so a creator can test before submitting. This answers §9.3.
- **Every platform installs a zip.** The web also downloads the pack's zip into the `PackStore`, instead of streaming
  card art file by file (§7.3). An install is one request, and a game never fetches a pack's art during play. That
  keeps the store well inside Cloudflare's free tiers, and the web gets offline play at no extra cost. This answers
  §9.5.
- **The catalog is the store's `index.json`** (§5.2), with the fields §11.5 adds.

### 11.2 The mod SDK

The mod SDK is one package, built from this repo and versioned with the app. Every pack depends on it. It contains:

- **The pack schema:** types for `pack.json` and for the card, scenario and deck records a pack may carry, plus a JSON
  Schema generated from those types for editors.
- **The ability DSL:** the `@mc/cards` builders, re-exported, so a pack's abilities are written the same way as the
  base game's.
- **`mc-pack validate`**, which checks:
  - the pack against the schema;
  - that every custom card code is `x.<pack-id>.<nn>`;
  - that every ability a card names is defined, and passes `dsl/validate.ts`;
  - that the scripts use only DSL features this SDK's engine has (it writes the list to `requires.dslFeatures`);
  - that every file in `files` exists with the listed size and sha256;
  - that `CREDITS.md` and `PERMISSION.md` are present.
- **`mc-pack build`:** writes the abilities out as `data/abilities.json`, fills in `pack.json`'s `files`, `totalBytes`
  and `requires`, and makes the deterministic zip.
- **`mc-pack test`:** plays headless smoke games on the real engine and fails on an engine error or a stuck game. A
  hero pack plays its precon; a scenario pack plays its scenario. The template's own Vitest tests use the same game
  builder to check that a card does what its text says.

The SDK ships two ways (the owner, 2026-11-10), so a creator can pin either:

- on **npm**, as `@<scope>/mod-sdk`;
- as a **tarball attached to each game release**.

The npm scope must not contain "Marvel" (§10). The SDK is bundled: it carries the engine and DSL code it needs and
doesn't depend on this repo's private workspace packages. It is AGPL-3.0-or-later, like the rest of this repo. A
pack's own data and art are under the pack's own license.

`requires.app` is the oldest app whose engine matches the pack's SDK version. Before the client offers a pack, it
checks `requires.app` and `dslFeatures` against its own version and feature list (§6).

### 11.3 The creator template repo

The template is `quincarter/marvel-champions-mod-template`, a GitHub template repository. A creator clicks "Use this
template" and gets:

- `pack.json`, with the pack's id, kind, name, authors and description filled in by a first-run script;
- `cards/`, with card records as one JSON file per card;
- `abilities/`, with TypeScript abilities written with the SDK's DSL, one module per card group;
- `scenarios/` and `decks/`;
- `art/`, with placeholder images at the expected sizes;
- `CREDITS.md`, saying who made the pack and its art;
- `PERMISSION.md`, recording the creator's permission for the store to distribute the pack;
- a sample pack: a small test hero whose cards use only existing primitives, so a creator sees one card of each kind
  done;
- `test/`, with a smoke test and a sample card test;
- **CI**: `validate` and `test` on every push and pull request; on a `v*` tag, `build`, which attaches the zip and
  `pack.json` to a GitHub release of the creator's repo;
- `SUBMITTING.md`, explaining how to submit to the store (§11.4).

### 11.4 Submission and approval

The store's registry is a second repo, `quincarter/marvel-champions-mods`. Its `packs/<pack-id>.yaml` files are the
list of approved packs:

```yaml
id: fan-gwenpool
repo: https://github.com/<creator>/<pack-repo>
tag: v1.0.0
commit: <full sha the tag points at>
creator: PatataSaurio
permission:
  by: PatataSaurio # the creator, or who granted permission on their behalf
  evidence: https://… # where the permission was given
  date: 2026-10-28
tags: [hero, justice]
```

1. **Submit:** the creator tags a release in their pack repo and opens a pull request that adds
   `packs/<pack-id>.yaml`. The PR template asks for the permission evidence.
2. **Check:** the registry's CI checks out the pack at `commit` rather than the tag, because a tag can move. It builds
   the pack with the SDK version the pack pins, runs `validate` and `test`, and compares the result with the release's
   zip. It then comments the pack's size, the DSL features it uses and the oldest app it needs.
3. **Review:** the owner, or a reviewer the owner names, reads the cards and tries the pack with the store's developer
   toggle. Merging the PR approves the pack.
4. **Publish:** on merge, the registry's publish workflow:
   - uploads the built zip and `pack.json` to `mc-packs/<pack-id>/<version>/` in R2;
   - attaches the same zip to a release of the registry repo, as the fallback (§5.2's `zipFallback`);
   - regenerates `index.json`.
5. **Update:** a new version is a PR that changes `tag` and `commit`. Older versions stay in R2, so saves that used
   them still load (§7.4).
6. **Withdraw:** removing a pack's file drops it from the catalog. The client keeps an installed copy and marks it
   "withdrawn": it's still playable, so saves still load, but the store doesn't offer it.

**The repo's own packs** (`content-packs/`: the samples and the community packs the owner imported with permission)
don't go through the registry. `.github/workflows/publish-packs.yml` in this repo builds them on a push to `main` and
publishes them to the same bucket and the same `index.json`, with the same rules: versions are immutable, older ones
stay, and `approved` keeps its first date (CONTRIBUTING.md, "Publishing packs"). The registry's publish must
therefore keep the packs it didn't publish when it regenerates `index.json`, and a pack id is published by one of the
two only.

A pack without permission evidence is never merged. Of BluefireF5ran's 30 packs, only Gwenpool has it so far (§10).
Neptune's packs (issue #661) are free to use by their creator's own statement, and that statement is the evidence.

### 11.5 The store's `index.json`

The store's catalog is §5.2's, with the extra fields the store screen shows:

```jsonc
{
  "schema": 2,
  "generated": "2026-11-10T00:00:00Z",
  "packs": [
    {
      "id": "fan-gwenpool",
      "kind": "hero",
      "name": "Gwenpool",
      "creator": "PatataSaurio",
      "summary": "One line for the store list.",
      "tags": ["hero", "justice"],
      "thumbnail": "https://packs.<domain>/fan-gwenpool/1.0.0/thumb.webp",
      "approved": "2026-11-12",
      "latest": "1.0.0",
      "versions": {/* as §5.2 */},
      "withdrawn": false,
    },
  ],
}
```

Each version may carry `"preview": "<base>preview.json"`. `mc-pack build` writes `preview.json` (and `thumb.webp`, when the
featured card has a picture) next to the zip, never inside it, so the zip bytes do not depend on it. It holds the
featured card (a hero pack's identity with both faces, a scenario pack's villain, a campaign pack's first scenario's
villain), the pack's own full card records, each precon deck as card ids and quantities (base-game ids stay ids) and the
list of `cards/<lang>/<code>.webp` pictures the pack ships (`PackPreview` in `@mc/content`). The client reads it
before an install to show the browse tile's card and the pack page's gallery. It is untrusted data: capped at 1 MiB,
validated, and only the pack's own well-formed cards are kept. Publishing it into the registry's index (the update-index
step) is not done yet.

The client fetches the catalog when the store opens, with a short cache. It keeps the last copy, so the store still
opens offline and shows what's installed.

### 11.6 The store screen

The store screen is **Extras ▸ Mod Store**. Like every other screen, it's drawn in Phaser with the `Mc*` widgets.

- **Browse:** tabs for All, Heroes, Scenarios and Installed. Each pack is a tile with its thumbnail, name, creator,
  kind, size and state: Install, Installed, Update, Needs app update or Withdrawn.
- **Pack page:**
  - the pack's cards as a gallery, with the hover popover on desktop;
  - its description, credits and permission;
  - its size, its version and what it needs;
  - Install, Update and Remove.
- **Install:** a progress bar shows while the zip downloads and unzips **in a worker** (offload-the-main-thread
  rule). A failed install leaves nothing installed (§7.2.3).
- **Input:** every press uses `onTap` or `McButton`, never a bare `pointerup`, and no control sits on a scrolling
  region. Every control is reachable with a controller, with its glyphs shown.
- **Screenshots:** at the five sizes (iPhone SE, Pixel, tablet portrait, tablet landscape and desktop).

Installed packs then show in the hero and scenario pickers with a small "Custom" badge (§7.4).

### 11.7 Build order

Each step is its own commit on #489's branch, pushed as soon as it lands. All of this goes on #489's branch (the
owner, 2026-11-10).

1. This section.
2. The mod SDK: the schema, `validate`, `build` and the sample pack under `content-packs/`, with tests.
3. The `PackStore` (IndexedDB) and the zip install worker, with tests.
4. The store screen, running from a local `index.json` built from the sample pack.
5. Wiring an installed pack into the pool, the pickers and the engine worker (§7.4). This is the largest step, because
   the app's pool is a constant fixed at build time today.
6. `mc-pack test` (headless smoke games), and the SDK's npm and tarball builds.
7. The registry repo with its check and publish workflows, and the template repo.
8. Once §11.8 is done, switching the catalog address to `packs.<domain>`, then Gwenpool as the first real pack.

### 11.8 The owner's Cloudflare and npm steps

The owner does these steps while the code is built. The code doesn't wait on them.

1. Buy a domain without "Marvel" in it through Cloudflare Registrar, so its DNS is already on Cloudflare.
2. Turn on R2 and create the bucket `mc-packs`. R2 asks for a payment method even on the free tier.
3. In the bucket's settings, connect `packs.<domain>` as its custom domain, and leave the `r2.dev` URL off.
4. Add a CORS policy that allows `GET` and `HEAD` from the site's address and from `http://localhost:5173`.
5. Create an R2 API token with Object Read & Write, scoped to `mc-packs`. Add its values as the Actions secrets
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` on `marvel-champions-mods`.
6. Create an npm organization for the SDK's scope, and a granular token that can publish to it. Add the token to this
   repo as the Actions secret `NPM_TOKEN`.

7. Add the same three R2 secrets to this repo too, and the repository variable `PACKS_BASE_URL`
   (`https://packs.<domain>`), for `publish-packs.yml`, which publishes the packs under `content-packs/` (§11.4).

R2's free tier covers 10 GB of storage, 1 million writes and 10 million reads a month, and egress is free. The 30
community packs come to about 150 to 200 MB (§10), so even every version of every pack stays far under the limit.

### 11.10 Campaigns

A pack may carry campaigns, as data only (no engine change). Each file in `campaigns/*.json` is one `PackCampaign`:

```jsonc
{
  "id": "<pack-id>-<name>", "version": "1", "name": "…", "description": "…", "tagline": "A story in two issues",
  "definition": { /* the engine's CampaignDefinition: campaignId === id, version === version */ },
  "record": { "scenarioIds": ["…"], "campaignSetIds": [], "prohibited": { … } }, // the @mc/content Campaign shape, minus box fields
  "story": { "blurb": "…", "rosterBanner": "…", "issues": [{ "nodeId": "…", "title": "…", "villain": "…", … }], "finale": { … } },
  "art": { "cover": "art/cover.webp" } // a file of the pack, never a base-game picture
}
```

`record.scenarioIds` lists the nodes' scenarios in order; each is a scenario of the pack, a base scenario or one of a
required pack's. `story` mirrors the data fields of the client's `CampaignStory` and `IssueStory` (no art, no
functions); a campaign without one gets the client's plain wording. `validatePack` checks the id (the pack's prefix, not
a base campaign's, `definition.campaignId` and `version` matching), that instruction, log field and node ids are
unique, that every field a step reads or writes is declared, that conditional instruction keys are the instructions'
ids, that every in-game effect and node rule passes the DSL validator (including the `campaignLog` read checks), that
literal card ids and campaign sets resolve, that the definition is plain JSON, and that the story's node ids exist.
`requires.dslFeatures` covers the campaign's instructions too (`campaign:<op>`, `effect:*`, `expr:campaignLog`).

First version limits, each refused with a sentence naming it:

- the graph is `linear` and every node's scenario is `fixed`;
- no market or shop (the `spend` op, Unit Cost filters), no roles, no `composition` (villain or set choice between
  games), `requiredModularSetIds`, set-aside cards or per-seat sets, no log field gated by modes;
- no expert campaign rules (`expertCampaign` gates) and no elimination policy;
- players are base heroes (a custom hero in a campaign is not offered yet).

`mc-pack test` plays each campaign through the real campaign runner with a base precon: between-games setup, a played
game, the result folded into the log, at every node until the campaign ends. A loss is allowed (the loss policy runs, then
a staged win advances the run so later nodes are still covered); an engine error, a stuck game or a campaign that writes
none of its log fields fails. What it cannot cover, and `mc-pack test` says so in its notes: the greedy driver loses even the Core scenarios, so a Defeat block runs only when a game is lost and a node it always wins never runs one; optional between-games choices are declined and every other choice takes its first options; an instruction behind a `when` gate or mode that is false in these runs is not exercised; and after a loss the next node is reached by a staged win (the lost game's own log writes are not folded twice). `failOnAlwaysLost` (off by default, because the driver loses everything) makes a campaign fail when every seed loses at the same node. `content-packs/sample-scenario/campaigns/sample-scenario-crisis.json` ("Clockwork Crisis",
two nodes, a number and a flag written between games and read by a game's setup) is the example. A client lists packs'
campaigns with `packCampaignRecords(packs)`, finds a definition with `packCampaignDefinitionOf(packs, id)` (the campaign
service's `definitionOf`), and builds a node's game with `campaignGameWithPacks(start, packs)`.

## Sources

Prices and quotes were read from these pages on 2026-10-30.

- Cloudflare: [Workers static assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/), [Developer Platform terms](https://www.cloudflare.com/service-specific-terms-developer-platform/), [CDN terms](https://www.cloudflare.com/service-specific-terms-application-services/).
- Netlify: [pricing](https://www.netlify.com/pricing/), [April 2026 credit rates](https://www.netlify.com/changelog/2026-04-14-pricing-updates-april-2026/).
- AWS: [CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/), [S3 pricing](https://aws.amazon.com/s3/pricing/).
- Azure: [bandwidth](https://azure.microsoft.com/en-us/pricing/details/bandwidth/), [Front Door](https://azure.microsoft.com/en-us/pricing/details/frontdoor/), [Static Web Apps](https://azure.microsoft.com/en-us/pricing/details/app-service/static/). The Blob and S3 storage prices are from third-party summaries.
- Others: [Backblaze B2](https://www.backblaze.com/cloud-storage/pricing) (its pages disagree on storage, $6.95/TB against $0.005/GB), [bunny.net](https://bunny.net/pricing/cdn/), [Wasabi FAQ](https://wasabi.com/pricing/faq), [Tigris](https://www.tigrisdata.com/pricing/), [DigitalOcean Spaces](https://www.digitalocean.com/pricing/spaces-object-storage), [Vercel](https://vercel.com/pricing), [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
- jsDelivr's restrictions: [github.com/jsdelivr/jsdelivr](https://github.com/jsdelivr/jsdelivr).
- GitHub release asset limits: [About large files on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).
