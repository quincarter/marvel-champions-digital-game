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
  eventSource,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  giveTough,
  handCountOf,
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
  valueAtLeast,
  valueAtMost,
  valueEquals,
  varAtLeast,
  varOf,
  whenRevealed,
  yourIdentity,
  you,
  FRIENDLY_CHARACTER,
} from "../../dsl/index.js";

/** "If that card's printed cost is an odd number": a printed cost no card has is not odd (a dashed cost is not a number). */
const ODD_PRINTED_COST = anyOf(
  ...[1, 3, 5, 7, 9, 11, 13, 15].map((n) => valueEquals(printedCostOf(chosen("discardedCard")), n)),
);

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
 * **65019 Krahllak's Blessing**: when the attached villain would take damage from a friendly character (a hero or an
 *   ally; the villain is only ever damaged by those), reduce it by 3, the villain attacks that character, discard this
 *   card.
 * **65026 Darkness Within**: change to hero form, the villain attacks you. Boost: an attack gains overkill.
 * **65027 Embraced by Darkness**: the villain schemes; if 2 or less threat was placed that way (none included), discard
 *   the top 3 cards of the encounter deck. Boost: an attack places 2 threat on the main scheme.
 *
 * Cards (10):
 * - 65012a Archpriestess (villain)
 * - 65013a Daredevil (villain)
 * - 65014a Elektra (villain)
 * - 65015a Gorgon (villain)
 * - 65016a Lady Bullseye (villain)
 * - 65017a White Tiger (villain)
 * - 65018 Art of the Kill (attachment)
 * - 65019 Krahllak's Blessing (attachment)
 * - 65026 Darkness Within (treachery)
 * - 65027 Embraced by Darkness (treachery)
 */
export const SHADOWLAND_DARK_PROTEGE: AbilityRegistry = defineAbilities({
  "65012a.archpriestess-forced-response": forcedResponse(
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
  ),

  "65013a.daredevil-forced-response": forcedResponse(
    on.attacks(query(["identity", "ally"]), { target: { self: true }, byYou: true }),
    { limit: oncePerRoundPerPlayer },
    chooseOne(
      option("Discard 1 random card from your hand", { when: valueAtLeast(handCountOf(you), 1) }, discardAtRandom(1)),
      option("Daredevil attacks you", enemyAttack(self, { against: you })),
    ),
  ),

  "65014a.elektra-forced-interrupt": forcedInterrupt(
    attacksYou,
    moveCards(topOfDeck(1), "discard", "discardedCard"),
    ifThen(ODD_PRINTED_COST, modifyAttack({ atkBonus: 1 }), modifyAttack({ keywords: ["overkill", "piercing"] })),
  ),

  "65015a.gorgon-forced-interrupt": forcedInterrupt(
    attacksYou,
    chooseOne(
      option("Spend a [physical] resource", spendResources({ physical: 1 }, "spent")),
      option("Stun your identity", stun(yourIdentity)),
      option("Take 2 indirect damage", dealIndirectDamage(you, 2)),
    ),
  ),

  "65016a.lady-bullseye-forced-response": forcedResponse(
    attacksYou,
    ifThen(eventDealt("undefended"), dealIndirectDamage(you, 1), placeThreat(1, theMainScheme)),
  ),

  "65017a.white-tiger-forced-response": forcedResponse(
    attacksYou,
    { limit: oncePerRoundPerPlayer },
    enemyAttack(self, { against: you, atkBonus: 1 }),
  ),

  "65018.art-of-the-kill-forced-interrupt": forcedInterrupt(
    on.enemyAttacks(query("enemy"), { againstYou: true }),
    modifyAttack({ atkBonus: 1 }),
    atEndOfAttack(ifThen(eventDealt("defeated"), placeThreat(1, theMainScheme))),
  ),
  "65018.art-of-the-kill-action": alterEgoAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, discard(self)),

  "65019.krahllaks-blessing-forced-interrupt": forcedInterrupt(
    { ...on.damage("host"), sourceIs: FRIENDLY_CHARACTER },
    reduceDamage(3),
    enemyAttack(host, { targetCharacter: eventSource }),
    discard(self),
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
