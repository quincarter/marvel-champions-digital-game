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

The Worker is shaped for all three: routes are grouped by feature (`/transfer`, `/sync`), each feature has its own
Durable Object class (`TransferRoom`, `SyncSpace`), and the rate limiter, CORS and kill switches are shared.

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
