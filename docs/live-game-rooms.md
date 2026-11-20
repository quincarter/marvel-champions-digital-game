# Live game rooms: watching now, multiplayer next

Owner: `multiplayer-netcode-engineer`. Started 2026-11-19 from Quin's ask for a "Watch this game" button on the
Discord presence card, built on the same mechanism live multiplayer will use (PLAN.md Phase 5, "the live relay").

## 0. Ground rule: single player stays offline-first (Quin, 2026-11-19)

Nothing in this work may break single player, and the game must keep working fully offline (on a plane). Online
features are opt-in and lazy: nothing is spawned, fetched or connected until the player picks one. Every online failure
(no network, the Worker down, a room gone) degrades quietly or with a short message, and never blocks the title,
setup, a game, saving or resuming. No single-player path waits on the network. Changes to shared paths keep a test
with the network off.

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

## 8. Rooms and the lobby (issue #880, stacked on #878)

What a player sees:

- **Title → Play online:** "Host a room" or "Join a room". Joining takes a 6-character code (typed, case-insensitive)
  or a link `https://marvel.champions-digital-game.com/#join=<code>` (and `marvelchampions://join/<code>`).
- **Your name:** asked the first time you host or join (a setting, "Online name", changeable later), at most 24
  characters, shown on your seats and in chat.
- **Lobby:** the code and a Copy link button; everyone in the room with their name and role; the seats (one per hero
  the host sets up) with who holds each; chat; the host's settings, read-only for everyone else.
- **Seats:** the host sets the table up with the existing setup flow (scenario, heroes, decks) in room mode; each hero
  is a seat. A participant asks for a seat and the host approves it, or the host gives one out. A participant may hold
  more than one seat only when the host allows it. The host may hold seats too.
- **Host controls** (room settings, host-only, broadcast to all):
  - Play mode: **Strict** (the game as written: no Undo, no Back out, no Manual adjust, no rule changes mid-game) or
    **Host control** (the host may allow Undo/Manual adjust and decides any change request).
  - House rules: the table rules the game already has (`TableRules`), chosen by the host.
  - Mods: which of the host's installed custom packs the game may use; a joiner who lacks one sees which and where to
    get it, and cannot take a seat until they have it at the same version.
  - Several seats per person: on or off.
  - Chat: on or off.
- **Start:** the host presses Start when every seat is held. The game starts on the host's device as a watchable
  game; in this PR seated players follow it as watchers with their seats marked (playing it is #881).
- **Known gap (for #881):** the lobby shows which allowed mods a guest lacks and disables the guest's own Take, but the
  host can still approve a request or give a seat to a guest who lacks a mod. In this PR seated players only watch, so
  nothing breaks; #881, where seats play, must refuse or warn at approval and at Start.
- **A game belongs to one room:** the host's game config carries the lobby's room id (`SessionConfig.room`, left out of
  live headers and replay files like `watchable`); the room worker attaches a game to the hosted lobby only on a match,
  so a later single-player game never joins an old lobby. The room is left when the game hands back to the Title, for
  the host and for a guest leaving the watch.

Room and protocol (built, `packages/sync-worker`; extends `room-protocol.ts`, and a room created without `lobby` behaves
exactly as watching did):

- `POST /room` takes `{ lobby: true }` and also returns a 6-character `code` (the transfer room-code alphabet). A small
  `RoomCode` Durable Object per code (`room-code-store.ts`, migration `v6`) maps it to the room id. `GET /room/code/:code`
  (any case, dashes and spaces ignored) answers `{ roomId }` or 404; it is limited to 60 lookups an hour per IP, a soft limit
  counted in memory (no row; it resets when the limiter object is evicted, and the 31^6 code space is the real defence). A code collision draws another code (8 tries); the directory entry expires with the room: it is created
  with the room's 12-hour idle time plus an hour of margin (so the two alarms never race), the room moves it out whenever its own idle alarm moves out, and the room deletes it
  when it closes (an alarm in the directory drops an entry whose room never came back to say so; a refresh writes a missing entry back for
  the same room). Only the room a code belongs to may refresh or release it. A failing directory call is tried twice and
  then ignored.
- `hello` carries `name` (trimmed, at most 24 code points in a lobby room (a watch room's `hello` may carry up to 32 and ignores it), required in a lobby room: otherwise `refused name-required` and
  the socket closes; other rooms ignore it), `build { appVersion, contentVersion }` and `seatTokens`. Roster participants
  carry their `name` and `build`. A lobby room advertises caps `watch`, `chat`, `seats`.
- The room sends `lobby { code, settings, seats }` after `welcome` to a joiner and to everyone after each change.
  `settings` is `{ playMode: "strict" | "host", tableRules, mods: [{ id, version }], multiSeat, chat, appVersion,
  contentVersion }`; the two versions are the host's build, stamped by the room from the host's `hello` (never taken from a
  `lobby-set`). `seats` is `[{ id, label, holder?, holderName?, requested? }]`, at most 4.
- Host only: `lobby-set { settings?, seats? }` (a kept seat id keeps its holder, requests and token; turning `multiSeat`
  off is refused `multi-seat` while someone holds two), `seat-assign { seat, participant }` (a connected participant; the
  host may also `seat-request` a seat for themselves and it is granted at once), `seat-deny { seat, participant }` (turns
  down a request, or takes the seat from its holder). Participants: `seat-request { seat }`, `seat-release { seat }` (gives
  up a seat or withdraws a request). `LobbySeat` gets a `table` field when several tables arrive (step 4). A request or assignment is refused `build-mismatch` unless the participant's `build`
  equals the host's in both versions (a missing build never matches), `multi-seat` for a second seat while `multiSeat` is
  off, `seat-taken`, `no-such-seat`, `no-such-participant`. Only `bad-message`, `too-large` and `not-allowed` count toward
  the room closing a noisy socket.
- A seat whose connected holder runs a build that is not the host's (restored by token after an update, or the host changed
  build) stays held and is sent with `mismatch: true`; its holder may not act for it until the builds match (the later play
  step enforces that). Restoring by token also obeys `multiSeat`: an extra seat is refused `multi-seat` and stays with its
  old holder.
- Names and chat lines are NFC-normalized, format characters (zero-width, bidi) are removed, controls and line separators
  become spaces, and they are cut by code points; a name needs at least one visible character; an over-long chat line is
  cut to 280, not refused.
- An assignment sends that participant alone `seat-token { seat, token }` (192 random bits; only its SHA-256 is stored).
  A reconnect is a new participant id: `hello { seatTokens: [...] }` puts the sender back in the seats those tokens open
  (the token is the credential, so it also takes the seat from the id the same player held before), and the same token
  keeps working. A disconnected holder keeps the seat (shown with `holderName` and no roster entry) until released or taken
  back by the host; a disconnect withdraws that participant's pending requests.
- Chat: `say { text }` (control characters become spaces, 1 to 280 characters, 1 a second with a burst of 5 per
  participant, `rate-limited` over it, `not-allowed` when chat is off or the room has no lobby) and `said { from, name,
  text, at }` to everyone including the sender. The last 50 lines are kept in memory and sent to a joiner in a
  `chat { kind: "backlog", lines }` message after `welcome` (not when empty or chat is off). No chat is stored, so a room
  that hibernates forgets the backlog.
- A host's `seat-deny` of a pending request sends the requester `seat-denied { seat }` (the request is memory-only, so the
  client otherwise re-sends it after a wake). A lobby room hosts one game after another: the host's `start` on an ended
  table reopens it (a rematch), where any other room refuses it.
- Storage: the existing `meta` row gains `code` and `roomId` (lobby rooms only); settings, seats (holders, requests) and the
  seat-token hashes are one separate `lobby` row, not part of `meta` (which also carries the end outcome and the hourly
  host stamp), written only when the host sets or changes the lobby, a seat's holder changes (assigned, released, taken back, or
  restored by token) or the host's build is first stamped or changes. Pending seat requests are memory only (a woken room
  starts with none; the client asks again), and a participant's lobby messages are rate limited (burst 10, then 2 a second),
  so no loop of requests writes a row. Nothing is written per chat line, join or leave. A socket with 50 soft refusals in
  10 seconds is closed. The cost notes are in `packages/sync-worker/wrangler.jsonc`.
- The room's limits and kill switch are the ones #878 set up.
