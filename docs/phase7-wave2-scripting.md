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
  treachery, printed in _two_ of Hawkeye's/his nemesis' own encounter sets → the `cap` pack's 03030). All three
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
honest; the pack's own module docblock and this file's §6 are where the _reason_ for each entry actually lives.

### 4.1 A found-by-testing addition to the rule: verify a skip claim is real before shipping around it

One `trors` ability (`04004.mockingbird-interrupt`, Mockingbird) was scripted with `preventDamage()` and
typechecked cleanly, but a ruling test (`hawkeye.test.ts`) proved it was a **silent no-op**: `preventDamage`
(`packages/engine/src/resolve/apply-effect.ts`) only ever adjusts an _already-pushed_ `dealDamage` event frame, and
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
  _villain's own_ conditional keyword grant reads the villain's own keywords correctly; it was mistaken for the
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
  e.g. Hawkeye's Sonic Arrow (04005, cost 2) needs 2 resources for its own play _and_ Hawkeye's Bow in play,
  ready, to exhaust for the "(attack)" ability's cost. `payWith(state, player, n, exclude)` only covers the
  resource half; exclude every card the ability will also consume (the bow itself, if it's also a hand-card
  payment candidate — it usually isn't, since it needs to already be in play).
- **A prompt's `optionId` for an ability _on an ally/attachment_, not the identity, is prefixed with that card's
  own instance id** — `${allyInstanceId}:<ability id>`, never the identity's. Mockingbird's own interrupt uses
  `${mockingbird}:04004.mockingbird-interrupt`; using the identity's instance id there silently finds no matching
  option and the choice never resolves as expected — the trigger doesn't error, it just isn't in `offered`, so a
  `settle(..., stop: hasOption)` loop runs straight past it to the next unrelated choice instead of throwing.
- **A cost prompt for an _ability_ (not a card play) has its own prompt kind, `payForAbility`** — distinct from
  `payForCard`. A custom picker that only branches on `payForCard` silently declines the payment (answers `[]`,
  which the engine currently accepts for a `spend(N)` cost's card-selection step) instead of paying it. Branch on
  both, or on "any pending choice not otherwise recognized still needs a real payment," when scripting a test for
  an ability with a `spend(...)` cost.
- **A nemesis set's cards are set aside per player** (`PlayerState.setAside`, RRG 1.8 Appendix II step 5), **not**
  in `GameState.encounterSetAside` (which is the _scenario's own_ set-aside list: signature side schemes,
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
  expected hand-size delta after playing an event that also draws a card must subtract _two_ (the played card, the
  resource payment) before adding back the draw, not one; this was wrong in the first drafts of the Press the
  Advantage and Clear the Area tests here.
- **Every villain phase runs the villain's (and every engaged minion's) own normal activation, independent of
  whatever encounter card is revealed that round** — a scenario with a minion already in play at setup (Zola's
  Ultimate Bio-Servants, Absorbing Man's none, Taskmaster's none) means _more than one_ enemy activates each
  round, and **each activating enemy is dealt its own boost card from the top of the encounter deck before any
  player's own encounter card is dealt.** A `stackEncounterDeck(state, filler, realCard)` two-card stack (the
  pattern wave 1 established for a lone villain) silently deals the _filler_ to the second activating enemy and
  the _real_ card to a third enemy or the player depending on order, unless you either stack one filler per
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
  boost card" printed _on a card that is itself resolving as a boost card_ means "for **this** activation"
  (`modifyAttack({ extraBoostCards })`), not "deal a _future_ facedown boost card" (`giveBoostCard`, which waits on
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
open gap" test now asserts the _correct_ post-fix behavior instead). Every §6 primitive gap found scripting `trors`
is now landed; only the two data gaps (Captured by Hydra 04028/04107, no ability ref for their "When Defeated"
half) and the deferred Hydra Campaign refs remain in `KNOWN_SKIPPED`. Write-ups below are kept as-is (now
historical) since they're still the most complete account of _why_ each primitive has the shape it does.

**LANDED (2026-09-19, `game-rules-architect`): §6.15 through §6.19, the `toafk`/`wsp` batch.** Full write-up,
including the two places the shape differs from the request and one open corner, in docs/phase7-wave2.md §17; engine
tests in `packages/engine/src/primitives-wave2c.test.ts`. In short — §6.16 `TargetQuery.nemesisMinionOf: PlayerRef`;
§6.17 `sourceInstanceId` on `characterDefeated`/`schemeDefeated`, matched by the existing `EventPattern.sourceIs`
(use `owner: "you"`, not `controller`, for an event card); §6.18 a new interruptible `basicPowerUsing` event plus
`EffectSpec modifyBasicPower { amount }` — **ATK/THW/DEF only**, recovery flagged and deliberately not built (§17.4
says exactly why and what it would take); §6.19 `RuleSpec attackKeywords.basicOnly`; §6.15 fixed in `traitsOf` with a
documented semantic call (a constant trait grant's condition reads _printed_ traits, never constant-granted ones —
§17.5). No DSL builders were written: the two the scripter needs are described in §17.4. Un-skippable now:
`11013b.when-revealed`, `13001a.small-but-mighty`, `13005.rapid-growth-interrupt`,
`13008.red-room-training-constant-2`, `12027.yellowjacket-constant(-2)`, `13002.ant-man-constant(-2)`.

**Un-skipped (2026-09-19, `ability-scripting-engineer`): all eight of the above, each with a real engine test.**
DSL additions in `packages/cards/src/dsl`: `on.defeats(source)` and `on.basicPowerUsing(who, { power? })`
(`abilities.ts`), `modifyBasicPower(n)` and `anyOfCards(...selectors)` (`effects.ts`), `attacksGainKeywords(...,
{ basicOnly })` (`abilities.ts`, extended). `11013b.when-revealed` (`toafk/kang.ts`) reuses the exact `forEachPlayer`/
`selectCards`/`putIntoPlay` shape `zola.ts`'s Island of Dr. Zola setup already established for "search for X and put
it into play engaged with them" — no new pattern needed beyond `anyOfCards`/`nemesisMinionOf`. Yellowjacket
(`ant/obligation-nemesis.ts`) and the Ant-Man ally (`wsp/kit.ts`) are scripted exactly as originally attempted before
the crash (§6.15's own "Scripted once as…" quote), now safe under §17.5's guard — confirmed with a real reveal-then-
read-traits test, not just re-added on faith. `wsp` moved from "in progress" to "scripted" (§7): its only remaining
skip is `13012.wasp-interrupt`, a pre-existing missing-primitive block unrelated to this batch.

**A data-completeness gap found while testing `11013b.when-revealed`, not a primitive gap:** `TargetQuery.
nemesisMinionOf` (§17.1) requires the `nemesisMinion: true` card-data flag _unconditionally_ (`packages/engine/src/
select.ts`'s `matchesQuery`), but RRG 1.8 "Nemesis Encounter Set" (p. 30) only requires the parenthetical (and
therefore the flag) to disambiguate a nemesis set with **multiple** minions — a single-minion nemesis set is
automatically "the" nemesis minion with no parenthetical needed, and real MarvelCDB text for such cards omits it.
Hawkeye's own nemesis set (`hawkeye_nemesis`, `trors`) has exactly one minion, Crossfire (04027), and its card data
carries no `nemesisMinion: true` flag (unlike Ant-Man's Yellowjacket 12027, Wasp's own nemesis minion, and Spider-
Woman's Viper 04054, all correctly flagged) — so `nemesisMinionOf` currently finds nothing for a Hawkeye player,
and Kang's Wrath 4B silently searches up empty for that one hero specifically. Confirmed with a real test
(`toafk/kang.test.ts`'s Kang's Wrath 4B test uses Ant-Man, not Hawkeye, and documents why inline). **Flagged for
`card-data-pipeline`:** either give Crossfire the flag (a data fix matching the engine's current, stricter-than-RRG
reading) or `game-rules-architect` widens `nemesisMinionOf`'s own check to treat a set with exactly one minion as
automatically flagged (an engine fix matching the RRG's literal wording) — the two are alternatives, not both
needed, and deciding which is out of `ability-scripting-engineer`'s remit.

### 6.1 A one-shot played event granting piercing/ranged to only its own attack (4 cards blocked, the largest gap)

- **Cards:** Hawkeye's Bow (04002, constant: "each of your Arrow attacks gain ranged"), Vibranium Arrow (04009,
  "this attack gains piercing"), Crossfire's boost (04027, "if this boost resolves during an attack, the attack
  gains piercing"), Piercing Strike (04044, "this attack gains piercing").
- **The gap:** piercing/ranged are read off the _attacking character's own keywords_
  (`packages/engine/src/resolve/event.ts` `applyDamage`'s `attackKeyword`, keyed to the `dealDamage` event's
  `sourceInstanceId` — the attacker's own instance for a player attack, never the ability's card). A persistent
  character or attachment granting _itself or its host_ the keyword works today (Black Knight, 04012, scripted and
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
  would both work; the latter is simpler if no cycle 1 or later card ever needs a _subset_ of the four.

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
  §6's `<bind>.boostIcons` sibling). A `discardFromHand` cost's own `bind` reports only a card _count_.
- **Closest existing primitive:** `totalPrintedCost(cardsRef: TargetRef)` (docs/phase7-wave2.md §3.10, landed for
  Hydra Prison) is the nearest sibling — a `totalPrintedResources(cardsRef: TargetRef)` `ValueSpec` of the same
  shape, reading `printedResources(card)` (`resources.ts`, already exported) summed over whatever the ref names,
  would cover this without a bind at all.

### 6.6 A lasting "this attack's damage is fully prevented" flag, from attack initiation (1 card — found by testing, §4.1)

- **Card:** Mockingbird (04004): "Interrupt: When the villain initiates an attack against you, spend 1 resource of
  any type and return Mockingbird to your hand → prevent all damage from this attack."
- **The gap:** `preventDamage()` (`resolve/apply-effect.ts`) only adjusts an _already-pushed_ `dealDamage` event
  frame — it does nothing outside one. Mockingbird's interrupt fires at attack **initiation** (the `enemyAttack`
  event, before `declareDefender` even runs, let alone a `dealDamage` frame existing), unlike Backflip (01003,
  Core), whose own interrupt is on `when.damage(...)` specifically so a live `dealDamage` frame exists at that
  point. The effect needs to survive from initiation through `declareDefender` and into whatever `dealDamage`
  event eventually happens (its amount not yet known at interrupt time, and dependent on defense).
- **Closest existing primitive:** `RuleSpec cannotTakeDamage`'s `while: Predicate` (used elsewhere for a _standing_
  conditional immunity, e.g. `packages/engine/src/indirect-damage.test.ts`) combined with a way to scope `while` to
  "the attack this interrupt is currently resolving inside" — the same shape `Predicate { kind: "currentAttack" }`
  (`undefendedAttack`, `dsl/values.ts`) already gives a _read_, but as a scope for a lasting rule rather than a
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
- **The gap:** no `TargetRef`/`PlayerRef` reads a scheme's own defeating player for a _later_ effect in the same
  ability. `on.defeated`'s `byYou` filter (used on the _responding_ ability's own trigger condition) can name "you
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
  mutates state: toughness, uses counters, the ally-limit check) _before_ announcing the event, so by the time any
  ability on it could react, the card is already fully in play. A **Response** on the same event ("after an
  environment enters play, discard each other one") doesn't fix this either for a card whose _effect itself_
  needs to distinguish the entering card from the others (`query("environment")` at that point matches the new
  one too, and there's no `TargetQuery` field to exclude a specific `TargetRef` the way `self` excludes only the
  ability's own card — confirmed by testing, docs §4.1's convention: scripting it as an Interrupt produces a
  silent no-op; scripting it as a Response discards the entering card too).
- **Closest existing primitive:** making `cardEntersPlay` interruptible (moving `enterPlay`'s `announce` call
  before its own state mutations, the way `cardBeingPlayed` already precedes an event's own effects) is the
  cleanest fix, paired with a `TargetQuery` field to exclude a specific `TargetRef` (`eventTarget`, here) from a
  query — the second half is independently useful for any future "each _other_" card whose own entry would
  otherwise match its own query.

### 6.10 `formChanged` has no direction filter, and no "any player" `EventPattern` shorthand (1 card, 3 refs)

- **Card:** Taskmaster (I/II/III) (04093/04094/04095, `taskmaster.ts`): "Forced Response: After **a player**
  changes to **hero form**, they discard the top card of the encounter deck and take damage equal to the number of
  boost icons on that card."
- **The gap:** `formChanged`'s own event shape (`packages/engine/src/spec.ts`) carries `to: "hero" | "alterEgo"`,
  but `EventPattern` has no field to filter on it — only `on.youChangeForm()`'s hardcoded `{ playerIs: "controller"
}`, which also doesn't fit here: this is a _villain_ ability reacting to _any_ player's change, not "you." A
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
  with `RangeError: Maximum call stack size exceeded` the moment Yellowjacket was in play and _anything_ called
  `traitsOf` or `statBonus` for _any_ card — not only Yellowjacket itself.
- **The gap, precisely.** `traitsOf(state, id)` (`packages/engine/src/select.ts`, its trait-grant scan around lines
  145–173) loops over every card in play and evaluates every constant `traitGrant`'s `while` predicate
  _unconditionally_, before checking whether the grant's own `target` even matches the requested `id`. A `while:
hasTrait(ref, trait)` predicate's `evaluate` case (`select.ts`, `"hasTrait"`) calls `traitsOf(state, refId)` — a
  full, unmemoized re-entry into the very function currently running. Because the predicate's inputs never depend
  on the outer call's `id`, the re-entrant call hits the identical ability's identical `while` again, unconditionally,
  every single time: an **unconditional** infinite recursion (not merely deep), so no board size or player count
  avoids it. `statBonus`/`modifiersFor` (`modifiers.ts`) hit the same wall for the ATK sibling, since a stat
  modifier's own `while` reaches `evaluate` → `traitsOf` the same way.
- **Not unique to this card.** Any constant `gainsTrait`/`gets`/`gainsKeyword` rule anywhere whose `while` needs
  `hasTrait`/`traitsOf` on any card crashes the instant that ability is active in play and `traitsOf`/`statBonus` is
  called for _anything_ — this is the first card in the pool to combine the two, but nothing about the shape is
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

### 6.16 "The current player's own nemesis minion" as a live, per-player query (found scripting `toafk`)

- **Card:** Kang's Wrath 4B (11013b, `kang.ts`): "Each player searches the encounter deck, discard pile, and
  set-aside area for their nemesis minion and puts it into play engaged with them."
- **What landed already covers the _pooling_ half.** §6.14's "one pool across several zones" gap (docs/phase7-
  wave2.md §10.1, `CardSelector { kind: "anyOf" }`) is exactly this card's own worked example, and it landed. What's
  still missing is the _identification_ half: nothing reads "the minion belonging to _this player's own_ chosen
  hero's nemesis set" dynamically, so the search still can't be written as one selector.
- **The gap, precisely.** `CardSelector { kind: "setAside", player }` already finds _a_ player's whole set-aside
  pool (every card in their nemesis set, not only the minion), and `TargetQuery.name` matches one fixed printed
  name — but no query field varies that name _per player_ the way `PlayerRef defeatingPlayer` now reads a defeated
  scheme's own defeating player, or the way `identitySetOf: PlayerRef` reads a _player card's_ `aspect` field
  against a player's identity. Nemesis minions are encounter cards, not player cards (ruling, Jun 25, 2026 (4):
  "Nemesis sets belong to that identity" — about set ownership, not `identitySetOf`'s own player-card-only
  `aspect` check), so `identitySetOf` itself doesn't reach them; a `nemesisMinion: true` card-data flag already
  exists (`packages/content/src/schema/validation.ts`) but nothing ties it to _which_ identity's nemesis set a
  specific minion belongs to at query time.
- **Closest existing primitive:** the `defeatingPlayer`/`eventPlayer` family of context-scoped `PlayerRef`s, or
  `identitySetOf`'s own shape generalized past player cards — a `TargetQuery.nemesisMinionOf?: PlayerRef` field
  (matching a minion whose own nemesis set belongs to that player's chosen identity) would let this card's search
  be written as one `anyOf` selector with no per-player special-casing, the same way `04028.when-revealed` (`trors`,
  Marked for Death's own "Mockingbird, wherever she is" search — a different, fixed-name gap, not to be conflated
  with this one) would benefit from the pooling half alone.
- **Pinned:** `11013b.when-revealed` (`wave2/coverage.test.ts`'s `KNOWN_SKIPPED.toafk`).

### 6.17 "X (or an event you play) defeats" — narrower than "you defeat" (found scripting `wsp`)

- **Card:** Small but Mighty, Wasp's own hero-face ability (13001a): "Response: After Wasp (or an event you play)
  defeats a minion or side scheme, deal 1 damage to the villain."
- **The gap.** `on.defeated({ byYou: true })` matches `characterDefeated`/`schemeDefeated`'s own `defeatedByPlayerId`
  (`packages/engine/src/trigger-events.ts`), set "when the defeat came from a damage event with a player-controlled
  source" — any player-controlled source, an ally's own attack included. Small but Mighty's printed text
  deliberately narrows to "Wasp (or an event)", excluding allies, and nothing on the event names _which card_ (as
  opposed to which player) dealt the defeating damage, so there is no way to exclude an ally-caused defeat without
  also silently accepting it as "you".
- **Closest existing primitive:** the `overkill.sourceInstanceId` field `characterDefeated` already carries for its
  own overkill case — a general `sourceInstanceId` on the same event (whatever dealt the defeating damage,
  character or event, alongside the existing `defeatedByPlayerId`) would let this be read directly.
- **Pinned:** `13001a.small-but-mighty` (`wave2/coverage.test.ts`'s `KNOWN_SKIPPED.wsp`; full write-up in
  `wsp/kit.ts`'s module docblock).

### 6.18 A bonus scoped to "the basic power activation currently resolving", for any of the four basic powers (found scripting `wsp`)

- **Card:** Rapid Growth (13005): "Hero Interrupt: When you use one of your hero's basic powers (THW, ATK, or DEF),
  change to your Giant hero form and get +2 to that power for this use."
- **The gap.** `LastingUntil.endOfAttack` (the closest existing "just this activation" scope) is keyed to
  `currentActivationFrameId` (`packages/engine/src/stack.ts`), which only recognizes `attack`/`enemyAttack`/
  `enemyScheme`/`thwart` event frames. A basic _defense_ or _recover_ use pushes no frame kind that scope
  recognizes, so a DEF use of this card — which the printed text explicitly includes — could not be scoped
  correctly even though ATK/THW could.
- **Closest existing primitive:** `enemyAttack`/`enemyScheme`'s own inline `atkBonus`/`schBonus` (a bonus scoped to
  exactly the activation an _effect_ initiates) — there is no equivalent for a basic power a _player command_
  initiates, which an interrupt would need to hook into before the amount is computed. Generalizing
  `currentActivationFrameId` to recognize a basic defense/recover frame too would also close this, if those pushes
  a comparable frame kind already (unconfirmed).
- **Pinned:** `13005.rapid-growth-interrupt` (full write-up in `wsp/kit.ts`'s module docblock).

### 6.19 An attack-keyword rule that matches _only_ a basic attack, excluding an event-sourced one (found scripting `wsp`)

- **Card:** Red Room Training (13008): "While you are in Tiny hero form, your basic attacks gain piercing."
- **The gap.** `RuleSpec attackKeywords`'s `via` field (docs/phase7-wave2.md §3.13.1) can _exclude_ a basic attack
  (a rule with `via` set never matches one, since a basic attack's own `viaId` is always null — "a basic attack
  never matches a rule with `via`"), but there is no way to require the opposite: match _only_ a basic attack,
  excluding an event-sourced one. Without it, "your basic attacks gain piercing" can only be scripted as "your
  attacks gain piercing" (omitting `via` entirely), which over-grants piercing to the player's own event attacks
  too — a real rules bug, not an approximation of the same behavior.
- **Closest existing primitive:** `via`'s own null-exclusion, generalized to a `basicOnly: true` field (or a
  sentinel `via` value meaning "no via at all", the mirror image of today's "some via" match).
- **Pinned:** `13008.red-room-training-constant-2` (full write-up in `wsp/kit.ts`'s module docblock).

### 6.20 No trigger event announces a completed ready — only the interrupt to replace one (found scripting `qsv`)

- **Card:** Friction Resistance (14009, Quicksilver): "Hero Response: After you ready Quicksilver, ready this
  card." (its own Resource ability needs nothing new and is scripted.)
- **The gap.** `cardReadying` (`packages/engine/src/trigger-events.ts`) is the _interrupt_ twin only ("when [a
  card] would ready"), pushed solely so an ability can replace the ready (Frozen in Time, docs/phase7-wave2.md
  §3.11) — it is explicitly excluded from the response-window scan (the same kind list `basicPowerUsing`,
  `encounterCardRevealing`, and the rest of the "-ing" events sit in, all interrupt-only by design). Nothing fires
  _after_ a ready completes, the way `basicPowerUsed` fires after a basic power resolves, or `cardEntersPlay`/
  `characterDefeated` announce after their own event.
- **Closest existing primitive:** the same "-ing"/"-ed" pair the engine already uses for `basicPowerUsing`/
  `basicPowerUsed` — a `cardReadied` announcement, pushed once `readyOrAnnounce` (`resolve/event.ts`) actually
  readies the card (mirroring how `cardReadying`'s own interrupt is pushed today), would let this (and any future
  "after X readies" card) be written the same way.
- **Pinned:** `14009.friction-resistance-response` (full write-up in `qsv/kit.ts`'s module docblock).

### 6.21 "Cannot ready … until your next turn ends" — a sibling gap to Care for Cassie's "cannot change form" (found scripting `qsv`)

- **Card:** Need for Speed (14024), Quicksilver's own obligation: "…Exhaust your identity. **You cannot ready your
  identity until your next turn ends.** Discard this obligation."
- **The gap.** The same shape Care for Cassie's own restriction (12025, `ant/obligation-nemesis.ts`, §6 above) is
  pinned for, except this is "cannot **ready**", a different standing rule than "cannot change form" —
  `LastingEffectBody` has no `cannotReady`-kind sibling to `statModifier`/`traitGrant`/`costReduction`/
  `blankTextBox` for either restriction, and "until your next turn ends" isn't one of `LastingUntil`'s four values
  either. Otherwise the Core obligation shape (`core/obligations.ts`'s `obligation` helper already handles "give to
  X, may flip, exhaust-to-remove-or-alternative").
- **Closest existing primitive:** `LastingEffectBody`'s own shape, needing a `cannotReady`-kind sibling (and, like
  Care for Cassie, a "until your next turn ends" duration) — the same fix would very likely close both cards at
  once, since they're the identical shape of restriction on two different standing rules.
- **Pinned:** `14024.obligation` (full write-up in `qsv/obligation-nemesis.ts`'s module docblock).

### 6.22 Not primitive gaps: two small `@mc/cards`-owned catch-ups, found scripting `qsv`

- **`oncePerRound`'s own sibling was missing.** "(Limit once per phase.)" (Super Speed, 14001a) needed
  `AbilityLimit { count: 1, period: "phase" }` — the engine already supports `period: "phase"` (docs/phase7-wave1-
  scripting.md's own `AbilityLimit` shape), just no DSL constant for it. Added `oncePerPhase` next to
  `oncePerRound` (`dsl/abilities.ts`).
- **`dsl/validate.ts`'s `checkBindings` didn't know about `playCard.x`.** Speed Cyclone's (14006) "Stun X Enemies"
  reads `varOf("x")` — the play's own var for a cost printed "X" (`commands.ts`'s own docblock, built for this
  exact card) — but the validator's bound-var scope only pre-seeded the `"paid."`/`"sequence."`/`"self.counters."`
  _prefixes_, not the bare `"x"` name, so any card reading it failed `defineAbilities`'s own "var read before it is
  bound" check even though the var is genuinely supplied externally (the same class as `paid.*`, just not a
  dotted prefix). Added `"x"` to the pre-seeded scope, and `"overpaid."` alongside `"paid."` while there (`playCard`
  also exposes `overpaid.*` to a card's own abilities per the same docblock; nothing in the pool reads it yet, but
  the validator would have hit the identical false-positive the moment something did).

## 7. Status

| Pack                     | Code    | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Rise of Red Skull    | `trors` | **Scripted.** 152 cards, 248 ability refs: 220 resolve (15 as reprint aliases, 205 hand-scripted), 30 in `KNOWN_SKIPPED` — all 30 Hydra Campaign refs (PLAN.md, "Campaign mode"; `trors` is slated to be the first box built), pinned regardless of any primitive while campaign mode is unbuilt. Every §6 primitive gap found scripting `trors` (§6.1–§6.7, §6.9, §6.10, plus the per-aspect-limit half of §6.11 — 18 refs total across Hawkeye's Bow, Vibranium Arrow, Crossfire's boost, Piercing Strike, Finesse, Jessica Drew's Apartment, Superhuman Agility, Crossfire's Rifle, Cable Arrow, Kate Bishop's Hawkeye, Mockingbird, Crossbones' Assault, Prison Camps, Hydra Reinforcements, Taskmaster I/II/III's forced response, None Shall Pass's forced interrupt) has since landed and was un-skipped in later passes over the same pack — see §6's "LANDED" notes. **`04028.when-revealed` is un-skipped (2026-09-20, `ability-scripting-engineer`, docs/phase7-wave2.md §18.4/§23):** the skip had gone stale — `anyOf` (unioning a `zone` selector with a `ref`/`each` selector over the play area) and `tuckCards` were both already there; `eventPlayer` is provably "the Clint Barton player" since Marked for Death only ever enters this reveal via Shadow of the Past unpacking the _same_ player's own nemesis set (`hawkeye-obligation-nemesis.ts`'s own module docblock walks the proof). Tested both halves with real commands (found in the deck; found already in play and taken out of it) — and, along the way, found and fixed a pre-existing staging bug in the two neighboring Sniper Shot tests (`hawkeye.test.ts`): bare `stackSetAside` reaches Rhino's own automatic boost draw, not the player's own reveal, so both tests were previously passing only because Rhino's own independent attack/scheme that same villain phase happened to satisfy their loose `toBeGreaterThanOrEqual` assertions — never actually revealing Sniper Shot at all; fixed with a new shared `stackSetAsideBehindBoost` helper.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | All five scenarios are scripted: Hawkeye/Spider-Woman kits (`hawkeye-kit.ts`, `hawkeye-obligation-nemesis.ts`, `spider-woman-kit.ts`, `spider-woman-obligation-nemesis.ts`), Crossbones (`crossbones.ts`), Absorbing Man (`absorbing-man.ts`), Taskmaster (`taskmaster.ts`), Zola (`zola.ts`) and Red Skull (`red-skull.ts`), each with its own `wave2Scenario(...)` entry in `../setup.ts` and its own ruling-level `.test.ts` plus a standalone setup test proving each scenario's own 1A/1B setup ability actually runs (setAside, scenario decks, engaged minions, revealed side schemes, etc.). Real-game tests: `wave2/trors/e2e.test.ts` (Hawkeye and Spider-Woman precons vs. Rhino, solo, to a real outcome; Crossbones standalone 2-player setup). **Data gaps flagged for `card-data-pipeline`:** (1) the Attack on Mount Athena 1A text prints "Three modular sets (Hydra Assault, Weapon Master, and Legions of Hydra)", but `trors/encounterSets.ts` has no "Legions of Hydra" `EncounterSet` — `crossbonesScenario` uses only the two that exist; (2) several cards carry more ability refs than their printed text has independent clauses for (Omni-Morph Duplication 04089's four extra "-constant" refs, The Mad Doctor 04113b's and Neurological Implants 04119's second refs, The Rise of Red Skull 1A's 04128a and New World Hydra's 04129b's "-constant" refs) — each is stood up as an empty `coveredByEngineRule()` rather than left unscripted, since the card's own primary ability ref already carries the full printed behavior; (3) Captured by Hydra (04107) prints a "When Defeated" clause with no ability ref to hang it on (contrast Hydra Prison, 04122, which prints an equivalent shape with two refs) — only its "When Revealed" half is scripted. |
| The Once and Future Kang | `toafk` | **Scripted, `KNOWN_SKIPPED` empty.** 51 cards, 90 ability refs (up from 82: `card-data-pipeline` split 11020/11049 each into a `-constant` ref and a `-action` ref, docs/phase7-wave2.md §18.2): all 90 resolve (2026-09-20, `ability-scripting-engineer`, docs/phase7-wave2.md §25) — `11049.fear-of-kang-constant` ("You cannot attack Kang") was the last non-campaign ref in the wave 2 skip backlog. `game-rules-architect` gave `RuleSpec cannotAttack` a `player?: PlayerRef` field mirroring `cannotPlay`'s (§25.1), so `11049.fear-of-kang-constant` ships as `player: you`, scoped to this obligation's own controller rather than the whole table; `fear-of-kang-constant.test.ts` keeps its two-player proof, now asserting both that a _bare_ rule (Distracting Taunts' own shape) is still table-wide by design and that the shipped scoped shape blocks only its own controller. §25.3's matching `cannotPlay` fix (`cards` now reads the speaker context) let `11020.depowered-constant`'s `cards` filter narrow from the `eachPlayer` workaround to `identitySetOf: you`, the more literal reading of "you cannot play _your_ hero-specific cards" — both read identically in practice per RRG 1.8 "Identity-Specific Card" (p. 23). All §6.13/§6.14/§6.16 gaps have landed (docs/phase7-wave2.md §10, §17.1) and are un-skipped: 11008b's both refs (the acceleration-token redirect and the join restriction — the latter needed no rule at all, §10.4), 11013a (Kang III added, the tucked Kang's Dominion revealed via the new `TargetRef { kind: "tuckedUnder" }`/`tuckedUnderRef`), and **11013b.when-revealed (2026-09-19, `ability-scripting-engineer`)** — "each player searches the encounter deck, discard pile, and set-aside area for their nemesis minion and puts it into play engaged with them", `TargetQuery.nemesisMinionOf` inside the already-landed `anyOfCards` pool, one `forEachPlayer`/`selectCards`/`putIntoPlay` triple. The Expert encounter set (11040–11051), not started as of an earlier session, is fully scripted. **`11018.weakened-action`/`11019.stolen-memories-action`/`11021.time-travel-hijinks-action` are un-skipped (2026-09-20, `ability-scripting-engineer`, docs/phase7-wave2.md §19/§23):** `AbilityCost.discardFromHand` gained `filter?: TargetQuery`, the cost-side twin of the effect's own `discardFromHand.filter`; `discardFromHandCost` (`dsl/abilities.ts`) grew a matching fourth argument. Each tested with a real command: an obligation revealed by relabeling an already-in-the-deck filler card (the same workaround the Time-Travel Hijinks reveal test above already used, since the Kang/Temporal set's own obligations carry no `encounterSetIds`), then its own Alter-Ego Action paid with the matching basic resource card ([physical]/[mental]/[energy]) moved to hand. **Two real bugs were found and fixed, not just new scripting:** (1, earlier session) `11007a.setup`'s "remove each player's obligation cards from the game" used `query("obligation")` — _every_ obligation-type card — which broke once the Temporal set's own four obligations (11018–11021, also type "obligation") existed; fixed with `withoutTrait: TEMPORAL`. (2, this session, a _data_ gap, not fixed here — out of `@mc/cards`' remit) `TargetQuery.nemesisMinionOf` requires the `nemesisMinion: true` flag unconditionally, but Hawkeye's own single-minion nemesis set (Crossfire, 04027, `trors`) carries no such flag (real cards only print the disambiguating parenthelical for a multi-minion set, RRG 1.8 p. 30) — found by testing Kang's Wrath 4B with a Hawkeye player and getting nothing back; the real test in `kang.test.ts` uses Ant-Man instead and documents the gap inline (also written up in §6, new subsection). | Kang's villain (standard and Expert), "Kang's Arrival" 1A/1B, "The Master of Time" 2A/2B, "Kang's Wrath" 4A/4B, and all four stage 3 alternatives are scripted in `kang.ts`; the Kang/Temporal encounter set plus the Expert set (11014–11033, 11040–11051, minus the two-clauses-one-ref obligations) is scripted in `kang-encounter-set.ts`. `wave2Scenario("kang", …)` (`../setup.ts`'s `kangScenario`) is data-driven off `WAVE2_SCENARIOS`. `kang.test.ts` has a standalone setup test (standard and expert), ruling-level tests, a full one-player split-and-rejoin playthrough exercising 11008b and 11013a end to end through real commands (defeat Kang (I) → stage 3 area created → defeat that area's Kang (II) → area rejoins the center → center advances straight to Kang's Wrath → Kang (III) and the tucked Dominion appear), and a second full playthrough (Ant-Man) proving 11013b's own search-and-engage fires automatically right after 11013a's, in the same stage advance. `kang-encounter-set.test.ts` covers Time-Travel Hijinks' highest-cost discard-and-tuck with a real playthrough, plus definition-level checks for the rest. **A second, purely data-side gap remains, not fixed (out of `@mc/cards`' remit): the Kang/Temporal set's own four obligations (11018–11021) carry `encounterSetIds: []` in `@mc/content`** — they are never shuffled into any deck in a real game, so they are currently unreachable content despite being correctly scripted. Flagged for `card-data-pipeline`; `kang-encounter-set.test.ts`'s own Time-Travel Hijinks test works around it by relabeling an already-in-the-deck filler card's `cardId`, documented inline as a stand-in for the real fix.                                                                  |
| Ant-Man                  | `ant`   | **Scripted.** 33 cards, 37 ability refs: all 37 resolve, none in `KNOWN_SKIPPED`. **The remaining five refs are un-skipped (2026-09-20, `ability-scripting-engineer`, docs/phase7-wave2.md §18/§23):** `12011.ant-man-interrupt` and `12032.muster-courage-action` were stale skips — `overpaid.total` was already readable from a later `cardEntersPlay` interrupt (§18.3), and "up to X" was already `chooseTarget.count: ValueSpec` + `optional`, not `chooseCards.max` (§18.5); `12024.team-building-exercise-action` and `12029.when-revealed` needed the new `TargetQuery.sharesTraitWith`/`encounterSetOf` fields (§20.1/§20.2, wrapped as `sharesTraitWith(ref)`/`encounterSetOf(ref)` in `dsl/values.ts`); `12025.obligation` needed `EffectSpec applyRuleUntil` (§22, wrapped as `cannotChangeFormUntil(...)` in `dsl/effects.ts`). Every one tested with a real command — Ant-Man's own overpayment via a basic resource card moved to hand and paid, including the printed 4-counter cap with a 6-resource overpayment; Team-Building Exercise's reduced-cost play resolved through its own `chooseCards`/`spendResources` prompts (`pack-cards.test.ts`, a new file); Care for Cassie's restriction proven to block, then release, the identity's own end-of-phase ready step across two real rounds (`kit.test.ts`). **Yellowjacket's two form-conditional constants (§6.15) are un-skipped (2026-09-19, `ability-scripting-engineer`)**, scripted exactly as the crash-inducing attempt originally was (`gainsTrait`/`gets(..., { while: hasTrait(identityOf(engagedPlayerOf(self)), GIANT) })`), now safe under `traitsOf`'s §17.5 guard — confirmed with a real reveal-from-encounter-deck test reading its live traits/stats, not re-added on faith. Three-sided identity (§1.1/§3.2 of docs/phase7-wave2.md) and Tech Theft's class-wide text-blanking (§8 there) are both landed and used (`kit.ts`'s `changeToOtherHeroForm`/`youHaveTrait`, `obligation-nemesis.ts`'s `blanksTextBox`, verified with a real behavioral test attaching a TECH upgrade and confirming its own text goes blank). Pym Particles' "after you spend this card" trigger (`resourcesSpent`/`on.youSpendThis()`) and Giant Strength's `LastingUntil.endOfTurn` both landed mid-session (commits `1036be7`, `c53ad0b`) and were un-skipped with real behavioral tests the same session.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Ant-Man's kit (`kit.ts`), obligation/nemesis (`obligation-nemesis.ts`) and the pack's own generic-aspect cards (`pack-cards.ts`) each have ruling-level tests (`kit.test.ts`) driving real commands — form changes, Hero Actions gated by `while`, a Team-Up legality check, a reveal-from-encounter-deck helper for the nemesis set's own cards, Yellowjacket's own live form-conditional trait/keyword/stat grants — plus `e2e.test.ts` (Rhino, standard, solo, Ant-Man Leadership precon to a real outcome, replayed deep-equal).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Wasp                     | `wsp`   | **Scripted (2026-09-19, `ability-scripting-engineer`).** 34 cards, ~50 ability refs: all resolve, none in `KNOWN_SKIPPED`. **`13012.wasp-interrupt` is un-skipped (2026-09-20, `ability-scripting-engineer`, docs/phase7-wave2.md §18.3/§23):** the skip was stale — `overpaid.energy` was already readable from a later `cardEntersPlay` interrupt, the identical shape Ant-Man's own overpay interrupt (12011, `ant`) needed. Tested both ways with a real command: her own deck's two basic resource cards (Energy: 2 [energy] icons; Strength: 2 [physical] icons) overpaying her 0 cost, isolating the resource-type filter (`pack-cards.test.ts`). **All five §17 refs are un-skipped, each with a real behavioral test:** Small but Mighty (`on.defeats`, an identity-or-event-not-ally defeat, proven both ways — Wasp's own basic attack damages the villain, the Ant-Man ally's identical defeat does not); the Ant-Man ally's two form-conditional constants (same shape and same §17.5 fix as Yellowjacket's, verified live); Rapid Growth (`on.basicPowerUsing`/`modifyBasicPower`, a real basic attack raised 2→4 damage mid-attack, played as a reactive event from hand inside the interrupt window, form change and "for this use" expiry both checked); Red Room Training's Tiny-form piercing half (`attacksGainKeywords({ basicOnly: true })`, a real tough-status-card discard distinguishing a basic attack from Pinpoint Strike's own ability attack).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Wasp's kit (`kit.ts`), obligation/nemesis (`obligation-nemesis.ts`, Red Dreams/Mother's Orders/Beetle/Beetle Armor MK IV/Beetle Mania) and the pack's own generic-aspect cards (`pack-cards.ts`) are scripted, each with real behavioral tests (`kit.test.ts`, `obligation-nemesis.test.ts`, `pack-cards.test.ts`). No standalone scenario/e2e test yet (`wsp` owns no scenario of its own; the Rhino Core scenario is used for every test, the same way `ant/kit.test.ts` does). Reused Ant-Man's own three-sided-identity and divided-basic-power patterns throughout, per the task brief.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Quicksilver              | `qsv`   | **Scripted (2026-09-19, `ability-scripting-engineer`).** 32 cards, ~35 ability refs: all resolve, none in `KNOWN_SKIPPED` (Armored Vest and the three basic resources are Core reprints, aliased by `../reprints.ts`, not counted as hand-scripted). **`14009.friction-resistance-response` and `14024.obligation` are un-skipped (2026-09-20, `ability-scripting-engineer`, docs/phase7-wave2.md §21/§22/§23):** the former needed the new `cardReadied` announcement (wrapped as `on.cardReadied(query)` in `dsl/abilities.ts`), proven by chaining off Super Speed's own real ready of Quicksilver (`kit.test.ts`); the latter needed `EffectSpec applyRuleUntil` (wrapped as `cannotReadyUntil(...)` in `dsl/effects.ts`), the sibling of Care for Cassie's own "cannot change form" restriction (12025, `ant`) — proven blocking, then releasing, the identity's own end-of-phase ready step across two real rounds (`obligation-nemesis.test.ts`). Reused `on.basicPowerUsing`/`modifyBasicPower` (§17.4) for Scarlet Witch's own interrupt (a live `ValueSpec` bonus, not a fixed one), `chooseOptions`/`RuleSpec attackKeywords.basicOnly`/`playCard.x` (all landed already, none previously exercised by a scripted card) for Double Time, Brute Force and Speed Cyclone respectively, and `atEndOfAttack` + `eventDealt`/`not(...)` (Sweeping Swoop's own precedent, `core/heroes/spider-man.ts`) to defer Never Back Down's "if you take no damage" half to the attack's own end. Two small DSL/validator catch-ups, not primitive gaps (§6.22): `oncePerPhase`, and `playCard.x` missing from the validator's own pre-seeded var scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Quicksilver's kit (`kit.ts`), obligation/nemesis (`obligation-nemesis.ts`) and the pack's own generic-aspect cards (`pack-cards.ts`) are scripted, each with real behavioral tests (`kit.test.ts`, `obligation-nemesis.test.ts`, `pack-cards.test.ts`) driving real commands — a real villain-phase defended attack for Never Back Down/Side Step (declaring a defender, playing a reactive event inside its own interrupt/payment windows, `wave1/cap/expert-defense.test.ts`'s own precedent), a real reveal from the encounter deck for Multiple Man/Avalanche/Earthquake, a real `basicAttack` with an "X" cost for Speed Cyclone. Brute Force (Aggression), Sense of Justice (Justice), United We Stand (Leadership) and Beat 'Em Up (Basic, absent from the precon's own curated list) are `toBeDefined()`-only — unreachable from Quicksilver's single-aspect Protection precon, the same situation `wsp/pack-cards.test.ts` records for her own off-aspect cards. A genuine two-player "each player independently" integration test for Avalanche was attempted and dropped (`obligation-nemesis.test.ts`'s own comment): both branches of that choice are proven with a real reveal in a solo game, and the `forEachPlayer(eachPlayer, chooseOneBy(thatPlayer, …))` shape itself is the same one already used by Under Attack (Core, `core/scenarios/ultron.ts`) and several wave 1/2 cards — the two-player table's own villain-phase dynamics (surge chains, a second enemy's own scheme once the nemesis minion is engaged) raced the scenario to an early loss before a deterministic assertion point could be reached, a scenario-level testing obstacle rather than evidence about the ability.                                                                            |
| Scarlet Witch            | `scw`   | **Scripted, `KNOWN_SKIPPED.scw` empty (2026-09-20, `ability-scripting-engineer`).** 31 physical cards (plus the reprinted resources/upgrade), 34 ability refs: all 34 resolve. `15023.obligation` (Slipping Sanity) is now scripted: `card-data-pipeline` landed a printed `starIcon?: boolean` field (docs/phase7-wave2.md §18.6/§24), and the engine grew a matching `ValueSpec`/`<bind>.starIcons`; the script is `obligation("Wanda Maximoff", { effects: [discardEncounterCards(5, { bind: "sanity" }), placeThreat(varOf("sanity.starIcons"), theMainScheme)] })`, the exact shape the architect's own §24.5 write-up gave. Tested with a diff between two full villain-phase runs (same seed, differing only in the five discarded cards' own icons) rather than a single before/after read, since the villain phase's own base threat placement and Rhino's own scheme/attack activation land on the same main scheme and would otherwise confound a single-run assertion; the discard pile deliberately mixes two star-only/star+pip cards (Weapons Runner 01121, Repair Sequence 01146) with three plain-pip no-star cards so `starIcons` (2) and `boostIcons` (5) disagree, catching a swap between the two rather than merely a "did anything happen" check (docs/card-scripting-process.md §7). A second test covers the obligation's other branch (exhaust Wanda Maximoff to remove it from the game), the same shape already proven for Spider-Man's own obligation in Core. Chaos Control (15001a) is scripted **only** against the `boostIconsCounting` activation-boost window (§3.6's own primitive, landed) — whether it also reaches a card effect's own `<bind>.boostIcons` count (Hex Bolt, Molecular Decay, Wiccan, Luminous, Chaos Manipulation, and the `qsv` Scarlet Witch ally) is the still-open §3.6/§4.8 rules question, deliberately left undecided rather than guessed at; see `kit.ts`'s own module docblock. Two found-by-testing script bugs (not primitive gaps, §4.1): Chaos Manipulation's own Luminous search needed `{ min: 1 }`, not `{ min: 0 }` — `firstLegal` (which always answers with the fewest legal selections) silently declined the pick even when she genuinely was found; and `playFromHandIgnoringCost`'s own doc comment mislabeled Chaos Magic as a `qsv` card (a one-line fix, `dsl/effects.ts`). Every test drives real commands — including a synthetic side-scheme surgery (`trors/red-skull.test.ts`'s own precedent) to prove Turn the Tide's "thwarts and defeats a scheme" Response, since the _main_ scheme reaching 0 threat never fires a `schemeDefeated` event — except Browbeat (Aggression), Last Stand (Leadership), Bait and Switch (Protection) and Recuperation (Basic, absent from the `scw-justice` precon's own curated card list), which are `toBeDefined()`-only, the same situation `qsv/pack-cards.test.ts` records for her own off-aspect cards.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Scarlet Witch's kit (`kit.ts`), obligation/nemesis (`obligation-nemesis.ts`) and the pack's own generic-aspect cards (`pack-cards.ts`) are scripted, each with real behavioral tests (`kit.test.ts`, `obligation-nemesis.test.ts`, `pack-cards.test.ts`). No standalone scenario/e2e test yet (`scw` owns no scenario of its own; the Rhino Core scenario is used for every test, the same way `wsp`/`qsv` do). The Next Evolution/Luminous/Magical Suspension/Chaos Manipulation (her nemesis set) are all reached through real reveals: Shadow of the Past (01190, a Core Standard card) for the first two, and set-aside-to-deck-or-discard test surgery (mirroring `stageNemesisCardForReveal`) for the latter two, since her nemesis set's own non-minion cards only re-enter a real game once Shadow of the Past shuffles them in.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

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
`KNOWN_SKIPPED` shrank from 47 to 33 (§7). One primitive (`AttackKeyword`) landed at the _very start_ of this
session and was inspected in detail before the rest showed up mid-session in the same batch; the DSL layer for all
of them was added together, once the full batch was confirmed landed.

Two new lessons for §5: (1) `payForAbility`'s own `minSelections` can be 0 even for a mandatory resource-spend cost
(the engine allows auto-top-up) — `firstLegal` then pays _nothing_, silently failing the cost; a test exercising a
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
`absorbing-man.test.ts`'s old "(documents the open gap)" test, which asserted the _broken_ pre-fix behavior, to
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

**`toafk` (Kang) is `"in progress"`, same day.** Kang's villain (11001–11006, standard _and_ the Expert Kang copies
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
  this stage", 1 ref) — `tuckedUnder(...)` finds tucked cards, but no effect turns a _tucked, out-of-play_ card
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
`PACK_STATUS[code]` to `"in progress"` and pin the pack's _entire_ ability-ref list in `KNOWN_SKIPPED` before
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
- **Yellowjacket** (12027): turning its "is defined" test into a real one _found a genuine engine crash_, not a
  missing vocabulary word — see the new §6.15 write-up. The ability was pulled from the registry (not shipped
  broken) and added to `KNOWN_SKIPPED.ant`, with the full root-cause analysis in `ant/obligation-nemesis.ts`'s
  module docblock and §6.15 here, for `game-rules-architect`. This is this brief's own "found-by-testing" rule
  (§4.1) working exactly as intended: the ability compiled, typechecked, and _looked_ like an existing pattern (The
  Viper's constant) right up until a real test exercised it.
- Re-ran the `KNOWN_SKIPPED` regeneration check (§1) against `ant`'s full ref list before promoting the pack to
  `"scripted"`: all 9 remaining unresolved refs are documented primitive/engine-bug blocks (none "not yet reached"),
  matching `trors`' own bar for that status. `ant`'s `KNOWN_SKIPPED` is unchanged in size (still 7 pre-existing
  primitive blocks) plus the 2 new Yellowjacket entries = 9.
- Confirmed §3.13's table before touching anything: three-sided identity (§3.2) and Tech Theft's class-wide
  text-blanking (§8 there) are both landed and already used correctly by the pack's existing scripts — no rework
  needed, just verification (this session's own version of the "re-check before assuming still blocked" lesson).
- `pnpm -w typecheck` and `packages/cards`' full Vitest suite (589 tests) are green.

**Same-day follow-up (still 2026-09-19): the coordinator pushed two more landed primitives mid-session** —
`resourcesSpent` (commit `1036be7`, DSL `on.youSpendThis()`) and `LastingUntil.endOfTurn` (commit `c53ad0b`) — the
exact two gaps blocking `12006.pym-particles-response` and `12009.giant-strength-response` (`kit.ts`'s own
docblock). Un-skipped both with real behavioral tests (`kit.test.ts`): Pym Particles spent to pay for another
card's cost, heals 2 in Giant hero form / draws 1 in Tiny hero form; Giant Strength's +1 ATK isolated from the
Tiny→Giant form change's own base-ATK difference by forking the same pre-change state into a declined and an
accepted branch, and confirmed absent (no new `lastingEffects` entry) when changing to alter-ego instead. `ant`'s
`KNOWN_SKIPPED` is now 7 (down from 9): the 2 genuine engine-bug entries from §6.15, plus the 5 pre-existing
missing-primitive blocks. Re-pushed to `origin/feature/wave2` after each verified green commit, per the process
change mid-session (fetch → merge → re-verify → push, never force-push).

**Not reached that session: `wsp`, `qsv`, `scw`.** Only `ant` fit in that session's budget once the found engine
crash needed a full root-cause writeup rather than a quick fix.

**2026-09-19, next session: `toafk` finished, promoted to `"scripted"`.** Picked up with `toafk` `"in progress"`
(51 cards, 82 refs: 59 resolved, 23 skipped — §6.13/§6.14's four primitive gaps, the four Temporal obligations, and
the not-yet-started Expert set). Re-checked docs/phase7-wave2.md §10 first, per this file's own standing habit, and
found all four §6.13/§6.14 gaps landed there the same day they were pinned:

- **Un-skipped `11008b`'s both refs** (`kang.ts`): the acceleration-token redirect is now
  `constant({ rules: [{ kind: "accelerationTokenDestination", to: self }] })` (§10.3); "players cannot join this
  game area unless…" needed **no rule at all** (§10.4 — the join procedure already only offers separate areas as
  destinations), so only the "advance to stage 4A" half of that ref carries an effect
  (`stateCheck(not(gameAreasSplit), advanceMainScheme(...))`).
- **Un-skipped `11013a.when-revealed`**: two new DSL builders, `centralMainScheme` and `tuckedUnderRef` (`dsl/
values.ts`, wrapping the landed `TargetRef { kind: "tuckedUnder" }`, §10.2), let `revealCard(tuckedUnderRef(
centralMainScheme), firstPlayer)` reveal the facedown Kang's Dominion(s) tucked there by the stage 3 areas' own
  Forced Responses — no new effect needed, `revealCard` already runs the whole reveal procedure on whatever it's
  given, tucked cards included.
- **`11013b.when-revealed` is still blocked** — §10.1's `anyOf` selector landed, but that only solves the "search
  several zones as one pool" half; a _new_ gap (§6.16, not a re-flagging of §6.14) blocks the "identify **whose**
  nemesis minion" half: no query reads "the minion belonging to _this player's own_ chosen hero's nemesis set"
  dynamically. Left skipped with the new gap documented precisely, not silently conflated with the landed one.

**Also scripted the Expert encounter set (11040–11051, not started as of the last session)** — 15 of 16 refs
(`kang-encounter-set.ts`): every "Boost: … Give this enemy another boost card" reads as `modifyAttack({
extraBoostCards })` (Hydra Exo-Soldier's own established reading, `trors/red-skull.ts` — never `giveBoostCard`,
which the validator refuses inside a `boost()` ability), Terminatrix's own piercing grant reuses the `attackKeywords`
rule Tyrannosaurus Rex (11032) already established, and Ancient Grudge's "Kang (Master of Time) activates against
you" reads as an attack, the convention `absorbing-man.ts` already cites for every other cycle-1 "activates against"
phrasing. `11049.obligation` (Fear of Kang) stays skipped — the same "two clauses, one ref" data shape 11020
(Depowered) already has, not a new gap.

**Un-skipped `11021.when-revealed`** ("discard the highest-cost card you control, then place it facedown under this
card") by centralizing `superlative`/`printedCostOf` into `dsl/values.ts` — the module docblock's own earlier claim
that no primitive existed for "the highest-cost card" was wrong: `TargetRef { kind: "superlative" }` already existed
in the engine and had five separate per-pack copies of an identical local builder (`wave1/{gob,hlk,twc,bkw,drs}/
local.ts`), just never centralized. Its Alter-Ego Action half stays skipped for the pre-existing resource-type-
filtered-cost gap (11018/11019 share it).

**A real bug, not just new scripting, was found and fixed:** writing `kang-encounter-set.test.ts`'s own real test
for 11021 (stacking it onto the encounter deck) found it unreachable — tracked down to `kang.ts`'s own `11007a.setup`
using `query("obligation")` (every obligation-type card) to "remove each player's obligation cards from the game," a
reading that stopped being correct the moment the Temporal set's own four obligations (11018–11021, also type
"obligation") existed. Fixed with `withoutTrait: TEMPORAL` — every identity's own obligation is untraited, and all
four Temporal obligations carry it, so the trait line draws exactly the distinction the printed text means without
needing a new primitive. This is this brief's own §4.1 ("found-by-testing" > "compiles, therefore correct") landing
again, now against an ability that had shipped as "scripted" for an entire prior session.

**A second, data-only gap was found and left for `card-data-pipeline`, not routed around:** the Temporal
obligations (11018–11021) carry `encounterSetIds: []` in `@mc/content`, so they are never shuffled into any deck in
a real game — correctly scripted, unreachable content. `kang-encounter-set.test.ts`'s own 11021 test works around
this by relabeling an already-in-the-deck filler card's `cardId` (a test-only technique, documented inline as a
stand-in for the real content fix, not a substitute for it).

**New real behavioral tests, not just "is defined" checks:** `kang.test.ts` gained a full one-player split-and-
rejoin playthrough (defeat Kang (I) → stage 2 → one random stage 3 area created → defeat that area's Kang (II) →
area rejoins the (now sole) central area → central advances straight to Kang's Wrath → Kang (III) added, the tucked
Dominion revealed), driven entirely through real commands (`basicAttack`, `endTurn`) with no engine-bypassing
shortcuts beyond the existing "damage: 999, then one real attack" convention. `kang-encounter-set.test.ts` (new
file — the module had zero tests before this session, a gap this pass didn't attempt to close in full, see below)
covers Time-Travel Hijinks the same way. One test-harness lesson worth carrying forward: **a blanket `picking(id)`
picker is unsafe once more than one prompt in a round could legally offer the same instance id** — Kang (I)'s own
attack that same round offered the test's ally as a legal defender, so `picking(allyId)` volunteered it to _defend_
instead of answering the unrelated `chooseTarget` prompt from the obligation being tested; scoping the picker to the
specific prompt (`prompt.kind === "chooseTarget" && prompt.slot === "pick"`) fixed it. Not a new rule, but a sharper
version of §5's existing "always pass `deps` explicitly" caution: a picker that matches on a bare id, not a prompt
shape, can silently answer the wrong prompt without erroring.

**Re-ran the `KNOWN_SKIPPED` regeneration check (§1)** before promoting `toafk`: all 6 remaining refs are documented
primitive/data-gap blocks (§6.16's new gap, the two pre-existing Temporal-obligation blocks, and two "two clauses,
one ref" data gaps), none "not yet reached" — the same bar `trors`/`ant` were held to. `pnpm --filter @mc/cards test`
(599 tests) and root `pnpm typecheck` are both green.

**Flagged, not fixed, and worth a wider sweep some session:** `kang-encounter-set.ts` (17 cards across the Kang/
Temporal and Expert sets) had **zero tests** before this session despite being registered as resolved since an
earlier one — this session added tests only for its own new work (11021, plus definition-level checks for a sample
of the Expert set), not a full retroactive audit of the pre-existing cards. Given §6.15 and this session's own
`11007a.setup` bug both turned up _inside_ modules that looked done, a future session auditing `kang-encounter-set.ts`
end to end (the same way this session's predecessor did for `ant`'s Tech Theft/Yellowjacket) would not be wasted
time — flagged here rather than attempted, to stay inside this session's own budget once `toafk` closed out.

**Not reached that session: `wsp`, `qsv`, `scw`.** `toafk`'s primitive-gap re-audit, the Expert set, and the
`11007a.setup`/11021 bug hunt took the rest of that session's budget.

**2026-09-19, next session: `wsp` started, promoted to `"in progress"` (from `"not started"`).** Scripted Wasp's kit
(`kit.ts`), obligation/nemesis (`obligation-nemesis.ts`) and the pack's own generic-aspect cards (`pack-cards.ts`),
reusing Ant-Man's own three-sided-identity (§1.1/§3.2) and divided-basic-power (§3.7) patterns throughout, per the
task brief. 6 refs skipped, all newly-documented or reused primitive gaps (§6.15's `traitsOf` recursion crash on
Wasp's own Ant-Man ally, identical shape to Yellowjacket's; the overpaid-from-a-later-interrupt gap on Wasp's own
ally, identical to Ant-Man's own ally; three genuinely new gaps found scripting this pack, §6.17–§6.19: Small but
Mighty's "identity-or-event, not ally" defeat distinction, Rapid Growth's basic-power-activation-scoped bonus
needing to cover THW/ATK/DEF (not just the two `LastingUntil.endOfAttack` already tracks), Red Room Training's
"basic attacks only" keyword grant).

**The session's own load-bearing finding wasn't a new primitive — it was confirming three form-conditional
constants that _looked_ like Yellowjacket's crash-inducing shape were actually safe, and proving it with a real
test rather than trusting the reasoning alone** (this brief's own §4.1 rule, cutting the other way from usual:
"verify a _skip_ claim is real" also means "verify a _script_ claim is safe" before shipping it). §6.15's crash is
specifically triggered by a constant **trait grant** whose own `while` calls `hasTrait(...)` — re-reading
`traitsOf`'s scan loop (`packages/engine/src/select.ts`) line by line found it only inspects `definition.trigger.
traitGrants`, never `.modifiers` or `.keywordGrants`, so a `while: hasTrait(...)` on a pure stat modifier (Wasp's
Helmet) or keyword grant (Red Room Training's Giant-form retaliate) or an _unconditional_ trait grant (Bio-Synthetic
Wings' "gains the Aerial trait", no `while` at all) never re-enters the poisoned scan. `kit.test.ts`'s own Bio-
Synthetic Wings test drives a real `basicAttack` against Rhino with both of those constants active in play
specifically to prove this out loud rather than leaving it as an inference — the closest this pack gets to `ant`'s
own found-by-testing crash, except this time testing confirmed the reasoning instead of overturning it.

**Also found and fixed, not just flagged:** `13012.wasp-interrupt`/Ant-Man's own `12002` in Wasp's deck both needed
the "gets +1 hit point for each pym counter" constant only — the overpay interrupt half was skipped, cleanly split
from the constant the same way `ant/pack-cards.ts` already does for `12011.ant-man-constant`.

**Every wsp test drives real commands, not `toBeDefined()`, except cards genuinely unreachable from Wasp's own
single-aspect Aggression precon** (Running Interference, Athletic Conditioning, and the rest of the Justice/
Leadership/Protection/Basic-aspect cards printed in her set but built for _any_ hero's deck — `pack-cards.test.ts`'s
own docblock explains why, rather than silently settling for the weaker bar). `pnpm --filter @mc/cards test` (618
tests) and root `pnpm typecheck` are both green.

**Not reached this session: `qsv`, `scw`.** `wsp`'s kit alone — three genuinely new primitive gaps, each needing the
same rules research toafk's own session did, plus the §6.15 safety verification — filled this session's budget.
**Next session starts with `qsv`** (`basicPowerUsed`, already proven twice now — Spider-Woman's Captain Marvel in
`trors`, Rapid Growth's own _skipped_ interrupt in `wsp` shows what it _can't_ yet do) — re-check §3.13/§6 before
assuming any gap recorded here is still open, the same habit every session so far has depended on. Also worth
carrying forward: **grep any new pack's constant abilities for a `while` that reaches `hasTrait`/`traitsOf` before
trusting it compiles-and-therefore-works, but don't stop at the grep** — this session found the grep alone
over-flags (a `while: hasTrait(...)` on a modifier/keyword grant is safe; only a trait grant's own `while` is
poisoned), so read what `traitsOf`'s own scan loop actually inspects before skipping a card that merely resembles
Yellowjacket's shape.

**2026-09-19, next session: the §17 batch un-skipped; `wsp` finished, promoted to `"scripted"`.** `game-rules-
architect` landed all five §17 primitives (§6.15–§6.19) the same day. Re-read docs/phase7-wave2.md §17 in full
before touching any code (§17.4's own recovery limit and divided-basic-attack corner, §17.5's exact semantic call),
then un-skipped all eight pinned refs, each with a real engine test through the real content, not a synthetic
fixture:

- **`11013b.when-revealed`** (`toafk/kang.ts`) — `TargetQuery.nemesisMinionOf` inside the landed `anyOf` pool
  (§17.1), one `forEachPlayer`/`selectCards`/`putIntoPlay` triple, the identical "search and put into play engaged
  with them" shape `zola.ts`'s Island of Dr. Zola setup already established (no new DSL builder needed beyond
  `anyOfCards`, a thin wrapper around the already-landed `CardSelector { kind: "anyOf" }`). `kang.test.ts` gained a
  second full split-and-rejoin playthrough (Ant-Man, not Hawkeye — see the data-gap note below) proving 11013b's own
  search-and-engage fires automatically right after 11013a's, in the same stage advance, exactly as `resolve/
defeat.ts`'s own `advanceMainScheme` comment says ("the new stage's A side is revealed first … then the B side").
- **`13001a.small-but-mighty`** (`wsp/kit.ts`) — `on.defeats(source)`, a new `on.*` builder wrapping `sourceIs`
  across both `characterDefeated`/`schemeDefeated` (§17.2). Tested both ways: Wasp's own basic attack defeating a
  minion damages the villain; the Ant-Man ally's identical defeat (same defeating _player_, different defeating
  _card_) does not — the exact distinction the primitive exists for. Needed `accepting(...)`, not `firstLegal`, for
  the attack command's picker: it's an optional Response, and `firstLegal` declines every optional thing by design,
  which silently made the first draft of this test fail on a false premise (the ability wasn't broken; the test
  never let it fire).
- **`13002.ant-man-constant`/`-2`** (`wsp/kit.ts`) and **`12027.yellowjacket-constant`/`-2`** (`ant/obligation-
nemesis.ts`) — scripted exactly as originally attempted before the crash (§6.15's own "Scripted once as…" quote),
  now safe under `traitsOf`'s §17.5 `DEFAULT_DEPS` guard. Both verified with a real reveal/play-then-read-traits-and-
  stats test in each pack's own `kit.test.ts`, not re-added on the strength of the engine docblock's own claim that
  the fix makes them safe — §4.1's rule again, this time in the "un-skip" direction.
- **`13005.rapid-growth-interrupt`** (`wsp/kit.ts`) — the new `on.basicPowerUsing`/`modifyBasicPower` DSL pair
  (§17.4, written this session per the doc's own spec — `game-rules-architect` built the engine primitives but not
  the `@mc/cards` wrapper). The test plays Rapid Growth as a reactive event _inside_ a real `basicAttack`'s own
  interrupt window (a `chooseTriggers` prompt, then a `payForCard` prompt — `accepting(...)` alone isn't enough for
  the payment step, since `firstLegal`'s `minSelections: 0` fallback backs out of a real cost instead of paying it;
  needed a small custom picker answering `payForCard` with the first offered card, the same pattern `wave1/drs/
pack-cards.test.ts` already uses), confirming the raised damage (Tiny ATK 1 → Giant ATK 2 + 2 = 4), the form
  change, and that no lasting effect survives past the attack ("for this use").
- **`13008.red-room-training-constant-2`** (`wsp/kit.ts`) — `attacksGainKeywords({ basicOnly: true })` (§17.3, the
  DSL extended with the new option). Tested with a real tough-status-card discard (piercing's only observable
  effect, the same technique `primitives-wave2c.test.ts`'s own §17.3 tests use) distinguishing a basic attack (gets
  piercing) from Pinpoint Strike's own "(attack)" ability (does not, even while Tiny).

**A data-completeness gap found while testing 11013b, not a primitive gap, flagged for `card-data-pipeline` (full
write-up above, §6, new subsection after §6.19):** `nemesisMinionOf` requires the `nemesisMinion: true` flag
unconditionally, but Hawkeye's own single-minion nemesis set (Crossfire, 04027, `trors`) carries no such flag —
real MarvelCDB text only prints the disambiguating parenthetical for a multi-minion set (RRG 1.8 p. 30), so a
single-minion set's card legitimately has none, and the engine's stricter-than-RRG reading finds nothing for a
Hawkeye player specifically. Ant-Man, Wasp and Spider-Woman's own nemesis minions are all correctly flagged, so
this affects exactly one hero pack in the pool today. `kang.test.ts`'s own 11013b test uses Ant-Man instead of
Hawkeye and documents why inline, rather than silently avoiding the case.

**Re-ran the `KNOWN_SKIPPED` regeneration check (§1)** for both `toafk` (77/82 resolve, 5 skipped — all four
pre-existing Temporal/Expert data-gap blocks, none newly stale) and `wsp` (49/50 resolve, 1 skipped —
`13012.wasp-interrupt`, unrelated to this batch) before promoting `wsp` to `"scripted"` and confirming `toafk`'s own
row stays `"scripted"`. `pnpm --filter @mc/cards test` (623 tests) and root `pnpm typecheck` are both green.

**Next: `qsv`, then (only once `qsv` is fully committed) `scw`, per the task brief's own ordering.** `qsv`'s
`basicPowerUsed` trigger is proven twice already (Spider-Woman's Captain Marvel in `trors`, and now Rapid Growth's
own _unblocked_ `basicPowerUsing` sibling in `wsp`) — read Quicksilver's and Scarlet Witch's own product inserts
before scripting either (docs/phase7-wave2.md §0 flags both as "not yet read"), and re-check §3.13/§6/§17 before
assuming any gap recorded anywhere in this file is still open, the same habit every session so far has depended on.

**2026-09-19, next session: `qsv` finished, promoted to `"scripted"`.** **Flagged, not silently skipped: this
session had no tool that fetches an external URL, so Quicksilver's own product insert (docs/phase7-wave2.md §0,
"not yet read") could not actually be read** — every card's ability was scripted from `@mc/content`'s own printed
`text` (the Golden Rule that outranks a product insert anyway, RRG 1.8 "The Golden Rules", p. 4) plus RRG/FAQ
citations, and nothing in the insert (a spoiler-free scenario rulebook and precon decklist, per how `toafk`'s own
insert read) would change a hero-pack card's own text. Recorded here rather than quietly proceeding as if the step
were done.

Scripted Quicksilver's kit (`kit.ts`), obligation/nemesis (`obligation-nemesis.ts`) and the pack's own generic-
aspect cards (`pack-cards.ts`) — see §7's own table row for the full per-card account. Two new primitive gaps
found and written up (§6.20, §6.21 — a completed-ready announcement; Need for Speed's "cannot ready" restriction,
a sibling to Care for Cassie's own gap), and two small `@mc/cards`-owned catch-ups that were _not_ primitive gaps
(§6.22 — `oncePerPhase`, and `playCard.x` missing from `dsl/validate.ts`'s own pre-seeded var scope, found the
moment Speed Cyclone's `varOf("x")` failed `defineAbilities`'s "read before bound" check despite being genuinely
supplied by the engine).

**Load-bearing lessons this session added to test-writing itself, not just to the card pool:**

- **A `chooseCards` prompt's own options are the candidate instance ids, never slot-keyed** — `firstLegal` alone
  picks its own `min` (often 0, since "shuffle up to 2"-shaped abilities are deliberately optional), so a picker
  matching by _label text_ (`accepting(...)`, the convention every prior pack's tests already use for
  `chooseTriggers`) silently matches nothing here and a test believes an effect fired when it picked zero cards.
  Needed a dedicated "take every offered candidate, up to the prompt's own max" picker (`pickAllCards`, `pack-
cards.test.ts`) for Multiple Man and Serval Industries.
- **`declareDefender`'s own "no defense" answer is `["decline"]`, not `[]`** — `firstLegal` already knows this
  (`if (choice.prompt.kind === "declareDefender") return ["decline"]`), but a test driving the choice by hand
  (to declare a _specific_ defender first) must remember it too; answering `[]` is rejected outright as an invalid
  selection count, not treated as declining.
- **An upgrade attaches rather than sitting in `playArea`** — `cardsInPlay(state)`, not `playerOf(state, p
).playArea`, is what finds it once played (Nerves of Steel's own test found this the hard way: `playArea` was
  empty, the card was attached to the identity instead, per RRG's own default host when none is named).
- **A multi-copy card's own precon quantity means `instancesOf(...)[0]` is not necessarily the one in play** — with
  3 copies of Nerves of Speed printed only 3, always pick the in-play one explicitly (`cardsInPlay(state).find(...)`
  ), the same lesson as the previous bullet stacked on top of it.
- **`moveToHand`'s returned `.state` must actually be used** — computing `.ids` from one call and then spreading
  the _original_ pre-call state for further surgery (rather than the returned post-move state) leaves a card
  simultaneously "moved" (by the id bookkeeping) and "not moved" (by the state), producing a card instance visible
  in two zones at once — caught by a `deck.includes(id) && discard.includes(id)` sanity check while debugging
  Serval Industries' own test, not by any assertion failure message that pointed at the actual mistake.
- **`chooseOne`'s own option ids are index-based (`"0"`, `"1"`, or `"<index>#<n>"` under `allowRepeat`), never the
  option's label text** — a picker matching by label must inspect `option.label` itself (`choice.options.find(o =>
o.label === wanted)`), not try to match the label against `optionId`.
- **A villain phase's `declareDefender` interrupt for "when you defend" resolves _after_ the defending character's
  own `basicPowerUsed` response, not before** — both get pushed onto the stack at the same moment (`setDefender`
  announces `defended` first, then `basicPowerUsing`/`basicPowerUsed` are pushed after it), and the stack is LIFO,
  so whichever event's own trigger fires _last_ on the stack resolves _first_. A test asserting an exact
  `chooseTriggers` prompt order for a card whose own controller _also_ has a `basicPowerUsed` reaction (Quicksilver's
  own Super Speed, reacting to his own basic defense) should accept the trigger whenever it's offered rather than
  asserting it's the very next prompt — this is not a bug in the ability itself, confirmed by the fully-resolved
  outcome (DEF applied, damage prevented) being correct either way.
- **A second real encounter-deck reveal, once an earlier one already put an engaged minion into play, needs a
  filler boost card per _activating_ enemy that phase, not one** — every enemy attack draws its own boost card
  (RRG 1.8 "Attack (Enemy Activation)", p. 9), not only a villainous minion's scheme (the boost-skipping rule is
  scheme-specific, RRG 1.8 "Scheme (Enemy Activation)", p. 39). `stageNemesisCardForReveal`'s own `fillers` count
  needed to grow from 1 (Rhino alone) to 2 once a nemesis minion was also in play and activating — and a _third_
  reveal, in a fresh round, is a real risk of racing the scenario's own main scheme to an early loss (this session's
  own two-player Avalanche test hit exactly that), not a testing technique to reach for by default once more than
  one enemy is active.

`pnpm --filter @mc/cards test` (647 tests) and root `pnpm typecheck` are both green.

**Not reached this session: `scw`.** `qsv`'s own primitive gaps, the `chooseCards`/`declareDefender`/attachment
test-writing lessons above (each cost real debugging time, not just scripting time), and the two-player Avalanche
detour together filled this session's budget. **Next session starts with `scw`** — re-check §3.13/§6/§17 before
assuming any gap recorded anywhere in this file is still open (Scarlet Witch's own two obligation cards, §1.10,
and boost-icon-counting-as-an-event, §3.6, were both already landed as of `toafk`'s own session; Hex Bolt's
card-effect boost-icon count, §4.8, was flagged as still open — re-verify rather than assume), and the fresh
lessons immediately above (`pickAllCards`, `["decline"]`, `cardsInPlay` for attachments, `moveToHand`'s returned
state) apply to any pack's own tests just as much as they did to `qsv`'s.

**2026-09-19, next session: `scw` finished, promoted to `"scripted"`.** The whole of cycle 1's hero-pack lineup is
now done. Re-checked §3.13/§6/§17 first, per the standing habit: Scarlet Witch's own two obligation cards (§1.10)
and boost-icon-counting-as-an-event (§3.6) were both confirmed landed, and §4.8 (whether Chaos Control's own "would
be counted" reaches a card effect's own boost-icon count, not only an activation's) was re-confirmed still open —
no FFG ruling landed on it since `toafk`'s own session, so it stays a live open question rather than something to
quietly resolve.

**Chaos Control (15001a) is scripted only against the window that exists** — `on.boostIconsCounted()`, the
activation-boost-step primitive §3.6 landed — per this session's own task brief, which named this exact decision
and asked it be surfaced rather than picked quietly. It does **not** reach the several _other_ boost-icon reads in
this same pack that go through a card effect's own `discardEncounterCards`/`<bind>.boostIcons` (Hex Bolt, Molecular
Decay, Wiccan, Luminous, Chaos Manipulation, and the `qsv` Scarlet Witch ally) — those cards' own counting already
works, since `<bind>.boostIcons` needs nothing from Chaos Control at all; what's undecided is only whether Chaos
Control's own replacement effect could someday reach them too. **Recorded precisely, not guessed at**, in `kit.ts`'s
own module docblock, in this file's §7 table row, and here — the change this file's own §4.8 write-up describes (an
engine-side widening of the `boostIconsCounting` window) is the only thing that would ever need to change if the
user later decides the broader reading is correct; Chaos Control's own script would not need to change at all.

**Slipping Sanity (15023) is genuinely blocked, confirmed rather than assumed (§4.1's own rule).** "For each star
icon ([star]) in the boost area discarded this way, place 1 threat on the main scheme" needs a count of _star_
icons (RRG 1.8 "Boost", p. 11: "a star icon is not itself considered a boost icon") among a discarded pool — reading
`packages/content/src/schema/validation.ts` found no schema field recording "this card has a star icon" at all
(only the numeric `boostIcons` pip count), and reading `packages/engine/src/defend-preview.ts` found the _only_
place the engine derives that fact today is a private, unexported `hasBoostAbility` (a structural "does this card
carry a printed ability whose `trigger.kind === 'boost'`?" check), used only for that module's own defend-prompt
bound and never surfaced as a `TargetQuery`/`ValueSpec` a card script could read. Closest existing primitive: the
same shape `<bind>.boostIcons` already has — a `<bind>.starIcons` (or `.boostAbilityCount`) sibling on
`discardEncounterCards`, reusing `hasBoostAbility`'s own check rather than duplicating it. Not scw-specific:
Longshot (`wolv` pack, not yet scripted) needs the identical underlying fact as a yes/no read. Because the whole
obligation is one ability ref (`core/obligations.ts`'s `obligation()` helper builds a single `AbilityDefinition`
for both the "exhaust to remove" and "discard 5, count stars" branches), the ref is pinned as a whole rather than
half-scripted — `15023.obligation` is `KNOWN_SKIPPED.scw`'s only entry.

**A found-by-testing script bug, not a primitive gap (§4.1 again, the "compiles ≠ correct" direction):** Chaos
Manipulation's own "search the encounter deck and discard pile for Luminous and put her into play" was first
written as `chooseCards(..., { min: 0, max: 1 })`, reasoning by analogy to Zola's own "the minion may already be in
play" case (`zola.ts`'s `04112a.setup`). A real test (staging Luminous into the encounter discard pile, then
revealing Chaos Manipulation) found she was never actually put into play: `firstLegal` always answers with the
_fewest_ legal selections, and for `min: 0` that means declining the pick even when she genuinely was found.
`executeChooseCards` (`packages/engine/src/resolve/effects-frame.ts`) already special-cases zero legal candidates
_before_ `min` is ever consulted, so `min: 1` is safe even when she isn't findable at all — it only forces the pick
when there is exactly one real candidate, which is what "search … for Luminous and put her into play" (no "you
may") actually means. Fixed in `obligation-nemesis.ts`, with the full account in that file's own docblock.

**Also fixed, a doc-only slip found while reading the primitive `playFromHandIgnoringCost` was built for:**
`dsl/effects.ts`'s own comment on that builder cited Chaos Magic as "(Chaos Magic, `qsv` pack)" — Chaos Magic is
15003, `scw`, not a `qsv` card. One-line fix, no shape change.

**Load-bearing test-writing lessons this session added, beyond the ones already listed above:**

- **`stackEncounterDeck` can place a card _already in the deck_ (from earlier test surgery) at an exact position
  relative to others** — since it finds a named card wherever it currently sits (deck or discard) and moves it to
  the front in the given order, a card moved into the deck by one surgery step (e.g. `stageFromSetAside`) can be
  named again in the _same_ `stackEncounterDeck` call to fix its exact position among several other stacked cards,
  rather than needing a second, separate splice.
- **`endTurn()`/a villain phase never forces a form change on its own** (RRG 1.8 "Form, Change Form": a change is
  always voluntary, or forced by a specific card) — a hero who ends a round in hero form is _still_ in hero form at
  the start of the next round. The harness's own `toHero()` is a bare `changeForm` command with no `to` field, which
  the engine reads as _toggle_, not "switch to hero" — calling it a second time on an already-hero identity flips it
  back to alter-ego instead of erroring, silently producing the wrong form for whatever the test does next. Check
  (or track) the actual current form before a second `toHero()` in the same test, rather than assuming every round
  starts fresh in alter-ego.
- **The _main_ scheme reaching 0 threat never fires a `schemeDefeated` event** — only a side scheme's own defeat
  does (RRG 1.8 draws this distinction structurally: the main scheme advances a stage instead). A card reading
  "after your hero thwarts and removes all threat from a scheme" (Turn the Tide, 15015) needs a real side scheme to
  test against; a synthetic one, injected directly via `villainArea`/a hand-built `CardInstance` with `threat: 1`,
  is the same technique `trors/red-skull.test.ts`'s own "gets +1 ATK for each side scheme in play" test already
  uses for the identical need.
- **A same-shaped ability that is itself the trigger's own reactive play** (a printed Response on an event card,
  played reactively rather than by command) still needs its own trigger-acceptance option id (`<instance>:<ability>`)
  in the `accepting(...)` picker's own wanted list _in addition to_ whatever target it names — a picker matching
  only the target's own slot name (e.g. `"enemy"`) never reaches the trigger-acceptance step at all, so the whole
  ability silently never fires, looking exactly like "the ability doesn't work" rather than "the test forgot the
  trigger's own option id."
- **Composing two "patch one field of state" test helpers requires composing through the first's own returned
  state, not the original** — `{ ...helperA(state, x), instances: { ...state.instances, ... } }` silently discards
  whatever `helperA` changed, since the second `instances` spread reads from the _original_ `state`, not
  `helperA`'s output. The same class of mistake `docs/phase7-wave2-scripting.md`'s own `moveToHand`-returned-state
  lesson (qsv's session) already named, recurring here across two different single-purpose helpers
  (`withThreat`/`withDamage`) instead of one multi-step effect.
- **A card's own precon aspect determines which of its non-hero-specific pack cards are real-command-testable** —
  Scarlet Witch's own `scw-justice` starter deck (`@mc/content`'s `SCW_STARTER_DECKS`) curates exactly 15002–15022,
  so Browbeat/Last Stand/Bait and Switch (Aggression/Leadership/Protection) and Recuperation (Basic, _not_ in that
  curated list either, despite being a Basic-aspect card any hero could nominally run) are unreachable from her own
  precon and get `toBeDefined()`-only tests, following `qsv/pack-cards.test.ts`'s own precedent for the identical
  situation.

Re-ran the `KNOWN_SKIPPED` regeneration check (§1) against `SCW_CARDS`/`WAVE2_ABILITIES` before promoting the pack:
34 refs, 33 resolve, 1 skipped (`15023.obligation`, the confirmed-genuine primitive gap above) — matching this
pack's own bar. `pnpm --filter @mc/cards test` (674 tests), root `pnpm typecheck`, and root `pnpm test` (content,
engine, cards, client — 3248 tests total) are all green.

**Cycle 1's hero-pack lineup (`trors`, `toafk`, `ant`, `wsp`, `qsv`, `scw`) is now fully scripted.** No pack is
`"not started"` or `"in progress"` in this file's own §7 table any longer. What remains open across the whole
cycle, for whoever picks this file up next: the Hydra Campaign cards (`trors`, deferred pending campaign mode), the
Temporal obligations and Expert-only refs (`toafk`), a handful of pre-existing overpaid-from-a-later-interrupt and
"cannot ready/change form until your next turn ends" primitive gaps (`ant`, `wsp`, `qsv`), and now Slipping Sanity's
own star-icon-counting gap (`scw`) — each already written up in its own §6.x subsection or module docblock, none
newly discovered by this session beyond the two found-by-testing script bugs above.

**2026-09-20, next session: the wave 2 skip backlog cleared, twelve refs un-skipped.** `game-rules-architect` ran an
audit-and-build pass over every remaining non-campaign `KNOWN_SKIPPED` entry (docs/phase7-wave2.md §§18–23) before
this session started: four of the fifteen recorded skips (§18.1's own numbering; `04028.when-revealed`,
`12011.ant-man-interrupt`, `13012.wasp-interrupt`, `12032.muster-courage-action`) turned out to have gone stale —
their primitives had landed and nobody had gone back to check — and eight more genuinely needed new primitives,
built in the same pass (§19–§22). This session scripted all twelve, verified each of the "already there" claims
with a real command sequence rather than trusting the architect's own write-up on faith (§4.1 cuts both ways), and
left the remaining three (`11020.obligation`, `11049.obligation`, `15023.obligation`) exactly where they were —
confirmed, not just re-read, to still be genuine `card-data-pipeline` gaps rather than something this pass could
close.

**§23's table held up on all twelve — no primitive turned out to do less than advertised.** For the four
"already there" claims, this session re-derived the proof independently rather than copying it: `04028`'s own
`eventPlayer` claim needed one extra step the architect's own engine-level test didn't have to make (a _real_
Hawkeye deck, not a synthetic single-card one) — tracing how Marked for Death can ever reach this reveal at all
(only via Shadow of the Past unpacking the _same_ resolving player's own nemesis set) to show `eventPlayer` and
"the Clint Barton player" are the same player by construction, not by coincidence of a solo table; written up in
`hawkeye-obligation-nemesis.ts`'s own module docblock rather than taken on faith.

**New DSL surface, all in `packages/cards/src/dsl/{values,effects,abilities}.ts`:** `discardFromHandCost` grew a
fourth `filter?: TargetQuery` argument (§19); `sharesTraitWith(ref)`/`encounterSetOf(ref)` query-fragment helpers
(§20.1/§20.2), composed as `query(categories, sharesTraitWith(ref))`; `on.cardReadied(query)` (§21), the "-ed" twin
of `on.cardReadying`; and `applyRuleUntil(rule, until, player?)` plus the two named conveniences the pool's own
cards need, `cannotChangeFormUntil(until, player?)` and `cannotReadyUntil(target, until, player?)` (§22).

**The twelve refs, by pack:**

- `trors` — `04028.when-revealed` (Marked for Death): `anyOf`(zone + `ref`/`each` over the play area) + `tuckCards`,
  already there. Tested both halves with a real command (found in the deck; found already in play and taken out of
  it, `hawkeye.test.ts`). **Found and fixed a collateral bug while staging this test:** bare `stackSetAside` (no
  filler ahead of it) reaches the active villain's own automatic boost draw instead of the player's own reveal
  (every villain gets one unconditionally, drawn from the top of the deck, before any player's own encounter card —
  `enemy-activation.ts`'s `getsBoostCard`; villain-phase step order in `flow.ts` runs `enemyActivations` before
  `dealEncounterCards`), confirmed by instrumenting the two neighboring, previously-_passing_ Sniper Shot tests: both
  were staged bare and both were silently never actually revealing Sniper Shot at all — their loose
  `toBeGreaterThanOrEqual` assertions passed only because Rhino's own independent attack/scheme that same villain
  phase happened to satisfy the bound anyway. A subtly-wrong-but-passing test is exactly CLAUDE.md's own warning;
  fixed with a new shared `stackSetAsideBehindBoost` helper, used for all three cards' own tests now.
- `toafk` — `11018.weakened-action`/`11019.stolen-memories-action`/`11021.time-travel-hijinks-action` (the Temporal
  obligations' own Alter-Ego Actions): `discardFromHandCost`'s new `filter`. Each tested with a real command: the
  obligation revealed by relabeling an already-in-the-deck filler card (the same "no `encounterSetIds`" workaround
  `kang-encounter-set.test.ts` already used for Time-Travel Hijinks' own When Revealed half), then its own action
  paid with the matching basic resource card ([physical]/[mental]/[energy]) moved to hand.
- `ant` — `12011.ant-man-interrupt` (already-there `overpaid.total`, tested with a plain overpay and a
  cap-triggering 6-resource one), `12024.team-building-exercise-action` (`sharesTraitWith`, tested playing Wasp at
  -1 cost off Tiny-form Ant-Man's own Avenger trait — a new `pack-cards.test.ts`), `12025.obligation`
  (`cannotChangeFormUntil`, tested blocking and then releasing a real `changeForm` command across two rounds,
  `kit.test.ts`), `12029.when-revealed` (`encounterSetOf`, tested by planting a second nemesis-set card a few cards
  down in the shared deck and confirming the search discards real filler before finding it), `12032.muster-
courage-action` (already-there `chooseTarget.count`/`optional`; genuinely unreachable from the Leadership-only
  `ant-leadership` precon, `toBeDefined()`-only, the same situation off-aspect cards hit in every other pack).
- `wsp` — `13012.wasp-interrupt` (already-there `overpaid.energy`, tested both ways with her own two basic resource
  cards isolating the type filter).
- `qsv` — `14009.friction-resistance-response` (`on.cardReadied`, tested by chaining off Super Speed's own real
  ready of Quicksilver), `14024.obligation` (`cannotReadyUntil`, tested the same block-then-release shape as Care
  for Cassie above, across two rounds, `obligation-nemesis.test.ts`). A stale "documents the gap" assertion
  (`"14009.friction-resistance-response" in QSV_KIT === false`) in `kit.test.ts` was rewritten rather than left in
  place, per this file's own §4.1 warning about assertions that start asserting the wrong thing once a gap closes.

**`KNOWN_SKIPPED` recomputed** (the throwaway-test method these comments describe, not hand-typed): `toafk` and
`scw` keep their one/two genuine data-gap entries (`11020.obligation`/`11049.obligation`, `15023.obligation` —
un-touched, still `card-data-pipeline`'s), `ant`/`wsp`/`qsv` are now empty, and `trors` is exactly its 30 Hydra
Campaign refs, whose comment now points at PLAN.md's own "Campaign mode" section rather than a bare "deferred."

`pnpm --filter @mc/cards test` (688 tests, up from 673 — net +15 across the new/expanded test files, since one
pre-existing false-positive assertion in `qsv/kit.test.ts` was rewritten rather than just added to) and root
`pnpm typecheck`/`pnpm test` (content, engine, cards, client) are all green.

**2026-09-20, next session: the wave 2 skip backlog closed to just `trors`'s 30 campaign refs.** Picked up the
five refs §23's table still left open: `11020` (Depowered)'s two-clauses-one-ref data gap, `11049` (Fear of
Kang)'s identical shape, and `15023.obligation` (Slipping Sanity) — `card-data-pipeline` had split 11020/11049
each into a `-constant`/`-action` ref pair (docs/phase7-wave2.md §18.2/§18.3) and added the printed `starIcon`
field 15023 needed (§18.6/§24) since the last session touched this file.

**Four of the five landed clean; the fifth is a real, proven engine gap, not scripted around.**

- **`11020.depowered-constant`/`11020.depowered-action`** (Depowered): both scripted. The action half
  (`discardFromHandCost(1, 1, undefined, { identitySetOf: you })`) worked exactly as §18.2 described. The constant
  half needed one correction, found by testing rather than assumed (§4.1): `cannotPlay`'s own `cards: TargetQuery`
  is checked against the _source card's_ raw `EffectContext` (`activeRules`, `packages/engine/src/rules.ts`), and
  an obligation's `instance.controllerId` is `null` — confirmed by inspecting a revealed 11020 instance directly —
  so `identitySetOf: you` silently matched nothing at all; the constant compiled, typechecked, and did nothing.
  Fixed with `identitySetOf: eachPlayer`, which reads the printed text ("hero-specific cards", no "your own") at
  least as faithfully and is equivalent in practice given RRG 1.8 "Identity-Specific Card" (p. 23) deckbuilding
  rules. Both halves proven with real commands: Hawkeye's Bow (hero-specific) blocked, Earth's Mightiest Heroes
  (basic-aspect) stays playable — the first negative control tried, a resource card, was rejected for an unrelated
  reason ("resource cards are discarded to pay costs, not played") and had to be swapped for a real playable
  basic-aspect card, a reminder that a negative control needs checking for its own false rejections just as much
  as a positive one needs checking for false passes.
- **`11049.fear-of-kang-action`**: scripted (`discardRandomFromHandCost(1)`, the same builder Magic Crowbar
  already uses), proven with a real command reducing hand size by exactly 1 and discarding the obligation.
- **`11049.fear-of-kang-constant` ("You cannot attack Kang") is the one ref this session did _not_ script**,
  and it is the main finding: §18.2's claim that "every primitive `cannotAttack` included already exists" does
  not hold for a _player-scoped_ "you cannot attack" restriction. `RuleSpec cannotAttack` is `{ target:
TargetQuery; while?: Predicate }` — shaped for its one existing user, Distracting Taunts ("**Players** cannot
  attack other villains", genuinely plural/global) — and has no `player` field the way `cannotThwart`/
  `cannotChangeForm`/`cannotPlay` do. Read the engine source first (`attackForbidden`, `packages/engine/src/
select.ts`): the function that walks constant `cannotAttack` rules is never handed the attacking player at all,
  only the target being attacked — so no `TargetQuery` construction on the _card_ side can recover "only this
  obligation's own controller" once inside it. **Proven, not just read**, per this brief's own instruction to
  build a two-player game and look (`toafk/fear-of-kang-constant.test.ts`): a synthetic, bare `cannotAttack` rule
  scoped only by `target: query("villain", { name: cardName("11001") })` — the only shape the primitive can
  express — blocks a _second_ player's attacks on Kang even though only the first player ever held Fear of Kang.
  Two tests pin both directions (the non-holder is blocked; the actual holder is too, so both readings of "you"
  agree on that half). This is a genuine engine-primitive gap (a `player?: PlayerRef` field on `cannotAttack`,
  mirroring `cannotPlay`'s own, plus threading the attacking player through `attackForbidden` to check it),
  flagged for `game-rules-architect` rather than worked around: shipping a bare `cannotAttack` here would have
  silently over-restricted every other player at the table, exactly the "subtly wrong implementation is worse than
  an unscripted one" case this project's own conventions single out. `11049.fear-of-kang-constant` stays the one
  entry left in `KNOWN_SKIPPED.toafk`.
- **`15023.obligation`** (Slipping Sanity): scripted, the exact shape §24.5 gave —
  `discardEncounterCards(5, { bind: "sanity" })` + `placeThreat(varOf("sanity.starIcons"), theMainScheme)` inside
  the Core `obligation(...)` helper. Both branches tested: the "discard 5" alternative, and "exhaust Wanda
  Maximoff to remove it" (the shared `obligation()` shape already proven for Spider-Man's own obligation in
  Core). The discard-5 test needed two runs diffed against each other, not one before/after read — the villain
  phase's own base threat placement and Rhino's own scheme/attack activation land on the same main scheme in a
  single run and would have made the assertion pass or fail for the wrong reason; running the same seeded scenario
  twice with only the five discarded cards' icons changed isolates exactly what Slipping Sanity itself
  contributed. The discard pile mixes a star-only card (Weapons Runner, 0 pips), a star-_and_-pip card (Repair
  Sequence, 1 pip) and two no-star pip cards (2 pips each), so `starIcons` (2) and `boostIcons` (5) disagree — the
  trap this brief's own §7 warned about, confirmed worth building the pile around rather than trusting it wouldn't
  matter.

**`KNOWN_SKIPPED` regenerated with `pnpm refs`** (`MC_REFS_PACKS="toafk ant wsp qsv scw trors"`), not hand-edited:
`toafk` now holds exactly `11049.fear-of-kang-constant`; `ant`/`wsp`/`qsv`/`scw` are empty; `trors` is unchanged,
its 30 Hydra Campaign refs. Six packs, 490 refs, 459 resolve (94%) — every unresolved ref left is either the one
genuine `cannotAttack` engine gap above or a Hydra Campaign card deferred by design.

**On tooling, since this session was asked to report on it:** `pnpm refs`/`pnpm card`/`pnpm dsl` (all landed mid-
task) removed real friction — `pnpm card "11020 11049 15023"` replaced what would have been six separate file
reads across `packages/content/src/data/toafk/cards.ts`/`scw/cards.ts` to get printed text, errata status and
starIcon flags in one place, and `pnpm dsl "cannot"` confirmed in one shot that no `cannotAttack`-adjacent builder
already existed to paper over the gap. Nothing here needed a new tool: the two failed-then-fixed test attempts
(the negative control that turned out to be a resource card, the single-run threat assertion that turned out to be
confounded by the villain phase's own activity) were each caught by _running_ the test and reading the real
rejection reason, not by a missing tool — both are the same "the expensive step is navigating a real game to a
deterministic assertion point" lesson §3 of `docs/card-scripting-process.md` already names, not a new one.

`pnpm --filter @mc/cards test` (701 tests, up from 688) and root `pnpm typecheck`/`pnpm test` (content 425, engine
748, cards 701, client 1448 — 3322 total, up from 3316) are all green.

**2026-09-20, closing session: `11049.fear-of-kang-constant` scripted, the wave 2 skip backlog's last non-campaign
ref.** `game-rules-architect` landed the engine change the prior session flagged (docs/phase7-wave2.md §25):
`RuleSpec cannotAttack` gained `player?: PlayerRef`, `attackForbidden` now threads the attacking player's controller
through it, and `cannotPlay`'s `cards` query was fixed to read a rule's speaker context rather than a controller-less
obligation's raw one (§25.3). Both fixes were used here, not just read about:

- `11049.fear-of-kang-constant` ships as `constant(rule({ kind: "cannotAttack", target: query("villain", { name:
cardName("11001") }), player: you }))` — no DSL change needed, `rule` already passes a `RuleSpec` straight through.
- `fear-of-kang-constant.test.ts` was rewritten, not deleted: it keeps its original regression guard (a _bare_,
  target-only `cannotAttack` rule — Distracting Taunts' own shape — is still table-wide by design, blocking a second
  player who never held the obligation) and adds the assertion that matters now: the shipped `player: you` shape
  blocks only its own controller, leaving a second player at the table free to attack Kang. Since `WAVE2_DEPS` now
  carries the real, scoped ability, the "baseline: unscripted" comparisons the old file used had to be rebuilt
  against a `NEUTRAL_DEPS` with `11049.fear-of-kang-constant` deliberately deleted from the registry (`activeRules`,
  `packages/engine/src/select.ts`, already skips a missing ability id silently — the same mechanism that made the
  card's constant half a safe no-op for every prior session), not against `WAVE2_DEPS` itself, which would have
  quietly flipped two assertions to test the wrong thing.
- `11020.depowered-constant`'s `cards` filter narrowed from the `eachPlayer` workaround to `identitySetOf: you` —
  §25.3's fix means both read identically in practice (RRG 1.8 "Identity-Specific Card", p. 23), and `you` is the
  more literal reading of "you cannot play _your_ hero-specific cards". `kang-encounter-set.ts`'s module docblock
  had its "silently does nothing" hazard note removed for both 11020 and 11049, since the gap it warned about no
  longer exists.

`KNOWN_SKIPPED` regenerated with `pnpm refs` (`MC_REFS_PACKS=toafk`), not hand-edited: `toafk` is now `[]`, 90/90
refs resolve. Pool-wide across all six wave 2 packs (`MC_REFS_PACKS="toafk ant wsp qsv scw trors"`): 490 refs, 460
resolve (94%) — the only unresolved refs left anywhere in wave 2 are `trors`'s 30 Hydra Campaign refs, deferred by
design until campaign mode exists (PLAN.md, "Campaign mode"). Everything in §25.4 worked as written; nothing needed
adjusting. `pnpm --filter @mc/cards test` (702, up from 701) and root `pnpm typecheck`/`pnpm test` (content 425,
engine 754, cards 702, client 1448 — 3329 total, up from 3328) are all green.
