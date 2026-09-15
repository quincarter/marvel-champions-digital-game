# Phase 7 wave 1: the ability-scripting brief

This is the brief every per-pack agent follows when scripting a wave 1 pack's card abilities
(`ability-scripting-engineer`, PLAN.md Phase 7, `docs/phase7-wave1.md`). Read `docs/phase7-wave1.md` first — it is
the shared spec for schema decisions (§1), per-pack setup needs (§2) and the engine primitives (§3) this brief
builds on. This document is the narrower "how to script a pack" companion to it: folder layout, reprints, test
conventions, and the rule for a genuinely missing primitive.

The model to follow for style is `packages/cards/src/core/` (the Core Set scripts) and `packages/cards/src/wave1/cap/`
(the first wave 1 pack, fully scripted). Read a `kit.ts` there before writing your own.

## 1. Folder layout and naming

Each pack owns one folder under `packages/cards/src/wave1/<pack>/`, where `<pack>` is its short code (`cap`, `msm`,
`thor`, `bkw`, `drs`, `hlk`, `gob`, `twc` — the same codes `@mc/content`'s `packages/content/src/data/<pack>/` uses).
Inside it:

| File | Contents |
|---|---|
| `kit.ts` | The hero's signature ability scripts (identity abilities, allies, events, upgrades, supports printed in the hero's own set). Named `<PACK>_KIT`. |
| `obligation.ts` | The identity's obligation card. Named `<PACK>_OBLIGATION`. Reuse `../../core/obligations.js`'s `obligation()` helper — every wave 1 obligation follows Core's "give to the alter-ego player, you may flip, choose: exhaust to remove / an alternative, discard this obligation" shape (docs/phase7-wave1.md §2.1). |
| `nemesis.ts` | The identity's nemesis set (nemesis minion, its side scheme/treachery/other minions). Named `<PACK>_NEMESIS`. |
| `pack-cards.ts` | The generic-aspect filler cards bundled in the same physical pack but not part of the hero's own signature set (an aggression/justice/protection/basic card each, per docs/phase7-wave1.md's pack surveys). Named `<PACK>_PACK_CARDS`. |
| `<scenario files>` | Scenario packs (`gob`, `twc`) instead have per-scenario files for their villain(s), main scheme(s) and modular sets — there is no single hero kit. Follow `packages/cards/src/core/scenarios/rhino.ts` and `packages/cards/src/core/modular/` for the shape; name each export after its content (e.g. `RISKY_BUSINESS`, `GOBLIN_GIMMICKS_SET`). |
| `index.ts` | Merges every module above into one `<PACK>_ABILITIES: AbilityRegistry` with `mergeRegistries(...)`. This is the **only** thing the pack's folder exposes to the rest of wave 1 — see `packages/cards/src/wave1/cap/index.ts`. |
| `<hero-name>.test.ts` | Ruling-level tests for the kit, one `it` per printed ability, in the style of `packages/cards/src/core/heroes/spider-man.test.ts` and `packages/cards/src/wave1/cap/captain-america.test.ts`. |
| `e2e.test.ts` | One real-game test: the pack's own precon (or, for a scenario pack, any Core or wave 1 hero) played by the greedy driver to a real outcome and replayed deep-equal — see `packages/cards/src/wave1/cap/e2e.test.ts`. |

Ability ids are the card's code plus a slug, exactly like Core: `"<code>.<slug>"` (e.g. `"03001a.i-can-do-this-all-day"`).
The slug should read as the card's own name for the ability (`-constant`, `-response`, `-action`, `-interrupt`,
`-resource`, `-when-revealed` are the recurring suffixes; match `@mc/content`'s `abilityId(...)` calls in
`packages/content/src/data/<pack>/cards.ts`, which already pin the exact ids your scripts must key).

**A pack agent never edits another pack's folder**, `packages/cards/src/wave1/reprints.ts`, `packages/cards/src/wave1/names.ts`,
or `packages/cards/src/wave1/testing.ts`. If one of those shared files seems to need a change for your pack, that is
itself a signal to flag rather than route around — see §4.

## 2. Registration: one line, added by the main session

`packages/cards/src/wave1/index.ts` merges every pack into `WAVE1_ABILITIES`:

```ts
export const WAVE1_ABILITIES: AbilityRegistry = mergeRegistries(
  WAVE1_REPRINT_ABILITIES,
  CAP_ABILITIES,
  // GOB_ABILITIES,
  // TWC_ABILITIES,
  ...
);
```

**A pack agent does not add this line.** Write the pack's own `index.ts` exporting `<PACK>_ABILITIES`, but leave the
commented-out placeholder in `wave1/index.ts` alone — the main session uncomments it (and updates
`wave1/coverage.test.ts`'s `PACK_STATUS`, §5 below) once the pack's tests are green, the same way it did for `cap`.
This keeps the one file every pack agent would otherwise collide on to a single-line, main-session-only edit.

## 3. Reprints: handled automatically, never scripted by hand

41 wave 1 cards across the eight packs are the identical Core card reprinted (same printed name **and** type —
`packages/cards/src/wave1/reprints.ts`'s `reprintKey`). `reprints.ts` finds every such pair by scanning `WAVE1_CARDS`
against `CORE_CARDS` and aliases the wave 1 ability id straight to Core's own `AbilityDefinition`, as long as the
ability refs line up one-for-one and the slug after the dot matches (e.g. `03016.make-the-call-action` aliases
`01071.make-the-call-action`). This runs once, at import time, ahead of every pack's own registry in
`wave1/index.ts`.

**Consequences for a pack agent:**
- **Never define an ability id for a card `reprints.ts` already supplies.** `mergeRegistries` throws `"defined
  twice"` if your module and `WAVE1_REPRINT_ABILITIES` both define the same id — this is the intended guard rail,
  not a bug to work around.
- Check `wave1ReprintPairs()` (or just try building and read the "defined twice" error) before writing a script for
  a card that looks like a Core reprint by name. **Matched by (name, type), not name alone** — `Hulk` is a hero
  identity in `hlk` but an ally in Core, `She-Hulk` is an ally in `hlk` but an identity in Core, `Iron Man` is an
  ally in `drs` but an identity in Core, and these must stay distinct (`reprints.test.ts` pins this).
- If a wave 1 "reprint" actually differs from the Core card (a different ability count, or a slug that doesn't
  match — usually because of a wording change or errata), `buildReprintAbilities()` refuses to alias it and throws
  at import time with a message naming exactly which card and why. Script that one by hand in your pack's own
  module instead; do not change `reprints.ts` to force a match.
- `wave1/coverage.test.ts` treats anything resolved for a not-yet-started pack that isn't explained by
  `wave1ReprintPairs()` as an error, precisely so an accidental hand-written id for a reprint (instead of letting
  `reprints.ts` supply it) gets caught immediately.

## 4. The rule: missing primitive → record and skip

If a card's printed text (current/erratad, per `card-data-pipeline`'s versioned data) genuinely cannot be expressed
with the DSL vocabulary that exists when you reach it:

1. **Do not hand-roll a bespoke branch** in the engine or a one-off effect shape just for that card. The point of
   the DSL is that new cards are additions of data, not additions of code paths (CLAUDE.md).
2. **Do not approximate.** A subtly wrong implementation is worse than an unimplemented one — it looks correct
   until someone hits the edge case in a real game.
3. **Record the gap precisely, in a comment beside the ability id you left unscripted (or in your pack's `index.ts`
   docblock if it's a whole card), stating:**
   - the card's code and printed (current) text;
   - exactly what DSL/engine primitive is missing, in the same shape as `docs/phase7-wave1.md` §3's write-ups
     (rule text, then state/resolution/interaction consequences);
   - which existing primitive it's closest to, if any, so `game-rules-architect` has a starting point.
4. **Skip it** — leave the ability id out of your pack's registry. `wave1/coverage.test.ts`'s per-pack check will
   report it as unresolved, which is the correct, honest state until the primitive lands. Do not mark the pack
   "scripted" in `PACK_STATUS` while anything is skipped this way; instead list exactly what's skipped and why (the
   coverage test's failure message already gives you the "and why" for free — keep the comment in the script as the
   durable record).
5. **Flag it to `game-rules-architect`** (or the orchestrating session) explicitly, the same way you would flag any
   other "when in doubt, ask" situation (CLAUDE.md) — don't let a silent gap sit undiscovered in a coverage-test
   failure message alone.

Wave 1's engine-primitive gaps (docs/phase7-wave1.md §3) were all landed ahead of scripting, so this should be rare;
treat it as a real signal that something in §3's survey missed a card, not a routine occurrence.

## 5. Test conventions

Every pack shares the test helpers in `packages/cards/src/testing/harness.ts` (deps-agnostic: `play`, `use`,
`identityOf`, `inst`, `playerOf`, `moveToHand`, `putOnTopOfDeck`, `patchInstance`, `resourceAbility`,
`stackEncounterDeck`, `payWith`, `picking`, `firstLegal`, `settle`, `settleUntil`, `answer`) and the wave-1-specific
wrappers in `packages/cards/src/wave1/testing.ts` (`runWave1`, `startWave1Game`, `WAVE1_DEPS`, re-exported `answer`/
`runWith`/`settle`/`settleUntil`). **Both files are shared — read them, never edit them** for pack-specific needs;
if a helper is missing something your pack genuinely needs, that's a signal to raise, not to patch inline.

- **Set up a real game**, not a stub: `startWave1Game(wave1Scenario(scenarioId, { players: [...], seed }))`, the
  wave 1 analog of Core's `startCoreGame(coreScenario(...))`. `wave1Scenario` seats a wave 1 (or Core) starter deck
  or explicit identity+deck at any Core scenario (Rhino/Klaw/Ultron) — wave 1 hero packs print no scenario of their
  own, so this is how their precons get tested until `gob`/`twc`'s own scenarios are scripted. A `gob`/`twc` test
  instead calls `coreScenario`-shaped setup for that pack's own scenario once it's scripted (follow `../core/setup.ts`'s
  pattern; there's no `wave1Scenario`-equivalent needed there since it *is* the scenario).
- **Every command goes through `runWave1`** (or `applyCommand(..., WAVE1_DEPS)` directly when you need to assert on
  a *rejected* command) — never `run`/`CORE_DEPS`, which doesn't know wave 1's ability ids.
- **A Response is optional, even without "you may" in the printed text** (RRG "Response"). Entering play (or any
  other triggering event) with a Response ability leaves a `chooseTriggers` pending choice — whether to trigger it
  at all — that must be settled (`settle(state, firstLegal, ...)` declines it; `firstLegal`'s `minSelections` is 0
  for an optional trigger) before the next command, even when the test doesn't care about the Response's effect.
  This bit several of `cap`'s tests during the wave 1 foundation pass; expect it on every ally/upgrade/support with
  a printed "Response:" line.
- **A mandatory `chooseTarget` behaves differently**: it has `minSelections` equal to its count even with only one
  legal target (RRG "Choose (Game Element)" — the choice is still made, just with one option), so it also needs
  settling, but *cannot* be declined the way a `chooseTriggers` can.
- **Payment: a hand card's value is the sum of its printed resource icons, not 1 per card.** Most wave 1 cards
  print exactly one icon, but resource-type cards (Energy/Genius/Strength, The Power of Leadership, ...) print or
  generate two, and some ("The Power of Leadership": "double the number of resources this card generates while
  paying for a Leadership (blue) card") are conditionally worth more depending on what they're paying for.
  `payWith(state, player, n, exclude)` (the test helper) picks `n` *cards*, not `n` resources — do not assume
  `n` cards pay for exactly `n`; if a test needs an exact underpay/overpay boundary, either exclude the
  variable-value cards explicitly or add enough guaranteed single-value filler that the boundary can't be crossed
  by accident. Overpaying is always legal (RRG "Cost").
- **An upgrade with no printed `attachesTo` auto-attaches to the identity** (`actions.ts`'s `ownIdentity` fallback)
  and therefore never appears in `playerOf(state, player).playArea` — check `inst(state, id).attachedTo` instead.
- **An obligation (and any other card whose `home` is the encounter deck) discards to the *encounter* discard
  pile**, not the player's own discard — check `activeEncounterDeck(state).discard`, matching
  `core/heroes/spider-man.test.ts`'s Eviction Notice tests.
- **`GameState.outcome` is `GameOutcome | null`, never `undefined`** (`packages/engine/src/state.ts`) — assert
  `toBeNull()` for "the game is still running", not `toBeUndefined()`.
- **A real-game (`e2e.test.ts`) test is not optional per pack.** Use `playToOutcome` from
  `packages/cards/src/testing/driver.ts` (the same card-name-agnostic greedy headless player Core's `e2e.test.ts`
  uses) against the pack's own precon, then `replay()` the session log and assert a deep-equal final state. This is
  what catches an ability that's individually well-tested but breaks when the generic driver/engine actually drives
  it through a full turn cycle (e.g. a leftover pending choice blocking the next command).
- **Don't invent a card's traits, aspect, or identity from the card's flavor/expectation — read `@mc/content`'s
  data.** One of the seven starting failures fixed in this pass was a test that assumed an ally had the Avenger
  trait because the ability being tested needed an Avenger ally; the data (and the real printed card) said
  otherwise. When a test's assumption about a card and the data disagree, the data wins unless you have a specific
  reason (citation) to believe the data is wrong — and if you do, that's a `card-data-pipeline` fix, not a script
  or test workaround.

## 6. Engine primitives added while scripting `cap` (reuse these — don't reinvent them)

These landed in `@mc/engine`/`@mc/cards` alongside the Captain America pack and are general vocabulary, not
Cap-specific. Check here before adding a new DSL primitive for a similar shape in a later pack.

| Primitive | Where | What it's for |
|---|---|---|
| `exhaustCardsCost(query, opts?): AbilityCost` | `dsl/abilities.ts`, engine `AbilityCost.exhaustCards` (an `InPlayCostPick`, `abilities.ts`), paid in `actions.ts` `planCost`/`payCost` | "Exhaust `<cards in play>` →" for cards other than this one (`exhaustThis`) or your hero (`exhaustYourHero`). A fixed count by default: `exhaustCardsCost(query("upgrade", { name: SHIELD }))` (Shield Block). `{ max: "any", bind: "n" }` for "exhaust any number of allies" (Strength in Numbers). Candidates are cards in play **the payer controls** (RRG 1.8 "Cost", p. 14; ruling June 25, 2026 #1), so the query doesn't need `controller: "you"`. `min` is at least 1: "any number"/"up to" still means one (p. 14). A forced pick (exactly `min` candidates) pays itself. Otherwise the command names its picks in `costChoices[slot]`, and `legalActions` fills in the smallest pick. Tested in `engine/src/target-cost.test.ts`. |
| `returnToHandCost(query, opts?): AbilityCost` | `dsl/abilities.ts`, engine `AbilityCost.returnToHand` (an `InPlayCostPick`) | "return `<cards>` from play to your hand →" (Shield Toss), to the owner's hand. Same picking rules as `exhaustCardsCost`. A card that "cannot leave play" can't pay. |
| `max` on `discardFromHandCost(min, max, bind?)` | `dsl/abilities.ts` | An upper bound on a variable discard-from-hand cost, for "discard X cards" where X is capped (Shield Toss's `discardFromHandCost(0, undefined, "x")` uses the *un*capped form; use the `max` argument when a card prints a limit). `min` 0 stays legal here because X is the player's choice. |
| `reduceNextCardCost(player, n, duration, cardFilter?)` | `dsl/effects.ts`, engine lasting `costReduction.cardFilter` (`lasting.ts`, `effects.ts` `costReductionFor`/`consumeCostReductions`) | A "next card" reduction only the matching card can use or consume: "reduce the cost of the next Avenger ally played this phase" (Avengers Tower). It waits through other cards and still expires with its duration. Unfiltered reductions are used by any card. Every waiting reduction the played card matches is summed and consumed, after constant `costModifier`s (Living Legend is a `costModifier` with `firstThisRound`, not a `cardFilter`). |
| `rule({ kind: "allyLimit", amount, while?: Predicate })` | `engine/src/abilities.ts`, read by `rules.ts` `allyLimitFor` | A conditional ally-limit increase (Avengers Tower: "if each of your allies has the Avenger trait, increase your ally limit by 1". This reads as true with no allies, per the literal "each of your X"). `while` is re-read on every check. The limit is enforced when an ally enters play and also between frames (`resolve/enter-play.ts` `checkAllyLimits`), because RRG 1.8 "Ally Limit" (p. 7) applies whenever a player "ever" has too many. |
| `TargetQuery.withoutTrait` | `engine/src/spec.ts`, checked in `select.ts` | The negative-trait half of a trait-uniformity check: `not(exists(query("ally", { withoutTrait: AVENGER })))` reads "each of your allies has the Avenger trait". |
| `TargetQuery.maxPrintedCost: number \| ValueSpec` | `engine/src/spec.ts`, checked in `select.ts` | Filters candidates by printed cost against a live value, not just a literal number — Quinjet's "an Avenger ally from your hand with printed cost equal to or less than the number of time counters on Quinjet" reads the counter live via `countersOn(self, "time")`. |
| `scaled(value, { divideBy, times?, plus?, max? })` | `dsl/values.ts`, engine `ValueSpec.scaled.divideBy` | "Half of X, rounded down" and similar — `divideBy` is floored and applies before `times`/`plus` (Man Out of Time's "discard half of the cards in your hand, rounded down": `scaled(handCountOf(), { divideBy: 2 })`). |
| `countAmong(cardsRef, query): ValueSpec` (`{ kind: "countInRef" }`) | `dsl/values.ts`, engine `select.ts` | Counts matches of a query among a *bound slot* of cards wherever they are (not just in play) — Falcon's "for each treachery looked at this way" over cards bound by `selectCards`. |
| `<bind>.boostIcons` value (`moveCards`'s bind) | engine `apply-effect.ts` `moveCards` case | Sums the printed (plus modifiers) boost icons of cards moved by a `moveCards` effect, bound for later use — Hit Squad's "takes 1 damage for each boost icon discarded this way" (`varOf("milled.boostIcons")`). |
| `allowUnlabeledAttack(definition, { citation })` | `dsl/validate.ts` | A documented, cited opt-out from the validator's rule that every attack effect belongs to an `(attack)`-labeled ability — added ahead of Black Widow's Dance of Death (08004), which prints no "(attack)" label but whose FAQ ruling (Dance of Death #4, RRG 1.8 p. 59) treats each damage-dealing sentence as its own attack anyway. Not yet consumed by any scripted card; use it only for a genuine printed/FAQ exception like that one, never to skip labeling a routine attack. |
| `PlayerZone` export | `engine/src/spec.ts` (type), re-exported from `engine/src/index.ts` | The `"hand" | "deck" | "discard"` union for `zone()`/`CardZoneQuery.zone`, now public so `@mc/cards` scripts can type a multi-zone search (Steve Rogers' setup: "search your deck and discard pile"). |
| `discardEncounterCards` bind shape | `dsl/validate.ts`'s slot/var scope handling | Validator support for binding the cards discarded by a `discardEncounterCards`-shaped effect, so a later effect in the same ability can reference them (used the same way `selectCards`'s bind is used). |

`engine/src/target-cost.test.ts` is the test file to read for `exhaustTarget`/`returnToHandCost`/`exhaustChosen`'s
exact engine-level semantics (what happens when the target isn't controlled by the player, when it's already
exhausted, when the query matches zero cards, etc.).

## 7. Status

| Pack | Code | Status | Notes |
|---|---|---|---|
| Captain America | `cap` | **Scripted.** 34 cards, 37 ability refs, 0 unscripted (`wave1/coverage.test.ts`). | 6 of 37 refs are Core reprints. Real-game test: `wave1/cap/e2e.test.ts` (Rhino, standard, solo). |
| Ms. Marvel | `msm` | **Scripted, 4 skips.** 33 ability refs: 26 scripted, 3 Core reprints, 4 recorded skips in `wave1/coverage.test.ts` `KNOWN_SKIPPED` (26 tests in `wave1/msm/`). | **Skipped, missing primitives:** Morphogenetics (05001a) needs an OR of traits (proposed `TargetQuery.anyTrait?: readonly Trait[]`). Teen Spirit (05001b) needs discard-from-a-player-deck-until-a-match (proposed `discardDeckUntil { player, filter, bind }`, the player-deck analog of `discardEncounterUntil`). Generation Why? (05026) needs a sum of two counts (proposed `ValueSpec { kind: "sum", values }`). **Engine bug:** Embiggen! (05010) — the `attack` case in `engine/src/resolve/apply-effect.ts` doesn't add `cardEffectBonus`, unlike `dealDamage`/`thwart`/`removeThreat` (confirmed by the main session). Not reachable through the `msm-protection` precon, so scripted but only lightly tested: Melee, Concussive Blow, Morale Boost, Down Time. Real-game test: `wave1/msm/e2e.test.ts`. |
| Thor | `thor` | **Scripted, 2 skips.** 34 cards; every ability ref resolves except the two in `wave1/coverage.test.ts` `KNOWN_SKIPPED` (28 tests in `wave1/thor/`). | **Skipped, missing primitives:** Mean Swing (06015) needs a `TargetQuery` host filter ("a Weapon upgrade **on your hero**"; proposed `TargetQuery.host?: TargetRef`). Valkyrie's Response (06012) can't see how she was paid for: a Response to a card's own entering play gets a fresh frame without the `playCard` frame's `paid.*` vars (proposed: carry them into that card's own Response candidate). Local DSL wrappers for landed engine effects not yet exposed as builders: `wave1/thor/local.ts` (`engage`, `reorderCards`, `distinctCardTypes`, `dealDamage.ignoreTough`). Real-game test: `wave1/thor/e2e.test.ts`. |
| Black Widow | `bkw` | **Scripted, 1 skip.** Every ability ref resolves except Taskmaster's boost in `wave1/coverage.test.ts` `KNOWN_SKIPPED` (25 tests in `wave1/bkw/`). | Errata'd text used for Black Widow (08001a) and Synth-Suit (08009); Dance of Death (08004) uses `allowUnlabeledAttack`. **Skipped:** Taskmaster's boost (08026) — `modifyAttack` can only bonus the current activation's own attacker. Burn Notice (08025) was a skip until the `superlative` validator fix; now scripted and tested (`bkw/obligation.test.ts`), breaking a highest-cost tie by the player's choice. Real-game test: `wave1/bkw/e2e.test.ts` (a win in round 12). |
| Doctor Strange | `drs` | **Scripted, 5 skips.** Every ability ref resolves except the five in `wave1/coverage.test.ts` `KNOWN_SKIPPED` (33 tests in `wave1/drs/`). | Invocation cards resolve from the separate deck; the e2e game (`wave1/drs/e2e.test.ts`) resolves at least one. **Skipped:** Vapors of Valtorr (09035) — no query for "has any status"; Physical Toll (09027) — no cost modifier without a phase/round duration; Counterspell (09030) — a cancelled play doesn't stop the card's own effects; Unflappable (09020) — a Response's cost can't depend on "and take no damage"; Desperate Defense (09015) — the `defended` event bug below. |
| Hulk | `hlk` | **Scripted, 2 skips.** 32 cards; every ability ref resolves except the two in `wave1/coverage.test.ts` `KNOWN_SKIPPED` (25 tests in `wave1/hlk/`). | **Skipped:** Hulk Smash (10003) — `applyPlayerAttack` builds its `dealDamage` from the attack event's fixed `overkill` field, never from an interrupt's `modifyAttack({ overkill })` frame var (enemy attacks do read it). Beat Cop's second action (10029) — `discardSelf` snapshots counters but not threat, so "for each threat here" reads 0. Clash of the Titans (10028) was a skip until the `superlative` validator fix; now scripted and tested (`hlk/clash-of-the-titans.test.ts`). Local DSL wrappers: `wave1/hlk/local.ts`. Real-game test: `wave1/hlk/e2e.test.ts`. |
| Green Goblin | `gob` | **Scripted, 8 skips.** Risky Business, Mutagen Formula and 4 modular sets; every ability ref resolves except the eight in `wave1/coverage.test.ts` `KNOWN_SKIPPED` (31 tests in `wave1/gob/`). | **Skipped:** Criminal Enterprise / State of Madness (02006a/b) — the data gives one ability ref per face, but each face needs two triggers (a state check and a separate response), a `card-data-pipeline` item; Hired Gun (02007), Intimidation (02035) — no "give the villain a boost card" outside an activation; Power Drain (02041), Lightning Bolt (02044), Shock Therapy (02045) — boost icons summed over several discarded cards (**likely scriptable**: `moveCards` binds `<bind>.boostIcons` summed over every card it moves); Tombstone (02047) — no filter for either of two resource types. Gang-Up (02039) is a Core reprint and must not be scripted here. Scenario setup: the shared `wave1Scenario`. Real-game tests: `wave1/gob/e2e.test.ts`, both scenarios solo and 2-player. |
| The Wrecking Crew | `twc` | **Scripted, 9 skips.** Breakout with Wrecker, Thunderball, Piledriver and Bulldozer; every ability ref resolves except the nine in `wave1/coverage.test.ts` `KNOWN_SKIPPED` (29 tests in `wave1/twc/`). | **Skipped:** Hard Hitter (07004), Gamma Blast (07019), Pile Drive (07034), Charge (07048) — no predicate reads a scheme's current threat against a threshold; Magic Crowbar (07006), Ball and Chain (07020), Bulldozer's Helmet (07049) — no random discard from hand as a cost; Radioactive Buildup (07022) — no redirect of an enemy attack's excess damage to a scheme; Thunderball's boost (07027) — no ref for "the defending character" during a boost. Breakout 1B re-picks the active villain by highest side-scheme threat every round, so a test that patches `activeVillainId` must also raise that villain's scheme threat. Real-game tests: `wave1/twc/e2e.test.ts`, solo and 2-player. |

**"The X with the highest/lowest Y"** (`TargetRef.superlative`): `dsl/validate.ts` accepts its implicit `candidate` slot inside `measure` (fixed 2026-09-15). When a card names a single card, bind the superlative to a slot and pick one of the tied cards rather than acting on all of them: `chooseTarget(pick, { inSlot })` for cards **in play** (Burn Notice, Clash of the Titans), `chooseCards(pick, cards(chosen(slot)), { min: 1, max: 1 })` for cards **out of play**, such as in hand (Thoughtcasting). `chooseTarget` only ever matches cards in play.

**Known engine bug, `defended` interrupts:** `isAnnouncement` (`engine/src/trigger-events.ts`) doesn't list `defended`, so it is treated as an announcement and only opens a response window. An Interrupt on `when.defends` never fires. Blocks Desperate Defense (09015); Expert Defense (03033, `cap`) has the same shape and is registered but untested.

Update this table (and `wave1/coverage.test.ts`'s `PACK_STATUS`, and `wave1/index.ts`'s registration) in the same
change that finishes a pack.
