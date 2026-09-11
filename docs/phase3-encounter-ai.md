# Phase 3 — Encounter & villain "AI"

Owner: `encounter-ai-designer`. Status: landed 2026-09-11 (see PLAN.md Phase 3).

## The model: there is no villain player

Marvel Champions is cooperative. The villain side never plays strategically or picks "the worst option for the players". Its behavior is a **forced procedure** (RRG "Villain Phase", "Activation", "Boost", "Surge", "Hazard Icon", "Encounter Deck"). Where that procedure leaves a decision open, the RRG gives it to a player:

- **"Choose" on an ability** → the player resolving the ability (RRG "Choose"). Examples: Hydra Bomber, Under Attack, Electric Whip Attack, obligations.
- **An encounter card targets a player or card and more than one is eligible** → the first player (RRG "First Player").
- **Effects that would resolve simultaneously** → the first player orders them (RRG "First Player", "Simultaneous Resolution").

So the "AI" is two things: the engine running the procedure itself (it needs no input to do so), and each open decision being routed to the player the rules name. Nothing the villain side does waits on a command except a decision the RRG assigns to a player.

## Where it lives

| File | What |
|---|---|
| `packages/engine/src/villain/phase.ts` | Villain phase steps one to five, moved out of `flow.ts`: step-one threat, activations (villain once per player in player order, then that player's minions), dealing (one each + hazard icons, round-robin from the first player), revealing in player order, passing the first player token. `flow.ts` keeps the round structure and delegates here. |
| `packages/engine/src/villain/authority.ts` | The routing rules above: `encounterTargetSelector`, `simultaneousOrderer`, `isEncounterSide`, `effectChoiceAuthority`. |
| `packages/engine/src/villain/audit.ts` | `auditVillainPhases(log, deps)` — an independent re-check of every villain phase in a recorded game (below). |
| `packages/engine/src/resolve/enemy-activation.ts` | Attack/scheme stack frames and boost cards. These are unchanged: Phase 3 only sequences them. |

### `PendingChoice.authority`

Every `PendingChoice` now says why its player is the one deciding:

- `player` — the player's own decision.
- `firstPlayerTargets` — the first player selecting for an encounter card.
- `firstPlayerOrders` — the first player ordering simultaneous effects.

A client can label these, for example "Choosing for the villain: Genetically Enhanced". QA can assert that each one went to the first player. The audit does.

### Choice routing, villain side

| Decision | Asked of | Authority | Rule |
|---|---|---|---|
| Declare defender | attacked player | player | RRG "Defend" |
| Minion activation order (`chooseMinionToActivate`) | the engaged player whose activations are running | player | RRG silent; see readings |
| Encounter attachment with several legal hosts, incl. "highest printed HP" ties (`chooseAttachmentTarget`) | **first player** (was: revealing player) | firstPlayerTargets | RRG "First Player" |
| Script `chooser: firstPlayer` on an encounter card (Caught Off Guard, Masters of Mayhem's search) | first player | firstPlayerTargets | RRG "First Player" |
| One effect makes several enemies attack/scheme (`orderEnemies`, new: Gang-Up's minions, Masters of Mayhem, Swarm Attack) | first player | firstPlayerOrders | RRG "First Player" |
| Simultaneous forced abilities (`orderTriggers`) | first player | firstPlayerOrders | RRG "First Player" |
| "Choose to either …" / "choose and discard …" on an encounter card | the resolving player | player | RRG "Choose" |
| Optional abilities on encounter cards (Hero Actions, responses) | the first player is offered them | player | unchanged Phase 1 simplification |

## Behavior changes

- **Attachment host ties** (Genetically Enhanced, Biomechanical Upgrades, any `anyCharacter`/`hero`/… host with several candidates): the first player picks, not the revealing player.
- **Caught Off Guard** ("Discard an upgrade or support you control"): no "choose", so the first player selects which of the revealing player's cards goes. `standard.ts` now uses `chooser: firstPlayer`.
- **Masters of Mayhem**: the first player orders the Masters of Evil attacks and, in the fallback, picks which minion is fetched.
- **"Each X attacks/schemes"** effects with two or more enemies park an `orderEnemies` choice for the first player. Before this, they used a fixed stable order. With one enemy nothing is asked.

## The villain-phase audit

`auditVillainPhases` replays a `GameLog` with the engine and follows its events. It keeps its own shadow of forms, engaged minions, side schemes in play, acceleration tokens, the main scheme stage and the first player, re-synced from the exact state at each command start. It does **not** call `villain/phase.ts`, so a regression there shows up as a disagreement. It checks:

1. **Steps:** the phase runs in order — step one, activations, deal, reveal, pass the token, end of round.
2. **Step one** places acceleration + acceleration tokens + acceleration icons (main scheme stage and side schemes).
3. **Villain activations:** the villain activates once per live player, in player order. It attacks a hero-form player and schemes against an alter-ego player.
4. **Minion activations:** each minion activates for the player whose activation is running, only if engaged with them, at most once. Every minion engaged with that player for the whole step activated.
5. **Boost cards:** only the villain and villainous minions get boost cards. Every villain attack or scheme that wasn't cancelled got at least one boost card (if the encounter deck and discard had any cards left). Every boost card dealt was flipped.
6. **Dealing:** each live player is dealt one card, plus hazard icons dealt round-robin starting with the first player.
7. **Revealing:** every card dealt in step three is revealed by the player it was dealt to, in player order. Surge cards and cards revealed by effects are exempt from the order check: they belong to whoever resolves the card that caused them, e.g. an obligation's owner.
8. **Passing the token:** it passes to the next live player clockwise from the current holder. If the first player is eliminated mid-phase, the token moves at once (RRG "Player Elimination"); that is allowed.
9. **Decision authority:** every `firstPlayer*` decision went to the current first player. A minion-order choice went to the player whose activations were running.

A step cut short by the game ending, or cards belonging to an eliminated player, are not flagged. Each phase record also carries a readable trace: activations, boost cards and their icons, cards dealt and revealed, and every decision with its authority.

## Exit criteria

`packages/cards/src/villain-ai.test.ts` covers the exit criteria:

- **Scripted matrix:** 48 games — Rhino / Klaw / Ultron × standard / expert × 1–4 players × 2 seeds. Each is played by the scripted greedy driver to an outcome, gets a clean audit, and replays to a deep-equal state.
- **Passive tables:** one game per scenario where the players only end turns and take the minimum on every choice. The villain side wins on its own, with a clean audit.

Engine-level tests are in `packages/engine/src/villain.test.ts`: routing, `orderEnemies`, audit records, and a replay rejection.

While building the audit, every discrepancy it raised traced back to the audit's own assumptions, not to the engine. The cases were: games ending mid-step, eliminated players, the token passing on elimination, obligation/surge reveals, and an attack cancelled by Get Behind Me! Those cases are now handled explicitly, as listed above.

## Readings and open questions

- **Minion activation order.** The RRG says each engaged minion activates, not in what order. The engine asks the engaged player. The first player would be the other defensible reading, under "the first player decides …" for game decisions. Revisit if an FAQ rules on it.
- **Caught Off Guard** is read literally under RRG "First Player", because the card targets and doesn't say "choose". Many tables let the revealing player pick. In solo the two readings are identical.
- **Ordering identical enemies** (Swarm Attack's facedown Drones) is still asked. The prompt is legal but low value; a client may auto-answer it when every option is interchangeable.
- **Setup-keyword attachments** still take the first legal host with no choice point. No Core card needs one (carried from Phase 2).
- **Optional encounter-card abilities** are offered to the first player only (carried from Phase 1).
