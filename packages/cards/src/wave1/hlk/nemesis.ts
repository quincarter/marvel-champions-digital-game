import {
  after,
  bindTargets,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  each,
  firstPlayer,
  forcedResponse,
  ifThen,
  inPlay,
  moveCards,
  not,
  query,
  rule,
  statOf,
  surge,
  takeDamage,
  topOfDeck,
  varAtLeast,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import { cardName } from "../names.js";
import { enemyAttackCharacter, refMatchesAnywhere, superlative } from "./local.js";

const ABOMINATION_NAME = cardName("10026");

/**
 * Hulk's nemesis set: Abomination (10026), Total Destruction (10027, side scheme), Clash of the Titans (10028,
 * treachery ×3).
 */
export const HLK_NEMESIS = defineAbilities({
  // Abomination — [star] Forced Response: After Abomination attacks you, discard the top card of your deck. If a
  // [physical] resource was discarded this way, take 2 damage. "You" is the attacked player
  // (`after.enemyAttacks("self", { againstYou: true })`, the same shape as `packages/engine/src/enemy-actions.test.ts`'s
  // "Radioactive Man" case). `refMatchesAnywhere` (local): the discarded card is in the discard pile, not in play,
  // by the time this is checked (RRG "refMatches", `spec.ts`).
  "10026.abomination-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    moveCards(topOfDeck(1, you), "discard", "milled"),
    ifThen(
      refMatchesAnywhere(chosen("milled"), query("resource", { printedResource: "physical" })),
      takeDamage(2, you),
    ),
  ),

  // Total Destruction — Threat cannot be removed from this scheme while Abomination is in play.
  "10027.total-destruction-constant": constant(
    rule({ kind: "threatCannotBeRemoved", target: { self: true }, while: inPlay(ABOMINATION_NAME) }),
  ),

  // Clash of the Titans — When Revealed: The enemy with the highest ATK attacks the hero or ally with the highest ATK
  // (first player decides ties.) If no attack was made this way, this card gains surge.
  // Each `superlative` keeps every tied card; the first player then picks one of them. With no hero or ally (every
  // player in alter-ego form, no allies) nothing is attacked, so the card surges.
  "10028.when-revealed": whenRevealed(
    bindTargets("strongestEnemies", superlative("highest", each(query("enemy")), statOf(chosen("candidate"), "atk"))),
    chooseTarget("attacker", { inSlot: "strongestEnemies" }, { chooser: firstPlayer }),
    bindTargets(
      "strongestCharacters",
      superlative("highest", each({ categories: ["hero", "ally"] }), statOf(chosen("candidate"), "atk")),
    ),
    chooseTarget("defender", { inSlot: "strongestCharacters" }, { chooser: firstPlayer }),
    enemyAttackCharacter(chosen("attacker"), chosen("defender"), "clash"),
    ifThen(not(varAtLeast("clash.made")), surge()),
  ),
});

/** Every Hulk nemesis-set ability is scripted now; kept so `./index.ts`'s exports are unchanged. */
export const HLK_NEMESIS_SKIPPED = [] as const;
