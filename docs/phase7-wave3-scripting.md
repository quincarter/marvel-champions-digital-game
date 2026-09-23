# Phase 7 wave 3: the ability-scripting brief

This is the brief for scripting wave 3 (cycle 2, `ability-scripting-engineer`, PLAN.md Phase 7, `docs/phase7-
wave3.md`). Read `docs/phase7-wave3.md` first — the shared spec for schema decisions (§1), per-pack setup needs
(§2) and engine primitives (§3, all landed for `gmw`/`stld`/`gam`/`vnm` except Moondragon, §3.23, `drax`-only).
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
2. **`16009.lashing-vines-response`** — "After Groot uses a basic power" (RRG 1.8's "Basic Power" glossary entry
   covers ATK/THW/DEF/REC together, so this plausibly spans all three player-facing powers). The DSL's
   `on.attacks`/`on.thwarts` treat the acting character as the event's _source_; `on.defends`'s `defended` event
   carries the defender as its _target_ instead (`eventSubjects`, `packages/engine/src/trigger-events.ts`). No
   single `EventPattern` reaches all three with one subject role, and an `AbilityDefinition` carries exactly one
   trigger. Needs a `usesBasicPower(by)` pattern that composes both roles itself — flag to `game-rules-architect`
   if a second card ever needs the same wording (none does yet in `gmw`).
3. **`16024.deft-focus-action`** — "reduce the resource cost of the next superpower card you play this turn by 1."
   Needs a standing "next matching card played this turn" cost-reduction rule, distinct from the interrupt-time
   reduction docs/phase7-wave3.md §3.20 built for Star-Lord's "What could go wrong?" (that one is offered live, at
   the point of paying for the card that triggers it — this one is banked ahead of time by an earlier action and
   has to survive until a later, unrelated card is played).

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
  a _basic_ attack, which has no effect-level bind to read.

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
2. **`16033.salvage-response`** ("Response: After you spend this card, …") needs a trigger event for a card being
   spent as a resource payment — no such `TriggerEvent` kind exists.
3. **`16048.flora-and-fauna-constant`/`-action`** (Rocket's own printing of the Team-Up card, identical at 16020
   in Groot's own range) — "a Rocket Raccoon upgrade" needs a `TargetQuery` for "belongs to a specific named
   character's card pool, independent of who controls it"; `identitySetOf` only reaches the _current player's_
   own identity-specific cards.
4. **`16052.booster-boots-interrupt`** ("… discard the top card of your deck →") needs an `AbilityCost` component
   for discarding from your own deck as a cost. Flagged for `game-rules-architect` rather than added unilaterally
   this pass: RRG 1.8 "Deck" (p. 15)'s empty-deck reshuffle rule needs a decision for a cost specifically (refuse
   the ability, or reshuffle mid-payment?) that a rushed addition risks getting wrong.

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

| Piece                                                                                                                                                           | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Groot's identity (16001a/b)                                                                                                                                     | Scripted, tested (Flora Colossus, Growth Spurt)                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Groot's kit (16002–16024)                                                                                                                                       | Scripted except §5's three gaps; every registered ref tested — see the handoff report for the ref→test mapping                                                                                                                                                                                                                                                                                                                                                                                          |
| Groot's obligation/nemesis (16025–16028)                                                                                                                        | Scripted, every registered ref tested (Wilt ×3, Fan the Flames, Blazing Inferno, Furnax)                                                                                                                                                                                                                                                                                                                                                                                                                |
| Groot e2e                                                                                                                                                       | 1 test, `groot-kit/e2e.test.ts` (Rhino, standard, solo)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Rocket Raccoon's identity/kit (16029–16052)                                                                                                                     | Scripted except §6a's four gaps; every registered ref tested — see the handoff report for the ref→test mapping                                                                                                                                                                                                                                                                                                                                                                                          |
| Rocket Raccoon's obligation/nemesis (16053–16057; 16058–16060 are Brotherhood of Badoon's villain Drang, not Rocket's — see below)                              | Scripted, every registered ref tested (Crisis on Halfworld ×3, Blackjack's Bazooka, Planetary Invasion)                                                                                                                                                                                                                                                                                                                                                                                                 |
| Brotherhood of Badoon (villain Drang 16058–16060, main scheme 16061–16062, Badoon Ship, Drang's Spear, Badoon Engineer, the four side schemes 16063–16069)      | Scripted except 16060.when-revealed (module docblock in `gmw/badoon.ts`: needs a player-level superlative, "the player engaged with the fewest minions" — no `PlayerRef` for it yet); every other registered ref tested — see `gmw/badoon.test.ts`, `gmw/band-of-badoon.test.ts`                                                                                                                                                                                                                        |
| Band of Badoon modular (16117–16121)                                                                                                                            | Scripted, every registered ref tested (`gmw/band-of-badoon.test.ts`) — 16121's overkill grant is pinned structurally rather than by a live spillover combat test (see that file's own comment: a full attack/defend/assign sequence to land excess damage on a _third_ character is more scaffolding than this pass built)                                                                                                                                                                              |
| Ship Command modular (16142–16148, used by 4 of 5 scenarios)                                                                                                    | Scripted, every registered ref tested (`gmw/ship-command.test.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Brotherhood of Badoon e2e                                                                                                                                       | 1 test, `gmw/brotherhood-of-badoon-e2e.test.ts` (standard, solo, Groot) — plays to a real outcome, replays deep-equal                                                                                                                                                                                                                                                                                                                                                                                   |
| Infiltrate the Museum (villain Collector I–III 16070–16072, main scheme The Grand Collection 16073a/b, encounter set 16074–16079, Menagerie Medley 16135–16137) | Scripted except `16073b.the-grand-collection-action` (needs a true either/or `AbilityCost`, module docblock in `gmw/museum.ts`); every other registered ref tested — see `gmw/museum.test.ts`. 16079 (Caught Off Guard) is a verbatim reprint of Core's 01188, aliased automatically (`../reprints.ts`) rather than scripted here — caught by `mergeRegistries`'s own duplicate-id guard; `wave3/reprints.test.ts` (new, mirrors `wave2/reprints.test.ts`, a shared-file gap this pass filled) pins it. |
| Escape the Museum (16080–16087 + Galactic Artifacts)                                                                                                            | **Not started**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Nebula (16088–16101 + Space Pirates modular)                                                                                                                    | **Not started**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Ronan the Accuser (16102–16121 + Kree Militants modular; 16117–16121 already done above, shared with Band of Badoon)                                            | **Not started**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Power Stone, Galactic Artifacts modular sets (16122–16141, 16149)                                                                                               | **Not started**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Campaign-only cards (The Market 16150–16177, Campaign Challenge/Badoon Headhunter 16178–16187)                                                                  | **Deferred to campaign mode (C2)** — stay in `KNOWN_SKIPPED` with reason "campaign mode deferred", the `trors` 04155–04166 precedent                                                                                                                                                                                                                                                                                                                                                                    |

**Next session on `gmw` should do Escape the Museum** (§1.1's ∞-hit-point Collector A2/B2 faces, the mode-labelled
villain pair 16080a/16081a, main scheme The Missing Milano → Lost in the Museum → The Great Escape, its own
encounter set 16082–16087). Menagerie Medley (16135–16137) and Galactic Artifacts are both already recommended/
required there too — Menagerie Medley is now fully scripted (`gmw/museum.ts`); Galactic Artifacts (16122–16134,
16149's Power Stone) is not yet reached. `MC_REFS_PACKS=gmw pnpm refs` is the up-to-date source of truth for
exactly which refs remain — the table above is a snapshot, that command is not.

**Infiltrate the Museum's own genuine primitive gap:** `16073b.the-grand-collection-action` ("Hero Action: Choose
to either exhaust your hero or spend 2 resources of any type → discard 1 card from The Collection …") needs a
true either/or `AbilityCost` — pay _one_ of two different cost shapes, the player's choice — distinct from
`cost: [a, b]`, which is an AND (`dsl/abilities.ts`'s `mergeCosts`). No card scripted before this pass has needed
one; flagged to `game-rules-architect` rather than approximated.

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

**`gam` and `drax` were each scripted concurrently by their own sessions** (`wave3/gam/`, `wave3/drax/`), pushing to
this same branch — neither this `gmw` session nor the `stld` one touches those folders. `vnm`/`ron`: not started.
All five packs' data is emitted and their own engine primitives have landed (`drax`'s Moondragon, §3.23, is the one
open exception — RRG/FAQ are silent on whether "that minion attacks another enemy" is an activation; docs/phase7-
wave3.md §4 Q12 has the proposed reading, still unconfirmed).

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

`19013.moondragon-action` stays skipped too, per docs/phase7-wave3.md §3.23/§4 Q12 — not this pack's gap to
resolve.

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

**Wave 3's client wiring is out of scope for every pack in this pass** (per the brief: "the whole wave gets wired
into the client once, at the end") — nothing here touches `packages/client` or `playable/`.
