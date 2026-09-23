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

## 7. Progress / next up

**Foundation: done.** `wave3/{index,cards,reprints,names,setup,testing,coverage.test}.ts` all exist and are green.

**A checkpoint-1 report first claimed "every ability backed by a real-command test" without actually checking —
9 of Groot's 19 registered refs had no test at all (an interrupt/response with an unpayable cost among them,
found only once a test was actually written for it; see §4's last bullet).** Fixed same session: every ref below
now has one, verified by name in the handoff report. **The standing rule this earned: before claiming a pack
"done", diff the ability ids a module registers against the ability ids its own test file(s) actually exercise —
don't trust the coverage report alone, it only proves a ref _resolves_, never that it's _correct_ or _reachable_.**

**`gmw` status: in progress.**

| Piece                                                                                                                              | Status                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Groot's identity (16001a/b)                                                                                                        | Scripted, tested (Flora Colossus, Growth Spurt)                                                                                      |
| Groot's kit (16002–16024)                                                                                                          | Scripted except §5's three gaps; every registered ref tested — see the handoff report for the ref→test mapping                       |
| Groot's obligation/nemesis (16025–16028)                                                                                           | Scripted, every registered ref tested (Wilt ×3, Fan the Flames, Blazing Inferno, Furnax)                                             |
| Groot e2e                                                                                                                          | 1 test, `groot-kit/e2e.test.ts` (Rhino, standard, solo)                                                                              |
| Rocket Raccoon's identity/kit (16029–16052)                                                                                        | Scripted except §6a's four gaps; every registered ref tested — see the handoff report for the ref→test mapping                       |
| Rocket Raccoon's obligation/nemesis (16053–16057; 16058–16060 are Brotherhood of Badoon's villain Drang, not Rocket's — see below) | Scripted, every registered ref tested (Crisis on Halfworld ×3, Blackjack's Bazooka, Planetary Invasion)                              |
| Brotherhood of Badoon (16058 Drang, 16061–16069 + Band of Badoon modular)                                                          | **Not started**                                                                                                                      |
| Infiltrate the Museum (16070–16079 + Menagerie Medley modular)                                                                     | **Not started**                                                                                                                      |
| Escape the Museum (16080–16087 + Ship Command/Galactic Artifacts)                                                                  | **Not started**                                                                                                                      |
| Nebula (16088–16101 + Space Pirates modular)                                                                                       | **Not started**                                                                                                                      |
| Ronan the Accuser (16102–16121 + Kree Militants modular)                                                                           | **Not started**                                                                                                                      |
| Shared modular sets used across scenarios (Power Stone, Ship Command, Galactic Artifacts: 16122–16149)                             | **Not started**                                                                                                                      |
| Campaign-only cards (The Market 16150–16177, Campaign Challenge/Badoon Headhunter 16178–16187)                                     | **Deferred to campaign mode (C2)** — stay in `KNOWN_SKIPPED` with reason "campaign mode deferred", the `trors` 04155–04166 precedent |

**Next session on `gmw` should do Brotherhood of Badoon** (the first scenario: its villain Drang 16058–16060, main
scheme 16061a/b–16062a/b, Milano/Charge Up 16063, and the Band of Badoon modular set 16064–16069), needed before
either hero's own e2e test can reach `gmw`'s own villain rather than falling back to Rhino. `MC_REFS_PACKS=gmw
pnpm refs` is the up-to-date source of truth for exactly which refs remain — the table above is a snapshot, that
command is not.

**`stld` and `gam` are now being scripted concurrently by their own sessions** (`wave3/stld/`, `wave3/gam/`), each
pushing to this same branch — this `gmw` session doesn't touch either folder. `drax`/`vnm`/`ron`: not started.
All five packs' data is emitted and their own engine primitives have landed (`drax`'s Moondragon, §3.23, is the
one open exception — RRG/FAQ are silent on whether "that minion attacks another enemy" is an activation;
docs/phase7-wave3.md §4 Q12 has the proposed reading, still unconfirmed).

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

**Wave 3's client wiring is out of scope for every pack in this pass** (per the brief: "the whole wave gets wired
into the client once, at the end") — nothing here touches `packages/client` or `playable/`.
