import {
  action,
  addCounters,
  after,
  chooseOne,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  constant,
  dealDamage,
  defineAbilities,
  doublesResourcesWhilePayingFor,
  draw,
  eachPlayer,
  eventTarget,
  forcedResponse,
  gets,
  heroAction,
  modifyStat,
  modifyStatOf,
  oncePerRound,
  option,
  payPrintedCostOf,
  putIntoPlay,
  query,
  ready,
  removeCounter,
  response,
  rule,
  self,
  spend,
  you,
} from "../../dsl/index.js";

const THAT_PLAYERS_CHARACTERS = query("character", { controlledBy: chosenPlayer() });

/** The Leadership aspect (01066–01074). */
export const LEADERSHIP = defineAbilities({
  // Hawkeye — "Hawkeye enters play with 4 arrow counters on him." (Not the Uses keyword: he stays when they run out.)
  "01066.hawkeye-constant": forcedResponse(after.entersPlay("self"), addCounters("arrow", 4)),
  // Response: After a minion enters play, remove 1 arrow counter from Hawkeye → deal 2 damage to that minion.
  "01066.hawkeye-response": response(after.entersPlay(query("minion")), { cost: removeCounter("arrow") }, dealDamage(2, eventTarget)),
  // Maria Hill — Response: After Maria Hill enters play, each player draws 1 card.
  "01067.maria-hill-response": response(after.entersPlay("self"), draw(1, eachPlayer)),
  // Vision — Action: Spend a [energy] resource → choose THW or ATK. Until the end of the phase, Vision gets +2 to the chosen power. (Limit once per round.)
  "01068.vision-action": action(
    { cost: spend({ energy: 1 }), limit: oncePerRound },
    chooseOne(option("+2 THW until the end of the phase", modifyStat("thw", 2, self, "endOfPhase")), option("+2 ATK until the end of the phase", modifyStat("atk", 2, self, "endOfPhase"))),
  ),
  // Get Ready — Action: Ready an ally.
  "01069.get-ready-action": action(chooseTarget("ally", query("ally")), ready(chosen("ally"))),
  // Lead from the Front — Hero Action: Choose a player. Each character that player controls gets +1 THW and +1 ATK until the end of the phase.
  "01070.lead-from-the-front-action": heroAction(
    choosePlayer(),
    modifyStatOf("thw", 1, THAT_PLAYERS_CHARACTERS, "endOfPhase"),
    modifyStatOf("atk", 1, THAT_PLAYERS_CHARACTERS, "endOfPhase"),
  ),
  // Make the Call — Action: Pay the printed cost of an ally in any player's discard pile → put that ally into play under your control.
  "01071.make-the-call-action": action({ cost: payPrintedCostOf("ally", { zone: "discard", player: "any", query: query("ally") }, { entersPlay: true }) }, putIntoPlay(chosen("ally"), you)),
  // The Power of Leadership — Double the number of resources this card generates while paying for a Leadership (blue) card.
  "01072.the-power-of-leadership-constant": constant(doublesResourcesWhilePayingFor({ aspect: "leadership" })),
  // The Triskelion — Increase your ally limit by 1.
  "01073.the-triskelion-constant": constant(rule({ kind: "allyLimit", amount: 1 })),
  // Inspired — Attached ally gets +1 THW and +1 ATK.
  "01074.inspired-constant": constant(gets("thw", 1, { hostOfSelf: true }), gets("atk", 1, { hostOfSelf: true })),
});
