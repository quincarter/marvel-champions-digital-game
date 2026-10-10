# Epic Multiplayer Mode plan (Loki, God of Lies)

Status: plan only, no code. Written 2026-10-09 for the Multiplayer phase (PLAN.md Phase 5).

Decision (owner, 2026-10-09): wave 9 ships **Single Group Mode** only. Epic Multiplayer Mode is executed in the
Multiplayer phase. Wave 9 builds the engine and DSL groundwork it can now, so Epic later adds groups and pods without
reshaping card scripts (section 3).

Sources. "Insert" is `docs/campaign-modes/markdown/mc55_trickster_takeover.md` (the Trickster Takeover insert, page
numbers are the insert's own). "Reminder" is the Epic Multiplayer Reminder card and "Shatter" the Shatter the Illusion
card, both transcribed in `docs/phase7-wave9-handoff.md`. "Ruling" is
`marvel-champions-rulings-post-rrg-1-7.md`. Card text is in `packages/content/src/data/tt/cards.ts`.

## 1. The rules of Epic Multiplayer Mode

### 1.1 Shape of the mode

- Two ways to play: "a single group of 1-4 players in Single Group Mode, or with any number of players split into
  groups of 1-4 players each in Epic Multiplayer Mode." In Epic "multiple groups fight one Loki, God of Lies together
  while facing off against their own Avatar of Loki versions in their group's game area." (Insert p. 9.)
- A **group** is "1 to 4 players who work as a team to fight the villain in their game area". A **pod** is "a
  collection of groups who can help each other through specific card abilities to defeat Loki, God of Lies". An event
  often has several pods, "each working together to take down Loki". (Insert p. 13.)
- Pod size: the organizer decides it before the game and tells players who is in which pod. Recommended maximum is 12 to
  16 players, "roughly 3 to 4 groups". Uneven groups and pods are allowed; divide evenly "to ensure a consistent
  experience". (Insert p. 13; the Reminder card says the same.)
- Each group needs its own copy of the scenario pack, and one person is the **event organizer**. (Insert p. 11.)

### 1.2 Setup

Per pod or per game (the insert says "one group puts", see Q1 for whether a pod has its own Loki):

- One group puts its Loki, God of Lies villain, his hit point dial and its Worlds Collide main scheme in "a neutral
  game area that is outside of any group's game area". Loki starts at 20 hit points, with the per-hero icon in that
  value "counting the total number of players in the game across all groups". All other groups' copies of Loki and
  Worlds Collide are removed. (Insert p. 11.) Card text agrees: "Each [per_hero] icon on Loki, God of Lies counts the
  total number of players in all game areas." (Worlds Collide 55028b.)

Per group (insert p. 11):

- Set up its game area per the normal Rules Reference setup.
- Four different villains with the Avatar of Loki trait, one hit point dial shared among them, one Mischief and Mayhem
  main scheme, one encounter deck.
- Follow the instructions on Mischief and Mayhem (1A).
- Each group chooses its own difficulty: "one group may play in expert mode, while other groups play in standard
  mode". (Insert p. 12.) Loki's When Revealed (55027b) is per group and per difficulty: "Each group in standard mode
  attaches their set-aside Intense Focus ... Each group in expert mode flips their Intense Focus attachment to its
  Total Focus side."

### 1.3 Shared across groups, and per group

| Thing                                                                                | Scope                                  | Source     |
| ------------------------------------------------------------------------------------ | -------------------------------------- | ---------- |
| Loki, God of Lies villain and his hit points (20 per player in the game, all groups) | one per game (see Q1)                  | p. 11      |
| Worlds Collide main scheme and its threat (target 2 per group)                       | one per game (see Q1)                  | pp. 11, 21 |
| Event organizer and time limit (default 180 minutes)                                 | one per game                           | pp. 14, 16 |
| Avatar of Loki villains (four), their shared hit point dial                          | per group                              | p. 11      |
| Mischief and Mayhem main scheme                                                      | per group                              | p. 11      |
| Encounter deck and discard                                                           | per group                              | p. 11      |
| Difficulty                                                                           | per group                              | p. 12      |
| Synergy environments, shatter counters on the Avatar                                 | per group                              | pp. 17-18  |
| The Mangog and Door Between Worlds, once in play                                     | in one group's area, usable by its pod | p. 16      |

Loki and Worlds Collide "can only be affected by abilities and game effects in other game areas that refer to them by
title", not by "the villain" or "the main scheme", and Worlds Collide cannot have acceleration tokens. (Insert p. 18.)

### 1.4 The per group icon

- On a card in a group's game area, the icon "multiplies the value it is next to by the number of groups in the
  respective pod". On a card not in a group's game area (Worlds Collide), it multiplies "by the total number of groups
  in the game". (Insert p. 4.)
- The Reminder card words the first case differently: "the number of groups that began the scenario in that pod". The
  difference matters once a group drops or finishes (Q2).
- In Single Group Mode the multiplier is 1 (insert p. 10: "the only group in your pod is your own group").
- Cards carrying it today: Door Between Worlds starting threat 7 per group (55046), The Mangog hit points per group
  (10, `hpPerGroup`), Worlds Collide target threat 2 per group (55028b). Worlds Collide's text also says "Each
  [per_group] icon on this scheme counts the total number of groups in all pods."

### 1.5 Every rule or card that reaches across game areas

Default (insert p. 12): "Unless explicitly stated otherwise, cards and components in one game area cannot affect
another game area. Players cannot attack or defend enemies in other game areas, and they cannot target any game elements
in other game areas." The explicit exceptions:

1. **Damage to Loki.** "There is only one way for players to deal damage to Loki, God of Lies: attempt to defeat an
   Avatar of Loki villain in their game area." The defeat puts 5 shatter counters on the Avatar, it flips to Fading
   Figment, and Shatter step 1 removes the counters and deals that much damage to Loki. The group must "immediately
   inform the event organizer". (Insert p. 20; Shatter card.)
2. **Threat on Worlds Collide.** Two sources: a group's Mischief and Mayhem reaches its target threat (first Forced
   Interrupt), and an identity in that group is defeated (second Forced Interrupt). Each is reported to the organizer.
   (Insert pp. 15, 21.)
3. **Loki flips at 10 remaining hit points** ("total players across all groups in all pods"): the organizer informs
   everyone, "each group should pause gameplay activity in their game area, first finishing any actions or abilities
   that are currently resolving", then Loki's When Revealed "triggers, affecting all groups simultaneously"; a group
   resumes when it finishes resolving it. (Insert p. 20.)
4. **The Mangog (minion) and Door Between Worlds (side scheme).** "Any player in your pod can attack The Mangog as if
   it were in their game area" and "can thwart Door Between Worlds as if it were in their game area". When Defeated:
   "Each group in your pod places 3 shatter counters on their Avatar of Loki and 1 synergy counter on one of their
   Synergy environments." The group where it entered play should tell its pod and the organizer, who may track its
   hit points or threat for all. (Insert p. 16; cards 41 and 46.)
5. **Synergy counters.** Encounter abilities "may allow players to choose a group within their pod, then put a number
   of synergy counters on one of that group's Synergy environments". Cross-group communication is "highly encouraged".
   (Insert p. 17.) In the card data this is the When Defeated on Laufey and the other minions, and the When Revealed on
   the four Fading Figments ("synergy counters ... equal to the number of players in their group").
6. **Win and loss.** Both span all groups (section 1.6).

### 1.6 Timing and sync between groups

- Groups play **simultaneously and independently**: "some groups may progress through their rounds faster than others,
  and that's okay; there is no need to wait until all groups have reached the same point in the round". (Insert p. 12.)
  There is no lockstep and no shared round counter.
- The insert notes a group can slow down to "game the system" to prevent a loss; there is no penalty, it is left to
  sportsmanship. (Insert p. 12.) The time limit (default 180 minutes, organizer may change it) is the only clock.
  (Insert p. 16.)
- The only forced sync points are the two broadcasts above: Loki flipping (pause, finish what is resolving, resolve
  When Revealed, resume) and Worlds Collide reaching its target (a group mid villain phase finishes the ability
  resolving and stops at once; a group mid player phase finishes that phase). (Insert pp. 20, 21.)

### 1.7 Win, loss, elimination

- **Win:** "If Loki, God of Lies is defeated before all player phases in all groups end, all players in all groups win."
  Loki's own text: "If Loki, God of Lies is defeated, all players in all groups win the game." (Insert p. 21; 55027b.)
- **Loss (pod/game):** "if Loki, God of Lies remains undefeated when all player phases in all groups end, all players
  in all groups lose." Worlds Collide reaching its target threat ends villain-phase play and lets player phases finish,
  so the loss lands when every group's current player phase ends. Completing the stage also reads "the players lose the
  game" (55028b). (Insert p. 21.)
- **Group loss:** the insert gives no separate group loss. A group whose players are all defeated feeds threat to
  Worlds Collide for each defeated identity (insert p. 21) and the whole game is lost or won together.
- **Player elimination:** a defeated identity places threat on Worlds Collide (second Forced Interrupt on Mischief and
  Mayhem). The insert says nothing about a group with no players left continuing (Q4).
- **Difficulty:** per group (section 1.2).

### 1.8 Rules ambiguities (each with a recommended default)

- Q1. Does each pod have its own Loki and Worlds Collide, or is there one per whole game? The insert says "one group
  puts their Loki" in setup but "total players across all groups in all pods" and "pods ... each working together to
  take down Loki" (pp. 11, 13, 20, 21). (a) One Loki and Worlds Collide per game, all pods share; (b) one per pod.
  Recommended: (b), matching "each pod working together to take down Loki" and the pod-scoped cards. Make the
  coordinator pod-scoped, so (a) is a pod of all groups.
- Q2. Per-group multiplier when a group drops or finishes: groups that began the scenario (Reminder card), or groups
  currently in the pod (insert p. 4)? Recommended: groups that began, fixed at setup (the Reminder card is the later
  summary and a fixed count keeps hit points and threat from changing mid-game).
- Q3. Do the per-hero count (Loki's 20 per player) and the Worlds Collide target (2 per group) count groups and players
  in the pod or the whole game? Insert p. 20 says "in all pods". Recommended: whole game if Q1 is (a), pod if (b).
- Q4. Can a group continue once all its players are defeated? Recommended: no; the group is finished, its threat
  contribution is already on Worlds Collide, and the pod continues.
- Q5. When Loki flips, does a group that has already finished (all players out) resolve When Revealed? Recommended:
  no, finished groups are skipped.
- Q6. A group takes the final Loki damage while another is mid-villain-phase: the win is immediate for all. Recommended:
  yes, stop at the next command boundary (not mid-ability).
- Q7. Is "Fading Figment" and the Shatter step 3 ("Deal each player 1 facedown encounter card") per group? Recommended:
  each player in that group only (the other groups' players are in other game areas).
- Q8. Does a group in standard mode and a group in expert mode that share a pod change the shared Loki's numbers?
  Recommended: no; difficulty modifies only that group's own area.

## 2. Architecture options

The engine is deterministic, with plain serializable state (including its `rng`), and a game is a command log that
replays to the same state. A pod must keep that property.

### Option A: one engine state holding all groups

One `GameState` with `groups: GroupState[]`; every zone, instance and phase counter becomes group-scoped.

- Pros: Loki damage and Worlds Collide threat are ordinary state changes; one log, one replay, one save.
- Cons: the engine assumes one phase/round clock, one active player, one villain and one encounter deck. Groups run at
  independent paces (insert p. 12), so we would need N phase machines inside one state, N interleaved command streams
  and a defined order for commands from different groups. Every query that walks "all players" or "the villain" needs
  a group filter, which reshapes the whole engine and every card script. A hot-path change on 3 to 4 groups of up to
  16 players makes state copies several times larger (the worker copy is about 205 KB for 4 players today).
- The shared log serializes groups that the rules say never wait for each other, so one slow group's command latency
  would block reading others' commands.

### Option B: N independent engine instances plus a pod coordinator

Each group is an unmodified single-authority game (its own state, rng seed and command log). A small **pod
coordinator** owns the shared state (Loki hit points, Worlds Collide threat, pod outcome, per-group status) and
connects groups through events.

- A group emits a typed **outbound event** when something crosses areas (`lokiDamaged`, `worldsCollideThreat`,
  `mangogEntered`, `synergyOffer`). The coordinator updates shared state and returns **inbound** events
  (`lokiFlipped`, `podWon`, `podLost`, `synergyGranted`) which the group applies as a new command type
  (`externalEvent`, section 3).
- Every inbound event is recorded in the receiving group's own log, as a command, at its position in that log. A group
  therefore replays alone, with no network and no coordinator, which preserves determinism: its log is a complete
  record of its inputs.
- Pros: reuses the engine as built; independent pace falls out naturally; a single-group game is the pod of one, with
  the same path (matches the netcode rule that solo is a 1-player session, here a 1-group pod); a group can finish,
  drop or crash without touching the others.
- Cons: two logs to keep consistent (group logs and the coordinator log), and cross-group consequences are
  asynchronous: a group may act after Loki flipped but before the inbound event arrives. The insert tolerates this
  ("first finishing any actions ... currently resolving", p. 20), so the rule is to apply inbound events at the next
  command boundary.

### Recommendation: Option B

Determinism: each group's replay needs only its own log, including inbound events. The coordinator is a reducer over
outbound events (its own log), also deterministic. Cross-group order is not defined by the rules, so it need not be
deterministic across groups; it is fixed by the recorded order in each log.

- **Replay:** replay a group from its log alone; replay a pod by replaying the coordinator log, which regenerates the
  inbound events each group must have received (a consistency check, not a second source of truth).
- **Save and resume:** save each group's state plus log, and the coordinator state plus log; resume rebinds them.
  Inbound events not yet applied are re-sent from the coordinator log using per-group sequence numbers.
- **Reconnect:** a player rejoins their group's authority and catches up from the group log, exactly as in the plain
  multiplayer design (PLAN.md Phase 5). A group authority reconnecting to the coordinator replays its unacknowledged
  outbound events (idempotent by event id) and receives missed inbound ones.
- **Group finishing or dropping:** the coordinator marks it `finished`, `dropped` or `abandoned` (see Q-C below). Its
  Worlds Collide threat stays; per Q2 the multiplier does not change; its Mangog or Door Between Worlds, if in play,
  stay claimable by the pod only while the group's authority is live (otherwise the card is lost and the pod is told).
- **Rule under test:** nothing in Option B edits engine invariants, so the existing replay and scenario tests stay
  valid.

## 3. Groundwork for wave 9 (no networking)

All items must work and be tested in single-group play with multiplier 1. Shapes are proposals.

| #   | Item                                                     | Decision                                                     | Reason                                  |
| --- | -------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| 1   | `groups` count in game state; `scale()` reads `perGroup` | build now                                                    | needed by three cards now               |
| 2   | `GroupId` and a `groupId` on game state                  | build now                                                    | stable key for events and selectors     |
| 3   | Loki damage as an emitted event                          | build now                                                    | the seam the coordinator takes over     |
| 4   | Worlds Collide threat as an emitted event                | build now                                                    | same seam                               |
| 5   | "this group" and "a group in your pod" target selectors  | build now                                                    | card scripts never change later         |
| 6   | `externalEvent` command type                             | build now (type, validator, no-op handlers for tested kinds) | what the coordinator injects            |
| 7   | Pod/group status in game state (`status`)                | defer                                                        | only meaningful with a coordinator      |
| 8   | Per-group difficulty already in setup                    | build now (verify only)                                      | already per game, check it is per group |
| 9   | Cross-area attack and thwart ("as if in their area")     | defer                                                        | needs a second area to test             |
| 10  | Group-scoped RNG streams                                 | build now                                                    | otherwise inbound events perturb rolls  |

Details.

1. **Group count.** Add to game state `pod: { readonly groupId: GroupId; readonly groupsAtStart: number }`, with
   `groupsAtStart` 1 for every game today. `scale(value, playerCount, groupCount)` becomes
   `base + perPlayer * playerCount + (perGroup ?? 0) * groupCount`; callers in `packages/engine/src/query.ts` (lines
   595, 604, 822) pass `state.pod.groupsAtStart`. Pins: the Mangog hit points 10, Door Between Worlds starting threat
   7, Worlds Collide target 2 at one group (new `packages/engine/src/scale-per-group.test.ts`; also a two-group state
   built directly in the test gives 20, 14, 4, so the multiplier is proven, not only 1). Reason: the engine currently
   ignores `perGroup`.
2. **Group id.** `type GroupId = Brand<string, "GroupId">`; the single table is `"g1"`. Recorded in the log header so a
   replay knows which group it was. Pin: `replay.test.ts` log round trip unchanged apart from the header.
3. **Loki damage event.** Shatter step 1 emits a `GameEvent`
   `{ type: "sharedVillainDamaged", groupId, amount, source }` and then, as the single-group coordinator, the engine
   applies it to the (local) Loki hit point dial through the same reducer the pod coordinator will use
   (`applySharedEvent(shared, event)`, a pure function on a `SharedPodState` of `{ lokiHp, worldsCollideThreat }`). In
   single-group play the shared state lives in game state and applying happens in the same command. Later, the
   function moves to the coordinator unchanged. Pin: the Shatter test in the wave 9 scenario suite (damage equals
   counters removed; Loki defeat wins the game; flip at 10 remaining).
4. **Worlds Collide threat event.** Same shape, `{ type: "sharedSchemeThreat", groupId, amount, cause }` with `cause`
   `"targetReached" | "identityDefeated"`. Pin: Mischief and Mayhem forced interrupts add threat; reaching target 2
   loses the game once the player phase ends.
5. **Selectors.** Add to the target DSL `group: "self"` and `group: "inPod"` (resolved as the own group in single-group
   play, a choice later), so the Fading Figments say "choose a group in your pod" and Synergy placement targets
   `{ group, environment }`. Pins: with one group the choice is auto-resolved (no prompt) and the counters land on that
   group's environment, using the existing no-prompt single-option rule.
6. **`externalEvent` command.** Add `{ type: "externalEvent"; sequence: number; event: PodInboundEvent }` to `Command`
   with `PodInboundEvent` initially `lokiFlipped | podWon | podLost | synergyGranted`. Single-group play never sends
   one; a unit test sends `lokiFlipped` as a stand-in for the engine's own flip, and checks the log replays. The command
   is rejected from a player seat (only the authority issues it). Pin: `legalActions` never lists it; a seat command
   with this type is refused.
7. **RNG.** Each group already has its own `rng`; make the Fading Figment swap draw only from it, so a recorded inbound
   event does not change later rolls. Pin: a replay with an extra no-op `externalEvent` inserted gives identical later
   draws.

Defer 7 and 9 to the Multiplayer phase, since neither is testable with one table. Keep the God of Lies scripts written
against selectors from item 5 and events from items 3 and 4, so Epic adds no card changes.

Test names (new, all at multiplier 1): `scale-per-group.test.ts`, `shared-villain-event.test.ts`,
`shared-scheme-event.test.ts`, `group-selector.test.ts`, `external-event-command.test.ts`, plus the God of Lies
scenario test in the wave 9 suite.

## 4. Later work, phased

1. **Pod model and coordinator (headless).** `PodCoordinator` as a pure module with shared state, a log of outbound
   events, sequence numbers per group, idempotent apply. Unit tests with fake groups. Depends on wave 9 items 1 to 6.
2. **Simulated pods.** A test harness that runs 3 to 4 headless engine instances with scripted players and a coordinator
   in memory; asserts win, loss (all player phases end), Loki flip broadcast, Worlds Collide stop, and that each group
   replays alone from its log (the property test for Option B).
3. **Cross-group effects.** Mangog and Door Between Worlds: a "remote claim" of a card in another group's area (attack
   or thwart as if in own area) routed through the owning group's authority as an ordinary command from a guest seat;
   synergy grants as inbound events with a player choice.
4. **Pod lobby and seating.** Event organizer creates a pod, sets groups and pod membership, per-group difficulty and
   the time limit; players pick a group and seat. Extends the Phase 5 lobby; a one-group pod is the normal lobby.
5. **Network transport.** Reuse the Phase 5 authority per group (the same async `EngineHost` interface); the coordinator
   is another authority-side service that group authorities talk to.
6. **UI.** A pod strip on the board: Loki hit points and Worlds Collide threat (the organizer role is replaced by the
   displays), each other group's status (round, threat, Avatar hit points, defeated players), a time-limit clock,
   a choice sheet for "choose a group in your pod", and the Loki flip pause banner. Keep text short per project
   convention.
7. **Reconnect and drop handling.** Per section 2; add organizer actions to mark a group finished or abandoned.
8. **Regression tests.** Rulings pinned: Ruling 3 (Feb 28, 2026: Intense Focus and Total Focus stay in play and attach
   to the swapped-in Avatar) and the Dark Scepter ruling (Jun 25, 2026) per group; plus pod-level tests above.

## 5. Open questions for the owner

- Q-A. One Loki per pod or one per whole game? (a) per game, (b) per pod. Recommended: (b), see Q1.
- Q-B. Is the per-group multiplier the groups at start or the current count? (a) at start, (b) current. Recommended: (a).
- Q-C. When a group drops mid-pod (cannot reconnect), what happens? (a) the pod waits, (b) the group is marked
  abandoned and the pod continues, (c) the organizer decides. Recommended: (c), defaulting to (b) after a timeout.
- Q-D. Is the 180-minute time limit enforced by the app? (a) display only, (b) enforced as a loss, (c) off by default.
  Recommended: (a).
- Q-E. Pod size cap in the lobby? (a) none, (b) soft warning above 16 players, (c) hard cap at 16. Recommended: (b).
- Q-F. Is there an organizer role with special controls in the app? (a) yes, a pod host seat, (b) no, automatic.
  Recommended: (a) for lobby and drop handling only, with scorekeeping automatic.
- Q-G. Can players spectate other groups' areas? (a) read-only view of any group in the pod, (b) only a summary strip.
  Recommended: (b) first, (a) later.
- Q-H. Does Epic ship as an online-only mode? (a) yes, (b) also local hot-seat pods. Recommended: (a).
