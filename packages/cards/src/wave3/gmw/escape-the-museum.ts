import {
  addAccelerationToken,
  boost,
  cards,
  chooseTarget,
  chosen,
  confuse,
  constant,
  defineAbilities,
  encounterCards,
  encounterSetAside,
  enemyAttack,
  enemyScheme,
  exhaust,
  exhaustCardsCost,
  firstPlayer,
  firstPlayerAction,
  flipCard,
  forcedInterrupt,
  forcedResponse,
  gets,
  giveTough,
  hasStatus,
  ifThen,
  mainSchemeStageNumber,
  moveCards,
  named,
  not,
  perHero,
  putIntoPlay,
  query,
  removeThreat,
  rule,
  self,
  selectCards,
  setup,
  stateCheck,
  stun,
  theMainScheme,
  theVillain,
  threatAtLeast,
  when,
  on,
  advanceMainScheme,
  endGame,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
  you,
} from "../../dsl/index.js";

/**
 * Escape the Museum: the mode-labelled Collector pair (16080a/16080b standard, 16081a/16081b expert; docs/phase7-
 * wave3.md §1.1), the main scheme The Missing Milano → Lost in the Museum → The Great Escape (16082–16084), Library
 * Labyrinth / Museum Ship (16085), and the treacheries "I Have You Now!" (16086) and Impossible Geometry (16087).
 * Galactic Artifacts and Ship Command's own cards are scripted elsewhere (`ship-command.ts`; Galactic Artifacts is
 * not reached yet).
 *
 * **The ∞ back faces (16080b/16081b) and the front faces' own flip (16080a/16081a).** docs/phase7-wave3.md §3.1:
 * the engine resets the hit point dial itself on any flip into or out of an `infiniteHp` face, so the back face's
 * own printed "…then set Collector's hit point dial to his printed hit points" is a no-op restatement of that
 * engine rule, the same reading `gmw/museum.ts`'s own Collector I–III docblock already used for a different
 * Collector ability. `cannotBeDefeated` (§3.1) is exact for "Collector cannot be defeated." even though it is
 * already unreachable by damage (`infiniteHp`) — it also stops a card-effect defeat (`EffectSpec defeat`, §3.9).
 *
 * **"Gets +X SCH and +X ATK, where X is equal to the main scheme's current stage number"** needed a new, generic
 * value (`ValueSpec mainSchemeStageNumber`, `dsl/values.ts`) — the main-scheme analog of the already-landed
 * `villainStageNumberOf`. No printed card before this needed the main scheme's own stage number as a value.
 *
 * **"When the last threat is removed from this scheme, advance to stage 2A/3A"** (16082b, 16083b) is printed as a
 * Forced *Interrupt*, but is scripted as a forced *Response* to `removeThreat` on self, checking the scheme's own
 * threat only once the removal has actually applied (docs/phase7-wave3.md §3.26's own reading for this exact
 * wording): advancing *before* the removal would apply "remove N threat" to the wrong stage's own threat total
 * (RRG 1.8 "Main Scheme": excess threat does not carry over on an advance, and the new stage's own starting threat
 * is placed immediately), and the removal must be confirmed to have actually reached zero (RRG 1.8 "Threat
 * Removal", the removed amount is capped at what's there) before "the last threat" is a true statement.
 *
 * **Known correctness gap, found while testing (not covered, and NOT in `KNOWN_SKIPPED` because the ref itself
 * resolves): "If this stage is completed, the players lose the game."** Unlike `gmw/badoon.ts`'s Protect the Planet
 * 2B (whose stage really is the scenario's *final* one, so the RRG 1.8 "Villain Defeat" (p. 47) default already
 * covers it), stages 1 and 2 of *this* scenario are not final, and the engine's own `completeMainScheme` default
 * for a *non*-final stage is to advance — so if this stage instead completes the ordinary way (threat reaching its
 * printed *target*, e.g. from step one's placement, acceleration and an Incite reveal over a normal round), the
 * engine currently advances it, when the printed text says it should lose instead. Confirmed empirically while
 * writing `escape-the-museum.test.ts`: an unpatched villain phase reached stage 1's target threat and the game
 * silently advanced to 2A. Every test below resets the main scheme's threat before running a real villain phase,
 * specifically to avoid this confound — it is not fixed. Fixing it needs a `whenCompleted` trigger (RRG 1.8 "When
 * Completed Abilities", p. 48: a forced interrupt to the completion, which can call `endGame("loss")` before the
 * engine's own advance runs, exactly like the `next === null` final-stage branch already does) — but the emitted
 * data gives this whole two-sentence text box exactly **one** ability ref (`16082b.the-missing-milano-forced-
 * interrupt` / `16083b.lost-in-the-museum-forced-interrupt`), already spent on the `removeThreat` response above,
 * and an `AbilityDefinition` carries exactly one trigger kind — `forcedResponse` and `whenCompleted` cannot share
 * one id. This is a `card-data-pipeline` gap (the two independently-triggered sentences need a second ref, the
 * same way Blind Side's `chooseOne` needed `partOf` bullets) or a `game-rules-architect` one (a compound-trigger
 * `AbilityDefinition`), not a wording question — flagged rather than guessed at.
 *
 * **"Set aside the Ship Command modular encounter set" / "shuffle the remaining … into the encounter deck"**
 * needed a new, generic `CardDestination` (`"encounterSetAside"`, `spec.ts`/`resolve/cards.ts`): `moveCards` could
 * already *read* the shared set-aside pile (`CardSelector encounterSetAside`, `gmw/badoon.ts`'s own Milano
 * pattern) but had no way to *send* cards there. Both directions bind a reference card from the set first
 * (Rogue Vessel, 16143 — any always-shuffled-in Ship Command card works) and match every other card sharing an
 * encounter set with it (`TargetQuery.encounterSetOf`, already generic and pack-agnostic) — no new `TargetQuery`
 * field for "belongs to a named encounter set" was needed.
 *
 * **Genuine primitive gaps (`KNOWN_SKIPPED`), Library Labyrinth / Museum Ship (16085):**
 *
 * - **`16085a.this-way`** ("Hero Action: Deal yourself 1 facedown encounter card → remove 5 threat from the main
 *   scheme. (Limit once per round per player.)") needs `AbilityLimit.per` to support a per-*acting-player* key.
 *   Today `per` only carries `"aspectOfEventCard"`, and an unqualified limit's `abilityUses` counter is keyed by
 *   `<instance>:<ability>` alone (`resolve/ability.ts`'s `limitKeyOf`) — shared across every player who might use a
 *   *shared* card's own Hero Action, not per player. RRG 1.8 "Limit" (p. 26) confirms the *un*qualified default is
 *   card-specific, not per-player, which is exactly why this printed card spells "per player" out: it is asking
 *   for scoping the engine does not have a key for yet. Threading an acting-player key through every place a limit
 *   is checked and recorded (`resolve/ability.ts`, `actions.ts`'s `useAbility` pre-check, the trigger paths in
 *   `resolve/triggers.ts`) is a real, multi-site primitive, not a one-line addition — flagged for
 *   `game-rules-architect` rather than approximated as a shared limit, which would silently block a second
 *   player's own use for the rest of the round.
 * - **`16085b.hold-on-to-your-butts`, `.museum-ship-constant`, `.museum-ship-constant-2`** ("Forced Interrupt: When
 *   the villain phase begins, choose one: exhaust the Milano → assign 2[per_hero] indirect damage among players;
 *   or assign 3[per_hero] indirect damage among players.") needs a primitive for a chooser freely splitting a pool
 *   of *indirect* damage across players (not each player's own characters, which `EffectSpec dealIndirectDamage`'s
 *   existing `PlayerRef | "group"` shapes already cover, and not "among heroes and allies" within one player's
 *   own pool, which `EffectSpec assignDamage` already covers but only as ordinary — not indirect — damage). No
 *   printed card in the pool needs "indirect damage among *players*" today; not approximated with either existing
 *   shape, since both would either under- or over-scope who takes the damage.
 */

/** "Exhaust the Milano" as a cost — Milano is unique, so this always names the one in play (`gmw/badoon.ts`'s own copy). */
const exhaustMilano = exhaustCardsCost(query("support", { name: "Milano" }));

/** "Collector gets +X SCH and +X ATK, where X is equal to the main scheme's current stage number." */
const collectorScales = () =>
  constant(gets("sch", mainSchemeStageNumber, { self: true }), gets("atk", mainSchemeStageNumber, { self: true }));
/** "Forced Interrupt: When Collector would be defeated, remove 3[per_hero] threat from the main scheme and flip
 * this card instead." */
const collectorFrontInterrupt = () =>
  forcedInterrupt(when.defeated("self"), removeThreat(perHero(3), theMainScheme), flipCard(self));
/** "Collector cannot be defeated." */
const collectorCannotBeDefeated = () => constant(rule({ kind: "cannotBeDefeated", target: { self: true } }));
/** "Forced Interrupt: When the round ends, flip this card, then set Collector's hit point dial to his printed hit
 * points." — the dial reset is the engine's own rule on any flip into/out of an ∞ face (module docblock). */
const collectorBackInterrupt = () => forcedInterrupt(on.phaseEnding("villain"), flipCard(self));

/** "When the last threat is removed from this scheme, advance to stage N (module docblock: response, not literal
 * interrupt timing, so the removal has actually applied before the check)." */
const advanceWhenClear = (stageNumber: number) =>
  forcedResponse(
    { on: "removeThreat", selfIs: "target" },
    ifThen(not(threatAtLeast(self, 1)), advanceMainScheme({ to: { stageNumber } })),
  );

export const ESCAPE_THE_MUSEUM = defineAbilities({
  // Collector A1 (standard front) — [star] Collector gets +X SCH/ATK; Forced Interrupt: flip on defeat.
  "16080a.collector-constant": collectorScales(),
  "16080a.collector-forced-interrupt": collectorFrontInterrupt(),
  // Collector A2 (standard back, ∞ hit points) — cannot be defeated; flips back when the round ends.
  "16080b.collector-constant": collectorCannotBeDefeated(),
  "16080b.collector-forced-interrupt": collectorBackInterrupt(),
  // Collector B1 (expert front) — same shape as A1.
  "16081a.collector-constant": collectorScales(),
  "16081a.collector-forced-interrupt": collectorFrontInterrupt(),
  // Collector B2 (expert back, ∞ hit points) — same shape as A2.
  "16081b.collector-constant": collectorCannotBeDefeated(),
  "16081b.collector-forced-interrupt": collectorBackInterrupt(),

  // The Missing Milano 1A — Setup: Put the Library Labyrinth environment into play. Set aside the Ship Command
  // modular encounter set (module docblock: bind a reference card, match everything sharing its encounter set).
  "16082a.setup": setup(
    selectCards("labyrinth", encounterCards(["deck"], { name: "Library Labyrinth" })),
    putIntoPlay(chosen("labyrinth"), firstPlayer),
    selectCards("shipRef", encounterCards(["deck"], { name: "Rogue Vessel" })),
    moveCards(encounterCards(["deck"], { encounterSetOf: chosen("shipRef") }), "encounterSetAside"),
  ),
  // The Missing Milano 1B — Forced Interrupt (scripted as a response, module docblock): advance to stage 2A when
  // the last threat is removed. "If this stage is completed, the players lose the game" is a known, unfixed
  // correctness gap for this non-final stage (module docblock) — not implemented, since the one ability ref this
  // text carries is already spent on the response below.
  "16082b.the-missing-milano-forced-interrupt": advanceWhenClear(2),

  // Lost in the Museum 2A — When Revealed: Put the set-aside Milano support into play under the first player's
  // control.
  "16083a.when-revealed": whenRevealed(
    selectCards("milano", encounterSetAside({ name: "Milano" })),
    putIntoPlay(chosen("milano"), firstPlayer),
  ),
  // Lost in the Museum 2B — same "advance when the last threat is removed" shape as 1B, to stage 3A.
  "16083b.lost-in-the-museum-forced-interrupt": advanceWhenClear(3),

  // The Great Escape 3A — When Revealed: Flip Library Labyrinth. Place 1 acceleration token on the main scheme.
  // Shuffle the remaining cards from the set-aside Ship Command encounter set into the encounter deck.
  "16084a.when-revealed": whenRevealed(
    flipCard(named("Library Labyrinth")),
    addAccelerationToken(),
    selectCards("shipRef", encounterSetAside({ name: "Rogue Vessel" })),
    moveCards(encounterSetAside({ encounterSetOf: chosen("shipRef") }), "encounterDeckShuffle"),
  ),
  // The Great Escape 3B — First Player Action: Exhaust the Milano → remove 3 threat from here.
  "16084b.the-great-escape-constant": firstPlayerAction({ cost: exhaustMilano }, removeThreat(3, self)),
  // The Great Escape 3B — If there is no threat here, the players win the game. ("If this stage is completed, the
  // players lose the game" is the engine's own final-stage default — no ref, per the module docblock.)
  "16084b.the-great-escape-constant-2": stateCheck(not(threatAtLeast(self, 1)), endGame("win")),

  // Library Labyrinth ("This way?") and Museum Ship — SKIPPED (module docblock): 16085a needs `AbilityLimit.per`
  // to support a per-acting-player key; 16085b needs an "assign indirect damage among players" primitive.

  // "I Have You Now!" (16086) — When Revealed (Alter-Ego): Exhaust your identity. Collector schemes.
  "16086.when-revealed-alter-ego": whenRevealedAlterEgo(exhaust(yourIdentity), enemyScheme(theVillain)),
  // "I Have You Now!" — When Revealed (Hero): You are stunned. Collector attacks you.
  "16086.when-revealed-hero": whenRevealedHero(stun(yourIdentity), enemyAttack(theVillain, { against: you })),
  // "I Have You Now!" — [star] Boost: Give Collector a tough status card.
  "16086.boost": boost(giveTough(theVillain)),

  // Impossible Geometry (16087) — Incite 1 (data-driven). When Revealed: You are confused. If you are already
  // confused, choose and discard 1 card you control (checked before the confuse, the same "already" shape
  // `gmw/museum.ts`'s Psionic Ghost and `gmw/badoon.ts`'s Badoon Sentry both already use).
  "16087.when-revealed": whenRevealed(
    ifThen(hasStatus(yourIdentity, "confused"), [
      chooseTarget("discarded", { categories: ["ally", "support", "upgrade"], controller: "you" }, { chooser: you }),
      moveCards(cards(chosen("discarded")), "discard"),
    ]),
    confuse(yourIdentity),
  ),
});
