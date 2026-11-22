# Multiplayer achievements, points and feats (#909): build plan, as built

Status (2026-11-21): built. The player-facing description is in
[`achievements.md`](achievements.md#multiplayer-and-table-feats-909-2026-11-21); this file stays as the build map the
code comments point at (package letters, counter groups). Where code and this file differ, the code is right: Game
Night Host counts standard and Epic room games only (not Competitive), and a hot-seat competitive game earns no
competitive achievement. The owner calls marked provisional there (friends bonus, rank rescale, hot seat, host count)
are not final.

Issue #909 plus bluefireF5ran's "Together" and "Feats" lists (Quin, 2026-11-21: all in). Stats pages (Friends,
Competitive, Epic), unlockable themes and seasonal challenges are later issues.

## Ground rules

- A room game with Cheats on, and any adjusted game (#791), earns nobody points, achievements or stats.
- Watchers earn nothing but Front Row Seat. A device that held no seat in a room game earns nothing from it but
  Game Night Host.
- "Mine" is the seats this device held at the end of the game plus any it took over. In a multi-seat solo game every
  seat is mine, so single-player facts are unchanged. Only room rows narrow to my seats.
- A guest's room game counts toward their own hero's stats like a solo game.
- Competitive games stay "played only": no scenario firsts, hero win rates or global stats. They earn points only
  through the competitive achievements, which read competitive saves through their own facts.

## Achievements

Points follow the existing scale (a feat 50 to 150, a single trophy 25 to 50, a tier 100 to 250, a funny one 0 with a
pack). Sources: S an existing save or summary field; C a new summary counter (package in brackets); R room metadata on
the save row (`SaveMeta.roomPlay`); W the local watch history; E a small additive engine event change.

### Playing together (family `together`)

| id                        | name                       | pts      | source                               |
| ------------------------- | -------------------------- | -------- | ------------------------------------ |
| `room-four-players`       | Assemble!                  | 100      | S + R                                |
| `room-tag-team-10`        | Tag Team                   | 150      | R `friends` (online names)           |
| `room-takeover-away`      | No One Left Behind         | 100      | R `tookOver` reason `away`           |
| `room-takeover-left`      | I Got This                 | 100      | R `tookOver` reason `left`           |
| `room-chat-50`            | Talk It Out                | 50       | R `chatSent`                         |
| `room-strict-5`           | Strict Rules Club          | 100      | S `roomPlayMode` strict / R `strict` |
| `together-avenge-me`      | Avenge Me!                 | 50       | S `summary.seats[i].defeated`        |
| `together-upgrade-given`  | It's Dangerous to Go Alone | 50       | C(A1)                                |
| `together-oops`           | Oops, That One's Yours     | 0, funny | C(A1)                                |
| `together-get-behind-me`  | Get Behind Me!             | 50       | C(A1)                                |
| `together-human-shield`   | Human Shield               | 50       | C(A1)                                |
| `together-combat-medic`   | Combat Medic               | 50       | C(A1) + E1                           |
| `together-alliance-paid`  | Assemble the Wallets       | 50       | C(A1)                                |
| `together-kill-steal`     | Kill Steal                 | 25       | C(A1)                                |
| `together-care-package`   | Care Package               | 50       | C(A1)                                |
| `together-sticky-fingers` | Sticky Fingers             | 50       | C(A1)                                |
| `together-friendly-fire`  | Friendly Fire              | 0, funny | C(A1)                                |

### Epic Multiplayer (family `epic`)

| id                     | name                 | pts | source                       |
| ---------------------- | -------------------- | --- | ---------------------------- |
| `epic-finished`        | Pod Person           | 50  | S `config.epic`              |
| `epic-loki-final-blow` | Shatter the Illusion | 150 | E2 + C(A4)                   |
| `epic-mangog-remote`   | Mangog Hunter        | 100 | E2 + C(A3)                   |
| `epic-door-remote`     | Door Stop            | 100 | E2 + C(A3)                   |
| `epic-three-tables`    | Tables Turned        | 150 | S `config.epic.groupsInGame` |

### Civil War Competitive (family `competitive`)

| id                        | name              | pts | source                  |
| ------------------------- | ----------------- | --- | ----------------------- |
| `competitive-both-sides`  | Pick a Side       | 50  | S `summary.competitive` |
| `competitive-leader-down` | Leader Down       | 100 | S                       |
| `competitive-tie-break`   | Tie-Breaker       | 100 | S                       |
| `competitive-no-you-move` | No, You Move!     | 50  | C(A3)                   |
| `competitive-veteran`     | Civil War Veteran | 250 | S                       |

### Watching and hosting (family `hosting`)

| id             | name            | pts | source |
| -------------- | --------------- | --- | ------ |
| `watch-to-end` | Front Row Seat  | 25  | W      |
| `host-10`      | Game Night Host | 100 | S + R  |

### Feats (family `feats`)

| id                       | name                 | pts      | source              |
| ------------------------ | -------------------- | -------- | ------------------- |
| `feat-full-health`       | Not a Scratch        | 100      | C(A4)               |
| `feat-over-printed-hp`   | Plenty to Spare      | 100      | C(A4)               |
| `feat-surrounded`        | Surrounded           | 50       | C(A2)               |
| `feat-clean-sweep`       | Clean Sweep          | 50       | C(A4)               |
| `feat-case-closed`       | Case Closed          | 50       | C(A4)               |
| `feat-overkill-5`        | Overkill             | 100      | E1 + C(A2)          |
| `feat-minions-8`         | Bloodthirsty         | 100      | C(A2)               |
| `feat-trophy-case`       | Trophy Case          | 100      | C(A4)               |
| `chain-reaction`         | Chain Reaction       | 0, funny | C(A2)               |
| `feat-deck-reset-2`      | Deck Goes Brrr       | 50       | C(A2)               |
| `feat-stun-defeat`       | Stop, Drop and Punch | 50       | C(A2)               |
| `feat-pacifist`          | Pacifist             | 150      | C(A2)               |
| `feat-big-spender`       | Big Spender          | 50       | C(A2)               |
| `feat-full-supports`     | Saving It for Later  | 100      | C(A4)               |
| `feat-ally-final-blow`   | Giant Slayer         | 100      | S `finalBlowCardId` |
| `feat-tough-as-nails`    | Tough as Nails       | 150      | C(A2)               |
| `feat-villain-phase-win` | Come at Me, Bro      | 100      | C(A4)               |
| `feat-lucky-charm`       | Lucky Charm          | 50       | C(A3)               |
| `cursed-boosts`          | Cursed               | 0, funny | C(A3)               |
| `feat-own-obligation`    | Not Today, Life      | 50       | C(A2)               |

## New data

- **Summary counters** (`SUMMARY_VERSION` 7, so the backfill replays older games): a resolving-actor tracker
  (`engine/record-actor.ts`, A0) and one module per group, `record-together.ts` (A1), `record-feats.ts` (A2),
  `record-boosts.ts` (A3), `summary-end-state.ts` (A4).
- **Engine, additive only:** E1 `damageHealed.sourceInstanceId?`, `damageDealt.excess?`; E2
  `SharedPodState.defeatedByGroup?`, a `remotePowerSettled` event in the attacker's group, carrying `defeated`
  (`remotePowerResolved` gets no `defeated?`).
- **Room metadata:** `SaveMeta.roomPlay?: RoomPlayRecord` (`engine/room-play.ts`): role, roomId, gameKey, mode, mySeats,
  friends, tookOver, chatSent, strict, cheats, Epic group/tables, competitive team/side. Host via
  `GameStorage.setRoomPlay`; guests get a finished row of their own (`GameStorage.createFinished`), never offered as
  Continue or rewind. A main-thread `live/room-play-tracker.ts` gathers it.
- **Watch history:** `platform/watch-history.ts`, local `mc-watch-history`, about 200 entries.
- **Fixes:** relay `adjusted` in the live `end` frame; pass `roomCheats` in `epic-start.ts`.

## Work packages

1. E1 (engine events), A0 (record actor, stubs, version), R1 (storage and room metadata).
2. E2 (Epic engine), A1 (together counters), A2 (feat counters).
3. A3 (boost and remote counters), A4 (end-state summary), R2 (room-play tracker).
4. R3 (guest rows), R4 (publisher adjusted, Epic cheats), R5 (watch history).
5. P (points rules and progression doc), H0 (achievements scaffold, my-seat filters), S (stats readers, global upload
   skips guest rows).
6. H1 (together), H2 (Epic, competitive, watching, hosting), H3 (feats).
7. D (docs, changelog).

A code review after each package.
