import {
  action,
  after,
  constant,
  countOf,
  damageAnEnemy,
  defineAbilities,
  doublesResourcesWhilePayingFor,
  eventAmount,
  exhaustThis,
  gets,
  heroAction,
  heroInterrupt,
  ifElse,
  instead,
  paidWith,
  query,
  removeCounter,
  removeThreatFromAScheme,
  response,
  takeDamage,
  thwartAScheme,
  when,
  YOUR_HERO,
} from "../../dsl/index.js";

/** The Justice aspect (01058–01065). */
export const JUSTICE = defineAbilities({
  // Daredevil — Response: After Daredevil thwarts, deal 1 damage to an enemy.
  "01058.daredevil-response": response(after.thwarts("self"), damageAnEnemy(1)),
  // Jessica Jones — Jessica Jones gets +1 THW for each side scheme in play.
  "01059.jessica-jones-constant": constant(gets("thw", countOf(query("sideScheme")), { self: true })),
  // For Justice! — Hero Action (thwart): Remove 3 threat from a scheme (4 threat instead if you paid for this card using a [mental] resource).
  "01060.for-justice-action": heroAction({ label: "thwart" }, thwartAScheme(ifElse(paidWith("mental"), 4, 3))),
  // Great Responsibility — Hero Interrupt: When any amount of threat would be placed on a scheme, you take it as damage instead.
  "01061.great-responsibility-interrupt": heroInterrupt(when.threatPlaced(), instead(takeDamage(eventAmount))),
  // The Power of Justice — Double the number of resources this card generates while paying for a Justice (yellow) card.
  "01062.the-power-of-justice-constant": constant(doublesResourcesWhilePayingFor({ aspect: "justice" })),
  // Interrogation Room — Response: After you defeat a minion, exhaust Interrogation Room → remove 1 threat from a scheme.
  "01063.interrogation-room-response": response(after.defeated(query("minion"), { byYou: true }), { cost: exhaustThis }, removeThreatFromAScheme(1)),
  // Surveillance Team — Uses (3 snoop counters). Action: Exhaust Surveillance Team and remove 1 snoop counter from it → remove 1 threat from a scheme.
  "01064.surveillance-team-action": action({ cost: [exhaustThis, removeCounter("snoop")] }, removeThreatFromAScheme(1)),
  // Heroic Intuition — Your hero gets +1 THW. ("Your" = the player who controls this upgrade.)
  "01065.heroic-intuition-constant": constant(gets("thw", 1, YOUR_HERO)),
});
