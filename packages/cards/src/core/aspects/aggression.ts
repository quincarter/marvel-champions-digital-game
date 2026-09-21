import {
  action,
  after,
  allOf,
  anAttackableEnemy,
  anyOf,
  attack,
  attackAnEnemy,
  chosen,
  constant,
  damageAnEnemy,
  dealDamage,
  defineAbilities,
  discard,
  doublesResourcesWhilePayingFor,
  each,
  exhaustThis,
  exists,
  forcedResponse,
  gets,
  heal,
  heroAction,
  ifThen,
  moveCards,
  paidWith,
  partOf,
  query,
  removeCounter,
  response,
  self,
  thwartAScheme,
  topOfDeck,
  varAtLeast,
  YOUR_HERO,
} from "../../dsl/index.js";

const hulkMilled = (type: "physical" | "energy" | "mental") =>
  anyOf(varAtLeast(`hulk.${type}`), varAtLeast("hulk.wild"));

/** The Aggression aspect (01050–01057). */
export const AGGRESSION = defineAbilities({
  // Hulk — Forced Response: After Hulk attacks, discard the top card of your deck. If that card's printed resource has:
  // [physical] - Deal 2 damage to an enemy. [energy] - Deal 1 damage to each character. [mental] - Discard Hulk. [wild] - All of the above.
  "01050.hulk-forced-response": forcedResponse(
    after.attacks("self"),
    moveCards(topOfDeck(1), "discard", "hulk"),
    ifThen(hulkMilled("physical"), damageAnEnemy(2)),
    ifThen(hulkMilled("energy"), dealDamage(1, each(query("character")))),
    // His own [energy] damage may already have defeated him.
    ifThen(allOf(hulkMilled("mental"), exists({ self: true })), discard(self)),
  ),
  // The four result lines are ingested as separate refs; their behavior is the forced response above.
  "01050.hulk-constant": partOf("01050.hulk-forced-response"),
  "01050.hulk-constant-2": partOf("01050.hulk-forced-response"),
  "01050.hulk-constant-3": partOf("01050.hulk-forced-response"),
  "01050.hulk-constant-4": partOf("01050.hulk-forced-response"),
  // Tigra — Response: After Tigra attacks and defeats a minion, heal 1 damage from her.
  "01051.tigra-response": response(after.attacks("self", { target: query("minion"), defeats: true }), heal(1, self)),
  // Chase Them Down — Response (thwart): After your hero attacks and defeats an enemy, remove 2 threat from a scheme.
  "01052.chase-them-down-response": response(
    after.attacks(YOUR_HERO, { defeats: true }),
    { label: "thwart" },
    thwartAScheme(2),
  ),
  // Relentless Assault — Hero Action (attack): Deal 5 damage to a minion. If you paid for this card using a [physical] resource,
  // this attack gains overkill.
  "01053.relentless-assault-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("minion", "minion"),
    ifThen(paidWith("physical"), attack(5, chosen("minion"), { overkill: true }), attack(5, chosen("minion"))),
  ),
  // Uppercut — Hero Action (attack): Deal 5 damage to an enemy.
  "01054.uppercut-action": heroAction({ label: "attack" }, attackAnEnemy(5)),
  // The Power of Aggression — Double the number of resources this card generates while paying for an Aggression (red) card.
  "01055.the-power-of-aggression-constant": constant(doublesResourcesWhilePayingFor({ aspect: "aggression" })),
  // Tac Team — Uses (3 attack counters). Action: Exhaust Tac Team and remove 1 attack counter from it → deal 2 damage to an enemy.
  "01056.tac-team-action": action({ cost: [exhaustThis, removeCounter("attack")] }, damageAnEnemy(2)),
  // Combat Training — Your hero gets +1 ATK. ("Your" = the player who controls this upgrade.)
  "01057.combat-training-constant": constant(gets("atk", 1, YOUR_HERO)),
});
