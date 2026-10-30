# Cloud saves plan

Issue [#276](https://github.com/quincarter/marvel-champions-digital-game/issues/276) asks for saves that follow a
player between devices. The game has no accounts and keeps everything on the device
([docs/save-data.md](save-data.md)); the plan keeps it that way and adds a small online service beside it.

## The service

One Cloudflare Worker, `packages/sync-worker`, with Durable Objects for state, on Cloudflare's **free plan** and on its
own `workers.dev` address, apart from the Netlify site. The game never depends on it: if it is down, switched off, or
over its daily allowance, the game says so and Export/Import still work. A free account has no billing to run up, and
going over a limit fails requests for the rest of the day rather than charging. Owner setup is in
[CONTRIBUTING.md](../CONTRIBUTING.md#the-save-transfer-worker).

Free-plan limits that matter here (Cloudflare's published numbers, October 2026):

| Limit                   | Free plan                | What it means for us                               |
| ----------------------- | ------------------------ | -------------------------------------------------- |
| Worker requests         | 100,000 a day            | a transfer is two requests (send, receive)         |
| Durable Object requests | 100,000 a day            | each transfer touches a room and a rate limiter    |
| Durable Object storage  | 5 GB, SQLite-backed only | uploads are ≤ 2 MB and live ≤ 15 minutes           |
| Durable Object duration | 13,000 GB-s a day        | rooms wake briefly on upload, fetch and alarm      |
| Worker CPU time         | 10 ms a request          | the Worker only copies bytes; crypto is on devices |

## Steps

1. **Transfer (done, #340).** Settings → More → Save data → Send to another device shows a 12-character code and a
   QR code; the other device enters or scans it and gets the whole save once, end-to-end encrypted, within 15
   minutes. One-way and one-shot, like Export/Import without the file. Format and security in
   [docs/save-data.md](save-data.md).
2. **Sync across devices (this step).** Described below.
3. **Multiplayer relay.** The same Worker relays online co-op: a Durable Object per table passes the host's engine
   commands to the other seats over WebSockets (hibernatable, so idle tables cost nothing). The engine stays
   authoritative on the host; the relay only forwards. See PLAN.md's multiplayer phase.

4. **Global win rates (done, #542).** Opt-in, anonymous results from finished games. Described at the end of this
   page.

The Worker is shaped for all of these: routes are grouped by feature (`/transfer`, `/sync`, `/global`), each feature has
its own Durable Object class (`TransferRoom`, `SyncSpace`, `GlobalStats`), and the rate limiter, CORS and kill switches
are shared.

## Step 2: sync across devices

**For the player.** The title screen asks once, "Set up cross-device sync?" (Set up, Join with a code, Not now; the
same controls live in Settings → More → Save data → Sync across devices). Setting up shows a 25-character **recovery
code** once, which the player must acknowledge. Another device joins by scanning a QR code, typing a short link code
(15 minutes, one use) or typing the recovery code. From then on saved games, decks, campaigns, unlock picks and
progress stay in step with no login. Several games can be in progress at once; the title lists them with the platform
each was last played on (web, Windows, macOS, Linux, Android, iOS), and Continue picks up the newest, first pulling
that game's latest moves from the other devices. If both devices played the same game separately, the game asks
which copy to keep: this device, the other device, or both as two saved games (not offered for campaign games, where
two attempts at one node would be ambiguous). A prompt about a game other than the one on the table waits until the
player leaves the table. Unlink and Delete cloud data are in the same screen.

**How it works** (code in `packages/client/src/sync/`, server in `packages/sync-worker/src/sync-*.ts`):

- Everything a device needs derives from the recovery code with HKDF: the space id, a bearer token (the server stores
  only its SHA-256), an AES-GCM key for contents and an HMAC key for record names. The server stores records it can't
  read under names it can't read.
- Local IndexedDB stays the source of truth. Sync maps it to small records: per saved game a meta, a baseline and the
  command log in chunks of 64; one record per deck, campaign and other store row; one per synced `mc-*`
  localStorage key. Per-device keys (display settings, window, update and break-time state) stay local.
- Pull, merge, push: a single version counter per space orders every change. Last write wins for most records; a
  game's log merges when one side extends the other and otherwise asks the player; unlock picks merge (union). The
  game open on this device is never overwritten.
- When: on app open, when the app comes back to the foreground, a few seconds after a move or an edit (sooner at the
  end of a turn), when the app goes to the background, and from Sync now. Offline just queues; sync never blocks play.

**Mixed versions.** The web updates at once while the desktop and Android shells lag, so linked devices routinely run
different builds. We don't force lockstep; the rule is that an older build never damages what a newer one wrote.
Every game's meta records the app version and card-pool fingerprint that last wrote it (`lastPlayedOn.appVersion` /
`contentVersion`, additive, no `SAVE_SCHEMA` bump), and every sealed record carries `w: { app, content }` and, for a
`db:` record, `d`, the writer's database version (records without them are fine). The older build:

- never replays, appends to or marks incompatible a game a newer app wrote (a newer `SAVE_SCHEMA` is treated the same
  way): it throws "This game was saved by a newer version. Update the game to continue it.", Continue skips it, and the
  title list shows the row as "Played on a newer version: update to continue" with no Resume. It still syncs the game
  down (that is fine) but pushes nothing for it, except Remove (a status-only retirement cannot damage the newer
  build's data, so the other devices see it). A game this build also played, while a newer build played on elsewhere,
  is an ordinary conflict: the player is asked (keep this device, the other, or both; not both for a campaign game).
  The web ships ahead of a release, when `CLIENT_VERSION` has not moved, so a game also records the card-pool
  fingerprint and build commit that wrote it: a game that fails to replay and was written by a different pool, commit
  or newer app is left untouched with the same "update to continue" message, and only one written by this very build
  (or by no stamped build) is marked incompatible;
- keeps a `db:` record whose database version, or whose store, is newer than its own untouched: parked, not applied,
  not dropped, not overwritten by its pushes, and fetched again after an update;
- when both sides changed a deck, campaign or other `ls:` record and the remote writer is a newer app, takes the newer
  writer's record and overwrites its own local edit (not pushed); a record only it changed pushes normally. Unlock
  picks (`ls:mc-unlocks`) keep their union merge even then (the owner's decision: no silent loss of picks);
- tells the player in the Sync status line, after the sync time ("Synced 2 min ago · Another device has a newer
  version of the game"), but only when a run actually withheld something (a push it did not make, or a remote change it
  did not apply).

Builds from before this guard (for example #340's) know none of it and can still mark a newer game incompatible; that
is a local mark that syncs as active, so the newer devices keep the game, but it cannot be prevented there.

**Limits on the free plan.** Each space holds up to 10 MiB. Per IP: 3 new spaces a day, 5,000 storage rows written a
day, and 300 sync requests in 10 minutes; per space: 60 pushes and 1,500 record writes an hour. A push writes about
2-3 storage rows per changed record, so a typical session costs around 15 rows; the account's 100,000 rows a day
serve a few hundred active players. A space untouched for a year is deleted. `SYNC_ENABLED` in `wrangler.jsonc` is the
kill switch; the game then says online sync is unavailable and keeps everything on the device.

**Known limit: finished games accumulate.** A game can only be marked abandoned, never deleted, so won, lost and abandoned games stay in the space and count toward the 10 MiB. Removing decks frees space; a future change can prune old finished games.

**The short link code: a tradeoff the owner accepted (2026-10-22).** "Link another device" shows a QR code whose key
is about 109 bits, plus a typed code: 8 characters naming a transfer room and 8 digits of key (about 27 bits), valid
for 15 minutes and one use, deleted after 5 wrong tries. Outsiders get at most those 5 guesses. Whoever runs the
Worker, though, holds the proof and the ciphertext during those 15 minutes and could try every 8-digit key offline,
which would reveal the recovery code and so lasting access to that player's space. The owner accepted that for game
saves. The QR link and the recovery code don't have this weakness, and a player who wants to avoid it can always use
them.

## Global win rates

**For the player.** Your stats' Heroes, Villains and Encounter tabs have an Everyone / You toggle, and the deck
builder's Against list can read everyone's winning decks. Reading those numbers needs no consent and sends nothing about
the player. Contributing to them is opt-in: off by default, asked once with an explanation of exactly what is sent, and
changeable in Settings. Consent is per device, in a local key that sync does not carry: a device that has opted in also
sends a finished game that syncs onto it from another device, because the save does not say which device finished it.

**What is sent, after each game finished once opted in:** the villain's name, the difficulty, the modular set ids, each
seat's hero, aspects and deck card ids, the result and the loss cause. Nothing else: no sync space id, no device id, no
player or deck names, no save id, no seed, no timestamps. The contract is
`packages/sync-worker/src/global-protocol.ts`, and a client test pins the exact fields.

**Counted once.** A result's id is a SHA-256 of a fixed prefix and the game's save id, cut to 32 hex characters. The same
game synced to two devices counts once, and the id cannot be tied back to the save. The Worker keeps seen ids in monthly
buckets and drops any older than the month before, and the client never sends a game over 30 days old, so a late retry
cannot count twice. A conflict resolved by "keep both" does make a new game. The rate limiter holds an IP for a day, as it does for
sync. The Worker stores no IP with a result and no time per game beyond the month bucket, and logs nothing from a request.

**How it works** (client in `packages/client/src/global-stats/`, server in `packages/sync-worker/src/global-*.ts`). One
`GlobalStats` Durable Object, named `global`, keeps one row per villain, modular set and hero, and one row per villain
of deck cards. Rows with fewer than 20 games are never served, and a card in fewer than 3 decks is left out. `GET
/global/stats` serves a stored summary rebuilt at most hourly, so a read costs one row. The client caches answers for
six hours and keeps a stale copy; nothing is asked for until a screen needs it.

**Limits on the free plan.** A game writes about 6 rows and at worst 20, plus about 2 in the caller's rate limiter. A
repeat writes none. Per IP: 60 results a day and 120 reads an hour; reads write no rows. Across everyone: 3,000 results a
day. On the worst day that is about 81,000 of the 100,000 daily rows, the monthly clean-up of old ids included (one
small step every 10 minutes). `GLOBAL_STATS_ENABLED` in `wrangler.jsonc` is the kill switch: every `/global` route
answers 503.

**Only real content takes a row.** `packages/sync-worker/src/global-allowlist.ts` lists every villain, modular set and
hero, generated from the card pool, and the Worker refuses a result naming anything else, so made-up ids cannot add rows
or reach a player. A client test fails when the list is stale and prints the command to regenerate it. One limit
remains: deck card ids are not checked, since they cost no rows and a card row has a byte cap, so a forged id can sit in
one until it is pushed out. A game against several villains counts for each of them, so a joined name never takes a row.

The game never depends on any of this. With the Worker down, uploads wait for a later launch without a word, and the
Everyone toggle says the numbers are unavailable.
