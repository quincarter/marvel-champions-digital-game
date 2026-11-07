# Custom content packs: design proposal

Status: **parked by the owner on 2026-10-31, until a domain is chosen (§10).** Proposal, second pass. Nothing here is
built yet. The aim is to agree on the shape before any code lands.

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

A pack's source images are a bundle in `assets/manifest.json`, in a new `pack` group: `pnpm assets:pack pack-<id>`
uploads them like any other bundle, and a plain `pnpm assets:fetch` skips the group, so the app build and a fresh
checkout never download them.

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

## Sources

Prices and quotes were read from these pages on 2026-10-30.

- Cloudflare: [Workers static assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/), [Developer Platform terms](https://www.cloudflare.com/service-specific-terms-developer-platform/), [CDN terms](https://www.cloudflare.com/service-specific-terms-application-services/).
- Netlify: [pricing](https://www.netlify.com/pricing/), [April 2026 credit rates](https://www.netlify.com/changelog/2026-04-14-pricing-updates-april-2026/).
- AWS: [CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/), [S3 pricing](https://aws.amazon.com/s3/pricing/).
- Azure: [bandwidth](https://azure.microsoft.com/en-us/pricing/details/bandwidth/), [Front Door](https://azure.microsoft.com/en-us/pricing/details/frontdoor/), [Static Web Apps](https://azure.microsoft.com/en-us/pricing/details/app-service/static/). The Blob and S3 storage prices are from third-party summaries.
- Others: [Backblaze B2](https://www.backblaze.com/cloud-storage/pricing) (its pages disagree on storage, $6.95/TB against $0.005/GB), [bunny.net](https://bunny.net/pricing/cdn/), [Wasabi FAQ](https://wasabi.com/pricing/faq), [Tigris](https://www.tigrisdata.com/pricing/), [DigitalOcean Spaces](https://www.digitalocean.com/pricing/spaces-object-storage), [Vercel](https://vercel.com/pricing), [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
- jsDelivr's restrictions: [github.com/jsdelivr/jsdelivr](https://github.com/jsdelivr/jsdelivr).
- GitHub release asset limits: [About large files on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).
