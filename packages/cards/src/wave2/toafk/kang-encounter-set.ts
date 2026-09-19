import {
  adjustBoostCount,
  allOf,
  attachCard,
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
  discardThis,
  eachPlayer,
  enemyAttack,
  eventDealt,
  eventSource,
  eventTarget,
  dealDamage,
  dealEncounterCard,
  dealIndirectDamage,
  defeatingPlayer,
  exists,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  giveTough,
  identityOf,
  ifThen,
  instead,
  made,
  modifyAttack,
  moveCards,
  not,
  on,
  option,
  ownerOf,
  placeThreat,
  preventDamage,
  putIntoPlay,
  query,
  refMatches,
  rule,
  self,
  selectCards,
  stun,
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

/**
 * The Kang encounter set (11014–11017, 11022–11029) plus its "Temporal" modular set (11030–11033, marked by
 * traits rather than a separate module — Temporal's own cards are few enough to keep here) and the four "Temporal
 * obligations" (11018–11021).
 *
 * **The Temporal obligations no longer combine two trigger kinds under one ref** (the pipeline split 11018,
 * 11019 and 11021 into their own "When Revealed"/"Forced Response" ref plus their own "Alter-Ego Action" ref, each
 * scripted below; the leading `.obligation` ref on each is a leftover empty artifact, `coveredByEngineRule()`).
 * **11020 (Depowered) was not split** — still one ref for both "You cannot play hero-specific cards" (scripted, a
 * `cannotPlay` rule) and "Alter-Ego Action: discard a hero-specific card → discard this obligation" (not scripted:
 * the ref can only carry one `AbilityTriggerSpec` kind, and the first clause is the card's own primary restriction).
 *
 * **Skipped (missing engine primitive — see docs/phase7-wave2-scripting.md):**
 * - `11018.weakened-action`, `11019.stolen-memories-action`, `11021.time-travel-hijinks-action` — each "Alter-Ego
 *   Action: Discard a [physical/mental/energy] resource from your hand → discard this obligation" needs a
 *   *resource-type-filtered* discard **cost**. `AbilityCost.discardFromHand` (`{min, max, bind}`) has no `filter`
 *   field the way the *effect* version does (`EffectSpec.discardFromHand.filter`, used by Power Drain's "discard 1
 *   resource of any type" — `ANY_RESOURCE`) — there is no way to require the discarded hand card carry a specific
 *   printed resource icon as part of paying a cost.
 * - `11029.when-revealed` — "Each player searches the encounter deck and discard pile for a **different**
 *   obligation and reveals it" is scripted below reading "different" as "this player's own choice" only: no
 *   primitive compares one player's pick against another's within `forEachPlayer`, so cross-player distinctness
 *   isn't enforced. Flagged, not silently assumed correct.
 */
export const KANG_ENCOUNTER_SET = defineAbilities({
  // Weakened — Forced Response: after you use a basic hero power, take 1 damage. Alter-Ego Action (skipped, module
  // docblock): discard a [physical] resource → discard this obligation.
  "11018.obligation": coveredByEngineRule(),
  "11018.weakened-forced-response": forcedResponse(on.basicPowerUsed(query("hero", { controller: "you" })), takeDamage(1)),

  // Stolen Memories — When Revealed: place the top 8 cards of your deck facedown under this card. Alter-Ego
  // Action (skipped, module docblock): discard a [mental] resource → discard this obligation (and the tucked
  // cards with it).
  "11019.obligation": coveredByEngineRule(),
  "11019.when-revealed": whenRevealed(tuckCards(topOfDeck(8, you), self, true)),

  // Depowered — SKIPPED (missing primitive — module docblock): "You cannot play hero-specific cards" needs a
  // `TargetQuery` matching "belongs to *your own* hero's signature set" dynamically — `aspect` is an exact
  // single-string match (`"hero:12001a"` for Ant-Man specifically), and this obligation is generic (any hero could
  // hold it), so no fixed aspect string can be hardcoded here. The same "dynamic match against your own hero" gap
  // Team-Building Exercise needs (`pack-cards.ts`'s own module docblock).

  // Time-Travel Hijinks — Alter-Ego Action (skipped, module docblock): discard an [energy] resource → discard this
  // obligation (and the tucked card with it). The "When Revealed: discard the highest-cost card you control, then
  // place it facedown under this card" half is also skipped: no selector picks "the single highest-cost card
  // among a set" (`TargetQuery.maxPrintedCost` is a fixed threshold comparison, not a superlative pick).
  "11021.obligation": coveredByEngineRule(),

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
    atEndOfAttack(ifThen(allOf(eventDealt("damage"), refMatches(eventTarget, query("hero"))), stun(eventTarget)), discard(self)),
  ),

  // Frozen in Time — Attach to your identity. Forced Interrupt: when attached character would ready, discard this
  // card instead. [star] Boost: Attach to your identity.
  "11016.frozen-in-time-forced-interrupt": forcedInterrupt(on.cardReadying("host"), instead(discard(self))),
  "11016.boost": boost(attachCard(self, yourIdentity)),

  // Macrobots — Guard. Retaliate 1 (data). [star] Boost: Give Kang a tough status card.
  "11017.boost": boost(giveTough(theVillain)),

  // Corrupted Timestream — Players cannot trigger "Alter-Ego Action" abilities on obligations. When Revealed: each
  // player must either discard 1 random card from hand, or place 2 threat here.
  "11022.corrupted-timestream-constant": constant(rule({ kind: "cannotTriggerActions", on: query("obligation"), form: "alterEgo" })),
  "11022.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, chooseOne(option("Discard 1 random card from hand", discardAtRandom(1, thatPlayer)), option("Place 2 threat here", placeThreat(2, self)))),
  ),

  // Kang's Dominion — Kang cannot take damage. When Defeated: deal the player who defeated this scheme an
  // encounter card.
  "11023.kangs-dominion-constant": constant(rule({ kind: "cannotTakeDamage", target: query("villain") })),
  "11023.when-defeated": whenDefeated(dealEncounterCard(defeatingPlayer)),

  // Pinned Down — Crisis (data). When Revealed: place 2 threat here for each obligation in play.
  "11024.when-revealed": whenRevealed(placeThreat(countOf(query("obligation")), self)),

  // Rampage — Acceleration (data). When Defeated: discard cards from the top of the encounter deck until a minion
  // is discarded. Put that minion into play engaged with the player who defeated this scheme.
  "11025.when-defeated": whenDefeated(discardEncounterUntil(query("minion"), "found"), putIntoPlay(chosen("found"), defeatingPlayer)),

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
  "11028.when-revealed": whenRevealed(forEachPlayer(eachPlayer, dealIndirectDamage(thatPlayer, countOf(query("obligation", { controller: "other" }))))),
  "11028.boost": boost(adjustBoostCount(countOf(query("obligation", { controller: "you" })))),

  // Past Machinations — Incite 1 (data). When Revealed: each player searches the encounter deck and discard pile
  // for a different obligation and reveals it (module docblock: cross-player distinctness not enforced). Shuffle
  // the encounter deck.
  "11029.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      chooseCards("found", { kind: "encounter", zones: ["deck", "discard"], filter: query("obligation") }, { min: 0, max: 1, chooser: thatPlayer }),
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
  "11032.tyrannosaurus-rex-constant": constant(rule({ kind: "attackKeywords", keywords: ["piercing"], attacker: query("minion", { self: true }) })),

  // Time Portal — Hazard (data). Forced Interrupt: when this scheme is defeated, shuffle it into the encounter
  // deck instead of discarding it.
  "11033.time-portal-forced-interrupt": constant(rule({ kind: "defeatedIntoEncounterDeck", target: query("sideScheme", { self: true }) })),
});
