import type { AbilityRegistry } from "@mc/engine";
import {
  activationIs,
  alterEgoAction,
  anyOf,
  atEndOfAttack,
  boost,
  canTakeStatus,
  cards,
  changeForm,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  dealAsEncounterCard,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardAtRandom,
  discardEncounterCards,
  enemyAttack,
  enemyScheme,
  eventDealt,
  countOf,
  retargetAttack,
  revealCard,
  defeatingPlayer,
  each,
  exists,
  selectCards,
  encounterCards,
  bindTargets,
  superlative,
  forEachCard,
  whenDefeated,
  takeDamage,
  handCountOf,
  valueAtLeast,
  actingCharacter,
  eventSource,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  giveTough,
  host,
  ifThen,
  modifyAttack,
  moveCards,
  not,
  on,
  option,
  oncePerRoundPerPlayer,
  placeThreat,
  printedCostOf,
  query,
  reduceDamage,
  self,
  spend,
  spendResources,
  stun,
  theMainScheme,
  theVillain,
  topOfDeck,
  valueAtMost,
  valueEquals,
  varAtLeast,
  varOf,
  whenRevealed,
  you,
} from "../../dsl/index.js";

/** "If that card's printed cost is an odd number": a printed cost no card has is not odd (a dashed cost is not a number). */
const ODD_PRINTED_COST = anyOf(
  ...[1, 3, 5, 7, 9, 11, 13, 15].map((n) => valueEquals(printedCostOf(chosen("discardedCard")), n)),
);

/** "Damage from a character": a source that is, or acts for, a character (`TargetQuery.actsFor`). */
const DAMAGE_FROM_A_CHARACTER = { actsFor: query("character") };

/** "Attacks you": the six Dark Protege villains' triggers, `againstYou` read by timing (an interrupt: the attacked player). */
const attacksYou = on.enemyAttacks("self", { againstYou: true });

/**
 * Shadowland, the Dark Protege set (MC65, scenario 1; docs/phase7-shadowland.md section 6). The six villains' A sides
 * are scripted here where their printed text stands alone; Linked is data on the ten linked cards (M7).
 *
 * **65012a Archpriestess**: "After Archpriestess attacks you, give a minion a tough status card. If no tough status
 *   card was placed this way, discard the top 3 cards of the encounter deck, then deal 1 minion discarded this way to
 *   yourself as a facedown encounter card." Nothing prints "choose", so the first player picks the minion and the
 *   discarded minion (RRG 1.8 "First Player", p. 19); only a minion that can take a tough status card is a target
 *   (one already holding one is not), and "placed" reads the status card actually given.
 * **65013a Daredevil**: after you or an ally you control attacks him, "choose: either discard 1 random card from your
 *   hand, or Daredevil attacks you" (once per round per player). The discard is offered only to a player with a card in
 *   hand (an option that cannot be carried out is not one to choose, RRG 1.8 "Choose (Option)", p. 12).
 * **65014a Elektra**: the top card of your deck is discarded and its printed cost read: odd gives +1 ATK, otherwise
 *   (even, zero, a dashed cost, or no card) overkill and piercing. The DSL has no parity value yet, so odd is the list
 *   of printed costs 1 to 15.
 * **65015a Gorgon**: choose to spend a physical resource, stun your identity, or take 2 indirect damage.
 * **65016a Lady Bullseye**: after her attack, 1 indirect damage if it was undefended, otherwise 1 threat on the main scheme.
 * **65017a White Tiger**: after she attacks you, she attacks you again with +1 ATK (once per round per player, so the
 *   second attack's own response is stopped by the limit).
 * **65018 Art of the Kill**: an enemy attacking you gets +1 ATK; if the attack defeats a character, 1 threat on the main
 *   scheme (read at the attack's end, as every "if that attack defeats"). Alter-Ego Action: spend one of each
 *   energy, mental and physical to discard it.
 * **65019 Krahllak's Blessing**: when the attached villain would take damage from a character, reduce it by 3, the
 *   villain attacks that character, discard this card. "From a character" is the character the damage's source acts
 *   for (owner decision 2026-10-20, docs/phase7-shadowland.md; RRG 1.8 "You, Your", p. 49): an identity, ally or enemy
 *   itself, the identity for an event its player plays or an upgrade it controls, labeled "(attack)" or not; never a
 *   support, a player side scheme or an encounter card, whoever owns it. An enemy source has nobody to be attacked
 *   (enemies attack players), so the damage is reduced and no attack is made.
 * **B sides (65012b to 65017b)**: "Steady. Toughness." is data; each star ability is the A side's, registered again under
 *   the b ref, except White Tiger's second attack, which has no "+1 ATK" on B. Which side's abilities are live follows the
 *   villain's faceup side.
 * **65020-65025 (linked cards)**: Archpriestess minion's attacks, Gorgon minion's stun, Lady Bullseye minion's ranged
 *   attack on an ally, White Tiger minion's indirect damage, and the two side schemes' When Defeated, by the
 *   defeating player. Villainous and Linked are data.
 * **65026 Darkness Within**: change to hero form, the villain attacks you. Boost: an attack gains overkill.
 * **65027 Embraced by Darkness**: the villain schemes; if 2 or less threat was placed that way (none included), discard
 *   the top 3 cards of the encounter deck. Boost: an attack places 2 threat on the main scheme.
 *
 * Cards (16):
 * - 65012a Archpriestess (villain)
 * - 65013a Daredevil (villain)
 * - 65014a Elektra (villain)
 * - 65015a Gorgon (villain)
 * - 65016a Lady Bullseye (villain)
 * - 65017a White Tiger (villain)
 * - 65018 Art of the Kill (attachment)
 * - 65019 Krahllak's Blessing (attachment)
 * - 65020 Archpriestess (minion)
 * - 65021 Gorgon (minion)
 * - 65022 Lady Bullseye (minion)
 * - 65023 White Tiger (minion)
 * - 65024 Rite of Offering (side_scheme)
 * - 65025 Shadowy Plot (side_scheme)
 * - 65026 Darkness Within (treachery)
 * - 65027 Embraced by Darkness (treachery)
 */
/** The A and B sides of a villain print the same ability unless noted; one definition is registered under both refs. */
const archpriestessResponse = () =>
  forcedResponse(
    attacksYou,
    chooseTarget("minion", query("minion", { ...canTakeStatus("tough") }), { chooser: firstPlayer }),
    giveTough(chosen("minion"), { bind: "tough" }),
    ifThen(not(varAtLeast("tough.amount", 1)), [
      discardEncounterCards(3, { bind: "discarded" }),
      // "Then deal 1 minion discarded this way": a plain sequence, not `andThen`, because the unresolved choice above
      // (no minion could take the status card) would otherwise mark this whole frame as a failed "then" (RRG 1.8 p. 44).
      chooseCards("dealt", cards(chosen("discarded"), query("minion")), { min: 1, max: 1, chooser: firstPlayer }),
      dealAsEncounterCard(chosen("dealt"), you),
    ]),
  );

const daredevilResponse = () =>
  forcedResponse(
    on.attacks(query(["identity", "ally"]), { target: { self: true }, byYou: true }),
    { limit: oncePerRoundPerPlayer },
    chooseOne(
      option("Discard 1 random card from your hand", { when: valueAtLeast(handCountOf(you), 1) }, discardAtRandom(1)),
      option("Daredevil attacks you", enemyAttack(self, { against: you })),
    ),
  );

const elektraInterrupt = () =>
  forcedInterrupt(
    attacksYou,
    moveCards(topOfDeck(1), "discard", "discardedCard"),
    ifThen(ODD_PRINTED_COST, modifyAttack({ atkBonus: 1 }), modifyAttack({ keywords: ["overkill", "piercing"] })),
  );

const gorgonInterrupt = () =>
  forcedInterrupt(
    attacksYou,
    chooseOne(
      option("Spend a [physical] resource", spendResources({ physical: 1 }, "spent")),
      option(
        "Stun your identity",
        chooseTarget("identity", query("identity", { controller: "you", ...canTakeStatus("stunned") })),
        stun(chosen("identity")),
      ),
      option("Take 2 indirect damage", dealIndirectDamage(you, 2)),
    ),
  );

const bullseyeResponse = () =>
  forcedResponse(
    attacksYou,
    ifThen(eventDealt("undefended"), dealIndirectDamage(you, 1), placeThreat(1, theMainScheme)),
  );

export const SHADOWLAND_DARK_PROTEGE: AbilityRegistry = defineAbilities({
  "65012a.archpriestess-forced-response": archpriestessResponse(),
  "65012b.archpriestess-forced-response": archpriestessResponse(),

  "65013a.daredevil-forced-response": daredevilResponse(),
  "65013b.daredevil-forced-response": daredevilResponse(),

  "65014a.elektra-forced-interrupt": elektraInterrupt(),
  "65014b.elektra-forced-interrupt": elektraInterrupt(),

  "65015a.gorgon-forced-interrupt": gorgonInterrupt(),
  "65015b.gorgon-forced-interrupt": gorgonInterrupt(),

  "65016a.lady-bullseye-forced-response": bullseyeResponse(),
  "65016b.lady-bullseye-forced-response": bullseyeResponse(),

  "65017a.white-tiger-forced-response": forcedResponse(
    attacksYou,
    { limit: oncePerRoundPerPlayer },
    enemyAttack(self, { against: you, atkBonus: 1 }),
  ),
  // The B side prints no "+1 ATK" (the A side's second attack has it).
  "65017b.white-tiger-forced-response": forcedResponse(
    attacksYou,
    { limit: oncePerRoundPerPlayer },
    enemyAttack(self, { against: you }),
  ),

  "65018.art-of-the-kill-forced-interrupt": forcedInterrupt(
    on.enemyAttacks(query("enemy"), { againstYou: true }),
    modifyAttack({ atkBonus: 1 }),
    atEndOfAttack(ifThen(eventDealt("defeated"), placeThreat(1, theMainScheme))),
  ),
  "65018.art-of-the-kill-action": alterEgoAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, discard(self)),

  "65019.krahllaks-blessing-forced-interrupt": forcedInterrupt(
    { ...on.damage("host"), sourceIs: DAMAGE_FROM_A_CHARACTER },
    reduceDamage(3),
    enemyAttack(host, { targetCharacter: actingCharacter(eventSource) }),
    discard(self),
  ),

  // Linked is data. "Each other minion engaged with you": one attack per minion, the revealing player's. "If no attack
  // was made this way" reads the attacks made (a stunned minion's attack is replaced, RRG 1.8 "Stun, Stunned", p. 41).
  "65020.when-revealed": whenRevealed(
    forEachCard(
      "other",
      each(query("minion", { engagedWithPlayer: you, not: { self: true } })),
      enemyAttack(chosen("other"), { against: you, bind: "hit" }),
      { bind: "attacks" },
    ),
    ifThen(not(varAtLeast("attacks.hit.made")), discardEncounterCards(3)),
  ),

  "65021.gorgon-forced-response": forcedResponse(
    on.attacks(query("character"), { target: { self: true }, damages: true }),
    stun(actingCharacter(eventSource)),
  ),

  // Same attack, retargeted (RRG 1.8 "Interrupt" p. 25; "Attack (Enemy Activation)" p. 8: an attack on an ally you
  // control still attacks you); Crossfire precedent (hood 24026), wave 4 section 3.21. Ties: first player picks (RRG 1.8
  // "First Player" p. 19). With no ally the attack stays on you, still ranged ("if able"). "Attacks you" is your
  // identity (RRG 1.8 "You, Your", p. 49).
  "65022.lady-bullseye-forced-interrupt": forcedInterrupt(
    { ...attacksYou, youAreIdentity: true },
    modifyAttack({ keywords: ["ranged"] }),
    ifThen(exists(query("ally", { controller: "you" })), [
      bindTargets(
        "highest",
        superlative("highest", each(query("ally", { controller: "you" })), printedCostOf(chosen("candidate"))),
      ),
      ifThen(
        valueAtLeast(countOf({ inSlot: "highest" }), 2),
        chooseTarget("bullseye-target", { inSlot: "highest" }, { chooser: firstPlayer }),
        bindTargets("bullseye-target", chosen("highest")),
      ),
      retargetAttack(chosen("bullseye-target")),
    ]),
  ),

  "65023.when-revealed": whenRevealed(dealIndirectDamage(you, 2)),

  "65024.when-defeated": whenDefeated(
    ifThen(
      exists(query("ally", { controlledBy: defeatingPlayer })),
      [
        chooseTarget("ally", query("ally", { controlledBy: defeatingPlayer }), { chooser: defeatingPlayer }),
        moveCards(cards(chosen("ally")), "removedFromGame"),
      ],
      takeDamage(3, defeatingPlayer),
    ),
  ),

  // Reveal first, then discard the rest, as printed.
  "65025.when-defeated": whenDefeated(
    selectCards("looked", encounterCards(["deck"], undefined, 3)),
    chooseCards("revealed", cards(chosen("looked")), { min: 1, max: 1, chooser: defeatingPlayer }),
    revealCard(chosen("revealed"), defeatingPlayer, { fromEncounterDeck: true }),
    // Only the looked-at cards still in the encounter deck: a surge from the revealed card may have revealed one of them
    // (RRG 1.8 "Surge" p. 42), and a card now in play or dealt to a player is not "the rest" to discard.
    selectCards("rest", encounterCards(["deck"], { inSlot: "looked", excludeSlots: ["revealed"] })),
    moveCards(cards(chosen("rest")), "discard"),
  ),

  "65026.when-revealed": whenRevealed(changeForm(you, "hero"), enemyAttack(theVillain, { against: you })),
  "65026.boost": boost(ifThen(activationIs("attack"), modifyAttack({ overkill: true }))),

  "65027.when-revealed": whenRevealed(
    enemyScheme(theVillain, { against: you, bind: "scheme" }),
    ifThen(valueAtMost(varOf("scheme.threatPlaced"), 2), discardEncounterCards(3)),
  ),
  "65027.boost": boost(ifThen(activationIs("attack"), placeThreat(2, theMainScheme))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_DARK_PROTEGE_SKIPPED: Readonly<Record<string, string>> = {};
