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
- **The log in frozen chunks.** Hibernation evicts a room from memory after about 10 s of quiet, which is common
  between moves, so a memory-only log would mean a full re-upload after most pauses, and a log past the 1 MiB WebSocket
  message would never fit one resend. The room stores one row for the header (at `start`/`log`) and one row per
  completed chunk of 20 commands, with the checksums that fall in it, written once when the chunk fills and never
  rewritten. The unfinished tail (under 20 commands) lives in memory and is written to one `t1:tail` row, with its checksums, each
  time the host's socket closes or is replaced, when the game ends, and while the host streams when a batch arrives
  over 60 s after the last write (at most 60 rows an hour; a close in a woken room that has not loaded the table writes
  nothing, so it cannot overwrite the stored tail; overwritten each time; deleted when a frozen chunk
  supersedes it, a rewind cuts it or a `log` replaces the table), so a host who closes the app mid-game leaves
  watchers the log to within about a minute of its last command (a close that lands in a room that has just woken keeps
  the last stored tail, which is at most a minute old; the host's later resend heals the rest). A woken room loads the header and chunks and
  asks the host for the tail with `resend { from: <stored count> }`, answered with an ordinary `commands` batch (or,
  when `from` is 0, a `log` with the header and first commands, then `commands` batches). That is about one row per 20
  commands (rows written are the scarcest free-plan quota, shared with sync and global stats); a rewind deletes the
  chunks past the cut. The meta row holds the host token hash, createdAt, a last-host stamp (written at most hourly,
  for the 12-hour idle rule) and, once, the end and outcome. The whole log is capped (`MAX_ROOM_LOG_BYTES`, 8 MiB of
  commands): past it the room refuses `too-large` and ends the table for watchers. A woken room does not know how far its
  watchers got, so before it takes the host's first batch after loading it sends them `rewind { to: <what it holds> }`,
  and the batch re-appends from there (a refused `rewind` past what it holds asks the host to resend like a refused
  batch). The host is not sent `resend` on `hello` (its `welcome` already carries `hasHeader` and the command
  count); it is sent for an out-of-order batch or rewind and for a watcher joining while the room is unverified.
  Reads: a wake re-reads the header, every chunk and the tail (one row each), not once per watcher join: a 3,000-command
  game is 150 chunks, so a wake costs about 150 rows read, and a game woken 300 times (a pause of over 10 s between
  moves) about 45,000, which the 5 million a day read allowance covers for about 100 such games a day. A joining
  watcher gets the log in
  parts of about 512 KiB (a `log`, then `commands` batches, then `end` when the table ended).
- **WebSocket hibernation.** Incoming WebSocket messages are billed as 1/20 of a request and outgoing ones not at all,
  and a hibernated room costs no duration. A game of about 600 commands an hour costs about 30 Durable Object requests
  an hour, plus a handful per watcher joining.

## 3. Where this is going (Quin, 2026-11-19)

Watching is step one. The next steps are **chat**, then **true multiplayer: several seats at a table and several tables
in one room** (Epic Multiplayer pods, [epic-multiplayer-plan.md](epic-multiplayer-plan.md) option B: one engine per
group plus a pod coordinator). The room is shaped for all of it now so none of it means a new server:

| Step               | Room                                                                      | What it adds                                                                                        |
| ------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1. Watch (this PR) | one table, its host, watchers                                             | the room, the `room` and `game` channels, live viewer, Discord button and count                     |
| 2. Chat            | same                                                                      | `chat` channel (`say`/`said`), display names, per-participant rate limit, a short in-memory backlog |
| 3. Seats           | one table, host plus up to 3 seats, watchers                              | seat tokens bound to a `playerId`, `propose` to the host, `refused`; build match required; no undo  |
| 4. Tables and pods | several tables, a host each, seats, watchers                              | `tables` capability; a pod coordinator's shared state as its own channel, owned by one host         |
| Later              | host migration, lobby/matchmaking, reconnect by seat token across devices |

Rules that keep the growth path open:

- **Participants, not sockets.** Everyone in a room is a participant with an id, a role (`host`, `seat`, `watcher`), a
  table (for host and seat) and later a name. The roster is broadcast; the watcher count Discord shows is read from it.
- **Channels.** Every message is `{ v, ch, kind, ... }` on `room`, `game` or `chat`. Each side ignores what it does not
  know; `hello`/`welcome` swap capability lists (`watch`, `chat`, `seats`, `tables`).
- **Every game message names its table** (`t1` until step 4), so tables are a matter of the room holding a map.
- **Authority stays with each table's host.** The room orders and relays; it never runs or judges a game. A seat's
  `propose` goes to its host, which dispatches it only when the engine's legal actions belong to that seat's player.
- **Tokens, not trust.** The room issues the host token (and later seat tokens) and keeps their hashes; a role comes
  only from a token.

## 4. Protocol (`packages/sync-worker/src/room-protocol.ts`, shared with the client)

HTTP:

- `POST /room`: creates a room with its first table and answers `{ roomId, hostToken, table }`. Rate limited per IP
  (`DEFAULT_ROOMS_PER_IP_PER_DAY`, 20) behind the kill switch `ROOMS_ENABLED`; Turnstile when `TURNSTILE_SECRET` is set.
- `GET /room/:id/ws`: the WebSocket upgrade (origin-checked like every route). The first message is `hello`; a valid
  `hostToken` makes the sender the table's host (a reconnecting host takes its place back and the old socket is closed),
  otherwise a watcher.

Messages (full shapes in the file): client to room `hello`, `start`, `commands`, `rewind`, `log`, `end` (reserved:
`propose`, `say`); room to client `welcome`, `roster`, `table`, `closed`, `refused`, `resend { from }`, `log`, `commands`,
`rewind`, `end` (reserved: `proposal`, `said`). Only a table's host may send its `game` messages.

Limits (vars in `wrangler.jsonc`, documented like the others): `MAX_ROOM_PARTICIPANTS` 25, `MAX_ROOM_MESSAGE_BYTES`
64 KiB (a `start` or `log` up to just under 1 MiB, the WebSocket cap), a room closes 12 hours after its last host
message, or 5 minutes after every table ended; `MAX_ROOM_LOG_BYTES` 8 MiB per table. `hello.name` is ignored until chat.
A `rewind` that cuts an ended table reopens it. `TableInfo` carries `hasHeader` (the room needs `start`/`log` when false).

## 5. Client pieces

1. **Per game, chosen in setup (Quin, 2026-11-19):** "Let people watch this game" in table setup and on the campaign
   Briefing sets `SessionConfig.watchable`; only a watchable game streams, and nothing is spawned or connected until
   one begins. The setting "Always allow watchers" (Settings, More), off by default, only pre-ticks that toggle.
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

## 6. Not in this first step

Chat, seats and proposals, multiple tables, host migration, version-pinned viewers (the web build always being the newest), Turnstile on room
creation (shared follow-up with transfer and sync), and a lobby screen.

## 7. Rooms and playing together: Quin's requirements (2026-11-19)

For the stacked PRs after this one (2: rooms and lobby, 3: play together):

- **Whose turn it is.** Every seated player and watcher sees, in one fixed place, whether it is their own turn (or
  their own decision) or someone else's, and whose.
- **Names.** Joining a room asks for a display name, shown on the seat and the hero it controls.
- **More than one hero per person.** A participant may control several heroes (seats) if the host allows it.
- **Host controls.** The host decides how the game is played: strict rules (the game as written, no adjustments) or
  host control (the host may allow Manual adjust, Undo and other changes, decide on requests to modify something),
  which rules and house rules are on, and which mods (custom packs) are allowed. A request to change something is the
  host's call. These live on the room as host-only settings, shown to everyone in the lobby.
