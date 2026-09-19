# Phase 7 wave 2: the ability-scripting brief

This is the brief every per-pack agent follows when scripting a wave 2 (cycle 1) pack's card abilities
(`ability-scripting-engineer`, PLAN.md Phase 7, `docs/phase7-wave2.md`). Read `docs/phase7-wave2.md` first — it is
the shared spec for schema decisions (§1), per-pack setup needs (§2) and the engine primitives (§3) this brief
builds on. This document is the narrower "how to script a pack" companion to it, directly modeled on
`docs/phase7-wave1-scripting.md` (wave 1's own version of this brief): folder layout, reprints, test conventions,
the rule for a genuinely missing primitive, and — because cycle 1 is six packs, not one hero pack — a live
**progress / next up** section so a session cut off by a usage limit can resume exactly where the last one stopped.

The model to follow for style is `packages/cards/src/core/` (Core Set), `packages/cards/src/wave1/cap/` (wave 1's
first fully-scripted pack), and now `packages/cards/src/wave2/trors/` (this wave's first pack, in progress).

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

## 6. Engine primitive gaps found scripting `trors` (ranked by how many cards each blocks so far)

The same discipline as `docs/phase7-wave1-scripting.md` §6/§4: each is a rule write-up (text, then
state/resolution/interaction consequences) with the closest existing primitive named, so `game-rules-architect` has
a starting point. None of these were hacked around — every card that needs one is in `KNOWN_SKIPPED` instead.

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

### 6.7 "The player who defeated this scheme" as a `PlayerRef` (1 card)

- **Card:** Crossbones' Assault (04070, a side scheme): "When Defeated: Crossbones activates against the player
  who defeated this scheme."
- **The gap:** no `TargetRef`/`PlayerRef` reads a scheme's own defeating player for a *later* effect in the same
  ability. `on.defeated`'s `byYou` filter (used on the *responding* ability's own trigger condition) can name "you
  defeated it" as a yes/no gate, but can't hand that player back as a `PlayerRef` value for `enemyAttack(theVillain,
  { against: <that player> })`.
- **Closest existing primitive:** the `defendingCharacter`/`eventSource`/`eventTarget` family of context-scoped
  refs (`dsl/values.ts`) — a `defeatingPlayer: PlayerRef` reading the current `characterDefeated`/`schemeDefeated`
  event's own defeating player (already recorded on that event, since `byYou` reads it) would slot in the same way.

### 6.8 Already known, not newly found (see `docs/phase7-wave2.md` §3.11)

- **"Once per round for each aspect"** (Superhuman Agility, 04031a): needs a limit keyed by the played card's
  aspect, not a flat once-per-round.
- **Blanking a whole class of cards' text** (Tech Theft, `ant` pack — not yet reached in `trors`, listed here so a
  future `ant` agent doesn't rediscover it): `textBoxBlank` is read without the ability registry today.

## 7. Status

| Pack | Code | Status | Notes |
|---|---|---|---|
| The Rise of Red Skull | `trors` | **In progress.** 152 cards, 248 ability refs: 73 resolve (13 as reprint aliases, 60 hand-scripted), 175 in `KNOWN_SKIPPED` (12 genuinely missing-primitive blocks — §6 — the other 163 simply not yet scripted). | Hawkeye's and Spider-Woman's own kits, obligations and nemesis sets are scripted (`hawkeye-kit.ts`, `hawkeye-obligation-nemesis.ts`, `spider-woman-kit.ts`, `spider-woman-obligation-nemesis.ts`; 35 tests across `hawkeye.test.ts`/`spider-woman.test.ts`). The Crossbones scenario's villain, main scheme and own encounter set are scripted (`crossbones.ts`; 6 tests in `crossbones.test.ts`, plus a standalone 2-player setup test in `e2e.test.ts`) — the only cycle 1 scenario with a working `wave2Scenario("crossbones", …)` builder so far (`../setup.ts`). **Not started:** Absorbing Man, Taskmaster, Zola and Red Skull (the other four Red Skull scenarios), the Hydra Campaign cards (data only while campaign mode is deferred, per the wave 2 scope decision), and the pack's own generic-aspect filler cards beyond what's already a Core/wave 1 reprint. Real-game tests: `wave2/trors/e2e.test.ts` (Hawkeye and Spider-Woman precons vs. Rhino, solo, to a real outcome; Crossbones standalone 2-player setup). **Data gap flagged for `card-data-pipeline`:** the Attack on Mount Athena 1A text prints "Three modular sets (Hydra Assault, Weapon Master, and Legions of Hydra)", but `trors/encounterSets.ts` has no "Legions of Hydra" `EncounterSet` — `crossbonesScenario` uses only the two that exist. |
| The Once and Future Kang | `toafk` | **Not started.** | Needs `GameState.gameAreas`-shaped setup (landed per docs/phase7-wave2.md §3.1) and its own `wave2Scenario` entry once scripted — it's a scenario pack, no hero kit. |
| Ant-Man | `ant` | **Not started.** | Three-sided identity (§1.1/§3.2 of docs/phase7-wave2.md, landed). Known gap ahead of time: Tech Theft's class-wide text-blanking (§6.8). |
| Wasp | `wsp` | **Not started.** | Three-sided identity; divided basic powers (§3.7, landed). |
| Quicksilver | `qsv` | **Not started.** | `basicPowerUsed` trigger event (landed, used already by Spider-Woman's Captain Marvel in `trors`). |
| Scarlet Witch | `scw` | **Not started.** | Two copies of her own obligation shuffled in (§1.10, landed); boost-icon counting as an event (§3.6, landed for activation counts; card-effect counts — Hex Bolt — still open per §4.8). |

## 8. Progress / next up (update this every session)

**Last updated:** 2026-09-19, by the session that fixed the villain-AI regression and the two pre-existing type
errors, then built the registry/coverage/scenario scaffolding and finished Hawkeye + Spider-Woman + Crossbones.

**Immediately resumable next steps, in priority order (release order, per the task brief):**
1. **Absorbing Man** (`trors`, 04076–04095 roughly): the villain, its single-stage main scheme "None Shall Pass",
   and the Hydra Patrol modular set. Needs "gains the trait of each environment in play" (`gainsTraitsOf`, already
   landed in `dsl/abilities.ts` — unused so far, this is its first real card) and the "environments with Surge
   enter without surging" reading from docs/phase7-wave2.md §2.2.
2. **Taskmaster** (04096–04111 roughly): needs the Captive allies set aside (§3.10, landed) and the Hydra Patrol
   modular set (shared with Absorbing Man).
3. **Zola** (04112–04127 roughly): needs Hydra Prison's player-ally tucking (§3.10, landed) and `totalPrintedCost`
   (already landed, unused so far).
4. **Red Skull** (04128–04154 roughly): needs the side-scheme separate deck (§1.8/§3.3, landed) and the Assault
   keyword / optional thwart-with-ATK rule (§3.11, landed).
5. Once all five `trors` scenarios are scripted, add per-scenario standalone setup tests for each (the task's
   original ask) and mark `trors` `"scripted"` in `PACK_STATUS` (§7) — it cannot be marked that until every
   `KNOWN_SKIPPED` entry is a genuine primitive block, not a "not reached yet."
6. Then `toafk`, `ant`, `wsp`, `qsv`, `scw` in that order (release order), each starting the same way this file's
   §2 describes: registry + coverage entry + (for `toafk`, a scenario) before any card scripting, so the tree stays
   green at every stopping point.

**Do not start a card that needs §6.1's piercing/ranged gap, §6.3's wild-resource-cost gap, or §6.6's
attack-initiation damage-prevention gap without checking whether `game-rules-architect` has landed the primitive
first** — re-run the `KNOWN_SKIPPED` regeneration test (§1) to see whether a card you're about to skip is actually
already scriptable.
