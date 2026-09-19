# Phase 7 wave 2: the ability-scripting brief

This is the brief every per-pack agent follows when scripting a wave 2 (cycle 1) pack's card abilities
(`ability-scripting-engineer`, PLAN.md Phase 7, `docs/phase7-wave2.md`). Read `docs/phase7-wave2.md` first — it is
the shared spec for schema decisions (§1), per-pack setup needs (§2) and the engine primitives (§3) this brief
builds on. This document is the narrower "how to script a pack" companion to it, directly modeled on
`docs/phase7-wave1-scripting.md` (wave 1's own version of this brief): folder layout, reprints, test conventions,
the rule for a genuinely missing primitive, and — because cycle 1 is six packs, not one hero pack — a live
**progress / next up** section so a session cut off by a usage limit can resume exactly where the last one stopped.

The model to follow for style is `packages/cards/src/core/` (Core Set), `packages/cards/src/wave1/cap/` (wave 1's
first fully-scripted pack), and now `packages/cards/src/wave2/trors/` (this wave's first pack, fully scripted).

## 1. Folder layout and naming

Each pack owns one folder under `packages/cards/src/wave2/<pack>/`, where `<pack>` is its short code (`trors`,
`toafk`, `ant`, `wsp`, `qsv`, `scw` — the same codes `@mc/content`'s `packages/content/src/data/<pack>/` uses).
Inside it, the same file shape wave 1 used (`docs/phase7-wave1-scripting.md` §1): `kit.ts`/`<hero>-kit.ts`,
`obligation.ts`/`<hero>-obligation-nemesis.ts`, `nemesis.ts`, `pack-cards.ts`, per-scenario files, an `index.ts`
that is the pack's **only** export to the rest of wave 2, ruling-level `<hero-name>.test.ts` files, and an
`e2e.test.ts`.

**Cycle 1's difference from wave 1: `@mc/content`'s `WAVE2_SCENARIOS` is empty.** No `ScenarioCuration` has been
written yet for any of the six packs (docs/phase7-wave2.md §2's per-scenario setup notes are researched, but
turning them into `Scenario` records is `card-data-pipeline`'s follow-up work, not done). This means
`../wave2/setup.ts`'s `wave2Scenario(...)` **cannot** dispatch through a generic `Scenario`-driven builder the way
`wave1Scenario` does for Green Goblin/The Wrecking Crew — there is nothing to dispatch through yet. Until
`WAVE2_SCENARIOS` lands, each cycle 1 scenario this repo can actually set up standalone is a **small, hand-written
function in `wave2/setup.ts`**, reading card ids straight out of `WAVE2_CARDS` by code (the same shape
`wave1/gob/testing.ts`'s stopgap `gobScenario` used before `WAVE1_SCENARIOS` existed). `crossbonesScenario` is the
first of these. **A pack agent adds their own scenario function to `wave2/setup.ts` and registers it in
`TRORS_SCENARIOS`/a new per-pack table there** once that scenario's own cards are scripted enough to be worth
setting up — this is one of the few places outside your own pack folder you're expected to touch, alongside the
one-line registration in `wave2/index.ts` (§2).

Ability ids are the card's code plus a slug: `"<code>.<slug>"`. The slug must match `@mc/content`'s `abilityId(...)`
calls in `packages/content/src/data/<pack>/cards.ts` exactly — **never guess it from the printed text.** The first
draft of this pack's own `KNOWN_SKIPPED` list (§5) was hand-typed from memory and was wrong in several places
(`04070.crossbones-assault-when-defeated` instead of the real `04070.when-defeated`, a fabricated uniform
`.when-revealed` suffix for dozens of cards that actually use their own printed-name slugs like
`04089.omni-morph-duplication-constant`); it was only caught and corrected by computing the list programmatically
(a throwaway test dumping `allRefs.filter((id) => !(id in WAVE2_ABILITIES))`, `WAVE2_ABILITIES` from
`packages/cards/src/wave2/index.ts`) and diffing against the hand-typed one. **Always regenerate `KNOWN_SKIPPED`
this way rather than typing ids from the card text.**

**A pack agent never edits another pack's folder**, `packages/cards/src/wave2/reprints.ts`,
`packages/cards/src/wave2/names.ts`, or `packages/cards/src/wave2/testing.ts`. If one of those shared files seems
to need a change for your pack, that's a signal to flag rather than route around.

## 2. Registration: two lines, added by the main session

`packages/cards/src/wave2/index.ts` merges every pack into `WAVE2_ABILITIES`, and `packages/cards/src/wave2/
coverage.test.ts`'s `PACK_STATUS` records whether a pack is `"scripted"` (every ref resolves except documented
missing-primitive skips), `"in progress"` (some cards scripted, the rest pinned in `KNOWN_SKIPPED` as not-yet-done —
see §5), or `"not started"`. **A pack agent does not add these lines** — write the pack's own `index.ts` exporting
`<PACK>_ABILITIES`, but leave the commented-out placeholder in `wave2/index.ts` alone; the main session uncomments
it once the pack's tests are green.

## 3. Reprints: handled automatically, never scripted by hand

Cycle 1 reprints a Core **or wave 1** card verbatim in several places (not just Core, unlike wave 1's own reprint
mechanism) — same printed name **and** type. `packages/cards/src/wave2/reprints.ts` finds every such pair
programmatically by scanning `WAVE2_CARDS` against `WAVE1_CARDS` (which already includes Core), and aliases a
matching wave 2 ability id straight to the wave 1/Core `AbilityDefinition`, as long as the ability shape lines up
one-for-one. This runs ahead of every pack's own registry.

**A same-name, same-type collision that is genuinely a different card** (cycle 1's own version of wave 1's
Hulk/She-Hulk/Iron Man cases) is recorded in `WAVE2_REPRINT_PROBLEMS` rather than forced into an alias — e.g. the
Hawkeye ally "Hawkeye" (04011, Kate Bishop, `trors`) vs. the Core/wave 1 "Hawkeye" ally chain (Clint Barton,
03012/01015, aliased into `cap`). That card must be (and is) hand-scripted.

**Consequences, learned the hard way scripting `trors` (three real "defined twice" collisions this pass, none
anticipated by the module that hand-scripted them):**
- **Never define an ability id for a card `reprints.ts` already supplies** — `mergeRegistries` throws "defined
  twice" if your module and `WAVE2_REPRINT_ABILITIES` both define the same id. This caught three cards the
  original `trors` scripts wrongly hand-rolled even though they're verbatim reprints: **Lead from the Front**
  (04018, event → Core 01070), **Hydra Bomber** (04066, minion → Core 01110), and **Hail Hydra!** (04057/04147,
  treachery, printed in *two* of Hawkeye's/his nemesis' own encounter sets → the `cap` pack's 03030). All three
  were removed from their pack module once the build error pointed at them.
- **Check `wave2ReprintPairs()` before writing a script for a card that looks like a Core/wave 1 reprint by name.**
  The fastest way, since the collision only surfaces once the whole registry is built: write (or reuse) a
  throwaway test that filters `wave2ReprintPairs()` to your pack's own card ids and dumps the pairs — see
  `packages/cards/src/wave2/reprints.test.ts` for the shape (it also pins the Hawkeye-ally exception and the
  Hail Hydra! dual-printing case) rather than discovering each one individually via a build failure.
- `wave2/coverage.test.ts`'s per-pack check treats anything resolved for a pack outside its own module (and not
  explained by `wave2ReprintPairs()`) as an error, for the same reason wave 1's did.

## 4. The rule: missing primitive → record and skip

Identical to wave 1's rule (`docs/phase7-wave1-scripting.md` §4) — read it there. The short version: don't
hand-roll a bespoke branch in engine code, don't approximate, record the gap precisely beside the ability id
(citing the exact printed/current text, the missing primitive, and the closest existing one), leave the id out of
the pack's registry, and flag it. **`KNOWN_SKIPPED` (`wave2/coverage.test.ts`) also carries every card simply not
yet reached** for a pack marked `"in progress"` — not only primitive-blocked ones (see §5's exact split for
`trors`). Both kinds share one list because the coverage test's exact-match assertion is what keeps either kind
honest; the pack's own module docblock and this file's §6 are where the *reason* for each entry actually lives.

### 4.1 A found-by-testing addition to the rule: verify a skip claim is real before shipping around it

One `trors` ability (`04004.mockingbird-interrupt`, Mockingbird) was scripted with `preventDamage()` and
typechecked cleanly, but a ruling test (`hawkeye.test.ts`) proved it was a **silent no-op**: `preventDamage`
(`packages/engine/src/resolve/apply-effect.ts`) only ever adjusts an *already-pushed* `dealDamage` event frame, and
Mockingbird's interrupt fires at "the villain **initiates** an attack" — before a defender is even declared, let
alone a `dealDamage` frame existing. The command applied without error, the cost was paid, and the villain's
attack still dealt full damage. **A card compiling and its command being accepted is not evidence it's correct** —
this is exactly the "subtly wrong is worse than unimplemented" case CLAUDE.md warns about, so the ability was
pulled from the registry and moved to `KNOWN_SKIPPED` with the missing primitive documented (§6.6), rather than
left in a state where it looks scripted but silently does nothing in a real game.

Three other cases in this same pass were **not** actually broken, despite an earlier docblock claiming they were —
the previous, cut-off session's own comments turned out to be wrong guesses, caught by trying to build the
registry rather than trusting the prose:
- Crossbones' own "while he has a Weapon attachment, his attacks gain piercing" (04058/04059/04060) — a
  *villain's own* conditional keyword grant reads the villain's own keywords correctly; it was mistaken for the
  one-shot-played-event gap (§6.1) that does NOT apply to a persistent character.
- Two effects used a `TargetQuery` (`query("villain", { self: true })`) where a `TargetRef` was needed
  (`attachCard`'s `to`, `discardEncounterCards`'s count via a hand-rolled `{ kind: "stat", of: ... }`), papered
  over with an `as never` cast that silenced the compiler rather than fixing the shape. Both compiled, both would
  have failed at runtime (the villain wouldn't actually be found), and neither was caught until this pass replaced
  the casts with the correct `theVillain`/`statOf` builders and added a shape-level regression test
  (`crossbones.test.ts`). **Grep for `as never`/`as any`/`as unknown` in a pack you're resuming before trusting its
  "scripted" claims** — a type-escape hatch at a `TargetRef`/`ValueSpec` position is a near-certain sign the
  original author hit a real shape mismatch and hid it instead of fixing it.

## 5. Test conventions

Identical to wave 1's (`docs/phase7-wave1-scripting.md` §5) with the shared helpers renamed: `packages/cards/src/
wave2/testing.ts` (`runWave2`, `startWave2Game`, `WAVE2_DEPS`) over `../testing/harness.ts`'s deps-agnostic
helpers. Everything wave 1's §5 says about Responses being optional even without "you may," mandatory
`chooseTarget`s still needing settling, hand-card payment being resource-icon-sum not per-card, `GameState.outcome`
being `null` not `undefined`, and not inventing a card's data, applies unchanged. A few more, found scripting
`trors`:

- **An event card's own "Hero Action"/"Hero Action (attack)"/"Action" text resolves automatically when the event
  is played** (`resolve/play-card.ts`'s `"abilities"` stage, `definition.trigger.kind === "action"`, `forced:
  true`) — **there is no separate `useAbility` command for it.** `play(P1, id, payment)` alone triggers it, and
  any in-play cost the ability itself carries (e.g. `exhaustCardsCost`) is paid automatically as part of resolving
  the play, not offered as a separate choice, when there's exactly one legal candidate to exhaust. This tripped up
  the first drafts of several Hawkeye/Spider-Woman event tests, which mistakenly tried `use(...)` on them.
- **A card printed on an event still needs its OWN play cost paid, plus any in-play cost its ability carries** —
  e.g. Hawkeye's Sonic Arrow (04005, cost 2) needs 2 resources for its own play *and* Hawkeye's Bow in play,
  ready, to exhaust for the "(attack)" ability's cost. `payWith(state, player, n, exclude)` only covers the
  resource half; exclude every card the ability will also consume (the bow itself, if it's also a hand-card
  payment candidate — it usually isn't, since it needs to already be in play).
- **A prompt's `optionId` for an ability *on an ally/attachment*, not the identity, is prefixed with that card's
  own instance id** — `${allyInstanceId}:<ability id>`, never the identity's. Mockingbird's own interrupt uses
  `${mockingbird}:04004.mockingbird-interrupt`; using the identity's instance id there silently finds no matching
  option and the choice never resolves as expected — the trigger doesn't error, it just isn't in `offered`, so a
  `settle(..., stop: hasOption)` loop runs straight past it to the next unrelated choice instead of throwing.
- **A cost prompt for an *ability* (not a card play) has its own prompt kind, `payForAbility`** — distinct from
  `payForCard`. A custom picker that only branches on `payForCard` silently declines the payment (answers `[]`,
  which the engine currently accepts for a `spend(N)` cost's card-selection step) instead of paying it. Branch on
  both, or on "any pending choice not otherwise recognized still needs a real payment," when scripting a test for
  an ability with a `spend(...)` cost.
- **A nemesis set's cards are set aside per player** (`PlayerState.setAside`, RRG 1.8 Appendix II step 5), **not**
  in `GameState.encounterSetAside` (which is the *scenario's own* set-aside list: signature side schemes,
  `Scenario.setAside`/`setAsideVillainCardIds` cards). `../testing/harness.ts`'s `stackEncounterDeck` only reaches
  the deck/discard, so it can't stack a set-aside nemesis card (e.g. Hawkeye's Sniper Shot) — a `trors`-local test
  helper, `stackSetAside` (`hawkeye.test.ts`), moves one from `playerOf(state, player).setAside` onto the top of
  the encounter deck instead. A future shared version of this (if more packs need it) belongs in `wave2/testing.ts`,
  not copied per pack.
- **`characterProfile()` has no `keywords`, `traits`, or `hp` field** — it's stats only (`atk`/`thw`/`def`/`rec`/
  `sch`/`maxHp`/`missing`). Use `hasKeyword(state, id, name, deps)` (`@mc/engine`, `keywords.ts`) and `traitsOf
  (state, id, deps)` (`@mc/engine`, `select.ts`) for those, and `characterProfile(...)?.maxHp` (not `.hp`) for hit
  points.
- **A trait string is the schema's upper-cased spelling** ("AERIAL", not "Aerial") — `traitsOf(...).map(String)`
  reads back exactly what `@mc/content`'s `trait(...)` constructor produced, and `dsl/values.ts`'s `TRAIT` map
  already upper-cases every entry (`../../dsl/values.js`'s docblock: "the content schema upper-cases traits").
- **`CardInstance.statuses` is a `StatusCounts` object** (`{ stunned, confused, tough }`, each a count), never an
  array — `.statuses.confused > 0`, not `.statuses.toContain("confused")` (which is a wave 1-vintage-looking
  mistake this pass made and then had to fix across several tests once the real shape was checked).
- **Playing a card costs its own resource payment on top of the card leaving the hand** — a test computing an
  expected hand-size delta after playing an event that also draws a card must subtract *two* (the played card, the
  resource payment) before adding back the draw, not one; this was wrong in the first drafts of the Press the
  Advantage and Clear the Area tests here.
- **Every villain phase runs the villain's (and every engaged minion's) own normal activation, independent of
  whatever encounter card is revealed that round** — a scenario with a minion already in play at setup (Zola's
  Ultimate Bio-Servants, Absorbing Man's none, Taskmaster's none) means *more than one* enemy activates each
  round, and **each activating enemy is dealt its own boost card from the top of the encounter deck before any
  player's own encounter card is dealt.** A `stackEncounterDeck(state, filler, realCard)` two-card stack (the
  pattern wave 1 established for a lone villain) silently deals the *filler* to the second activating enemy and
  the *real* card to a third enemy or the player depending on order, unless you either stack one filler per
  activating enemy ahead of the real card, or (simpler, used in `zola.test.ts`) patch the extra minion out of
  `state.villainArea` for that one test. **Never assume "before/after one round" isolates a single card's own
  effect**, either: the main scheme's own step-one acceleration threat and the villain's own normal
  attack/scheme both change state every round regardless of what's revealed — isolate a conditional card's own
  contribution with a differential (two otherwise-identical rounds that differ only in the condition, e.g.
  `absorbing-man.test.ts`'s Steel Kick tests), not an absolute delta.
- **`TargetRef { kind: "named" }` (and any `TargetRef`, generally) only ever finds a card already in play** —
  `resolveRef`'s "named" case searches `cardsInPlay(state)`. A setup ability that needs to find a specific card
  still sitting in the encounter deck (Red Skull's own "Put the Red House into play") must search for it first
  (`selectCards`/`encounterCards`, or `encounterSetAside` for a set-aside card like The Sleeper) and act on the
  bound slot, not reference it by name directly — `putIntoPlay(named(...), ...)` silently does nothing (the ref
  resolves to no candidates) rather than erroring, so this fails silently, not loudly.
- **`putIntoPlay(card, controller)` already engages a minion with `controller`**
  (`packages/engine/src/resolve/apply-effect.ts`'s own `putIntoPlay` case) — a separate `{ kind: "engage" }` effect
  right after it is redundant for "put that minion into play engaged with X," not merely harmless-but-unnecessary;
  check the primitive's own behavior before assuming a printed "engaged with" clause needs its own effect.
- **A `giveBoostCard` inside a `boost()` ability is a validator error**, not merely wrong: "give an additional
  boost card" printed *on a card that is itself resolving as a boost card* means "for **this** activation"
  (`modifyAttack({ extraBoostCards })`), not "deal a *future* facedown boost card" (`giveBoostCard`, which waits on
  an enemy for a later activation) — the validator (`dsl/validate.ts`) refuses the latter inside a Boost ability
  specifically because the two are easy to conflate from the printed wording alone (Hydra Exo-Soldier, 04131,
  `red-skull.ts`).
- **`payForAbility`'s own `minSelections` can be `0` even for a cost that is not actually optional** (a plain
  `spend({ wild: 1 })`/`spend(1)` resource cost on a triggered ability, as opposed to a card's own play cost) — the
  engine allows a payment prompt to be answered with zero explicit picks (auto-top-up from elsewhere), but with
  nothing else to draw from, `firstLegal`'s `slice(0, minSelections)` pays **nothing**, and the ability's cost is
  never actually satisfied — not an error, just a triggered ability that silently does nothing (Mockingbird's
  interrupt, `hawkeye.test.ts`, before this was found: `settle(..., picking(theTrigger))` alone picked the trigger
  correctly but then paid its cost with an empty selection at the very next prompt). Answer a `payForAbility` prompt
  reached through a resource-spend cost with an explicit pick (`answer(state, [state.pendingChoice.options[0]!.
  optionId], deps)`), not `firstLegal`/`picking`'s fallback.
- **`answer`/`settleUntil` default to `CORE_DEPS` when `deps` is omitted** — a wave 2 (or any non-Core) test that
  calls either without passing `WAVE2_DEPS` explicitly gets a state where the ability being tested is invisible to
  `heard`/`hasCandidates` (it isn't in `CORE_DEPS.abilities`), so its trigger window never opens. This looks exactly
  like "the interrupt didn't fire" — the same failure mode a genuine ability bug would produce — so always pass
  `deps` explicitly on every `settle`/`settleUntil`/`answer` call in a non-Core pack's test, not just the first one
  in a chain.

## 6. Engine primitive gaps found scripting `trors` (ranked by how many cards each blocks so far)

The same discipline as `docs/phase7-wave1-scripting.md` §6/§4: each is a rule write-up (text, then
state/resolution/interaction consequences) with the closest existing primitive named, so `game-rules-architect` has
a starting point. None of these were hacked around — every card that needs one is in `KNOWN_SKIPPED` instead.

**LANDED (2026-09-19), un-skipped in this same pass:** §6.1 through §6.7, and the "once per round for each aspect"
half of §6.11, all landed in `packages/engine` (`AttackKeyword`/`RuleSpec attackKeywords`, `TargetQuery.anyAspect`,
`ResourceRequirement.wild`, `EffectSpec.{removeThreat,thwart}.ignoreCrisis`, `ValueSpec totalPrintedResources`,
`modifyAttack.preventAllDamage`, `PlayerRef defeatingPlayer`, `AbilityLimit.per: "aspectOfEventCard"`) in the same
session that pinned them. The DSL builders (`attacksGainKeywords`, `attack(...).keywords`, `modifyAttack(...).
keywords`/`.preventAllDamage`, `thwart(...).ignoreCrisis`, `totalPrintedResources`, `defeatingPlayer`, `ANY_ASPECT_
CARD`, `on.youPlay`) were added in `packages/cards/src/dsl/{effects,values,abilities}.ts`, and every card these
blocked (Hawkeye's Bow 04002, Vibranium Arrow 04009, Crossfire's boost 04027, Piercing Strike 04044, Finesse 04033,
Jessica Drew's Apartment 04034, Superhuman Agility 04031a, Crossfire's Rifle 04029, Cable Arrow 04008, Kate Bishop's
Hawkeye 04011, Mockingbird 04004, Crossbones' Assault 04070, Prison Camps 04141, Hydra Reinforcements 04143) is
un-skipped, scripted and behaviorally tested (`hawkeye.test.ts`, `spider-woman.test.ts`, `crossbones.test.ts`,
`red-skull.test.ts`).

**LANDED (2026-09-19, later the same day):** §6.9 and §6.10 too — `EventPattern.eventIs` (docs/phase7-wave2.md
§3.13.9) and `cardEntersPlay` becoming interruptible plus `TargetQuery.excluding` (§3.13.10). Un-skipped: Taskmaster
I/II/III's forced response (04093/04094/04095, `taskmaster.ts`, DSL: `on.playerChangesForm`, `eventPlayer`) and
None Shall Pass's forced interrupt (04079b, `absorbing-man.ts`, DSL: `query(..., { excluding: eventTarget })`),
each with a real behavioral test (`taskmaster.test.ts`, `absorbing-man.test.ts` — the latter's old "documents the
open gap" test now asserts the *correct* post-fix behavior instead). Every §6 primitive gap found scripting `trors`
is now landed; only the two data gaps (Captured by Hydra 04028/04107, no ability ref for their "When Defeated"
half) and the deferred Hydra Campaign refs remain in `KNOWN_SKIPPED`. Write-ups below are kept as-is (now
historical) since they're still the most complete account of *why* each primitive has the shape it does.

### 6.1 A one-shot played event granting piercing/ranged to only its own attack (4 cards blocked, the largest gap)

- **Cards:** Hawkeye's Bow (04002, constant: "each of your Arrow attacks gain ranged"), Vibranium Arrow (04009,
  "this attack gains piercing"), Crossfire's boost (04027, "if this boost resolves during an attack, the attack
  gains piercing"), Piercing Strike (04044, "this attack gains piercing").
- **The gap:** piercing/ranged are read off the *attacking character's own keywords*
  (`packages/engine/src/resolve/event.ts` `applyDamage`'s `attackKeyword`, keyed to the `dealDamage` event's
  `sourceInstanceId` — the attacker's own instance for a player attack, never the ability's card). A persistent
  character or attachment granting *itself or its host* the keyword works today (Black Knight, 04012, scripted and
  tested; Crossfire's own villain constant, 04027's neighbor 04058, also scripted and tested) because the host
  stays in play continuously and the grant is read off it. A played event (or a boost card resolving only for one
  activation) has no persistent card to grant the keyword "from" — the attack it's boosting is a different frame
  entirely, and by the time `applyDamage` reads keywords, the event card is already discarded.
- **Closest existing primitive:** `dealDamage.ignoreTough`, an inline per-effect override of the same shape
  (`attack()`'s own `overkill` option is the nearest DSL-level analog: a boolean carried on the `attack`/`dealDamage`
  EffectSpec itself, read at damage-application time instead of off the source card's persistent keywords). A
  `piercing`/`ranged` option on `attack()` (and on `boost`'s own attack-modifying effects, for Crossfire's case)
  would need the same "does this activation's damage bypass tough / count as ranged" read `overkill` already gets.

### 6.2 An OR of the four core aspects in a `TargetQuery` (2 cards)

- **Cards:** Finesse (04033, "generate a [wild] resource for an aspect card"), Jessica Drew's Apartment (04034,
  "for an aspect card").
- **The gap:** `TargetQuery.aspect` (`packages/engine/src/select.ts` `matchesQuery`) is an exact single-string
  match against `card.aspect`/`card.printedAspect`. "An aspect card" means any of aggression/justice/leadership/
  protection, not one fixed value.
- **Closest existing primitive:** `TargetQuery.anyTrait: readonly Trait[]` (the OR-of-traits field, landed in wave
  1's primitives batch) — an `anyAspect: readonly CoreAspect[]` field of the identical shape, or an `isAspectCard:
  true` boolean (since "an aspect card" always means exactly those four, never a fixed list a card author chooses)
  would both work; the latter is simpler if no cycle 1 or later card ever needs a *subset* of the four.

### 6.3 A cost requiring a wild resource specifically, not "any one resource" (1 card in `trors`, recurs across later packs)

- **Card:** Crossfire's Rifle (04029, "Hero Action: Exhaust your hero and spend a [wild] resource → discard
  Crossfire's Rifle").
- **The gap:** `ResourceRequirement` (`packages/engine/src/resources.ts`) has only `generic`/`physical`/`mental`/
  `energy` slots. A typed slot (e.g. `physical: 1`) already accepts a wild resource as backfill (`satisfies`'s
  "wilds cover any typed shortfall"), and `generic: 1` accepts literally anything — but there is no way to require
  the payment be a wild resource **specifically**, as opposed to any single resource of any type.
- **Not unique to `trors`:** a text search across `@mc/content`'s raw data found the same "spend a [wild] resource"
  cost phrasing on cards in other packs too (Moon Knight, an ally; an unidentified Alter-Ego Action card), so this
  is worth prioritizing over a one-card fix.
- **Closest existing primitive:** the typed fields themselves — a `wild` field on `ResourceRequirement`, checked
  before typed/generic fallback (i.e., `satisfies` would need a wild-specific branch that consumes from
  `pool.wild` only, not letting a typed resource substitute for it, unlike every other slot).

### 6.4 "Ignoring any crisis icons in play" as a per-effect override (1 card)

- **Card:** Cable Arrow (04008, "remove 3 threat from a scheme, ignoring any crisis icons in play").
- **The gap:** today's crisis check (a scheme with a crisis icon can't be thwarted below some floor, or can't be
  the target of a basic thwart — see `packages/engine/src/actions.ts`/`resolve/event.ts`) is unconditional; there
  is no way for one specific effect to bypass it.
- **Closest existing primitive:** `dealDamage.ignoreTough`, the same inline per-effect override shape as §6.1
  proposes for piercing/ranged — an `ignoreCrisis` option on `removeThreat`/`thwart`.

### 6.5 A `ValueSpec` reading a specific referenced card's own printed resource icons (1 card)

- **Card:** Hawkeye, the ally (04011, Kate Bishop): "deal X damage … where X is the number of printed resources on
  that card" (referring to a card chosen or discarded by an earlier effect in the same ability, not a bind of
  several cards).
- **The gap:** the engine only reports resource pools **summed across a bind of several moved/discarded cards**
  (`<bind>.physical`/`.mental`/`.energy`/`.wild` on `moveCards`/`discardEncounterCards`, docs/phase7-wave1-scripting.md
  §6's `<bind>.boostIcons` sibling). A `discardFromHand` cost's own `bind` reports only a card *count*.
- **Closest existing primitive:** `totalPrintedCost(cardsRef: TargetRef)` (docs/phase7-wave2.md §3.10, landed for
  Hydra Prison) is the nearest sibling — a `totalPrintedResources(cardsRef: TargetRef)` `ValueSpec` of the same
  shape, reading `printedResources(card)` (`resources.ts`, already exported) summed over whatever the ref names,
  would cover this without a bind at all.

### 6.6 A lasting "this attack's damage is fully prevented" flag, from attack initiation (1 card — found by testing, §4.1)

- **Card:** Mockingbird (04004): "Interrupt: When the villain initiates an attack against you, spend 1 resource of
  any type and return Mockingbird to your hand → prevent all damage from this attack."
- **The gap:** `preventDamage()` (`resolve/apply-effect.ts`) only adjusts an *already-pushed* `dealDamage` event
  frame — it does nothing outside one. Mockingbird's interrupt fires at attack **initiation** (the `enemyAttack`
  event, before `declareDefender` even runs, let alone a `dealDamage` frame existing), unlike Backflip (01003,
  Core), whose own interrupt is on `when.damage(...)` specifically so a live `dealDamage` frame exists at that
  point. The effect needs to survive from initiation through `declareDefender` and into whatever `dealDamage`
  event eventually happens (its amount not yet known at interrupt time, and dependent on defense).
- **Closest existing primitive:** `RuleSpec cannotTakeDamage`'s `while: Predicate` (used elsewhere for a *standing*
  conditional immunity, e.g. `packages/engine/src/indirect-damage.test.ts`) combined with a way to scope `while` to
  "the attack this interrupt is currently resolving inside" — the same shape `Predicate { kind: "currentAttack" }`
  (`undefendedAttack`, `dsl/values.ts`) already gives a *read*, but as a scope for a lasting rule rather than a
  yes/no check. A `preventThisAttacksDamage()` effect that pushes a lasting `cannotTakeDamage` rule scoped to the
  current attack's own frame id, cleared when that attack's resolution finishes (the same point `atEndOfAttack`
  fires), is the shape to build.

### 6.7 "The player who defeated this scheme" as a `PlayerRef` (3 cards)

- **Cards:** Crossbones' Assault (04070, `crossbones.ts`): "When Defeated: Crossbones activates against the player
  who defeated this scheme." Prison Camps (04141, `red-skull.ts`): "When Defeated: **the player who defeated this
  scheme** searches their deck and discard pile for an ally, puts it into play, and shuffles their deck." Hydra
  Reinforcements (04143, `red-skull.ts`): "When Defeated: **the player who defeated this scheme** discards a
  non-Elite minion." All three are otherwise fully scriptable with existing vocabulary — this is the only thing
  blocking each of them.
- **The gap:** no `TargetRef`/`PlayerRef` reads a scheme's own defeating player for a *later* effect in the same
  ability. `on.defeated`'s `byYou` filter (used on the *responding* ability's own trigger condition) can name "you
  defeated it" as a yes/no gate, but can't hand that player back as a `PlayerRef` value for `enemyAttack(theVillain,
  { against: <that player> })`, `chooseCards(..., { chooser: <that player> })`, etc.
- **Closest existing primitive:** the `defendingCharacter`/`eventSource`/`eventTarget` family of context-scoped
  refs (`dsl/values.ts`) — a `defeatingPlayer: PlayerRef` reading the current `characterDefeated`/`schemeDefeated`
  event's own defeating player (already recorded on that event, since `byYou` reads it) would slot in the same way.

### 6.9 `cardEntersPlay` is announcement-only — no Interrupt timing for "when a card enters play" (2 cards)

- **Cards:** None Shall Pass 1A (04079b, `absorbing-man.ts`): "Forced Interrupt: When an environment enters play,
  discard each other environment card in play." Omni-Morph Duplication and friends never need this, but any future
  card printed "Interrupt: when X enters play" will hit the same wall. (Counted as one gap; only one `trors` card
  needs it.)
- **The gap:** `isAnnouncement` (`packages/engine/src/trigger-events.ts`) defaults to `true` (response-only, no
  interrupt window opened) for any `TriggerEventKind` not in its explicit interruptible list, and `cardEntersPlay`
  isn't in that list — `enterPlay()` (`resolve/enter-play.ts`) calls `applyEnterPlayKeywords` (which already
  mutates state: toughness, uses counters, the ally-limit check) *before* announcing the event, so by the time any
  ability on it could react, the card is already fully in play. A **Response** on the same event ("after an
  environment enters play, discard each other one") doesn't fix this either for a card whose *effect itself*
  needs to distinguish the entering card from the others (`query("environment")` at that point matches the new
  one too, and there's no `TargetQuery` field to exclude a specific `TargetRef` the way `self` excludes only the
  ability's own card — confirmed by testing, docs §4.1's convention: scripting it as an Interrupt produces a
  silent no-op; scripting it as a Response discards the entering card too).
- **Closest existing primitive:** making `cardEntersPlay` interruptible (moving `enterPlay`'s `announce` call
  before its own state mutations, the way `cardBeingPlayed` already precedes an event's own effects) is the
  cleanest fix, paired with a `TargetQuery` field to exclude a specific `TargetRef` (`eventTarget`, here) from a
  query — the second half is independently useful for any future "each *other*" card whose own entry would
  otherwise match its own query.

### 6.10 `formChanged` has no direction filter, and no "any player" `EventPattern` shorthand (1 card, 3 refs)

- **Card:** Taskmaster (I/II/III) (04093/04094/04095, `taskmaster.ts`): "Forced Response: After **a player**
  changes to **hero form**, they discard the top card of the encounter deck and take damage equal to the number of
  boost icons on that card."
- **The gap:** `formChanged`'s own event shape (`packages/engine/src/spec.ts`) carries `to: "hero" | "alterEgo"`,
  but `EventPattern` has no field to filter on it — only `on.youChangeForm()`'s hardcoded `{ playerIs: "controller"
  }`, which also doesn't fit here: this is a *villain* ability reacting to *any* player's change, not "you." A
  `PlayerRef { kind: "eventPlayer" }` already exists (`spec.ts`) and would supply "they" for the effect body once
  the trigger itself can be written.
- **Closest existing primitive:** a `to?: "hero" | "alterEgo"` field on `EventPattern`, read the same way
  `requireResults` reads other event-carried fields, plus a version of `on.youChangeForm` (or a new `on.
  playerChangesForm`) with no built-in `playerIs: "controller"` scoping.

### 6.11 Already known, not newly found (see `docs/phase7-wave2.md` §3.11)

- **"Once per round for each aspect"** (Superhuman Agility, 04031a): LANDED as `AbilityLimit.per: "aspectOfEventCard"`
  (see the top of §6) and scripted (`spider-woman-kit.ts`).
- **Blanking a whole class of cards' text** (Tech Theft, `ant` pack — not yet reached in `trors`, listed here so a
  future `ant` agent doesn't rediscover it): `textBoxBlank` is read without the ability registry today. Still open.

### 6.12 Not a primitive gap: a stale DSL wrapper, fixed in this pass

- `dsl/effects.ts`'s `modifyAttack({ extraBoostCards })` was typed `number` only; the engine's own `EffectSpec`
  already accepted `number | ValueSpec`. Master Strategist (04134, `red-skull.ts`, "give him an additional boost
  card for each side scheme in play," the exact card docs/phase7-wave2.md §3.11 names as this field's reason for
  existing) needed the live-value form, so the DSL wrapper's type was widened to `Amount` to match the engine
  primitive that had already landed — not a new primitive, just catching up the wrapper. Every existing caller
  passed a literal number and is unaffected (`amount(1)` still compiles to the same `{ kind: "const", value: 1 }`).

### 6.15 `traitsOf`'s constant trait-grant scan has no recursion guard for a `while: hasTrait(...)` predicate (found scripting `ant`)

- **Card:** Yellowjacket (12027, Ant-Man's nemesis minion): "While you are in Giant hero form, Yellowjacket gains
  the Giant trait and retaliate 1. While you are in Tiny hero form, Yellowjacket gains the Tiny trait and gets +1
  ATK." Read per docs/phase7-wave2.md §3.2 as "your identity currently has the [Giant/Tiny] trait" — a nemesis
  minion has no controller of its own, so "you" is the engaged player, the same reading The Viper's own "while
  engaged with you" constant uses (`04054.the-viper-constant`, `trors/spider-woman-obligation-nemesis.ts`).
- **Found by testing (§4.1's rule), not a missing vocabulary word.** Scripted once as `gainsTrait(GIANT, query(
  "minion", { self: true }), { while: hasTrait(identityOf(engagedPlayerOf(self)), GIANT) })` (and the Tiny/ATK
  sibling) — this typechecked, looked structurally like The Viper's constant, and was only "is defined"-tested
  before this pass. A real reveal-from-encounter-deck test (`ant/kit.test.ts`, since reverted) crashed the engine
  with `RangeError: Maximum call stack size exceeded` the moment Yellowjacket was in play and *anything* called
  `traitsOf` or `statBonus` for *any* card — not only Yellowjacket itself.
- **The gap, precisely.** `traitsOf(state, id)` (`packages/engine/src/select.ts`, its trait-grant scan around lines
  145–173) loops over every card in play and evaluates every constant `traitGrant`'s `while` predicate
  *unconditionally*, before checking whether the grant's own `target` even matches the requested `id`. A `while:
  hasTrait(ref, trait)` predicate's `evaluate` case (`select.ts`, `"hasTrait"`) calls `traitsOf(state, refId)` — a
  full, unmemoized re-entry into the very function currently running. Because the predicate's inputs never depend
  on the outer call's `id`, the re-entrant call hits the identical ability's identical `while` again, unconditionally,
  every single time: an **unconditional** infinite recursion (not merely deep), so no board size or player count
  avoids it. `statBonus`/`modifiersFor` (`modifiers.ts`) hit the same wall for the ATK sibling, since a stat
  modifier's own `while` reaches `evaluate` → `traitsOf` the same way.
- **Not unique to this card.** Any constant `gainsTrait`/`gets`/`gainsKeyword` rule anywhere whose `while` needs
  `hasTrait`/`traitsOf` on any card crashes the instant that ability is active in play and `traitsOf`/`statBonus` is
  called for *anything* — this is the first card in the pool to combine the two, but nothing about the shape is
  specific to Ant-Man or nemesis minions.
- **Closest existing primitive/fix:** `blankedByConstantRules` (`select.ts`, immediately above `traitsOf`) already
  solved the identical class of problem for `blankTextBox`, by evaluating a rule's own `target`/`while` under
  `DEFAULT_DEPS` (printed characteristics only) specifically "so matching cannot re-enter this function" (its own
  docblock). `traitsOf`'s trait-grant scan (and `modifiersFor`'s stat-modifier scan) has no equivalent guard and
  needs the same treatment — or a recursion-depth/visited-set guard — before this shape of ability is safe to
  script. **Not reworked into a differently-shaped ability**: the printed text is a trait grant depending on
  another card's current trait, not a form check to hardcode a bespoke reading around, so the fix belongs in the
  engine, not in `@mc/cards`.
- **Pinned:** `12027.yellowjacket-constant`, `12027.yellowjacket-constant-2` (`wave2/coverage.test.ts`'s
  `KNOWN_SKIPPED.ant`; full write-up in `ant/obligation-nemesis.ts`'s module docblock). Until this lands, Yellowjacket
  in play behaves as its base 2 ATK / 2 SCH / 4 HP minion with no form-conditional bonus — a documented inaccuracy,
  not a crash risk, since the ability is out of the registry entirely.

## 7. Status

| Pack | Code | Status | Notes |
|---|---|---|---|
| The Rise of Red Skull | `trors` | **Scripted.** 152 cards, 248 ability refs: 219 resolve (15 as reprint aliases, 204 hand-scripted), 29 in `KNOWN_SKIPPED` — 1 genuine data-gap block (Captured by Hydra's missing "When Defeated" ref) and 28 Hydra Campaign refs, pinned regardless of any primitive since campaign mode is deferred. Every §6 primitive gap found scripting `trors` (§6.1–§6.7, §6.9, §6.10, plus the per-aspect-limit half of §6.11 — 18 refs total across Hawkeye's Bow, Vibranium Arrow, Crossfire's boost, Piercing Strike, Finesse, Jessica Drew's Apartment, Superhuman Agility, Crossfire's Rifle, Cable Arrow, Kate Bishop's Hawkeye, Mockingbird, Crossbones' Assault, Prison Camps, Hydra Reinforcements, Taskmaster I/II/III's forced response, None Shall Pass's forced interrupt) has since landed and was un-skipped in later passes over the same pack — see §6's "LANDED" notes. | All five scenarios are scripted: Hawkeye/Spider-Woman kits (`hawkeye-kit.ts`, `hawkeye-obligation-nemesis.ts`, `spider-woman-kit.ts`, `spider-woman-obligation-nemesis.ts`), Crossbones (`crossbones.ts`), Absorbing Man (`absorbing-man.ts`), Taskmaster (`taskmaster.ts`), Zola (`zola.ts`) and Red Skull (`red-skull.ts`), each with its own `wave2Scenario(...)` entry in `../setup.ts` and its own ruling-level `.test.ts` plus a standalone setup test proving each scenario's own 1A/1B setup ability actually runs (setAside, scenario decks, engaged minions, revealed side schemes, etc.). Real-game tests: `wave2/trors/e2e.test.ts` (Hawkeye and Spider-Woman precons vs. Rhino, solo, to a real outcome; Crossbones standalone 2-player setup). **Data gaps flagged for `card-data-pipeline`:** (1) the Attack on Mount Athena 1A text prints "Three modular sets (Hydra Assault, Weapon Master, and Legions of Hydra)", but `trors/encounterSets.ts` has no "Legions of Hydra" `EncounterSet` — `crossbonesScenario` uses only the two that exist; (2) several cards carry more ability refs than their printed text has independent clauses for (Omni-Morph Duplication 04089's four extra "-constant" refs, The Mad Doctor 04113b's and Neurological Implants 04119's second refs, The Rise of Red Skull 1A's 04128a and New World Hydra's 04129b's "-constant" refs) — each is stood up as an empty `coveredByEngineRule()` rather than left unscripted, since the card's own primary ability ref already carries the full printed behavior; (3) Captured by Hydra (04107) prints a "When Defeated" clause with no ability ref to hang it on (contrast Hydra Prison, 04122, which prints an equivalent shape with two refs) — only its "When Revealed" half is scripted. |
| The Once and Future Kang | `toafk` | **In progress.** 51 cards, 82 ability refs: 59 resolve, 23 in `KNOWN_SKIPPED` (4 primitive/open-question gaps on stage 2/4 — §6.13/§6.14 — 4 data-gap Temporal obligations, 15 refs for the not-yet-started Expert encounter set 11040–11051). | Kang's villain (standard and Expert), "Kang's Arrival" 1A/1B, "The Master of Time" 2A, and all four stage 3 alternatives are scripted in `kang.ts`; the Kang/Temporal encounter set (11014–11033, minus the four Temporal obligations) is scripted in `kang-encounter-set.ts`. `wave2Scenario("kang", …)` (`../setup.ts`'s `kangScenario`) is data-driven off `WAVE2_SCENARIOS`. `kang.test.ts` has a standalone setup test (standard and expert) plus ruling-level tests. |
| Ant-Man | `ant` | **Scripted.** 33 cards, 37 ability refs: 28 resolve (reprints aliased by `../reprints.ts` plus hand-scripted refs across `kit.ts`/`obligation-nemesis.ts`/`pack-cards.ts`), 9 in `KNOWN_SKIPPED` — see §6.15 (Yellowjacket's two form-conditional constants, found-by-testing engine crash), plus missing-primitive blocks for Pym Particles' "after you spend this card" trigger, Giant Strength's `LastingUntil.endOfTurn`, Care for Cassie's "cannot change form" lasting rule, Yellowjacket's Plan's "belongs to encounter set X" query, Ant-Man's own overpaid-from-a-later-interrupt read, Team-Building Exercise's "shares a trait with your hero" query and Muster Courage's dynamic `chooseCards.max`. Three-sided identity (§1.1/§3.2 of docs/phase7-wave2.md) and Tech Theft's class-wide text-blanking (§8 there) are both landed and used (`kit.ts`'s `changeToOtherHeroForm`/`youHaveTrait`, `obligation-nemesis.ts`'s `blanksTextBox`, verified with a real behavioral test attaching a TECH upgrade and confirming its own text goes blank). | Ant-Man's kit (`kit.ts`), obligation/nemesis (`obligation-nemesis.ts`) and the pack's own generic-aspect cards (`pack-cards.ts`) each have ruling-level tests (`kit.test.ts`) driving real commands — form changes, Hero Actions gated by `while`, a Team-Up legality check, a reveal-from-encounter-deck helper for the nemesis set's own cards — plus `e2e.test.ts` (Rhino, standard, solo, Ant-Man Leadership precon to a real outcome, replayed deep-equal). |
| Wasp | `wsp` | **Not started.** | Three-sided identity; divided basic powers (§3.7, landed). |
| Quicksilver | `qsv` | **Not started.** | `basicPowerUsed` trigger event (landed, used already by Spider-Woman's Captain Marvel in `trors`). |
| Scarlet Witch | `scw` | **Not started.** | Two copies of her own obligation shuffled in (§1.10, landed); boost-icon counting as an event (§3.6, landed for activation counts; card-effect counts — Hex Bolt — still open per §4.8). |

## 8. Progress / next up (update this every session)

**Last updated:** 2026-09-19, by the session that, after `trors` was verified and committed end to end (commit
`953e284`), went back over its own `KNOWN_SKIPPED` pins and un-skipped every one whose primitive had since landed in
a concurrent `packages/engine` session: §6.1–§6.7 and the per-aspect-limit half of §6.11 (`AttackKeyword`/`RuleSpec
attackKeywords`, `TargetQuery.anyAspect`, `ResourceRequirement.wild`, `EffectSpec.{removeThreat,thwart}.
ignoreCrisis`, `ValueSpec totalPrintedResources`, `modifyAttack.preventAllDamage`, `PlayerRef defeatingPlayer`,
`AbilityLimit.per`). Added the matching DSL builders (`packages/cards/src/dsl/{effects,values,abilities}.ts`:
`attacksGainKeywords`, `attack(...).keywords`, `modifyAttack(...).keywords`/`.preventAllDamage`, `thwart(...).
ignoreCrisis`, `removeThreat(...).ignoreCrisis`, `totalPrintedResources`, `defeatingPlayer`, `ANY_ASPECT_CARD`,
`on.youPlay`), scripted the 14 previously-blocked ability refs across `hawkeye-kit.ts`, `hawkeye-obligation-
nemesis.ts`, `spider-woman-kit.ts`, `crossbones.ts` and `red-skull.ts`, and added real behavioral tests for each
(not just "is it defined") — see §6's "LANDED" note for the full list and §5's new lessons below. `trors`'s own
`KNOWN_SKIPPED` shrank from 47 to 33 (§7). One primitive (`AttackKeyword`) landed at the *very start* of this
session and was inspected in detail before the rest showed up mid-session in the same batch; the DSL layer for all
of them was added together, once the full batch was confirmed landed.

Two new lessons for §5: (1) `payForAbility`'s own `minSelections` can be 0 even for a mandatory resource-spend cost
(the engine allows auto-top-up) — `firstLegal` then pays *nothing*, silently failing the cost; a test exercising a
resource-spend cost through a `chooseTriggers`/`payForAbility` sequence must answer that prompt explicitly (pick a
specific offered card), not lean on `firstLegal`/`picking`'s fallback. (2) `settleUntil`/`answer` calls default to
`CORE_DEPS` if `deps` isn't passed explicitly — always pass `WAVE2_DEPS` (or the pack's own deps) or the ability
being tested is invisible to `heard`/`hasCandidates` and its trigger window never opens, which looks exactly like
"the ability didn't fire" rather than "the test forgot `deps`."

**Same-day follow-up (still 2026-09-19):** the coordinator flagged two more landed primitives before this session
moved on — `EventPattern.eventIs` (docs/phase7-wave2.md §3.13.9) and `cardEntersPlay` becoming interruptible plus
`TargetQuery.excluding` (§3.13.10), i.e. all of §6.9/§6.10. Un-skipped Taskmaster I/II/III's forced response
(04093/04094/04095, DSL: `on.playerChangesForm`, `eventPlayer`) and None Shall Pass's forced interrupt (04079b,
DSL: `query(..., { excluding: eventTarget })`), each with a real behavioral test — including rewriting
`absorbing-man.test.ts`'s old "(documents the open gap)" test, which asserted the *broken* pre-fix behavior, to
assert the correct post-fix one instead (a stale "documents the gap" test is worse than no test once the gap is
closed: it starts asserting the wrong thing is right). Every §6 primitive gap found scripting `trors` is now
landed; only two data gaps and the deferred Hydra Campaign refs remain in `KNOWN_SKIPPED` (§7).

**Also migrated `wave2/setup.ts` to `WAVE2_SCENARIOS`** (`@mc/content`, now holding all six cycle 1 scenario
records — trors's five plus Kang), the way `wave1/setup.ts` already dispatches through `WAVE1_SCENARIOS`: the five
hand-written `<villain>Scenario()` functions became one data-driven `buildSingleVillain(scenario, options)`
(copied from `wave1/setup.ts`'s own function of the same name, re-pointed at `WAVE2_CARDS`), with
`Scenario.separateDecks` replacing the hand-written `ScenarioSeparateDeck` literals and a small
`SETASIDE_BY_SCENARIO` lookup (`@mc/cards`-local; `Scenario.setAsideVillainCardIds` is villain cards only) covering
Taskmaster's Captive allies and Red Skull's Sleeper. Two things fell out of this migration that needed fixing, not
just plumbing: (1) Crossbones' "Legions of Hydra" data gap (flagged in `crossbones.ts`'s own docblock) is resolved
— the content record's `recommendedModularSetIds` now lists all three of the 1A text's modular sets, and
`buildSingleVillain` already uses every one by default, so the scenario needed no code change beyond deleting the
stale docblock note; (2) the content record's `separateDecks[].name` for Red Skull's own scenario deck is
`"side-scheme deck"` (the printed common noun), not the earlier hand-written `"side-scheme"` — `red-skull.ts`'s own
`buildScenarioDeck`/`scenarioDeck(...)` calls and `red-skull.test.ts`'s direct `state.scenarioDecks[...]` reads
both had to be renamed to match; a scenario-deck name is content data now, not a string `@mc/cards` invents, so
double-check it against the actual `Scenario` record rather than keeping whatever name a pre-migration draft used.

**`trors` is done — every scripted card, every primitive gap closed, scenario setup fully data-driven.** Do not
re-audit `trors` again (per the coordinator) — its own `KNOWN_SKIPPED` is exact-match asserted by `coverage.test.ts`,
so any future primitive landing that affects it will surface as a coverage-test failure (an unexpectedly-resolved
ref still listed as skipped) the next time anyone runs the suite, not something that needs active re-checking every
session.

**`toafk` (Kang) is `"in progress"`, same day.** Kang's villain (11001–11006, standard *and* the Expert Kang copies
11034–11039 — same printed text, reused ability bodies), "Kang's Arrival" 1A/1B, "The Master of Time" 2A, all four
stage 3 alternatives (Chronopolis/Inexorable Fate/Realm of Rama-Tut/Present Future War, each with its own
`createGameArea`+`addVillain`+`stateCheck`+`forcedResponse` set, modeled almost verbatim on
`packages/engine/src/game-areas.test.ts`'s synthetic Kang-shaped scenario — read that test file before touching
this pack again, it is the authoritative reference for every game-area primitive's exact shape), and the Kang/
Temporal encounter set (11014–11033, minus the four Temporal obligations) are scripted, each with a real
behavioral test (`kang.test.ts`) — including one proving `atEndOfPhase` really defers Kang (I)'s "advance to stage
2" past the moment of defeat, and one proving 1A's own obligation-removal actually empties the deck of them.
`toafk`'s `KNOWN_SKIPPED` (§7) has 23 refs: 4 genuine primitive/open-question gaps on Kang's own stage 2/4 (below,
new §6.13/§6.14), 4 data-gap Temporal obligations (same two-trigger-kinds-in-one-ref shape as `trors`'s own
Captured by Hydra), and 15 refs for the Expert-only encounter set (11040–11051, not started — lower priority than
standard play). `wave2/setup.ts` gained `kangScenario` (`separateGameAreas`, modeled on the same test file's
`kangGame()`), dispatched from `wave2Scenario("kang", …)`.

**Two new engine primitive gaps found scripting `toafk` (see `kang.ts`'s module docblock for the full write-up):**
- **§6.13 "Cannot join a game area unless a condition holds"** (The Master of Time 2B, 1 ref) — no `RuleSpec` for a
  standing per-area join restriction exists; closest primitive is `cannotAttack`/`cannotThwart`'s shape,
  generalized to game areas. Bundled with this same ref: "when an acceleration token would be placed on another
  scheme, place it here instead" has no interruptible "token about to be placed" event either (docs/phase7-wave2.md
  §4.3 already flags the redirect itself as an open rules question, unconfirmed against any FFG source).
- **§6.14 Un-tucking a facedown card into play** (Kang's Wrath 4A, "Reveal each face down Kang's Dominion under
  this stage", 1 ref) — `tuckedUnder(...)` finds tucked cards, but no effect turns a *tucked, out-of-play* card
  face up and puts it into play; `flipCard` only flips a card already in play. Also still open: a per-player
  nemesis-card selector spanning `setAside` (Kang's Wrath 4B's own "search […] and set-aside area for their
  nemesis minion", the same zone-search gap `04028.when-revealed` in `trors` has).

**Not reached this session: `ant`, `wsp`, `qsv`, `scw`.** `toafk` alone (separate game areas, several stage-shape
data quirks, and the game's most novel scenario mechanics) took the rest of the session once the `trors` follow-up
work (§6.9/§6.10, the `wave2/setup.ts` migration) was done — there was no remaining budget to even scaffold the
four hero packs. **Next session starts with `ant`** (three-sided identity, docs/phase7-wave2.md §1.1/§3.2, landed;
Tech Theft's class-wide text-blanking and Team-Building Exercise's cost-reduction-inside-an-ability are both
"Not done" per docs/phase7-wave2.md §3.13.11 as of this session — `game-rules-architect` was said to be working on
both; re-check §3.13 before assuming either is still blocked, the same lesson this session's own `trors` follow-up
just relearned), then `wsp` (three-sided identity; divided basic powers, §3.7, landed), `qsv` (`basicPowerUsed`,
already proven by Spider-Woman's Captain Marvel in `trors`), then `scw` (two copies of her own obligation shuffled
in, §1.10, landed; boost-icon counting as an event, §3.6, landed for activation counts — card-effect counts, Hex
Bolt, are still open per §4.8). Each begins the same way this file's §2 describes and `toafk`'s own start did:
registry (`<pack>/index.ts` exporting `<PACK>_ABILITIES`) + a `wave2/coverage.test.ts` entry (flip
`PACK_STATUS[code]` to `"in progress"` and pin the pack's *entire* ability-ref list in `KNOWN_SKIPPED` before
writing a single card script, computed the programmatic way §1 describes, never hand-typed), before any actual
card scripting — so the tree stays green at every stopping point.

**Re-run the `KNOWN_SKIPPED` regeneration test (§1) against whatever primitives have landed since this was
written, at the start of every pack and every session** — a card pinned as blocked may already be scriptable; this
session's own `trors` follow-up (§6.9/§6.10 landing after the checkpoint that pinned them) and `toafk`'s reuse of
already-landed game-area primitives both depended on this habit. §6.7's "player who defeated this scheme" gap
recurred three times across `trors` alone before landing — expect the same pattern (a gap recurring across several
cards/packs before anyone notices and fixes the primitive) with §6.13/§6.14 above.

**2026-09-19, later session: `ant` finished, promoted to `"scripted"`.** Picked up with `ant`'s kit, obligation/
nemesis and pack-cards modules already scripted (from a prior in-flight pass, recovered per `PLAN.md`'s "Wave 2:
Kang primitives, Mojo data, Ant-Man kit" commit) but its two obligation/nemesis abilities (Tech Theft, Yellowjacket)
only "is defined"-tested, against this brief's own quality bar (a response/constant test must drive real commands
and assert the printed outcome, not `toBeDefined()`). Made both real:
- **Tech Theft** (12026): a real test now attaches a TECH-trait upgrade (Reinforced Suit) to an ally, confirms its
  `+2 hit points` constant applies, reveals Tech Theft from the nemesis set (a `PlayerState.setAside` card, staged
  onto the encounter deck the same way `hawkeye.test.ts`'s `stackSetAside` does — a new local `
  stageNemesisCardForReveal`/`revealFromEncounterDeck` pair in `ant/kit.test.ts`, generalizable to `wsp`/`qsv`/`scw`
  the same way `stackSetAside` was flagged as reusable in `trors`), and confirms Reinforced Suit's own text (and so
  its +2 hit points) is now blank.
- **Yellowjacket** (12027): turning its "is defined" test into a real one *found a genuine engine crash*, not a
  missing vocabulary word — see the new §6.15 write-up. The ability was pulled from the registry (not shipped
  broken) and added to `KNOWN_SKIPPED.ant`, with the full root-cause analysis in `ant/obligation-nemesis.ts`'s
  module docblock and §6.15 here, for `game-rules-architect`. This is this brief's own "found-by-testing" rule
  (§4.1) working exactly as intended: the ability compiled, typechecked, and *looked* like an existing pattern (The
  Viper's constant) right up until a real test exercised it.
- Re-ran the `KNOWN_SKIPPED` regeneration check (§1) against `ant`'s full ref list before promoting the pack to
  `"scripted"`: all 9 remaining unresolved refs are documented primitive/engine-bug blocks (none "not yet reached"),
  matching `trors`' own bar for that status. `ant`'s `KNOWN_SKIPPED` is unchanged in size (still 7 pre-existing
  primitive blocks) plus the 2 new Yellowjacket entries = 9.
- Confirmed §3.13's table before touching anything: three-sided identity (§3.2) and Tech Theft's class-wide
  text-blanking (§8 there) are both landed and already used correctly by the pack's existing scripts — no rework
  needed, just verification (this session's own version of the "re-check before assuming still blocked" lesson).
- `pnpm -w typecheck` and `packages/cards`' full Vitest suite (589 tests) are green.

**Not reached this session: `wsp`, `qsv`, `scw`.** Only `ant` fit in this session's budget once the found engine
crash needed a full root-cause writeup rather than a quick fix. **Next session starts with `wsp`** (three-sided
identity, same landed primitives `ant` used; divided basic powers, §3.7, landed) — re-check §3.13 for anything
landed since this was written, the same habit this session and the `trors`/`toafk` ones before it all depended on.
Also worth carrying forward: **grep any new pack's constant abilities for a `while` that reaches `hasTrait`/
`traitsOf` before trusting it compiles-and-therefore-works** — §6.15's crash was silent at the type level and only
surfaced through a real behavioral test, exactly the "compiling is not evidence of correctness" lesson CLAUDE.md
and this brief's own §4.1 both already warn about, now with a second concrete instance.
