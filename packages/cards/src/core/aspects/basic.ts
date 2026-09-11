import {
  action,
  after,
  anEnemy,
  atEndOfRound,
  attackAnEnemy,
  chooseOne,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  damageAnEnemy,
  defineAbilities,
  discard,
  discardThis,
  draw,
  exhaustThis,
  exists,
  forcedResponse,
  heal,
  heroAction,
  ifThen,
  interrupt,
  modifyAttack,
  option,
  query,
  ready,
  reduceNextCardCost,
  removeThreatFromAScheme,
  response,
  self,
  spend,
  stun,
  when,
  yourIdentity,
} from "../../dsl/index.js";

/** Basic cards (01083–01093; the resources 01088–01090 have no abilities). */
export const BASIC = defineAbilities({
  // Mockingbird — Response: After Mockingbird enters play, stun an enemy.
  "01083.mockingbird-response": response(after.entersPlay("self"), anEnemy(), stun(chosen("enemy"))),
  // Nick Fury — Forced Response: After Nick Fury enters play, choose one: remove 2 threat from a scheme, draw 3 cards, or deal
  // 4 damage to an enemy. At the end of the round, if Nick Fury is still in play, discard him.
  "01084.nick-fury-forced-response": forcedResponse(
    after.entersPlay("self"),
    chooseOne(
      option("Remove 2 threat from a scheme", { when: exists(query("scheme", { hasThreat: true })) }, removeThreatFromAScheme(2)),
      option("Draw 3 cards", draw(3)),
      option("Deal 4 damage to an enemy", damageAnEnemy(4)),
    ),
    atEndOfRound(ifThen(exists({ self: true }), discard(self))),
  ),
  // Emergency — Interrupt (thwart): When the villain schemes, reduce the amount of threat placed on the scheme by 1.
  "01085.emergency-interrupt": interrupt(when.enemySchemes(query("villain")), { label: "thwart" }, modifyAttack({ threatBonus: -1 })),
  // First Aid — Action: Heal 2 damage from any character.
  "01086.first-aid-action": action(chooseTarget("character", query("character")), heal(2, chosen("character"))),
  // Haymaker — Hero Action (attack): Deal 3 damage to an enemy.
  "01087.haymaker-action": heroAction({ label: "attack" }, attackAnEnemy(3)),
  // Avengers Mansion — Action: Exhaust Avengers Mansion → choose a player. That player draws 1 card.
  "01091.avengers-mansion-action": action({ cost: exhaustThis }, choosePlayer(), draw(1, chosenPlayer())),
  // Helicarrier — Action: Exhaust Helicarrier → choose a player. Reduce the resource cost of the next card that player plays this phase by 1.
  "01092.helicarrier-action": action({ cost: exhaustThis }, choosePlayer(), reduceNextCardCost(chosenPlayer(), 1, "phase")),
  // Tenacity — Hero Action: Spend a [physical] resource and discard this card → ready your hero.
  "01093.tenacity-action": heroAction({ cost: [spend({ physical: 1 }), discardThis] }, ready(yourIdentity)),
});
