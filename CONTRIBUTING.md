# Contributing

Thanks for helping build Marvel Champions: Digital Edition. This guide covers setting up the repo, the checks a change
has to pass, and the conventions the project follows. The roadmap is in the [README](README.md#roadmap), what is playable in
[Current status](docs/project/current-status.md) and how the packages fit together in
[Architecture](docs/project/architecture.md);
the full plan is in [PLAN.md](PLAN.md), and the engineering conventions in [CLAUDE.md](CLAUDE.md).

## Reporting issues

Use the [issue chooser](https://github.com/quincarter/marvel-champions-digital-game/issues/new/choose): there are
templates for a bug report, a feature request and a tested deck request. In the game, Report an issue (the bug icon in
the top bar or on the Title screen) copies or downloads the game log, and the pause menu shows the game's seed, so a
bug can be replayed exactly.

Before filing a rules bug, check the [Rules Reference](mc_rulesreference_v18_compressed.pdf) and
[FFG's rulings](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/).

## Setting up

You need [Node.js](https://nodejs.org/) (>= 22) and [pnpm](https://pnpm.io/) (>= 11.24). [mise](https://mise.jdx.dev/)
is optional: `mise.toml` pins the toolchain and wraps the `pnpm` scripts.

```bash
git clone https://github.com/quincarter/marvel-champions-digital-game.git
cd marvel-champions-digital-game
pnpm install
pnpm dev
```

`pnpm install` also installs the versioned git hooks in `.githooks/` (pre-commit, commit-msg and pre-push).

## Checks

```bash
# Lint, format check, YAML lint, changelog fragments, typecheck, unit tests and build, as one command
pnpm check

# Or one at a time
pnpm lint
pnpm fmt:check
pnpm yaml:lint
pnpm changelog:check
pnpm typecheck
pnpm test
```

- **Lint and format**: oxlint (`.oxlintrc.json`) and oxfmt (`.oxfmtrc.json`, 120 columns, otherwise Prettier
  defaults). The pre-commit hook runs both on staged files. Write code to the width; don't reflow by hand.
- **Unit and scenario tests**: Vitest, colocated as `src/**/*.test.ts`. The full suite is large; locally, run the test
  files your change touches (`pnpm --filter @mc/cards exec vitest run <path>`) and let CI run the rest.

### End-to-end tests

`packages/client/e2e/` is a [Playwright](https://playwright.dev/) suite that drives the client through a real browser
against its own Vite dev server.

```bash
# Install Chromium once
pnpm --filter @mc/client exec playwright install --with-deps chromium

# Run the suite
pnpm e2e
```

It does not run in CI. The pre-push hook runs it on what you are about to push whenever the push changes `packages/`
or `pnpm-lock.yaml`, refuses the push if it fails or if the working tree differs from the commit, and remembers a pass
so the same code is not tested twice. `pnpm e2e:verify` runs the same gate ahead of time. Don't push past it with
`--no-verify`: fix the game or the spec.

### What CI runs

- **CI** (`.github/workflows/netlify-deploy.yml`): lint and format, typecheck, the unit tests in shards, a client
  build, and a Netlify deploy: a preview for each pull request, production for `main`. Its "All checks" job passes
  when everything but the deploy passes, and is the one check the branch ruleset requires.
- **Release on Merge to Main** (`.github/workflows/release-on-merge.yml`): keeps the release pull request current and
  publishes the release when it merges.
- **E2E** (`.github/workflows/e2e.yml`): dispatch only.
- **Deploy the sync Worker** (a job in the CI workflow): deploys `packages/sync-worker` to Cloudflare, production on
  `main` and the staging Worker on pull requests. It skips until the Cloudflare secrets below exist, and "All checks"
  ignores it.

## The save-transfer Worker

Settings → More → Save data → **Send to another device** uploads an encrypted save to a small Cloudflare Worker
(`packages/sync-worker`) and shows a code and a QR code; **Receive** on the other device fetches it once. **Sync across
devices** in the same screen keeps a player's devices in step through the same Worker (`/sync`, one `SyncSpace`
Durable Object per player). The Worker runs on Cloudflare's free plan, apart from the Netlify site, so it can never
bill or take down the game. The design is in [docs/cloud-sync-plan.md](docs/cloud-sync-plan.md) and the format in
[docs/save-data.md](docs/save-data.md).

### Running it locally

No Cloudflare account is needed. In a second terminal next to `pnpm dev`:

```bash
pnpm dev:sync
```

That is `wrangler dev`, which runs the Worker and its Durable Objects on `http://localhost:8787` with local storage
under `packages/sync-worker/.wrangler/`. The client's dev build talks to that address unless `VITE_SYNC_URL` says
otherwise. The Worker's unit tests (`pnpm --filter @mc/sync-worker test`) use an in-memory fake and need neither.

### One-time Cloudflare setup (the owner)

Until this is done the Worker isn't deployed, and the game says online transfer is unavailable and points to Export.

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up). No payment method is needed.
2. Open **Workers & Pages** once and choose a `workers.dev` subdomain. The Workers become
   `https://mc-sync.<subdomain>.workers.dev` (production) and `https://mc-sync-staging.<subdomain>.workers.dev`
   (pull request previews).
3. **My Profile → API Tokens → Create Token**, use the **Edit Cloudflare Workers** template (all accounts or just
   yours, all zones), and copy the token.
4. Copy the **Account ID** from the Workers & Pages overview (right-hand column).
5. In GitHub, **Settings → Secrets and variables → Actions**: add the secrets `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID`, and on the **Variables** tab the variable `CLOUDFLARE_WORKERS_SUBDOMAIN` (just the
   subdomain, without `.workers.dev`).
6. Re-run CI on `main` (or merge anything). The deploy job publishes the Worker, and the next web, Android and desktop
   builds point at it.

Optional: to turn on [Turnstile](https://developers.cloudflare.com/turnstile/) bot checks for uploads, create a
Turnstile widget and set its secret with `pnpm --filter @mc/sync-worker exec wrangler secret put TURNSTILE_SECRET`
(add `--env staging` for the staging Worker). The client doesn't send a token yet, so while it is set transfer uploads fail
and so does setting up or joining device sync (the engine calls createSpace on a first sync); leave it off until the
client side lands.

**Kill switch:** set `TRANSFERS_ENABLED` to anything but `"true"` in `packages/sync-worker/wrangler.jsonc` and deploy
(or edit the variable in the dashboard). Every transfer then answers 503 and the game falls back to its export message.
`SYNC_ENABLED` does the same for device sync: the game then says online sync is unavailable and keeps saving on the
device. Each switch leaves the other feature running, with one overlap: "Link another device" (QR or short code) moves
the recovery code through transfer rooms, so `TRANSFERS_ENABLED=false` stops that linking too (typing the recovery
code on the other device still works).

## Conventions

- **Branches**: `feature/<descriptive-name>` or `bug-fix/<descriptive-name-and-issue-id>`, off `main`.
- **Pull requests**: describe what a player would see, before and after. Include screenshots for UI changes. Anywhere
  the client shows a card face, desktop mouseover should open the card hover popover; show it in the screenshots.
- **Changelog**: every change that lands on `main` carries a [changie](https://github.com/miniscruff/changie)
  fragment. Run `changie new -k <Kind> -b "<one line>"` (kinds in `.changie.yaml`: Added, Changed, Fixed, Engine,
  Content, Docs) and commit the `.changes/unreleased/*.yaml` file with the code. Wait a second between two
  `changie new` calls: fragments are named by kind and timestamp to the second. `pnpm changelog:check` (also run by
  `pnpm check`, the pre-commit hook and CI's "Changelog fragments" check) parses them the way the release job does.
- **Rules accuracy**: the [Rules Reference v1.8](mc_rulesreference_v18_compressed.pdf) in the repo root is the
  authority, then current errata, then FFG's rulings
  ([transcribed here](marvel-champions-rulings-post-rrg-1-7.md)). Community sites are pointers, not authorities. Cite
  the RRG page or ruling in a code comment when behavior is not obvious from the card text, and flag a conflict
  between sources in a comment rather than silently picking one.
- **Architecture**: dependencies point one way, `client → cards → engine → content`. The engine never names a specific
  card; card behavior goes through the ability DSL in `@mc/cards`. The client is a view: game state and move legality
  live only in the engine.

## Card data

Card data is ingested from MarvelCDB and normalized into `@mc/content`:

```bash
# Ingest Core Set card data from MarvelCDB
pnpm ingest

# Re-normalize from the committed offline cache
pnpm --filter @mc/content ingest -- --pack core --offline
```

### Card art in other languages

Card scans are a build input in `assets/card-art/`. A card language other than English is a second set in
`assets/card-art-locales/<lang>/`, saved under the English scans' own paths, which `pnpm card-art:localize --lang es`
fetches and pairs by art (`scripts/fetch_card_art.py`). `MC_CARD_LANG=es` builds the client with that set laid over the
English scans, so a card without a Spanish scan keeps its English one; the build decides this and the app never falls
back at runtime. Each release builds every installer once per language (issue #337).

```bash
# Refresh the Spanish set
pnpm card-art:localize --lang es

# Run or build the client with Spanish card art
MC_CARD_LANG=es pnpm --filter @mc/client dev
MC_CARD_LANG=es pnpm --filter @mc/client build
```

Turning a pack into playable content (data, ability scripts, rules QA, client wiring) follows the per-wave process in
[docs/card-scripting-process.md](docs/card-scripting-process.md) and the wave specs in [`docs/`](docs).

## Releases

Releases are automated. Every merge to `main` regenerates an open `chore(release): vX.Y.Z` pull request from the
unreleased changie fragments. Merging it tags the version, writes `CHANGELOG.md`, and builds and publishes the GitHub
release:

- **Desktop (Tauri)**: macOS for Apple silicon and Intel (`.dmg`, `.app.tar.gz`), Linux (`.deb`, `.rpm`,
  `.AppImage`), Windows 11 (`.msi`, `-setup.exe`).
- **Android (Capacitor)**: a release `.apk`.

Asset names spell out the OS, architecture and installer kind (`MarvelChampions-<version>-Windows-x64-Setup.exe`,
`-macOS-AppleSilicon-arm64.dmg`, `-Linux-x64.AppImage`, `-Android.apk` and so on). Every installer is also built in
Spanish, named with the language after the version (`MarvelChampions-<version>-ES-Windows-x64-Setup.exe`).
`scripts/lib/release-collector.mjs` names them for both the workflow (`scripts/stage-release-assets.mjs`) and local
builds, and every release's notes end with the table in `.github/release-downloads.md`. The README's download buttons name
the version they fetch and link to that release's files; the release PR updates both through the `replacements` in
`.changie.yaml` (the README links and the version on each `.github/assets/readme/download-*.svg`). A release is marked latest
only after every installer has been uploaded, which is what the apps' update notice
(`packages/client/src/platform/update-check.ts`) reads.

Every release thanks the people behind it. `scripts/release-credits.mjs` reads GitHub for the issues a release fixes
and the pull requests it merges, and the release notes and release PR get a **Special thanks** section that
@-mentions each reporter and code contributor (the repository owner and bots are left out). The release PR also
refreshes the README's Special thanks lists with avatars. The Watchers are reporters with at least two issues closed as
done (a bug fixed or a feature built, by anyone; `watcherMinimum` in `.github/credits.json`), and the Committers are
everyone with a merged pull request, led by `pinnedContributors` (the maintainer). People GitHub can't see, such as a bug sent on Discord or through the in-game
reporter, go in `.github/credits.json`.

`mise ship-it` (or `pnpm ship-it`) builds and stages the native packages locally.

### macOS signing

The `.dmg` is signed and notarized only when these repository secrets are set: `APPLE_CERTIFICATE` (a Developer ID
Application `.p12`, base64-encoded), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` (for example
`Developer ID Application: Name (TEAMID)`), and for notarization `APPLE_ID`, `APPLE_PASSWORD` (an app-specific
password) and `APPLE_TEAM_ID`. Without them the app is unsigned.

## License

By contributing, you agree that your contributions are licensed under the project's
[GNU Affero General Public License v3.0 or later](LICENSE). Card text, rules, artwork and characters belong to Fantasy
Flight Games and Marvel and are not covered by that license.
