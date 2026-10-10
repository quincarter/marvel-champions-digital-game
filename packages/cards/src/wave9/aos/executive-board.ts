import { AOS_BOARD_MEMBER_LOG, trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  addCounters,
  andThen,
  bindTargets,
  boost,
  chooseOneBy,
  chooseTarget,
  chosen,
  countOf,
  countersOn,
  dealDamage,
  defineAbilities,
  each,
  endGame,
  FRIENDLY_CHARACTER,
  firstPlayer,
  flipCard,
  forEachCard,
  forcedResponse,
  heal,
  heroAction,
  ifElse,
  inMode,
  on,
  option,
  placeThreat,
  query,
  remainingHpOf,
  removeThreat,
  removeCountersFrom,
  resolveWhenRevealedOf,
  self,
  spend,
  spendResources,
  stateCheck,
  superlative,
  theMainScheme,
  theVillain,
  valueAtLeast,
  whenRevealed,
} from "../../dsl/index.js";

const BOARD_MEMBER = trait("BOARD MEMBER");
/** "Each Board Member card": either face, in play (the environments and the attachments). */
const BOARD_MEMBER_CARDS = query([], { trait: BOARD_MEMBER });
/** "Board Member attachments". */
const BOARD_MEMBER_ATTACHMENTS = query("attachment", { trait: BOARD_MEMBER });

/**
 * "If there are 4 or more secret counters here (3 or more instead in expert mode), flip this card." The flip puts the
 * attachment face up attached to the villain (its `attachesTo` and `statModifiers` are data). Owner answer Q1 = A: the
 * secret counters stay on the card through the flip, though RRG 1.8 "Flip" (p. 20) discards every token on a change of
 * card type; `AOS_BOARD_MEMBER_LOG.secretsStayOnFlip` keeps that decision in one place.
 */
const flipAtSecrets = () =>
  stateCheck(
    valueAtLeast(countersOn(self, "secret"), ifElse(inMode("expert"), 3, 4)),
    flipCard(self, { keepCounters: AOS_BOARD_MEMBER_LOG.secretsStayOnFlip ? [AOS_BOARD_MEMBER_LOG.counter] : [] }),
  );
/** "If there are 3 Board Member attachments in play, the players lose the game." */
const lossAtThree = () =>
  stateCheck(valueAtLeast(countOf(BOARD_MEMBER_ATTACHMENTS), 3), endGame("loss", "cardAbility"));
/** "After a secret counter is placed here": a forced response answering the placing once (RRG 1.8 "Forced Response"). */
const afterSecretPlacedHere = on.countersPlaced("secret", "self");

/**
 * "You may spend X [type] resources to prevent X of these counters from being placed", played one Board Member card at
 * a time: for each, the first-listed choice is to spend 1 resource of the type (an option only a player who can pay
 * may choose) to prevent that card's counter, or to let it be placed. Choosing which X cards get no counter and
 * paying X in total comes to the same thing as X single payments (docs/phase7-wave9.md section 3.28).
 */
const placeSecrets = (type: "energy" | "mental" | "physical") =>
  forEachCard(
    "member",
    each(BOARD_MEMBER_CARDS),
    chooseOneBy(
      firstPlayer,
      option(`Spend 1 [${type}] resource to prevent this counter`, spendResources({ [type]: 1 }, "prevented")),
      option("Place the counter", addCounters("secret", 1, chosen("member"))),
    ),
  );

/**
 * S.H.I.E.L.D. Executive Board (Agents of S.H.I.E.L.D.; docs/phase7-wave9.md sections 3.26 to 3.28, owner answers Q1
 * and Q11 of section 4.1). Setup, Permanent, Incite 1, the attachment faces' "Attach to the villain" and their stat
 * boxes (+1 ATK, +1 SCH, +1 ATK) are data.
 *
 * **Board Member environments (50181a to 50183a)**: a state check flips the card at 4 secret counters (3 in expert
 * mode) to its attachment face, which keeps its secret counters (Q1 = A). The Hero Action spends two resources of the
 * card's type, removes a secret counter, and only then (RRG 1.8 "'Then'", p. 44) does its effect: heal 1 damage from a
 * friendly character, remove 2 threat from a scheme, deal 2 damage to an enemy.
 *
 * **Board Member attachments (50181b to 50183b)**: a Forced Response answers each placing of secret counters here
 * once, however many were placed. The first player chooses on an encounter card's behalf (RRG 1.8 "First Player",
 * p. 19). The last paragraph is a state check: 3 Board Member attachments in play lose the game.
 *
 * **A.I.M. Interference (50184a to 50184c)**: When Revealed places 1 secret counter on each Board Member card, a
 * payment of 1 [type] resource preventing one placing at a time. The boost resolves the When Revealed ability alone
 * (no incite: the card is not revealed).
 *
 * Cards (9):
 * - 50181a Chief Medical Officer (environment)
 * - 50181b Medical Officer's Aid (attachment)
 * - 50182a Chief Surveillance Officer (environment)
 * - 50182b Surveillance Officer's Aid (attachment)
 * - 50183a Chief Tactical Officer (environment)
 * - 50183b Tactical Officer's Aid (attachment)
 * - 50184a A.I.M. Interference ([energy]) (treachery)
 * - 50184b A.I.M. Interference ([mental]) (treachery)
 * - 50184c A.I.M. Interference ([physical]) (treachery)
 */
export const EXECUTIVE_BOARD: AbilityRegistry = defineAbilities({
  "50181a.chief-medical-officer-constant": flipAtSecrets(),
  "50181a.chief-medical-officer-action": heroAction(
    { cost: spend({ energy: 2 }) },
    removeCountersFrom(self, "secret", 1),
    andThen(chooseTarget("friend", FRIENDLY_CHARACTER), heal(1, chosen("friend"))),
  ),
  "50181b.medical-officers-aid-forced-response": forcedResponse(
    afterSecretPlacedHere,
    chooseOneBy(
      firstPlayer,
      option("Heal 2 damage from the villain", heal(2, theVillain)),
      option(
        "Deal 1 damage to the friendly character with the fewest remaining hit points",
        bindTargets("fewest", superlative("lowest", each(FRIENDLY_CHARACTER), remainingHpOf(chosen("candidate")))),
        chooseTarget("target", { inSlot: "fewest" }, { chooser: firstPlayer }),
        dealDamage(1, chosen("target")),
      ),
    ),
  ),
  "50181b.medical-officers-aid-constant": lossAtThree(),

  "50182a.chief-surveillance-officer-constant": flipAtSecrets(),
  "50182a.chief-surveillance-officer-action": heroAction(
    { cost: spend({ mental: 2 }) },
    removeCountersFrom(self, "secret", 1),
    andThen(chooseTarget("scheme", query("scheme")), removeThreat(2, chosen("scheme"))),
  ),
  "50182b.surveillance-officers-aid-forced-response": forcedResponse(
    afterSecretPlacedHere,
    placeThreat(2, theMainScheme),
  ),
  "50182b.surveillance-officers-aid-constant": lossAtThree(),

  "50183a.chief-tactical-officer-constant": flipAtSecrets(),
  "50183a.chief-tactical-officer-action": heroAction(
    { cost: spend({ physical: 2 }) },
    removeCountersFrom(self, "secret", 1),
    andThen(chooseTarget("enemy", query("enemy")), dealDamage(2, chosen("enemy"))),
  ),
  "50183b.tactical-officers-aid-forced-response": forcedResponse(
    afterSecretPlacedHere,
    chooseTarget("target", FRIENDLY_CHARACTER, { chooser: firstPlayer }),
    dealDamage(2, chosen("target")),
  ),
  "50183b.tactical-officers-aid-constant": lossAtThree(),

  "50184a.when-revealed": whenRevealed(placeSecrets("energy")),
  "50184a.boost": boost(resolveWhenRevealedOf(self)),
  "50184b.when-revealed": whenRevealed(placeSecrets("mental")),
  "50184b.boost": boost(resolveWhenRevealedOf(self)),
  "50184c.when-revealed": whenRevealed(placeSecrets("physical")),
  "50184c.boost": boost(resolveWhenRevealedOf(self)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const EXECUTIVE_BOARD_SKIPPED: Readonly<Record<string, string>> = {};
