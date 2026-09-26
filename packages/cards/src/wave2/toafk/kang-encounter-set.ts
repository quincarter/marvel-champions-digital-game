import { trait } from "@mc/content";
import {
  adjustBoostCount,
  allOf,
  alterEgoAction,
  andThen,
  attachCard,
  bindTargets,
  boost,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  coveredByEngineRule,
  countOf,
  defineAbilities,
  discardAtRandom,
  discardEncounterCards,
  discardEncounterUntil,
  discard,
  discardFromHandCost,
  discardRandomFromHandCost,
  discardThis,
  each,
  eachPlayer,
  encounterCards,
  engagedPlayerOf,
  enemyAttack,
  eventDealt,
  eventSource,
  eventTarget,
  exhaust,
  dealDamage,
  dealEncounterCard,
  dealIndirectDamage,
  defeatingPlayer,
  exists,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  gets,
  giveTough,
  identityOf,
  ifThen,
  inPlay,
  instead,
  made,
  modifyAttack,
  moveCards,
  named,
  not,
  on,
  option,
  ownerOf,
  placeThreat,
  preventDamage,
  printedCostOf,
  putIntoPlay,
  query,
  refMatches,
  revealCard,
  rule,
  self,
  selectCards,
  stun,
  superlative,
  takeDamage,
  theVillain,
  thatPlayer,
  topOfDeck,
  tuckCards,
  varOf,
  when,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";
import { atEndOfAttack } from "../../dsl/effects.js";
import { discardThisObligation } from "../../core/obligations.js";
import { cardName } from "../names.js";

/** The trait Expert Kang minions and Kang's Chosen search for/among (`packages/content`'s upper-cased spelling). */
const TEMPORAL = trait("TEMPORAL");

/**
 * The Kang encounter set (11014–11017, 11022–11029) plus its "Temporal" modular set (11030–11033, marked by
 * traits rather than a separate module — Temporal's own cards are few enough to keep here) and the four "Temporal
 * obligations" (11018–11021).
 *
 * **The Temporal obligations no longer combine two trigger kinds under one ref** (the pipeline split 11018,
 * 11019 and 11021 into their own "When Revealed"/"Forced Response" ref plus their own "Alter-Ego Action" ref, each
 * scripted below; the leading `.obligation` ref on each is a leftover empty artifact, `coveredByEngineRule()`).
 * **`card-data-pipeline` has since split 11020 (Depowered) and 11049 (Fear of Kang) the same way**
 * (docs/phase7-wave2.md §18.2/§18.3): each now carries a `-constant` ref (the "you cannot …" clause) beside its own
 * `-action` ref (the "Alter-Ego Action: discard … → discard this obligation" clause), so both halves can finally be
 * scripted independently instead of one ref forcing a choice between them.
 *
 * **11020 (Depowered) is now fully scripted, with one correction to §18.2's own shape.** `11020.depowered-action`
 * is `discardFromHandCost(1, 1, undefined, { identitySetOf: you })` (§19's cost-side `filter`) →
 * `discardThisObligation` — `you` here is fine, because `planCost` (§19) deliberately evaluates a cost's filter in
 * the *paying player's own* context. `11020.depowered-constant` is `RuleSpec cannotPlay` with `player: you` (scopes
 * *who* is restricted — fine, `rulePlayers` falls back to whichever player's play area holds the obligation) and
 * `cards: { identitySetOf: you }` — the printed text's own reading ("you cannot play *your* hero-specific cards").
 * `game-rules-architect` closed the gap this used to route around (docs/phase7-wave2.md §25.3): `cannotPlay`'s
 * `cards` query now matches against `ActiveRule.speakerContext`, not the source card's raw (controller-less, for an
 * obligation) context, so `you` resolves correctly instead of silently matching nobody. `eachPlayer` was the
 * workaround while that gap stood; it produced the identical result in practice (RRG 1.8 "Identity-Specific Card",
 * p. 23: a hero-specific card can only ever be in its own hero's hand to begin with), but `you` is the narrower,
 * more literal reading of "you" and no longer needs a workaround to work.
 *
 * **11049 (Fear of Kang) is now fully scripted too** (docs/phase7-wave2.md §25): `RuleSpec cannotAttack` gained the
 * same `player?: PlayerRef` field `cannotPlay`/`cannotThwart`/`cannotChangeForm` already carried, so
 * `11049.fear-of-kang-constant` ("You cannot attack Kang") is `player: you` — scoped to this obligation's own
 * controller, not the whole table. `11049.fear-of-kang-action` (discard a random card from hand → discard this
 * obligation) is scripted below with `discardRandomFromHandCost(1)`, the same builder Magic Crowbar (`07018`)
 * already uses. `fear-of-kang-constant.test.ts` keeps the two-player proof: it still pins that a *bare*, target-only
 * `cannotAttack` rule (the shape Distracting Taunts, `twc` 07035, genuinely needs) is table-wide by design, and now
 * also proves the scoped shape this card ships with blocks only its own controller.
 *
 * **11021 (Time-Travel Hijinks)'s "When Revealed" half is now scripted** — `superlative`/`printedCostOf` (`dsl/
 * values.ts`, added this pass) supply "the highest-cost card you control" (a gap the module docblock previously
 * claimed had no primitive at all; `TargetRef { kind: "superlative" }` already existed for other packs, just not as
 * a shared `@mc/cards` builder — see `superlative`'s own doc comment).
 *
 * **11018/11019/11021's own "Alter-Ego Action" refs are now scripted too** (docs/phase7-wave2.md §19,
 * `ability-scripting-engineer`): `AbilityCost.discardFromHand` gained `filter?: TargetQuery`, the cost-side twin of
 * the effect's own `discardFromHand.filter` (Power Drain's "discard 1 resource of any type"). `discardFromHandCost`
 * (`dsl/abilities.ts`) grew a matching fourth argument. A wild icon never pays one of these — RRG 1.8 "Wild
 * Resource" (p. 48): "When resources are not being generated for a cost, a wild resource does not have any
 * characteristic other than 'wild resource'" — the engine enforces this directly, not this file.
 *
 * **Skipped (missing engine primitive — see docs/phase7-wave2-scripting.md):**
 * - `11029.when-revealed` — "Each player searches the encounter deck and discard pile for a **different**
 *   obligation and reveals it" is scripted below reading "different" as "this player's own choice" only: no
 *   primitive compares one player's pick against another's within `forEachPlayer`, so cross-player distinctness
 *   isn't enforced. Flagged, not silently assumed correct.
 *
 * **The Expert encounter set (11040–11051, scripted this pass)** substitutes for the Kang/Temporal set in expert
 * mode (docs/phase7-wave2.md §2.3). Every "[star] Boost: … Give this enemy another boost card" reads "this enemy"
 * as the card's own current activation, the same `modifyAttack({ extraBoostCards })` reading Hydra Exo-Soldier
 * (04131, `trors/red-skull.ts`) established — never `giveBoostCard`, which the validator refuses inside a `boost()`
 * ability for exactly this reason (docs/phase7-wave2-scripting.md §5). "Kang (Master of Time) activates against
 * you" (11051) reads as an attack, the same convention `absorbing-man.ts` cites for every other cycle-1 "activates
 * against" phrasing (RRG 1.8 doesn't define "against" as a term; every other cycle-1 use of it names an attack's
 * target).
 */
export const KANG_ENCOUNTER_SET = defineAbilities({
  // Weakened — Forced Response: after you use a basic hero power, take 1 damage. Alter-Ego Action: discard a
  // [physical] resource from your hand → discard this obligation (docs/phase7-wave2.md §19).
  "11018.obligation": coveredByEngineRule(),
  "11018.weakened-forced-response": forcedResponse(
    on.basicPowerUsed(query("hero", { controller: "you" })),
    takeDamage(1),
  ),
  "11018.weakened-action": alterEgoAction(
    { cost: discardFromHandCost(1, 1, undefined, { printedResource: "physical" }) },
    discardThisObligation,
  ),

  // Stolen Memories — When Revealed: place the top 8 cards of your deck facedown under this card. Alter-Ego Action:
  // discard a [mental] resource from your hand → discard this obligation (and the tucked cards with it — `RRG
  // "Tuck"`: a card that leaves play discards whatever is tucked beneath it, `discardThisObligation`'s own
  // `moveCards` calls `leavePlay` for an in-play card, so no separate effect is needed here).
  "11019.obligation": coveredByEngineRule(),
  "11019.when-revealed": whenRevealed(tuckCards(topOfDeck(8, you), self, true)),
  "11019.stolen-memories-action": alterEgoAction(
    { cost: discardFromHandCost(1, 1, undefined, { printedResource: "mental" }) },
    discardThisObligation,
  ),

  // Depowered — You cannot play hero-specific cards. Alter-Ego Action: discard a hero-specific card from your
  // hand → discard this obligation (module docblock: `cannotPlay` + `identitySetOf: you` reads "hero-specific" as
  // "belongs to *your own* hero's signature set" live, off the identity you actually control, so nothing here
  // hardcodes a specific hero's aspect string). `cards: { identitySetOf: you }` matches the `player` field's own
  // "you" (module docblock, §25.3): `cannotPlay` now matches `cards` in the rule's speaker context.
  "11020.depowered-constant": constant(rule({ kind: "cannotPlay", player: you, cards: { identitySetOf: you } })),
  "11020.depowered-action": alterEgoAction(
    { cost: discardFromHandCost(1, 1, undefined, { identitySetOf: you }) },
    discardThisObligation,
  ),

  // Time-Travel Hijinks — When Revealed: discard the highest-cost card you control, then place it facedown under
  // this card. Alter-Ego Action: discard an [energy] resource from your hand → discard this obligation (and the
  // tucked card with it, same "Tuck" rule as Stolen Memories above).
  "11021.obligation": coveredByEngineRule(),
  // With no ally/upgrade/support in play, the required `chooseTarget` finds nothing, so "then place it facedown
  // under this card" doesn't attempt to resolve either (RRG 1.8 "'Then'", p. 44).
  "11021.when-revealed": whenRevealed(
    bindTargets(
      "highestCost",
      superlative(
        "highest",
        each(query(["ally", "upgrade", "support"], { controller: "you" })),
        printedCostOf(chosen("candidate")),
      ),
    ),
    chooseTarget("pick", { inSlot: "highestCost" }),
    discard(chosen("pick")),
    andThen(tuckCards(cards(chosen("pick")), self, true)),
  ),
  "11021.time-travel-hijinks-action": alterEgoAction(
    { cost: discardFromHandCost(1, 1, undefined, { printedResource: "energy" }) },
    discardThisObligation,
  ),

  // Temporal Shield — Attach to Kang. Forced Interrupt: When Kang is attacked, discard Temporal Shield → prevent
  // all damage from this attack and deal 1 damage to the attacker. "(Max 1 per attack.)" is a narrow edge case (two
  // copies attached to Kang at once, both interrupting the same attack) this DSL's `AbilityLimit.period` ("turn" |
  // "phase" | "round") can't express "per attack"; not modeled — the primary effect is exact either way.
  "11014.temporal-shield-forced-interrupt": forcedInterrupt(
    when.damage("host", { fromAttack: true }),
    { cost: discardThis },
    preventDamage(),
    dealDamage(1, identityOf(ownerOf(eventSource))),
  ),

  // Future Weapon — Attach to Kang. [star] Forced Interrupt: When Kang attacks, the attack gains overkill. If this
  // attack damages a hero, that hero is stunned. After this attack, discard Future Weapon. Modeled directly on
  // Rhino's own "Charge" (01099, `core/scenarios/rhino.ts`: `modifyAttack({ overkill: true })` at initiation, plus
  // `atEndOfAttack` for what depends on the attack's own results).
  "11015.future-weapon-forced-interrupt": forcedInterrupt(
    when.villainAttacks(),
    modifyAttack({ overkill: true }),
    atEndOfAttack(
      ifThen(allOf(eventDealt("damage"), refMatches(eventTarget, query("hero"))), stun(eventTarget)),
      discard(self),
    ),
  ),

  // Frozen in Time — Attach to your identity. Forced Interrupt: when attached character would ready, discard this
  // card instead. [star] Boost: Attach to your identity.
  "11016.frozen-in-time-forced-interrupt": forcedInterrupt(on.cardReadying("host"), instead(discard(self))),
  "11016.boost": boost(attachCard(self, yourIdentity)),

  // Macrobots — Guard. Retaliate 1 (data). [star] Boost: Give Kang a tough status card.
  "11017.boost": boost(giveTough(theVillain)),

  // Corrupted Timestream — Players cannot trigger "Alter-Ego Action" abilities on obligations. When Revealed: each
  // player must either discard 1 random card from hand, or place 2 threat here.
  "11022.corrupted-timestream-constant": constant(
    rule({ kind: "cannotTriggerActions", on: query("obligation"), form: "alterEgo" }),
  ),
  "11022.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      chooseOne(
        option("Discard 1 random card from hand", discardAtRandom(1, thatPlayer)),
        option("Place 2 threat here", placeThreat(2, self)),
      ),
    ),
  ),

  // Kang's Dominion — Kang cannot take damage. When Defeated: deal the player who defeated this scheme an
  // encounter card.
  "11023.kangs-dominion-constant": constant(rule({ kind: "cannotTakeDamage", target: query("villain") })),
  "11023.when-defeated": whenDefeated(dealEncounterCard(defeatingPlayer)),

  // Pinned Down — Crisis (data). When Revealed: place 2 threat here for each obligation in play.
  "11024.when-revealed": whenRevealed(placeThreat(countOf(query("obligation")), self)),

  // Rampage — Acceleration (data). When Defeated: discard cards from the top of the encounter deck until a minion
  // is discarded. Put that minion into play engaged with the player who defeated this scheme.
  "11025.when-defeated": whenDefeated(
    discardEncounterUntil(query("minion"), "found"),
    putIntoPlay(chosen("found"), defeatingPlayer),
  ),

  // Energy Blast — When Revealed (Alter-Ego): discard an ally or support you control. If you cannot, this card
  // gains surge. When Revealed (Hero): Kang attacks you.
  "11026.when-revealed-alter-ego": whenRevealedAlterEgo(
    ifThen(
      exists(query(["ally", "support"], { controller: "you" })),
      [chooseTarget("discard", query(["ally", "support"], { controller: "you" })), discard(chosen("discard"))],
      { kind: "gainSurge" },
    ),
  ),
  "11026.when-revealed-hero": whenRevealedHero(enemyAttack(theVillain, { against: you })),

  // Manipulated Timestream — When Revealed: discard each event from your hand. If no events are discarded this
  // way, this card gains surge.
  "11027.when-revealed": whenRevealed(
    selectCards("events", zone("hand", you, { filter: query("event") })),
    moveCards(cards(chosen("events")), "discard", "d"),
    ifThen(not(made("d")), { kind: "gainSurge" }),
  ),

  // Time-Travel Tactics — Surge (data). When Revealed: each player takes 1 indirect damage for each obligation in
  // their play area. [star] Boost: this card gains [boost] for each obligation in your play area.
  "11028.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, dealIndirectDamage(thatPlayer, countOf(query("obligation", { controller: "other" })))),
  ),
  "11028.boost": boost(adjustBoostCount(countOf(query("obligation", { controller: "you" })))),

  // Past Machinations — Incite 1 (data). When Revealed: each player searches the encounter deck and discard pile
  // for a different obligation and reveals it (module docblock: cross-player distinctness not enforced). Shuffle
  // the encounter deck.
  "11029.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      chooseCards(
        "found",
        { kind: "encounter", zones: ["deck", "discard"], filter: query("obligation") },
        { min: 0, max: 1, chooser: thatPlayer },
      ),
      { kind: "revealCard", cards: chosen("found"), player: thatPlayer },
    ),
    { kind: "shuffleEncounterDeck" },
  ),
  // The data carries a second ("-constant") ref for Past Machinations' printed Incite keyword line, with no
  // separate text of its own — the same parser-artifact shape as `04128a.the-rise-of-red-skull-constant`
  // (`red-skull.ts`) and other "-constant" refs beside Incite/keyword-only reminder text elsewhere in wave 2.
  "11029.past-machinations-constant": coveredByEngineRule(),

  // Ancient Warrior — Quickstrike (data). [star] Boost: You are stunned.
  "11030.boost": boost(stun(yourIdentity)),

  // Chitauri Soldier — [star] Forced Interrupt: when Chitauri Soldier attacks you, discard the top card of the
  // encounter deck → take indirect damage equal to the number of boost icons on that card.
  "11031.chitauri-soldier-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("host", { againstYou: true }),
    discardEncounterCards(1, { bind: "d" }),
    dealIndirectDamage(you, varOf("d.boostIcons")),
  ),

  // Tyrannosaurus Rex — Toughness (data). [star] Tyrannosaurus Rex's attacks gain piercing.
  "11032.tyrannosaurus-rex-constant": constant(
    rule({ kind: "attackKeywords", keywords: ["piercing"], attacker: query("minion", { self: true }) }),
  ),

  // Time Portal — Hazard (data). Forced Interrupt: when this scheme is defeated, shuffle it into the encounter
  // deck instead of discarding it.
  "11033.time-portal-forced-interrupt": constant(
    rule({ kind: "defeatedIntoEncounterDeck", target: query("sideScheme", { self: true }) }),
  ),

  // ---- The Expert encounter set (11040–11051), module docblock ----------------------------------------------

  // Apocryphus — When Revealed: discard an ally or support you control. [star] Boost: exhaust a character you
  // control. Give this enemy another boost card.
  "11040.when-revealed": whenRevealed(
    chooseTarget("target", query(["ally", "support"], { controller: "you" })),
    discard(chosen("target")),
  ),
  "11040.boost": boost(
    chooseTarget("char", query("character", { controller: "you" })),
    exhaust(chosen("char")),
    modifyAttack({ extraBoostCards: 1 }),
  ),

  // Deathunt 9000 — Toughness. Villainous (data). [star] Boost: give this enemy a tough status card and another
  // boost card.
  "11041.boost": boost(giveTough(self), modifyAttack({ extraBoostCards: 1 })),

  // Sir Raston — Guard. Retaliate 1 (data). [star] Boost: take 1 damage. Give this enemy another boost card.
  "11042.boost": boost(takeDamage(1), modifyAttack({ extraBoostCards: 1 })),

  // Terminatrix — Quickstrike (data). [star] Terminatrix's attacks gain piercing. [star] Boost: give this enemy 2
  // more boost cards.
  "11043.terminatrix-constant": constant(
    rule({ kind: "attackKeywords", keywords: ["piercing"], attacker: query("minion", { self: true }) }),
  ),
  "11043.boost": boost(modifyAttack({ extraBoostCards: 2 })),

  // Wildrun — When Revealed: discard 1 random card from your hand. [star] Boost: discard 1 random card from your
  // hand. Give this enemy another boost card.
  "11044.when-revealed": whenRevealed(discardAtRandom(1, you)),
  "11044.boost": boost(discardAtRandom(1, you), modifyAttack({ extraBoostCards: 1 })),

  // The Anachronauts — Hazard (data). When Defeated: shuffle each Temporal card in the encounter discard pile into
  // the encounter deck.
  "11045.when-defeated": whenDefeated(
    moveCards(encounterCards(["discard"], { trait: TEMPORAL }), "encounterDeckShuffle"),
  ),

  // Kang's Chosen — Incite 1 (data). When Revealed: discard cards from the top of the encounter deck until a
  // Temporal minion is discarded. Reveal that minion.
  "11046.when-revealed": whenRevealed(
    discardEncounterUntil(query("minion", { trait: TEMPORAL }), "found"),
    revealCard(chosen("found"), you),
  ),

  // Kang (Master of Time) — Toughness. Villainous (data). Gets +1 SCH and +1 ATK for each obligation in your (the
  // engaged player's) play area — the same "you" reading The Viper's own "while engaged with you" constant uses
  // (docs/phase7-wave2.md §3.2; `04054.the-viper-constant`, `trors/spider-woman-obligation-nemesis.ts`).
  "11047.kang-master-of-time-constant": constant(
    gets(
      "sch",
      { kind: "count", query: query("obligation", { controlledBy: engagedPlayerOf(self) }) },
      query("minion", { self: true }),
    ),
    gets(
      "atk",
      { kind: "count", query: query("obligation", { controlledBy: engagedPlayerOf(self) }) },
      query("minion", { self: true }),
    ),
  ),

  // Time-Displaced Soldier — Incite 1. Surge (data). [star] Boost: deal yourself 1 facedown encounter card.
  "11048.boost": boost(dealEncounterCard(you)),

  // Fear of Kang — You cannot attack Kang. `RuleSpec cannotAttack` gained `player?: PlayerRef` (docs/phase7-wave2.md
  // §25); `player: you` scopes the restriction to this obligation's own controller (`fear-of-kang-constant.test.ts`
  // now proves the scoped reading, not just the table-wide one the primitive used to be stuck with).
  "11049.fear-of-kang-constant": constant(
    rule({ kind: "cannotAttack", target: query("villain", { name: cardName("11001") }), player: you }),
  ),
  // Alter-Ego Action: discard a random card from your hand → discard this obligation.
  "11049.fear-of-kang-action": alterEgoAction({ cost: discardRandomFromHandCost(1) }, discardThisObligation),

  // Light of Centuries Sphere — Hazard (data). When Defeated: discard cards from the top of the encounter deck
  // until a minion is discarded. Put that minion into play engaged with the player who defeated this scheme (the
  // same shape Rampage, 11025, above, uses).
  "11050.when-defeated": whenDefeated(
    discardEncounterUntil(query("minion"), "found"),
    putIntoPlay(chosen("found"), defeatingPlayer),
  ),

  // Ancient Grudge — When Revealed: Kang (Master of Time) activates against you (module docblock: read as an
  // attack). If Kang (Master of Time) is not in play, search the encounter deck and discard pile for him and put
  // him into play engaged with you. Shuffle the encounter deck. Printed order matters: if he isn't in play yet, the
  // first effect's `named(...)` ref resolves to nothing and silently does nothing (docs/phase7-wave2-scripting.md
  // §5's `putIntoPlay(named(...))` precedent — the same "ref finds nothing, effect no-ops" reading applies to any
  // effect reading a `TargetRef`), so only the search half fires on the first reveal.
  "11051.when-revealed": whenRevealed(
    enemyAttack(named(cardName("11047")), { against: you, additionalResolution: true }),
    ifThen(not(inPlay(cardName("11047"))), [
      selectCards("found", encounterCards(["deck", "discard"], { name: cardName("11047") })),
      putIntoPlay(chosen("found"), you),
      { kind: "shuffleEncounterDeck" },
    ]),
  ),
});
