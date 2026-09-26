# Phase 7 wave 3: the ability-scripting brief

This is the brief for scripting wave 3 (cycle 2, `ability-scripting-engineer`, PLAN.md Phase 7, `docs/phase7-
wave3.md`). Read `docs/phase7-wave3.md` first — the shared spec for schema decisions (§1), per-pack setup needs
(§2) and engine primitives (§3, all landed, the last being Moondragon's §3.23 on 2026-09-23).
This document is the narrower "how to script a pack" companion, directly modeled on `docs/phase7-wave2-scripting.md`
(wave 2's own version). Read `docs/card-scripting-process.md` too — it says where the time actually goes and names
the standing traps (`stackSetAsideBehindBoost`, the two-wave-siblings trap this file's own §3 hit first).

The model to follow for style is `packages/cards/src/wave2/trors/` (a fully-scripted box) and, within this wave,
`packages/cards/src/wave3/gmw/groot-kit.ts` / `groot-obligation-nemesis.ts` (Groot, the first fully-scripted hero).

## 1. Folder layout and naming

Each pack owns one folder under `packages/cards/src/wave3/<pack>/` (`gmw`, `stld`, `gam`, `drax`, `vnm`, `ron`).
Inside `gmw`: one `<hero>-kit.ts` and one `<hero>-obligation-nemesis.ts` per hero (Groot, Rocket Raccoon), one file
per scenario (main scheme + that scenario's own modular set), an `index.ts` that is the pack's **only** export to
the rest of wave 3, ruling-level `<hero-name>.test.ts` / `<scenario>.test.ts` files, and an `e2e.test.ts` (a Groot
one exists; add a Rocket one, and a per-scenario smoke test, as those land).

Ability ids are the card's code plus a slug, read from `packages/content/src/data/gmw/cards.ts`'s own `abilityId(
...)` calls — **never guessed from the printed text.** Regenerate `KNOWN_SKIPPED` with `MC_REFS_PACKS=gmw pnpm
refs` (`pnpm dsl`/`pnpm card` are the other two lookups worth using constantly) — never hand-typed.

**A pack agent never edits another pack's folder**, `wave3/reprints.ts`, `wave3/names.ts`, `wave3/testing.ts`, or
`wave3/cards.ts`. If one of those shared files seems to need a change for your pack, flag it rather than route
around it — §3 below is exactly that kind of flag, already resolved once.

## 2. Registration

`packages/cards/src/wave3/index.ts` merges every pack into `WAVE3_ABILITIES`; `wave3/coverage.test.ts`'s
`PACK_STATUS` records `"scripted"` / `"in progress"` / `"not started"`. Adding a pack's own registry is one import
plus one line in `mergeRegistries(...)` in `wave3/index.ts`, plus flipping its `PACK_STATUS` entry once its
`KNOWN_SKIPPED` list is accurate.

## 3. The wave-siblings trap this file's own foundation hit first

**`WAVE1_CARDS` and `WAVE2_CARDS` are siblings, not nested** — both are built from `CORE_CARDS` independently
(`packages/content/src/data/index.ts`: `WAVE1_CARDS = [...CORE_CARDS, ...(eight wave 1 packs)]`, `WAVE2_CARDS =
[...CORE_CARDS, ...(six cycle 1 packs)]`). A first draft of `wave3/cards.ts`/`wave3/reprints.ts` built the "earlier
cards" pool from `WAVE2_CARDS` alone, on the same (wrong) assumption `../wave2/reprints.ts`'s own docblock already
warns against for the wave 1→2 boundary. The symptom: Desperate Defense (`gmw` 16013, a verbatim reprint of `drs`
09015 from wave 1) silently fell through reprint matching with **no entry in `WAVE3_REPRINT_PROBLEMS` either** —
`earlierByReprintKey` simply never had wave 1's cards in it at all, so the match attempt found nothing rather than
finding a mismatch. Caught by `MC_REFS_PACKS=gmw pnpm refs` still listing `16013.desperate-defense-interrupt` as
unresolved after Groot's kit was otherwise complete.

**The fix, already in `wave3/cards.ts`/`wave3/reprints.ts`/`wave3/index.ts`:** use `@mc/content`'s own
`PLAYABLE_CARDS` (Core + wave 1 + cycle 1, already deduplicated) as "every earlier card", and a plain object spread
`{ ...WAVE1_ABILITIES, ...WAVE2_ABILITIES }` (not `mergeRegistries`, whose throw-on-duplicate guard is for
genuinely new ids within one wave — these two siblings deliberately share every Core id) as "every earlier
ability". If you add a `stld`/`gam`/`drax`/`vnm`/`ron` pack later and a reprint mysteriously doesn't alias, check
this file's own pool-construction logic before assuming the card itself is the problem.

## 4. Test conventions

Same as wave 2 (`docs/phase7-wave2-scripting.md` §5, `docs/card-scripting-process.md` §7): real commands, never
`toBeDefined()`. `wave3/testing.ts` exports `runWave3`/`startWave3Game`/`playFromHand`/`revealFromEncounterDeck`/
`defeatWithAttack`, all wired to `WAVE3_DEPS`; `../testing/staging.ts` and `../testing/harness.ts` supply the rest
directly. `wave3Scenario("rhino", { players: [{ starterDeckId: "groot-protection" }], ... })` seats a `gmw` precon
against a Core villain when the box's own scenario isn't reached yet (falls back to `coreScenario`, mirroring
`wave2Scenario`'s own fallback) — this is what every Groot test in this pass uses; a Rocket Raccoon session should
do the same (`starterDeckId: "rocket-raccoon-aggression"`) until Brotherhood of Badoon is scripted.

**Two traps hit while testing Groot, worth knowing before you hit them again:**

- **Sparse counters read as `undefined`, not `0`.** `inst(state, id).counters.growth` is `undefined` on a card
  that has never had a growth counter placed or removed, not `0`. Compare with `?? 0` on both sides, or the
  assertion fails on a perfectly correct "no counters" result.
- **`stackEncounterDeck(state, "01186", "16025")` doesn't reveal `16025` alone.** The villain's own boost draw
  (`packages/cards/src/testing/staging.ts`'s `stackSetAsideBehindBoost` docblock; `docs/card-scripting-process.md`
  §7) consumes the _first_ stacked card unconditionally before the reveal step ever runs, so `"01186"` is spent as
  a boost card and `"16025"` is what actually gets revealed and resolved. Assertions on the encounter discard
  pile's size need to count that boost draw too (`groot-obligation-nemesis.test.ts`'s Wilt tests are `+2`, not
  `+1`, for exactly this reason).
- **A defeated villain stage's damage dial reads back as `0`, not "≥ its max hit points".** `groot-kit.test.ts`'s
  Root Stomp defeat test asserts `damage === 0` after the kill, not a `toBeGreaterThanOrEqual` on the pre-defeat
  max — the dial has nothing left to measure once the stage is gone.
- **An engaged minion's `home` is `{ kind: "activeEncounterDeck" }`, not the engaged player's `playArea`, and the
  ally/minion defeat sweep (`packages/engine/src/resolve/defeat.ts`) scans exactly `player.playArea`.** A synthetic
  minion built by state surgery for a test (the Rocket Raccoon interrupt test below) has to be placed in
  `player.playArea` (with `home: { kind: "playArea", playerId }`), _not_ `villainArea`, or its defeat is invisible
  to the sweep — it stays "in play" forever regardless of how much damage it's taken.
- **A villain phase that ends the game mid-resolution can cut off a later Response before it fires.** The Furnax
  test needed the main scheme's threat cleared first: left alone, his own scheme activation (his printed SCH, no
  ATK) stacked onto Rhino's own step-one threat completes the main scheme (a loss) the same villain phase he
  activates in, and the game ending appears to skip the still-queued Forced Response. Not chased further (no
  `gmw` card depends on the ordering); flagged here so the next person who hits "my Response never fires" checks
  `state.outcome` before assuming the ability is broken.
- **`AbilityCost.spendCounters` always spent counters off the ability's own card, with no way to spend them off a
  different target.** Caught by writing these very tests: Entangling Vines/Vine Shield/Vine Spikes (`gmw`
  16008/16010/16011) all say "remove 1 growth counter from **him** [Groot] and exhaust [this card] →" — the
  counters live on Groot's identity, not on the upgrade carrying the ability. Every one of the three abilities was
  _unconditionally unplayable_ (the cost could never be paid, so the interrupt was never even offered) until this
  landed. Fixed generically: `AbilityCost.spendCounters.target?: "self" | "identity"` (`packages/engine/src/
abilities.ts`), read in both `planCost`'s payability check and `payCost`'s payment (`packages/engine/src/
actions.ts`), with its own engine test (`packages/engine/src/abilities.test.ts`, "useAbility can pay a counter
  cost off the paying player's identity"). DSL: `removeCounter(counterType, n, { fromIdentity: true })`
  (`packages/cards/src/dsl/abilities.ts`). **This is the load-bearing lesson of this whole checkpoint: an
  untested registered ability reads as done in the coverage report while being silently unplayable.**

## 5. Genuine primitive gaps recorded this pass (all in `gmw/groot-kit.ts`, `KNOWN_SKIPPED`)

1. **`16006.we-are-groot-action`** — "Remove up to 4 growth counters from Groot → choose that many friendly
   characters." Needs a variable "spend up to N counters, X = amount spent" ability cost, the counter analog of
   `AbilityCost.resourcesX` (docs/phase7-wave3.md §3.25 only built the resource form). No existing primitive lets
   the number of counters actually removed drive the number of targets chosen.
   **Closed (docs/phase7-wave3.md §3.32, 2026-09-22).** New `spendCounters.upTo` and `bind`. The player sends the
   count as `costSelection.counters`; it must be at least 1 (RRG 1.8 "Cost", p. 14: "up to" still needs one). The
   builder is `removeUpToCounters` in `dsl/abilities.ts`. Script it as:

   ```ts
   heroAction(
     { cost: removeUpToCounters("growth", 4, { bind: "removed", fromIdentity: true }) },
     chooseTarget("friends", FRIENDLY_CHARACTER, { count: varOf("removed") }),
     giveTough(chosen("friends")),
   );
   ```

2. **`16009.lashing-vines-response`** — "After Groot uses a basic power" (RRG 1.8's "Basic Power" glossary entry
   covers ATK/THW/DEF/REC together, so this plausibly spans all three player-facing powers). The DSL's
   `on.attacks`/`on.thwarts` treat the acting character as the event's _source_; `on.defends`'s `defended` event
   carries the defender as its _target_ instead (`eventSubjects`, `packages/engine/src/trigger-events.ts`). No
   single `EventPattern` reaches all three with one subject role, and an `AbilityDefinition` carries exactly one
   trigger. Needs a `usesBasicPower(by)` pattern that composes both roles itself — flag to `game-rules-architect`
   if a second card ever needs the same wording (none does yet in `gmw`).
   **Closed (docs/phase7-wave3.md §3.28, 2026-09-22): no gap.** `on.basicPowerUsed(YOUR_IDENTITY)` already matches
   every basic power (attack, thwart, defense, recovery) with the character as the event's target. The one fix was
   engine-side: a defense's "after" window now waits for the attack to end (RRG 1.8 p. 16). Script it as:

   ```ts
   heroResponse(
     on.basicPowerUsed(YOUR_IDENTITY),
     { cost: [removeCounter("growth", 2, { fromIdentity: true }), exhaustThis] },
     ready(yourIdentity),
   );
   ```

3. **`16024.deft-focus-action`** — "reduce the resource cost of the next superpower card you play this turn by 1."
   Needs a standing "next matching card played this turn" cost-reduction rule, distinct from the interrupt-time
   reduction docs/phase7-wave3.md §3.20 built for Star-Lord's "What could go wrong?" (that one is offered live, at
   the point of paying for the card that triggers it — this one is banked ahead of time by an earlier action and
   has to survive until a later, unrelated card is played).
   **Closed (docs/phase7-wave3.md §3.29, 2026-09-22): no gap.** `reduceNextCardCost` already has a `"turn"`
   duration and a `cardFilter`, and nothing consumes it except a matching card. Script it as:

   ```ts
   heroAction({ cost: exhaustThis }, reduceNextCardCost(you, 1, "turn", { trait: SUPERPOWER }));
   ```

## 6. DSL builders added this pass

- **`min`/`max`** (`dsl/values.ts`): expose the engine's existing `ValueSpec` kinds of the same names (landed with
  docs/phase7-wave3.md §3.10, never wired to a DSL builder). "Remove that many growth counters (up to what's
  there)" is `min(eventAmount, countersOn(self, "growth"))`.
- **`addCounters`'s `opts.upTo`/`opts.bind`** (`dsl/effects.ts`): the builder only exposed `(counterType, n,
target)`; the engine's `EffectSpec addCounters` already carried `upTo`/`bind` (§3.10) with no way to reach them.
- **`on.thwarts`'s `basic` option** (`dsl/abilities.ts`): `on.attacks` already had it; `on.thwarts` didn't. Both
  read the same `attackKind: "basic"` `EventPattern` field, which the engine's matcher already accepts for both
  `"attack"` and `"thwart"` event kinds (`packages/engine/src/resolve/triggers.ts`) — no engine change needed.
- **`on.phaseBeginning(phase)` / `on.phaseEnding(phase)` / `on.villainStepResolved(step?)`** (`dsl/abilities.ts`):
  DSL builders for the three `TriggerEvent` kinds docs/phase7-wave3.md §3.2 landed in the engine but that nothing
  in `@mc/cards` had exposed yet. Used by Blazing Inferno ("After the villain phase begins").
- **`removeCounter`'s `opts.fromIdentity`** (`dsl/abilities.ts`): pairs with the engine change below (§4's last
  bullet) — "remove a counter from Groot" when the ability lives on a different card.
- **`on.attacks`'s `excessDamage` option** (`dsl/abilities.ts`): "After you deal excess damage to an enemy"
  ("Murdered You!", Rocket Raccoon's own hero identity, `gmw` 16029a). Reads the attack event's own `excessDealt`
  result (`resolve/event.ts`), the same field the `attack` _effect_'s own `bind` already exposed for a
  card-initiated attack (docs/phase7-wave3.md §0's Jan 26, 2026 (3) ruling) — this is the trigger-side sibling for
  a _basic_ attack, which has no effect-level bind to read. Since 2026-09-25 that result is the value overkill would
  spill (RRG 1.8 "Overkill", p. 31, superseding the Jan 26 ruling; docs/phase7-wave3.md §3.18).

**Engine changes this pass (minimal, generic, card-name-free, own tests):**

- `AbilityCost.spendCounters.target?: "self" | "identity"` (`packages/engine/src/abilities.ts`), read by
  `planCost`/`payCost` (`packages/engine/src/actions.ts`), tested in `packages/engine/src/abilities.test.ts`.
  Full rationale in §4.
- `excessDamageBonus` (`packages/engine/src/rules.ts`) is now re-exported from `packages/engine/src/index.ts`. It
  already existed (docs/phase7-wave3.md §3.18) but wasn't reachable from `@mc/cards` or its tests — used to test
  Follow Through (`gmw` 16045) as the constant it's modeled as, the same way `hasKeyword` already tests Dauntless.

## 6a. Rocket Raccoon's own gaps (in addition to §5's Groot gaps)

Recorded in `gmw/rocket-kit.ts`'s own module docblock (mirrors §5's format):

1. **`16032.schadenfreude-action`** ("Until the end of the turn, heal 2 damage from Rocket Raccoon each time you
   deal any amount of damage to an enemy") needs a "grant a standing triggered ability for a duration" primitive.
   `RuleSpec applyRuleUntil` only carries a `RuleSpec` (a static restriction/modifier), not an arbitrary reactive
   ability, so there is no way to express "each time X happens, do Y" as something that itself later expires.
   **Closed (docs/phase7-wave3.md §3.30, 2026-09-22):** `EffectSpec eachTimeUntil` (§3.17) was built for this card.
   It only lacked a builder. New builders: `eachTimeUntil` in `dsl/effects.ts` and `on.youDealDamage` in
   `dsl/abilities.ts`. "You" follows RRG 1.8 p. 49, and "deal" means damage dealt (p. 35). Script it as:

   ```ts
   heroAction(eachTimeUntil("endOfTurn", on.youDealDamage(query("enemy")), heal(2, yourIdentity)));
   ```

2. **`16033.salvage-response`** ("Response: After you spend this card, …") needs a trigger event for a card being
   spent as a resource payment — no such `TriggerEvent` kind exists.
   **Closed (docs/phase7-wave3.md §3.31, 2026-09-22): no gap.** `resourcesSpent` (DSL `on.youSpendThis()`,
   docs/phase7-wave2.md §12) is that trigger. It fires after the costs are paid and before the paid-for card
   resolves, and Salvage is already in the discard pile when it does. Script it as:

   ```ts
   response(
     on.youSpendThis(),
     chooseCards("tech", zone("discard", you, { filter: query("upgrade", { trait: TECH }) }), { min: 1, max: 1 }),
     moveCards(cards(chosen("tech")), "deckTop"),
   );
   ```

3. **`16048.flora-and-fauna-constant`/`-action`** (Rocket's own printing of the Team-Up card, identical at 16020
   in Groot's own range) — "a Rocket Raccoon upgrade" needs a `TargetQuery` for "belongs to a specific named
   character's card pool, independent of who controls it"; `identitySetOf` only reaches the _current player's_
   own identity-specific cards.
   **Closed (docs/phase7-wave3.md §3.34, 2026-09-22).** New `TargetQuery.titled` and `identitySetTitled`, whose
   names come from the card's own Team-Up keyword. They work for every Team-Up card, not just this one. The builders
   are `teamUpCharacters(index?)` and `ofTeamUpSet(index?)` in `dsl/values.ts`. Script both 16020 and 16048 as:

   ```ts
   heroAction(
     chooseOne(
       option(
         "Place 2 growth counters on Groot and ready him",
         addCounters("growth", 2, teamUpCharacters(0), { upTo: 10 }),
         ready(teamUpCharacters(0)),
       ),
       option(
         "Place 2 charge counters on a Rocket Raccoon upgrade and ready it",
         { when: exists(query("upgrade", ofTeamUpSet(1))) },
         chooseTarget("upgrade", query("upgrade", ofTeamUpSet(1))),
         addCounters("charge", 2, chosen("upgrade")),
         ready(chosen("upgrade")),
       ),
     ),
   );
   ```

   The `-constant` refs are the unparsed "Max 1 per deck" sentence, which the data fix removes.

4. **`16052.booster-boots-interrupt`** ("… discard the top card of your deck →") needs an `AbilityCost` component
   for discarding from your own deck as a cost. Flagged for `game-rules-architect` rather than added unilaterally
   this pass: RRG 1.8 "Deck" (p. 15)'s empty-deck reshuffle rule needs a decision for a cost specifically (refuse
   the ability, or reshuffle mid-payment?) that a rushed addition risks getting wrong.
   **Closed (docs/phase7-wave3.md §3.33, 2026-09-22).** New `AbilityCost.discardFromDeck`. It is payable only if the
   deck can supply every card. An empty deck with a discard pile is the deck the rules have already reshuffled
   (RRG 1.8 p. 33; ruling Apr 30, 2026 (3) answer 7), so it pays from the new deck; empty deck and discard pile
   cannot pay. The builder is `discardTopOfDeckCost` in `dsl/abilities.ts`. Script it as:

   ```ts
   heroInterrupt(
     when.damage(YOUR_IDENTITY, { fromAttack: true }),
     { cost: [exhaustThis, discardTopOfDeckCost()] },
     preventDamage(1),
   );
   ```

## 6b. Star-Lord's own gaps (`stld`, a separate concurrent session's pack)

Recorded in `stld/star-lord-kit.ts`'s own module docblock (mirrors §5/§6a's format); `stld` is otherwise fully
scripted (kit, obligation, nemesis, e2e — see §7's table):

1. **`17017.target-practice-interrupt`** ("Interrupt: When an ally with a weapon attachment upgrade makes an
   attack…") needs a `TargetQuery` filter asking whether a _character_ has an attachment matching some other
   query — the mirror of the existing `host`/`hostOfSelf` pair, which only ask about a candidate's _own_
   attachment relationship, not "does some other card in play consider this its host". Composing it as an
   `ifThen(exists(...))` guard inside the effects, rather than gating the trigger itself, would let the interrupt
   be offered (and Target Practice discarded) against an ally with no weapon at all — a real widening of the
   printed card, not an approximation worth shipping.
2. **`17029.agile-flight-action`** ("Remove a total of up to 5 threat from among schemes (as you choose)") needs
   an optional/"up to" form of `EffectSpec divide` — the existing builder always forces the full computed amount
   (`minSelections === maxSelections === amount`, docs/phase7-wave2.md §3.7's own Inconspicuous/Wasp Sting shape,
   which print "a total of N" with no "up to"), with no way for the player to choose to remove less.
3. **`17005.sliding-shot-constant`** ("Play only if you control an Element Gun") looked scriptable as a
   `constant` ability with a `cannotPlay` rule, but a `constant`'s rules are only active while its _own card is
   in play_ (`activeRules`/`activeAbilityRefs`, `packages/engine/src/select.ts`: both iterate `cardsInPlay(state)`)
   — and an event card being evaluated for whether it may be played from hand is never itself in play yet.
   Verified by writing the test: the restriction silently never applied. `playRestrictions` (the schema field
   that already covers "requires an identity trait/form") has no "controls a named card" case either. Needs
   either a new `playRestrictions` case or a play-time-evaluated rule kind distinct from the in-play-only
   `constant` rules.

**DSL builders added this pass (`stld` session, `packages/cards/src/dsl/`):** `dealtEncounterCount` (values.ts);
`defeat`, `cancelConsequentialDamage` (effects.ts); `AbilityOptions.playCostReduction` plus its pass-through in
`build()`, `dealEncounterCardsCost`, `firstRevealGainsSurge`, `on.attacksOrThwarts`, `on.cardPlayed`
(abilities.ts). No engine change.

## 6c. Traps hit scripting Brotherhood of Badoon (test-only, cost real time — read before repeating them)

- **`locateCard` scans the encounter deck before `villainArea`.** Test surgery that _adds_ a card id to
  `state.villainArea` without also _removing_ it from wherever it already sits (almost always the encounter deck
  it hasn't been drawn from) leaves the card locatable in both places; the next thing that moves it (its own
  discard-this-card cost, say) finds it via the deck first, silently leaving a stale duplicate in `villainArea`
  forever. Fixed generically with `packages/cards/src/testing/staging.ts`'s new `encounterCardInVillainArea` (the
  `@mc/cards` port of `packages/engine/src/testing/wave3.ts`'s own same-named helper, which already knew this) —
  use it instead of hand-rolling `{ ...state, villainArea: [...state.villainArea, id] }`.
- **`CardInstance.home` does not track "is this card in the villain area".** Its type (`CardHome`) is narrower
  than `ZoneId` on purpose — it only ever names a deck/discard/player-home kind, for routing a _later_ discard
  ("whose discard pile does this go to"), not the card's current location. A revealed environment or side scheme
  keeps `home: { kind: "encounterDeck", … }` forever, even while sitting in `villainArea`; `locateCard` (which
  scans the actual zone arrays) is the only authority on "where is this card right now". Don't try to "fix" a
  test by setting `home` to a location kind it can't express — `CardHome`'s own type will refuse it, correctly.
- **A minion put into play via `putIntoPlay` (a "[star] Boost: put X into play engaged with you" body) does emit
  `minionEngaged`**, through the same effect's own `entering` branch (`resolve/apply-effect.ts`'s `case
"putIntoPlay"`) — a minion's own Forced Response to "engages you" fires correctly whichever way it enters play,
  reveal or boost. No gap here; recorded only because it was worth checking rather than assuming.
- **A card drawn as a filler ahead of a staged reveal can itself have Surge, or a scenario's villain can deal more
  than one boost card for one activation** — `stackEncounterDeck(state, "01186", "<code>")`'s usual one-filler
  recipe (`docs/card-scripting-process.md` §7) is not a universal constant; if a reveal-triggered test's target
  still shows `engagedWith: null`/isn't the card you expect, check the actual event trace
  (`../testing/staging.ts`'s `driveEvents`) for how many `boostCardFlipped`/`encounterCardRevealed` pairs actually
  happened before assuming the ability itself is broken. Brotherhood of Badoon's own villain phase deals Drang two
  boost cards for a single scheme activation (Badoon Ship's own environment does not explain this; not chased
  further since every test in this pass that needed a _specific_ card revealed used the zero-filler "stack it
  alone, let it become the boost card" path instead, which is exact and doesn't depend on the count).
- **`instancesOf(state, code)` returns every printed copy, not "the one that just did something."** Multiple
  copies of the same minion (Badoon Grunt, Badoon Assassin, …) exist in a scenario's own deck; picking
  `instancesOf(...)[0]` after driving an ability is a coin flip. Filter by the property the ability actually
  changed (`engagedWith === P1`, `attachedTo === villain`, …) instead.

## 6d. The ten `gmw` gaps, closed (`game-rules-architect`, second primitives pass, 2026-09-22)

Each of the ten refs `KNOWN_SKIPPED` held as a primitive gap now has either new vocabulary or a proof that the
existing vocabulary already covered it. docs/phase7-wave3.md §3.28–§3.36 has the rules decision, the citation and
the engine test for each one. `packages/cards/src/dsl/wave3-primitives.test.ts` validates every composition below.
Drop each ref from `KNOWN_SKIPPED` when you script it.

| Ref                                                            | Closed by                                                                              | Builder(s)                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `16009.lashing-vines-response`                                 | existing `basicPowerUsed` (§3.28), plus a defense-timing fix                           | `on.basicPowerUsed(YOUR_IDENTITY)`                                  |
| `16024.deft-focus-action`                                      | existing `reduceNextCardCost` `"turn"` (§3.29)                                         | `reduceNextCardCost(you, 1, "turn", { trait: SUPERPOWER })`         |
| `16032.schadenfreude-action`                                   | existing `eachTimeUntil` (§3.17, §3.30)                                                | `eachTimeUntil`, `on.youDealDamage` (new)                           |
| `16033.salvage-response`                                       | existing `resourcesSpent` (§3.31)                                                      | `on.youSpendThis()`                                                 |
| `16020.flora-and-fauna-action`, `16048.flora-and-fauna-action` | new `TargetQuery.titled` / `identitySetTitled` (§3.34)                                 | `teamUpCharacters(i)`, `ofTeamUpSet(i)` (new)                       |
| `16060.when-revealed`                                          | new `PlayerRef superlative`, `choosePlayer.among` (§3.35)                              | `superlativePlayer`, `choosePlayer(slot, chooser, { among })` (new) |
| `16006.we-are-groot-action`                                    | new `spendCounters.upTo` / `bind`, `costSelection.counters` (§3.32)                    | `removeUpToCounters` (new)                                          |
| `16052.booster-boots-interrupt`                                | new `AbilityCost.discardFromDeck` (§3.33)                                              | `discardTopOfDeckCost` (new)                                        |
| `16073b.the-grand-collection-action`                           | new `AbilityCost.either`, `costSelection.branch`, `AbilityLimit.per: "player"` (§3.36) | `eitherCost`, `oncePerRoundPerPlayer` (new)                         |

The compositions are in §5 and §6a above and in docs/phase7-wave3.md. Drang III's, from §3.35:

```ts
whenRevealed(
  discardEncounterCards(perHero(4), {
    forEachDiscarded: {
      slot: "discarded",
      effects: [
        ifThen(refMatches(chosen("discarded"), query("minion"), { anywhere: true }), [
          choosePlayer("fewest", firstPlayer, {
            among: superlativePlayer("lowest", countOf(query("minion", { engagedWithPlayer: thatPlayer }))),
          }),
          putIntoPlay(chosen("discarded"), chosenPlayer("fewest")),
        ]),
      ],
    },
  }),
);
```

**Three more, found by the Escape the Museum pass** (docs/phase7-wave3.md §3.37, §3.38):

| Ref / card                                                                   | Closed by                                                                                                                 | Use                                                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 16082b / 16083b "If this stage is completed, the players lose the game."     | new `MainSchemeStage.completionLoses` (§3.37). It is data, so no ability ref is needed; `card-data-pipeline` must emit it | nothing to script; drop the tests' threat-reset workaround once `gmw` is re-emitted                             |
| `16085a.this-way`                                                            | `AbilityLimit.per: "player"` (§3.36)                                                                                      | `heroAction({ cost: dealEncounterCardsCost(1), limit: oncePerRoundPerPlayer }, removeThreat(5, theMainScheme))` |
| `16085b.hold-on-to-your-butts` (+ `-constant`, `-constant-2` as `partOf` it) | existing `dealIndirectDamage("group", …)`, RRG 1.8 p. 24 "among players" (§3.38)                                          | see below                                                                                                       |

```ts
forcedInterrupt(
  on.phaseBeginning("villain"),
  chooseOneBy(
    firstPlayer,
    option(
      "Exhaust the Milano → assign 2[per_hero] indirect damage among players",
      { when: exists(query("support", { name: "Milano", exhausted: false })) },
      exhaust(named("Milano")),
      dealIndirectDamage("group", perHero(2)),
    ),
    option("Assign 3[per_hero] indirect damage among players", dealIndirectDamage("group", perHero(3))),
  ),
);
```

**The last seven wave 3 gaps (`game-rules-architect`, third primitives pass, 2026-09-23).** docs/phase7-wave3.md
§3.39–§3.45 has the rules decision, the citation and the engine test for each one;
`packages/cards/src/dsl/wave3-primitives-2.test.ts` validates every composition below. Drop each ref from
`KNOWN_SKIPPED` when you script it. `19013.moondragon-action` was scripted with §3.23 (§4 Q12, decided 2026-09-23).

| Ref                               | Closed by                                                          | Builder(s)                                                       |
| --------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `16114.when-revealed`             | new `PlayerRef controllerOf` (§3.39) + `hasAttachment` (§3.40)     | `controllerOf`, `hasAttachment` (new)                            |
| `17017.target-practice-interrupt` | new `TargetQuery.hasAttachment` (§3.40)                            | `hasAttachment` (new)                                            |
| `17029.agile-flight-action`       | new `EffectSpec divide.upTo` (§3.41)                               | `divide(…, { upTo: true })`                                      |
| `17005.sliding-shot-constant`     | new `constant.playOnlyIf` (§3.42)                                  | `playOnlyIf` (new)                                               |
| `16131.kree-combat-armor-action`  | new `AbilityCost.sameResourceType` (§3.43)                         | `spendSameType` (new)                                            |
| `19012.martyr-response`           | consequential damage carries its attack's results (§3.44)          | `after.consequentialDamage` (new)                                |
| `19032.regroup-interrupt`         | new `setDefeatDestination`, `characterDefeated.fromAttack` (§3.45) | `setDefeatDestination`, `on.defeated(…, { byAttackFrom })` (new) |

Single-Minded Fury (`16114.when-revealed`). "Controls the Power Stone" is "attached to your identity" (§4 Q11). With
the stone on the villain the ref names nobody, no attack is made, and the card surges (§3.39):

```ts
whenRevealed(
  enemyAttack(theVillain, {
    against: controllerOf(each(query("identity", hasAttachment({ name: "Power Stone" })))),
    bind: "fury",
  }),
  ifThen(not(made("fury")), surge()),
);
```

Target Practice (`17017.target-practice-interrupt`). The filter is on the trigger, so an ally without a weapon never
offers it (§3.40):

```ts
interrupt(
  on.attacks(query("ally", hasAttachment(query("upgrade", { trait: WEAPON })))),
  { cost: discardThis },
  modifyStat("atk", 2, eventSource, "endOfAttack"),
);
```

Agile Flight (`17029.agile-flight-action`). The chooser may divide fewer than 5 points, even none (§3.41, §4 Q16):

```ts
heroAction({ label: "thwart" }, divide("threat", 5, query("scheme"), { upTo: true }));
```

Sliding Shot (`17005.sliding-shot-constant`). The condition is read from the card while it is being played, so it
works although the event is not in play (§3.42). No data change is needed: the ref already exists. The same builder
covers the other seventeen "Play only if …" cards §3.42's survey lists, each on its own "-constant" ref:

```ts
constant(playOnlyIf(exists({ name: "Element Gun", controller: "you" })));
```

Kree Combat Armor (`16131.kree-combat-armor-action`). A wild counts as any type; a card printing two types gives one
and overpays the other; `legalActions` offers it only when the hand can pay (§3.43):

```ts
heroAction({ cost: spendSameType(3) }, discard(self));
```

Martyr (`19012.martyr-response`). The response stays on the consequential damage, so the tough status card arrives
after that damage and cannot absorb it (§3.44):

```ts
response(after.consequentialDamage("self", { from: "attack", defeated: true }), giveTough(self));
```

Regroup (`19032.regroup-interrupt`). The ally is still defeated (When Defeated and "after … is defeated" still
apply); only its discard is replaced. Any player's ally, since the card does not say "your" (§3.45, §4 Q17):

```ts
interrupt(when.defeated(query("ally"), { byAttackFrom: query("enemy") }), setDefeatDestination("hand"));
```

**The last two wave 3 gaps (`game-rules-architect`, fourth pass, 2026-09-23), scripted in the same pass.**

| Ref                                 | Closed by                                                                                          | Builder(s)                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `16125.the-poison-forced-interrupt` | a turn beginning opens an interrupt window; an attachment's "you" is its host's controller (§3.46) | `forcedInterrupt(on.yourTurnBegins(), …)`       |
| `90005.when-revealed`               | new `EffectSpec dealAsEncounterCard` (§3.47)                                                       | `dealAsEncounterCard(chosen("discarded"), you)` |

## 7. Progress / next up

**Foundation: done.** `wave3/{index,cards,reprints,names,setup,testing,coverage.test}.ts` all exist and are green.

**A checkpoint-1 report first claimed "every ability backed by a real-command test" without actually checking —
9 of Groot's 19 registered refs had no test at all (an interrupt/response with an unpayable cost among them,
found only once a test was actually written for it; see §4's last bullet).** Fixed same session: every ref below
now has one, verified by name in the handoff report. **The standing rule this earned: before claiming a pack
"done", diff the ability ids a module registers against the ability ids its own test file(s) actually exercise —
don't trust the coverage report alone, it only proves a ref _resolves_, never that it's _correct_ or _reachable_.**

**That standing rule is now a structural guard, not just a rule to remember (2026-09-22 checkpoint).**
`wave3/coverage.test.ts`'s new "wave 3 pack ability id coverage" describe block fails for any ability id a
started pack's own registry defines whose full id string doesn't appear in that pack's own `*.test.ts` files. On
first run it flagged 46 `gmw` ids (all real tests that simply never named the id — `groot-kit.ts`/`rocket-
kit.ts`/`ship-command.ts`/`groot-obligation-nemesis.ts`/`rocket-obligation-nemesis.ts` — plus 9 genuinely
untested `badoon.ts` refs: `16059.drang-forced-response`, `16059.when-revealed`, `16060.drang-forced-response`,
`16061b.terrestrial-invasion-forced-response`, `16062a.when-revealed`, `16062b.protect-the-planet-constant`,
`16062b.protect-the-planet-forced-response`, `16065.badoon-engineer-forced-response`, `16065.boost`, `16067.
bombardment-forced-response`, and `16117.boost`). All are now covered: the 46 by adding the id to the existing
test's title, the 11 by new tests that reach Drang II/III (a real combat-driven defeat→advance for the When
Revealed ones, direct `stageIndex` surgery for the live forced responses), Protect the Planet's own stage
advance and both First Player Action branches, and Badoon Engineer/Bombardment/Badoon Assassin's boost bodies
(the latter two via the event log's own `abilityResolved`/`traceAbilities`, since Charge Up's own 4-counter reset
makes a final-barrage-count assertion read 0 even when the ability fired). `gmw`'s guard is green with zero
`KNOWN_SKIPPED`-adjacent exceptions. The guard also carries a `stld` `PENDING` allowlist (22 ids, all genuinely
tested but not id-named — see the guard's own docblock for the discrepancy between that count and the 2 the
originating brief expected) and a `gam` entry (13 ids fixed by title, `18001b.gamora-constant` exempted via a
structurally-checked `coveredByEngineRule()` citation rather than a bare allowlist entry).

**`gmw` status: in progress.**

| Piece                                                                                                                                                                                                                                                                                                                                                                                                                        | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Groot's identity (16001a/b)                                                                                                                                                                                                                                                                                                                                                                                                  | Scripted, tested (Flora Colossus, Growth Spurt)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Groot's kit (16002–16024)                                                                                                                                                                                                                                                                                                                                                                                                    | Scripted except §5's three gaps; every registered ref tested — see the handoff report for the ref→test mapping                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Groot's obligation/nemesis (16025–16028)                                                                                                                                                                                                                                                                                                                                                                                     | Scripted, every registered ref tested (Wilt ×3, Fan the Flames, Blazing Inferno, Furnax)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Groot e2e                                                                                                                                                                                                                                                                                                                                                                                                                    | 1 test, `groot-kit/e2e.test.ts` (Rhino, standard, solo)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Rocket Raccoon's identity/kit (16029–16052)                                                                                                                                                                                                                                                                                                                                                                                  | Scripted except §6a's four gaps; every registered ref tested — see the handoff report for the ref→test mapping                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Rocket Raccoon's obligation/nemesis (16053–16057; 16058–16060 are Brotherhood of Badoon's villain Drang, not Rocket's — see below)                                                                                                                                                                                                                                                                                           | Scripted, every registered ref tested (Crisis on Halfworld ×3, Blackjack's Bazooka, Planetary Invasion)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Brotherhood of Badoon (villain Drang 16058–16060, main scheme 16061–16062, Badoon Ship, Drang's Spear, Badoon Engineer, the four side schemes 16063–16069)                                                                                                                                                                                                                                                                   | Scripted except 16060.when-revealed (module docblock in `gmw/badoon.ts`: needs a player-level superlative, "the player engaged with the fewest minions"; **gap closed: docs/phase7-wave3.md §3.35, see §6d**); every other registered ref tested — see `gmw/badoon.test.ts`, `gmw/band-of-badoon.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Band of Badoon modular (16117–16121)                                                                                                                                                                                                                                                                                                                                                                                         | Scripted, every registered ref tested (`gmw/band-of-badoon.test.ts`) — 16121's overkill grant is pinned structurally rather than by a live spillover combat test (see that file's own comment: a full attack/defend/assign sequence to land excess damage on a _third_ character is more scaffolding than this pass built)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Ship Command modular (16142–16148, used by 4 of 5 scenarios)                                                                                                                                                                                                                                                                                                                                                                 | Scripted, every registered ref tested (`gmw/ship-command.test.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Brotherhood of Badoon e2e                                                                                                                                                                                                                                                                                                                                                                                                    | 1 test, `gmw/brotherhood-of-badoon-e2e.test.ts` (standard, solo, Groot) — plays to a real outcome, replays deep-equal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Infiltrate the Museum (villain Collector I–III 16070–16072, main scheme The Grand Collection 16073a/b, encounter set 16074–16079, Menagerie Medley 16135–16137)                                                                                                                                                                                                                                                              | Scripted except `16073b.the-grand-collection-action` (needs a true either/or `AbilityCost`, module docblock in `gmw/museum.ts`); every other registered ref tested — see `gmw/museum.test.ts`. 16079 (Caught Off Guard) is a verbatim reprint of Core's 01188, aliased automatically (`../reprints.ts`) rather than scripted here — caught by `mergeRegistries`'s own duplicate-id guard; `wave3/reprints.test.ts` (new, mirrors `wave2/reprints.test.ts`, a shared-file gap this pass filled) pins it.                                                                                                                                                                                                                                                                                                                                                                       |
| Escape the Museum (villain Collector A1/A2/B1/B2 16080–16081, main scheme The Missing Milano → Lost in the Museum → The Great Escape 16082–16084, Library Labyrinth/Museum Ship 16085, treacheries 16086–16087)                                                                                                                                                                                                              | Scripted except Library Labyrinth/Museum Ship (16085a's Hero Action needs `AbilityLimit.per` for a per-acting-player key; 16085b's three refs need an "assign indirect damage among players" primitive) — module docblock in `gmw/escape-the-museum.ts`. **Known unfixed correctness gap, same docblock:** "if this stage is completed, the players lose the game" on the two non-final stages (1B/2B) isn't implemented — the emitted data gives that whole two-sentence text box one ability ref, already spent on the "advance when the last threat is removed" response, and an `AbilityDefinition` carries one trigger; a real villain phase that reaches stage 1/2's ordinary _target_ threat currently advances instead of losing. Every other registered ref tested — see `gmw/escape-the-museum.test.ts`. Galactic Artifacts (required here too) is not yet reached. |
| Nebula (villain Nebula I–III 16088–16090, main scheme The Art of Evasion → Warp Drive Initiated 16091–16092, Nebula's Ship 16093, five Technique attachments 16094–16098, Lethal Intent 16099, Barrel Roll/Combat Ready 16100–16101, Space Pirates modular 16138–16141, Power Stone 16149), and its own treachery Ruthless (16102)                                                                                           | Scripted, no genuine primitive gaps — every registered ref tested, see `gmw/nebula.test.ts`. Power Stone (16149) is scripted here (its first scenario) and shared by Ronan the Accuser once that scenario lands. Ruthless (16102) was left in `KNOWN_SKIPPED` by the original pass with no recorded reason — a bare oversight, not a primitive gap; scripted separately in `gmw/ruthless.ts` (docs/phase7-wave3.md doesn't list a new file per card, but the brief asked for it to stay out of `nebula.ts`), tested in `gmw/ruthless.test.ts`.                                                                                                                                                                                                                                                                                                                                |
| Ronan the Accuser (villain Ronan I–III 16103–16105, main scheme Interception Imminent → "Take What Is Mine" 16106–16107, Kree Command Ship 16108, Universal Weapon 16109, Fanaticism 16110, Cut the Power/Pincer Maneuver/Superior Tactics 16111–16113, Single-Minded Fury/Kree Physiology/"You Stand Accused!" 16114–16116, Kree Militants modular 16131–16134; 16117–16121 already done above, shared with Band of Badoon) | Scripted except `16114.when-revealed` (needs a `PlayerRef` for "whoever's identity a named card is attached to", module docblock in `gmw/ronan.ts`) and `16131.kree-combat-armor-action` (needs a "same type" resource cost, same docblock — the gap flagged below was confirmed real). Every other registered ref tested, see `gmw/ronan.test.ts`; `gmw/ronan-e2e.test.ts` plays it to a real outcome. **Note for the next `gmw` session:** `AbilityCost.sameResourceType`/`spendSameType` (docs/phase7-wave3-scripting.md §6, "Kree Combat Armor") landed in this same merge window, so `16131.kree-combat-armor-action` is very likely closeable now with `heroAction({ cost: spendSameType(3) }, discard(self))` — not applied here, since `gmw/ronan.ts` was outside this session's assigned scope and a concurrent `gmw` session owns it.                               |
| Galactic Artifacts modular set (16122–16130, five attachments and four side schemes)                                                                                                                                                                                                                                                                                                                                         | Fully scripted. `16125.the-poison-forced-interrupt` closed when a turn beginning gained an interrupt window (docs/phase7-wave3.md §3.46). Every registered ref tested, see `gmw/galactic-artifacts.test.ts`. "Attach to the enemy/your identity with …" is data (`AttachmentCard.attachesTo`), already emitted; "Any player can do this" (Obedience Potion 16123, The Poison 16125) needed nothing new — an unowned attachment's Hero Action is already offered to every player (`legal.ts`'s `actionAbilities`).                                                                                                                                                                                                                                                                                                                                                             |
| Badoon Headhunter modular set (16183–16185; the minion, treachery pair)                                                                                                                                                                                                                                                                                                                                                      | Scripted, no genuine primitive gaps, every registered ref tested — see `gmw/badoon-headhunter.test.ts`. Confirmed modular, not campaign-only, per docs/phase7-wave3.md §1.7/§4 Q3 (`card-data-pipeline`, 2026-09-22): `EncounterSet.campaignSpecific` is `false` for it, so it is scripted here rather than deferred with The Market/Campaign Challenge. Exercised by swapping it into an existing scenario's recommended modular slot via `modularSetIds` (no `gmw` scenario names it in its own 1A "Contents").                                                                                                                                                                                                                                                                                                                                                             |
| Campaign-only cards (The Market 16150–16177, Campaign Challenge 16178–16182)                                                                                                                                                                                                                                                                                                                                                 | **Deferred to campaign mode (C2)** — stay in `KNOWN_SKIPPED` with reason "campaign mode deferred", the `trors` 04155–04166 precedent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Escape the Museum landed** (§1.1's ∞-hit-point Collector A2/B2 faces, the mode-labelled villain
pair 16080a/16081a, main scheme The Missing Milano → Lost in the Museum → The Great Escape, its own encounter set
16082–16087) — see the table row above for its own two remaining gaps (one skipped in `KNOWN_SKIPPED`, one a
known-but-unfixed correctness gap that isn't).

**Nebula landed** (`gmw/nebula.ts`): villain Nebula I–III, main scheme The Art of Evasion → Warp Drive Initiated,
Nebula's Ship, the five Technique attachments, Lethal Intent, Barrel Roll, Combat Ready, the Space Pirates modular
set (16138–16141), and the Power Stone modular card (16149, its first scenario). No genuine primitive gaps — every
`gmw` primitive Nebula needed had already landed for `stld`/`gam`/`vnm` before this session. **Two things this
session found and fixed, both flagged in `gmw/nebula.ts`'s own module docblock:**

- **Engine bug: `resolveSpecials({ cards })` didn't inherit the calling ability's controller.** A Special ability's
  own "you" (Evasive Maneuvering's "You are stunned.", Weapon Mastery's "Take 1 damage.") resolved to `null` when
  instructed by a villain's own Forced Interrupt, because the attachment itself (attached to the villain, an
  encounter card) has no controller of its own — silently a no-op. Fixed generically in
  `packages/engine/src/resolve/effects-frame.ts`'s `executeResolveSpecials`: falls back to the calling context's
  controller (RRG 1.8 "You, Your", p. 49: when a card has no controller, "you" is whoever the ability text
  concerns). Own engine test, `packages/engine/src/resolve-specials-controller.test.ts`, verified to fail on the
  unpatched code before landing the fix. `resolveSpecials({ of })` (a Boost ability's own "attach this card and
  resolve its Special") was already correct — only the `{ cards }` query path used by a Forced Interrupt/Response
  needed the fix.
- **Scripting trap: an optional `chooseTarget` silently does nothing under `firstLegal`.** Nebula II's own "choose
  and discard 1 of those attachments" is mandatory (no "may"), but was first written with `{ optional: true }` —
  `minSelections` then reads 0, and `firstLegal`'s `slice(0, minSelections)` declines it, so nothing gets chosen
  or discarded. A mandatory `chooseTarget` with zero legal candidates already resolves gracefully to nothing
  chosen on its own (`requestTargetChoice`'s own guard), so `optional` should only be reached for a printed "you
  may" — caught only because the test asserted an exact outcome rather than `toBeDefined()`.
- **Test-only trap, reconfirmed:** `instancesOf(state, code)` is ambiguous for any card with `quantityInSet > 1`
  (Cutthroat Ambition/Weapon Mastery/Wide Stance/Barrel Roll/Combat Ready ×2, Pirate Lackey ×4, Honor Among Thieves
  ×2) — `docs/card-scripting-process.md` §7's own standing trap, hit again scripting the Boost-body tests; fixed by
  tracking the exact staged instance id before calling `stackEncounterDeck`, not `instancesOf(...)[0]` after.

**Ronan the Accuser landed** (`gmw/ronan.ts`): villain Ronan I–III, main scheme Interception Imminent → "Take What
Is Mine", Kree Command Ship, Universal Weapon, Fanaticism, Cut the Power/Pincer Maneuver/Superior Tactics,
Single-Minded Fury/Kree Physiology/"You Stand Accused!", and the Kree Militants modular set. Two genuine primitive
gaps, both flagged in the table row above and `gmw/ronan.ts`'s own module docblock: `16114.when-revealed` (a
`PlayerRef` for "whoever's identity a named card is attached to" — no existing primitive inverts "the card attached
to a target" into "the player who controls whatever card matches a query") and `16131.kree-combat-armor-action`
(the "same type" resource cost this doc's own table already flagged as likely, now confirmed).

**Two traps hit scripting Ronan, beyond the standing ones — both recorded in `gmw/ronan.ts`'s and `gmw/
ronan.test.ts`'s own module docblocks, worth reading before repeating them:**

- **Ronan's own "Toughness" keyword gives him a tough status card at setup** (RRG 1.8 "Toughness", p. 45): a test
  that primes his damage dial and lands one small attack, expecting a kill, silently does nothing until the tough
  card is cleared first — it absorbs the whole hit instead. Cost real time across the Ronan II/III defeat-chain
  tests before being caught.
- **The Power Stone starts attached to the first player's identity** (16106a's own Setup text prints it), so "you
  control the Power Stone" — and the Forced Interrupt's own extra boost card — is already _true_ in the default
  post-setup state. Any test staging a specific card as _the_ boost card for Ronan's own activation has to move
  the stone off the identity first, or the extra boost card silently consumes the staged card as a second,
  unplanned boost draw — the same "villain deals more than one boost card" trap `gmw/badoon.ts`'s own §6c note
  names, just triggered by this scenario's own printed setup rather than a card in play. Also caught: a treachery
  with Surge (Kree Physiology, 16115) chains into a _second_ reveal regardless of whether its own When Revealed
  was cancelled, confounding a single-cancellation test — switched to a non-Surge treachery ("You Stand Accused!", 16116) for the Kree Command Ship cancellation test instead of chasing the chain.

**Engine bug found and fixed this session:** `resolveSpecials({ cards })` (a query, not a specific card) didn't
inherit the calling ability's controller. A Special ability's own "you" (Evasive Maneuvering's "You are stunned.",
Weapon Mastery's "Take 1 damage.") resolved to `null` when instructed by a villain's own Forced Interrupt, because
the attachment itself — attached to the villain, an encounter card — has no controller of its own; silently a
no-op. Fixed generically in `packages/engine/src/resolve/effects-frame.ts`'s `executeResolveSpecials`: falls back
to the calling context's controller (RRG 1.8 "You, Your", p. 49). Own engine test,
`packages/engine/src/resolve-specials-controller.test.ts`, verified to fail on the unpatched code before landing.
`resolveSpecials({ of })` (a Boost ability's own "attach this card and resolve its Special") was already correct.

`MC_REFS_PACKS=gmw pnpm refs` is the up-to-date source of truth for exactly which refs remain (Galactic Artifacts,
16122–16130, needed by Infiltrate the Museum/Escape the Museum, not Nebula or Ronan; the campaign-only Market/
Campaign Challenge/Badoon Headhunter cards) — the table above is a snapshot, that command is not.

**A new `ValueSpec mainSchemeStageNumber` and `CardDestination "encounterSetAside"` landed this session**
(`packages/engine/src/spec.ts`/`select.ts`/`resolve/cards.ts`, own tests `main-scheme-stage-number.test.ts` and
`encounter-set-aside-destination.test.ts`): the main-scheme analog of the already-landed `villainStageNumberOf`
("Collector gets +X SCH and +X ATK, where X is equal to the main scheme's current stage number"), and the
missing _send_ direction of the shared set-aside pile `moveCards` could already _read_ from
(`CardSelector.encounterSetAside`) but not move cards into ("Set aside the Ship Command modular encounter set").
DSL: `dsl/values.ts`'s `mainSchemeStageNumber`; the destination is a plain string literal, no DSL wrapper needed.

**Infiltrate the Museum's own genuine primitive gap:** `16073b.the-grand-collection-action` ("Hero Action: Choose
to either exhaust your hero or spend 2 resources of any type → discard 1 card from The Collection …") needs a
true either/or `AbilityCost` — pay _one_ of two different cost shapes, the player's choice — distinct from
`cost: [a, b]`, which is an AND (`dsl/abilities.ts`'s `mergeCosts`). No card scripted before this pass has needed
one; flagged to `game-rules-architect` rather than approximated.

**Closed (docs/phase7-wave3.md §3.36, 2026-09-22).** New `AbilityCost.either`: the player sends the branch as
`costSelection.branch`, and `legalActions` lists the payable ones in `costBranches`. New `AbilityLimit.per:
"player"` covers "(Limit once per round per player.)", here and on Library Labyrinth 16085a. The builders are
`eitherCost` and `oncePerRoundPerPlayer` in `dsl/abilities.ts`. Script it as:

```ts
heroAction(
  { cost: eitherCost(exhaustYourHero, spend(2)), limit: oncePerRoundPerPlayer },
  chooseCards("card", scenarioArea("The Collection"), { min: 1, max: 1 }),
  moveCards(cards(chosen("card")), "discard"),
);
```

**One engine change this pass (minimal, generic, own test):** `RuleSpec discardFromPlayDestination` (docs/phase7-
wave3.md §3.14) gains an optional `thenPlaceThreat?: number`. Collector III's own printed ability is one Forced
Interrupt box ("…instead, then place 1 threat on the main scheme"), and only a villain's _current_ stage's own
abilities are active (RRG 1.8 "Villain Defeat", p. 47) — so the redirect and its follow-up have to be one ability
id (`16072.collector-forced-interrupt`), not the redirect plus some other card's own response to the announced
`discardRedirected` event (the engine's own `scenario-area.test.ts` only used two cards to prove that event is
independently usable — a stand-in, not the intended per-card shape). `leavePlay` (`packages/engine/src/
effects.ts`) now places the follow-up threat itself, immediately after announcing the redirect, through the
ordinary interruptible `placeThreat` event — `rules.ts`'s `discardRedirectArea` returns the matched rule's
`thenPlaceThreat`/source instead of a bare area string, and a new `mainSchemeForRedirect` resolves the right main
scheme (respecting a separate game area, though `gmw` never splits one). New test in `packages/engine/src/
scenario-area.test.ts` (6th test, `COLLECTOR_III_RULE`/`startAgainstCollectorIII`), pinned with a card-name-free
synthetic villain the same way the file's existing tests are.

**DSL builders added this pass (`packages/cards/src/dsl/`):** `scenarioArea`, `createScenarioArea` (effects.ts);
`scenarioAreaCount` (values.ts) — docs/phase7-wave3.md §3.14 landed the engine primitives but nothing in `@mc/cards`
had exposed them yet (`CardSelector.scenarioArea` and `CardDestination.scenarioArea` were already plain data, used
directly with no wrapper needed). `RuleSpec attacksDealIndirectDamage` (§3.16, Starshark) needed no new builder —
the existing `rule(...)` passthrough carries it.

**A `gmw`-specific engine gap found and fixed this session:** `enterPlayOnReveal`'s per-type switch
(`packages/engine/src/resolve/reveal.ts`) had no `"support"` case, so `putIntoPlay` on an ownerless, scenario-
specific support (the Milano, 16142: `specificTo: { kind: "scenario" }`, never in a player's deck) silently did
nothing — the card never entered a play area. Fixed generically (any ownerless support, not just the Milano):
given the same "moves to a play area, `entered = true`" treatment `"obligation"` already had, plus setting
`controllerId`. New engine test: `packages/engine/src/scenario-support-setup.test.ts`. A second, `wave3/setup.ts`-
level gap: nothing populated `GameSetupConfig.setAside` for `specificTo: { kind: "scenario" }` cards at all, so the
Milano had no instance to find in the first place; fixed with `scenarioSpecificSetAside`, generic over any pack's
scenario-specific card, in `buildSingleVillain`.

**Two DSL/engine additions this session, both generic:**

- **`Predicate currentActivationIs`** (`{ kind: "currentActivationIs"; activation: "attack" | "scheme" }`,
  `packages/engine/src/spec.ts`/`select.ts`; DSL: `activationIs(...)`, `dsl/values.ts`) — "If this activation is an
  attack/scheme" (Badoon Warlord 16121, Badoon Lieutenant 16119), readable from a Boost ability body (which has no
  `context.event` of its own). Engine test: `packages/engine/src/current-activation.test.ts`.
- **`adjustBoostCount`/`replaceBoostCount` no longer require `boost.step === "count"`** (`resolve/apply-effect.ts`)
  — `step === "ability"` (a card's own "[star] Boost:" ability still resolving) now qualifies too, since both
  steps share the same `boost.countAdjust` field. Needed for the same two cards' own "this card gets +2 boost
  icons for this activation" text, printed under the Boost keyword itself. Same engine test file as above.
- **DSL: `firstPlayerAction`, `resource`'s `forAnyPlayer` option, and `firstPlayerOnly` on `action`/`interrupt`/
  `response`** (`dsl/abilities.ts`) — docs/phase7-wave3.md §3.13 landed the engine primitive but nothing in
  `@mc/cards` had exposed it yet; needed for the Milano's own "First Player Action"/"Piloting — Resource" text and
  every side scheme's "First Player Action: Exhaust the Milano → …".

**`stld` status: done.** Star-Lord's identity, kit (17001–17023), obligation (Banishment, 17024) and nemesis set
(Budding Crime Syndicate 17025 — no ability of its own, data-only Hinder keyword; Mister Knife 17026; Spartoi
Cunning 17027 ×3) are all scripted, every registered ref backed by a real-command test in
`stld/star-lord-kit.test.ts` / `stld/star-lord-obligation-nemesis.test.ts`, plus `stld/e2e.test.ts` (Rhino,
standard, solo, since `stld` carries no scenario of its own). Three genuine primitive gaps, §6b. No precon exists
for Star-Lord (`STLD_STARTER_DECKS` is empty, unlike `gmw`'s two box heroes), so his own tests build a legal
Leadership deck directly from his own pack (`stld/testing.ts`'s `STAR_LORD_LEADERSHIP`).

**`gam`, `drax` and `vnm` were each scripted concurrently by their own sessions** (`wave3/gam/`, `wave3/drax/`,
`wave3/vnm/`), pushing to this same branch — neither this `gmw` session nor the `stld` one touches those folders.
`ron`: not started. All five packs' data is emitted and their own engine primitives have landed (`drax`'s
Moondragon, §3.23, was the last: RRG/FAQ are silent on whether "that minion attacks another enemy" is an activation,
and the user decided docs/phase7-wave3.md §4 Q12 on 2026-09-23 — an attack, not an activation).

### `gam` (Gamora): fully scripted

`MC_REFS_PACKS=gam pnpm refs` resolves 35/35 — **no `KNOWN_SKIPPED` entries, no genuine primitive gaps.**
Everything docs/phase7-wave3.md §3.26 flagged "unproven" for this pack turned out to compose, once three small
primitives (all with their own engine tests) were promoted:

- `CardSelector.zone.bottommostOnly`, the mirror of the existing `topmostOnly` — Conditioning Room's "return the
  bottommost attack or thwart event from your discard pile".
- `TargetQuery.unique`, reading the same printed fact `unique.ts`'s `isUnique` uses for the deckbuilding unique
  rule — Godslayer's "against a unique enemy".
- `RuleSpec threatCannotBeRemoved.player` and `RuleSpec cannotAttack.attacker` — Sibling Rivalry ("players other
  than Gamora cannot remove threat from it") and Drax ("Drax cannot attack minions", independent of who controls
  him), each a `player`-shaped field added beside an existing rule the same way `cannotAttack.player` (docs/
  phase7-wave2.md §25) already worked, but scoping the _other_ half of the sentence (who is blocked / which
  character, respectively) that no existing field said.

`gamora-kit.ts`/`gamora-obligation-nemesis.ts` cover every non-reprint `gam` ability (18014 Uppercut, 18017 Combat
Training, 18032 Enhanced Reflexes alias from `reprints.ts`); `gamora-kit.test.ts` (24 tests) and
`gamora-obligation-nemesis.test.ts` (8 tests) drive every registered ref through its own real trigger window, named
in each test's own title; `e2e.test.ts` plays Gamora's own hand-built stand-in deck (`support.ts` — she has no real
precon yet, docs/phase7-wave3.md §0/§4) against Rhino to a real outcome. `support.ts`'s own docblock explains why
the deck is hand-built rather than a `StarterDeck` and that it makes no legality claim.

### `drax` (Drax): scripted, two genuine primitive gaps

`MC_REFS_PACKS=drax pnpm refs` resolves 32/35 — three `KNOWN_SKIPPED` entries. `drax-kit.ts` (identity + 19002–
19018, minus the two reprints 19014 Counter-Punch/19019 Indomitable aliased by `../reprints.ts`),
`drax-obligation-nemesis.ts` (Memories of Another Life 19025, the nemesis set Cull the Weak/Yotat the Destroyer/
Challenge Accepted/"I Will Destroy You!" ×2, plus Gamora the ally 19020 — a `basic`-aspect filler bundled in this
pack, scripted here since it has no other natural home) and `drax-pack-cards.ts` (the multi-aspect fillers "Bring
It!" 19030, "Think Fast!" 19031, Regroup 19032 — its `-forced-interrupt` only, see the gap below; Enhanced Physique
19033's resource ability is a fourth auto-aliased reprint) between them cover every other ref;
`drax-kit.test.ts` (19 tests), `drax-obligation-nemesis.test.ts` (9 tests) and `drax-pack-cards.test.ts` (3 tests)
drive every registered ref through its own real trigger window, named by id in each test's own title; `e2e.test.ts`
plays Drax's own hand-built stand-in deck (`support.ts` — no real precon yet, docs/phase7-wave3.md §0/§2.1) against
Rhino to a real outcome. Two genuine gaps, both flagged for `game-rules-architect` rather than approximated:

- **`19012.martyr-response`** ("Response: After Martyr takes consequential damage from performing an attack, if
  that attack defeated an enemy, give her a tough status card.") — the trigger point has to be the consequential
  damage itself (RRG 1.8 "Consequential Damage", p. 13, tier 5, resolving _after_ the attack and its own responses;
  giving tough any earlier would let the fresh tough card wrongly absorb Martyr's own consequential damage). The
  engine's consequential-damage `dealDamage` event (`pushConsequentialDamage`, `packages/engine/src/actions.ts`)
  carries no `parentFrameId` back to the attack that caused it — it's pushed _before_ the attack event exists (so
  it resolves _after_, LIFO) — so there is no way to read "did the attack I just took consequential damage from
  defeat an enemy" from within it.
- **`19032.regroup-interrupt`** ("Interrupt: When an ally is defeated by an enemy attack, return it to its owner's
  hand instead of discarding it.") — needs a defeat-destination redirect to _hand_, conditioned on the defeat
  coming from an enemy's attack. The one precedent, `RuleSpec defeatedIntoEncounterDeck` (Time Portal, `wave2/
toafk/kang-encounter-set.ts` 11033), is narrowly built for a side scheme going to the encounter deck,
  unconditionally — no "to hand" destination, no "only if defeated by an attack" condition.

`19013.moondragon-action` was scripted on 2026-09-23 by `game-rules-architect` with the primitive, per
docs/phase7-wave3.md §3.23/§4 Q12 (`enemyToAttack`, `enemyAttacksEnemy`).

**DSL/engine fixes made along the way, both minimal and generic:**

- `dsl/validate.ts`'s bind-tracking `bindsOf` had no case for `addCounters`, so `<bind>.amount` (documented on the
  builder itself, for exactly this card's "If you cannot, draw 1 card") failed validation as "read before it is
  bound." Added the missing case.
- `windowEventCost` (`packages/engine/src/resolve/window.ts`, pricing a card played only at its own trigger window
  — Crosscounter, Knife Leap: no standalone action, so never played via a plain `playCard`) read only the older
  `costReductionFor` "reduce the next card" mechanism, never the `CostModifierSpec` constant-rule system every
  _normally_-played card already gets (`playCostModifier`) — so Knife Leap's "reduce the cost to play this card by
  1 for each vengeance counter on Drax" (the Hercules/Winter Soldier shape, `activeIn: "hand"`) silently never
  applied at that prompt, even though the same reduction was already honored once payment committed. Own test,
  `packages/engine/src/window-event-cost.test.ts`.

### `vnm` (Venom): fully scripted

`MC_REFS_PACKS=vnm pnpm refs` resolves 34/34 — **no `KNOWN_SKIPPED` entries, no genuine primitive gaps.**
`venom-kit.ts` (identity 20001a/b + 20002–20022, 20026–20029, minus the two reprints The Power of Justice 20014 and
Resourceful 20020 aliased by `../reprints.ts`) and `venom-obligation-nemesis.ts` (Struggle for Control 20023, the
nemesis set Klyntar Frenzy 20024 / Enraged Symbiote ×4 20025) between them cover every ref; `venom-kit.test.ts` (24
tests) and `venom-obligation-nemesis.test.ts` (5 tests) drive every registered ref through its own real trigger
window, named by id in each test's own title; `e2e.test.ts` plays Venom's own hand-built stand-in deck (`support.ts`
— no real precon yet, docs/phase7-wave3.md §0/§4) against Rhino to a real outcome.

- **Three additive DSL wrappers, no engine change**: `paidWithOnly` (`dsl/values.ts`, the engine `Predicate` already
  existed from wave 2's own play-restrictions test), `restrictedLimit` (`dsl/abilities.ts`, docs/phase7-wave3.md
  §3.22's `RuleSpec`, landed with no DSL wrapper yet) and `atEndOfActivation` (`dsl/effects.ts`, the engine
  `EffectSpec` already existed for a Boost ability's own "after this activation ends" — this is its first use from
  a player-side interrupt, needed for Making an Entrance's "after that thwart ends" follow-up).
- **One additive engine export**: `restrictedLimitFor` (`packages/engine/src/rules.ts`) already existed but wasn't
  re-exported from `packages/engine/src/index.ts`, so no test outside the engine package could call it directly —
  the same gap `excessDamageBonus` had before this wave's `gmw` session re-exported it (§6's own note above).
- **One additive core export**: `mayFlipToAlterEgo` (`packages/cards/src/core/obligations.ts`) was a private helper
  inside the shared `obligation()` builder; Struggle for Control's first option ("Exhaust Flash Thompson **and take
  2 damage** → discard this obligation", not the shared "→ remove this obligation from the game") doesn't fit the
  shared shape, so it needed the flip-choice half on its own.
- **docs/phase7-wave3.md §4 Q8 answered**: all 4 printed copies of Enraged Symbiote start set aside, and this turns
  out to already be the engine's own general rule for every hero's nemesis-set cards (`packages/engine/src/
setup.ts`: only a hero's own obligation is shuffled into the encounter deck at setup; every other nemesis-set card
  is pushed onto that player's `PlayerState.setAside` and stays there) — not something this pack had to build.
  Corroborated by the Venom insert's own FAQ and an official FFG ruling (Hall of Heroes "Latest FFG Rulings
  (post-RRG 1.5)", May 18, 2023); full citations in `venom-obligation-nemesis.ts`'s own module docblock. Caught a
  real bug on the way: `Predicate exists({ inSlot })` resolves through `selectTargets`, which is scoped to
  `cardsInPlay` — always false for a still-set-aside card, so the obligation's own "if you cannot" branch looked
  like it always fired even when a symbiote was validly chosen. Fixed by reading the bound slot with `countAmong`
  (`dsl/values.ts`'s existing `ValueSpec countInRef`, "not restricted to in play") instead — no engine change.

### `ron` (Kree Fanatic modular set): fully scripted

**Update (2026-09-23):** `90005.when-revealed` is scripted with the new `dealAsEncounterCard` (docs/phase7-wave3.md
§3.47), `KNOWN_SKIPPED.ron` is empty and `PACK_STATUS.ron` is "scripted". The history below is kept as written.

`MC_REFS_PACKS=ron pnpm refs` resolves 11/12. `wave3/ron/kree-fanatic.ts` is the pack's only file so far (five
cards, `90001`–`90005`); `wave3/ron/index.ts` exports `RON_ABILITIES`; `PACK_STATUS.ron` moved from "not started"
to "in progress" and it was added to `coverage.test.ts`'s `PACKS_WITH_OWN_REGISTRIES` (the guard's own second
describe block requires an entry there for every started pack, checked by its own `it("checks every pack
PACK_STATUS marks started …")`). `kree-fanatic.test.ts` (13 tests) drives every scripted ref by name through real
commands; the villain (Nebula, chosen over any `ronan-the-accuser` scenario specifically to sidestep the title
collision below) has the modular swapped in via `wave3Scenario("nebula", { modularSetIds: ["kree_fanatic"] })`.

- **The minion shares its title with `gmw`'s own villain, Ronan the Accuser (16103–16105).** RRG 1.8's Unique rule
  (p. 46) keeps them apart at the table on its own; nothing here or in `gmw/ronan.ts` needs to script around it,
  since no scenario puts both decks in play together.
- **`90001.ronan-the-accuser-forced-interrupt`** ("engages the hero with the fewest remaining hit points") is
  docs/phase7-wave3.md §3.35's own proposed composition, confirmed to work as written:
  `choosePlayer(slot, firstPlayer, { among: superlativePlayer("lowest", remainingHpOf(identityOf(thatPlayer))) })`.
- **`90002.judge-jury-executioner-forced-response`** ("after a friendly character is defeated by an enemy attack")
  needed `FRIENDLY_CHARACTER` (identity or ally) for "friendly" — not `controller: "you"`, which resolves against
  this card's own controller and a side scheme has none, so it would never match anyone. **"By an enemy attack" is
  a deliberate, documented simplification, not a silent approximation:** a `sourceIs: { categories: ["enemy"] }`
  filter is the textually precise reading, but `checkDefeats`'s identity-elimination path
  (`packages/engine/src/resolve/defeat.ts`) constructs its own `characterDefeated` event with no `sourceInstanceId`
  at all — unlike the ally/minion path, which always carries one — so that filter would silently and permanently
  exclude every identity defeat, including ones genuinely caused by an enemy attack (the case the card exists
  for). Flagged in `kree-fanatic.ts`'s own module docblock as a narrow, real engine gap, not fixed here (outside
  this pass's scope, and a uniform fix needs the identity path to carry a source first).
- **`90004.boost`** ("if this activation defeats a character") surfaced the same identity-elimination gap from the
  other side: `eventDealt("defeated")` reads a `results.defeated` var that only ever gets set via the interruptible
  `characterDefeated` event path (`applyDefeat`'s `addFrameVars`), which for an identity is itself gated on
  `heard()` — so in a game with nothing else listening, an identity's elimination happens inline and the var never
  populates, even though a character genuinely was defeated. The composition is correct; the test works around the
  gap legitimately by also having Judge, Jury, Executioner in play (any real deck with an ally or a second
  character-defeat listener reaches the same event path on its own).
- **Genuine primitive gap, `90005.when-revealed`** ("deal that card to yourself as a facedown encounter card" for
  a card discarded from the encounter deck): no `CardDestination` moves a specific, already-identified card into a
  player's own dealt-encounter zone facedown — every existing route (`EffectSpec dealEncounterCard`) instead draws
  a _new_ card from the deck top. docs/phase7-wave3.md §2.3 flagged this exact clause as "believed expressible …
  but not yet proven"; it isn't. `90005.boost` needed nothing new and is scripted.

**Wave 3's client wiring is out of scope for every pack in this pass** (per the brief: "the whole wave gets wired
into the client once, at the end") — nothing here touches `packages/client` or `playable/`.
