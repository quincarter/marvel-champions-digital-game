import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  addAccelerationToken,
  adjustBoostCount,
  attacksGainKeywords,
  boost,
  constant,
  defineAbilities,
  discardFromHand,
  gainsKeyword,
  query,
  self,
  valueAtLeast,
  victoryDisplayCount,
  whenRevealed,
} from "../../dsl/index.js";

const AIM = trait("A.I.M.");
/** "Each A.I.M. minion in the victory display": the victory display is out of play, so it is counted, not queried. */
const AIM_MINIONS_IN_VICTORY_DISPLAY = victoryDisplayCount(query("minion", { trait: AIM }));

/**
 * Modular encounter set `scientist_supreme` (Agents of S.H.I.E.L.D.; docs/phase7-wave9.md sections 3.1 and 3.35).
 * Victory -1, Villainous, Vulnerable (the engine's keyword rule, section 3.1), Surge on Diplomatic Sanctions, boost
 * icons, the acceleration icon and the side scheme's starting threat are data.
 *
 * **Scientist Supreme (50125)**: his attacks gain piercing and ranged.
 *
 * **Monica Rappaccini (50126)**: gains villainous while Scientist Supreme is in the victory display. The scan prints
 * only "Victory -1. Vulnerable." (docs/phase7-wave9.md section 1.14 item 2), so the keyword is not printed.
 *
 * **Diplomatic Immunity (50127)**: When Revealed: places 1 acceleration token on this side scheme for each A.I.M.
 * minion in the victory display.
 *
 * **Diplomatic Sanctions (50128)**: When Revealed: the revealing player discards 1 card from their hand for each A.I.M.
 * minion in the victory display. Boost: this card gains 1 boost icon for each of them.
 *
 * Cards (4):
 * - 50125 Scientist Supreme (minion)
 * - 50126 Monica Rappaccini (minion)
 * - 50127 Diplomatic Immunity (side_scheme)
 * - 50128 Diplomatic Sanctions (treachery)
 */
export const SCIENTIST_SUPREME: AbilityRegistry = defineAbilities({
  "50125.scientist-supreme-constant": constant(
    attacksGainKeywords(["piercing", "ranged"], { attacker: { self: true } }),
  ),

  "50126.monica-rappaccini-constant": constant(
    gainsKeyword(
      { name: "villainous" },
      { self: true },
      { while: valueAtLeast(victoryDisplayCount(query("minion", { name: "Scientist Supreme" })), 1) },
    ),
  ),

  "50127.when-revealed": whenRevealed(addAccelerationToken(self, AIM_MINIONS_IN_VICTORY_DISPLAY)),

  "50128.when-revealed": whenRevealed(discardFromHand(AIM_MINIONS_IN_VICTORY_DISPLAY)),
  "50128.boost": boost(adjustBoostCount(AIM_MINIONS_IN_VICTORY_DISPLAY)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SCIENTIST_SUPREME_SKIPPED: Readonly<Record<string, string>> = {};
