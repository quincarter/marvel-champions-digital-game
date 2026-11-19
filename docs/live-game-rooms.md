# Live game rooms: watching now, multiplayer next

Owner: `multiplayer-netcode-engineer`. Started 2026-11-19 from Quin's ask for a "Watch this game" button on the
Discord presence card, built on the same mechanism live multiplayer will use (PLAN.md Phase 5, "the live relay").

## 1. The idea in one paragraph

A **game room** is one Durable Object per live game on the sync Worker. The player whose device runs the engine is the
room's **host**. The host streams the game's log into the room (the starting state once, then each command as it is
dispatched), and the room fans it out over WebSockets to everyone else in it. The engine is deterministic
(`applyCommand` is pure, the RNG lives in the state), so the log is the whole game: a **watcher** rebuilds every
position with the replay machinery that already exists (`replay/`). Live multiplayer is the same room with one more
role: a **player seat**, a watcher that may also propose commands. The room forwards a proposal to the host, the host's
engine judges it, and an accepted command comes back out of the room in order to every seat and watcher. The host stays
authoritative, the room only orders and relays, and nobody else runs a different game.

## 2. Why this shape

- **Host-authoritative over a relay, not engine-in-the-Worker.** The engine plus the card scripts and pool is far past
  the Workers Free bundle limit, and the free plan allows 10 ms of CPU per request, less than some villain phases take.
  The worker-host already acts as a local server (PLAN.md Phase 4 note: "a network host can replace it without
  changing the client"); the room is the network between that server and remote clients.
- **The log, not snapshots.** A command is a few hundred bytes; a state is hundreds of KB. Watchers and seats rebuild
  from the log the same way a resumed save and a replay do. A divergence (another build's card scripts) is caught by
  the replay checksums (`replay-file.ts`, every `CHECKSUM_EVERY` commands), which the host sends along.
- **No durable log in the room.** The host always holds the full log, so the room keeps it in memory only and, when it
  wakes from hibernation with an empty memory (or a watcher joins while it is empty), asks the host to send it again.
  That keeps the room at zero storage rows per command (rows written are the scarcest free-plan quota, shared with sync
  and global stats). The room stores one meta row when it is created (host token hash, expiry) and nothing else.
- **WebSocket hibernation.** Incoming WebSocket messages are billed as 1/20 of a request and outgoing ones not at all,
  and a hibernated room costs no duration. A game of about 600 commands an hour costs about 30 Durable Object requests
  an hour, plus a handful per watcher joining.

## 3. Protocol (`packages/sync-worker/src/room-protocol.ts`, shared with the client)

Versioned JSON messages (`v: 1`). All messages are size-capped by the room.

HTTP:

- `POST /room` (host): creates a room. Rate limited per IP (20 a day) and globally (kill switch `ROOMS_ENABLED`).
  Answers `{ roomId, hostToken }`. `roomId` is 72 random bits, like replay ids; `hostToken` is a secret only the host
  holds (the room keeps its SHA-256).
- `GET /room/:id/ws` (upgrade): joins. `?role=host&token=…` for the host, otherwise a watcher. The room refuses a
  second host connection only after the first one closed, so a reconnecting host takes its seat back.

Host to room:

- `start { header }`: `header` is the replay file's header fields (writer, config without deck names, pack refs,
  createdAt) and `initialState`. Sent on connect, and again when the room asks.
- `commands { from, commands, checksums? }`: commands `from..from+n-1`; the room drops a batch that does not continue
  its log and asks for a resend.
- `rewind { to }`: a single-player Undo or Back out truncated the log (never in a multiplayer room, PLAN.md: no undo in
  a live game).
- `end { outcome }`: the game is over; the room tells watchers and closes after a grace period.

Room to watchers (and later seats):

- `log { header, commands, checksums }` on join: the whole log so far.
- `commands`, `rewind`, `end` as the host sent them, in order.
- `presence { watchers }` whenever the count changes.
- `host-away` / `host-back` when the host's socket drops or returns.

Room to host:

- `presence { watchers }`.
- `resend` when the room's memory is empty or a batch did not line up.

Multiplayer, later (not built in this PR, reserved in the protocol):

- `POST /room/:id/seat` with the host's approval gives a seat token bound to a `playerId`.
- Seat to room: `propose { command }`; room to host: `proposal { seat, command }`; the host dispatches it only when the
  engine's legal actions are addressed to that seat's player, then streams it out as a normal `commands`. A refused
  proposal goes back to that seat alone as `refused { reason }`.
- Every seat must match the host's `writer.contentVersion` and build; a mismatch is refused at join (watchers are let in
  and told when the game plays out differently here, as a replay is).

Limits (env vars, documented in `wrangler.jsonc` like the others): `MAX_ROOM_WATCHERS` 25, `MAX_ROOM_MESSAGE_BYTES` 64 KiB
(the first `start`/`log` may be up to 1 MiB, WebSocket's own cap), a room expires 12 hours after its host last sent.

## 4. Client pieces

1. **Setting:** "Let people watch my games" (Settings, online section), off by default. Nothing connects while it is
   off.
2. **Live publisher:** a `live-room` worker owns the WebSocket (main thread only posts events, per the offload rule).
   The engine worker sends it the header at game start and each command as it is applied, over a `MessagePort`, the way
   it feeds the presence worker. It creates the room on the first command of a game, reconnects with backoff, and
   answers `resend`. It posts the room's watch link and watcher count back to main and to the presence worker.
3. **In game:** a small "watching" badge with the count on the board's top bar while anyone is watching, and "Copy
   watch link" in the pause menu while the room is open.
4. **Watch link:** `https://marvel.champions-digital-game.com/#watch=<roomId>` (desktop and phone apps link to the web
   version, as replay links do). Boot reads it like `#replay=`, opens replay mode on a **live source**: the replay
   backend takes appended commands and rewinds, and the transport follows the newest position unless the viewer has
   stepped back ("Live" button jumps back). Ended games become ordinary replays. Hand cards stay hidden the way a
   replay shows them.
5. **Discord:** while the room is open the presence card gets a second button, "Watch live", and the state line ends in
   "· N watching" when N > 0. (Discord hides your own buttons from you; checking it needs a second account.)

## 5. Not in this first step

Seats and proposals, host migration, version-pinned viewers (the web build always being the newest), Turnstile on room
creation (shared follow-up with transfer and sync), and a lobby screen.
