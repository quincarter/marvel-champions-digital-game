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

1. **Transfer (this step).** Settings → Save data → Send to another device shows a 12-character code and a QR code;
   the other device enters or scans it and gets the whole save once, end-to-end encrypted, within 15 minutes. One-way
   and one-shot, like Export/Import without the file. Format and security in [docs/save-data.md](save-data.md).
2. **Sync with "Link devices".** Devices link once with a code like step 1's and then keep one encrypted copy in
   step with each other, with no login. Linking hands over a sync key; a printable **recovery code** brings the save
   back on a new device if every linked one is lost. The server still stores only ciphertext. Needs a merge rule per
   store (the save file's records already carry their keys and timestamps) and a Durable Object per linked group.
3. **Multiplayer relay.** The same Worker relays online co-op: a Durable Object per table passes the host's engine
   commands to the other seats over WebSockets (hibernatable, so idle tables cost nothing). The engine stays
   authoritative on the host; the relay only forwards. See PLAN.md's multiplayer phase.

The Worker is shaped for all three: routes are grouped by feature (`/transfer` now), each feature has its own Durable
Object class, and the rate limiter, CORS and kill switch are shared.
