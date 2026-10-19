import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  ENCOUNTER_SIDE_SCHEME,
  action,
  addCounters,
  alterEgoAction,
  atEndOfThwart,
  attachCard,
  changeForm,
  chooseTarget,
  chooseTargetCost,
  chosen,
  constant,
  damageThisCardCost,
  dealDamage,
  defineAbilities,
  discard,
  discardThis,
  each,
  eventAmount,
  eventDealt,
  eventPlayer,
  exhaustThis,
  exists,
  forcedResponse,
  gets,
  giveTough,
  heroInterrupt,
  ifThen,
  inPlayAreaOf,
  interrupt,
  isAlterEgo,
  modifyThwart,
  named,
  on,
  playFromDeckReducingCost,
  preventDamage,
  query,
  remainingHpOf,
  removeCounter,
  response,
  self,
  sum,
  takeDamage,
  theVillain,
  valueAtLeast,
  YOUR_IDENTITY,
  you,
} from "../../../dsl/index.js";

const EVIDENCE = "evidence";
const ALIAS = named("Alias Investigations");
const NON_ELITE_MINION = { ...query("minion"), withoutTrait: trait("Elite") };
/** "2 less than that minion's remaining hit points" (a cost below 0 is 0). */
const CAMCORDER_X = sum(remainingHpOf(chosen("minion")), -2);

/**
 * Wave 11 scripting module `jj/jessica-jones/support-upgrades-allies` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (8):
 * - 61003 Luke Cage (ally)
 * - 61008 Calling in Favors (support)
 * - 61009 4K Digital Camcorder (upgrade)
 * - 61010 Circumstantial Evidence (upgrade)
 * - 61011 Leather Jacket (upgrade)
 * - 61012 "Now I'm Ticked Off!" (upgrade)
 * - 61013 Reluctant Flier (upgrade)
 * - 61014 Stakeout (upgrade)
 *
 * **61003**: Toughness is the keyword; the action pays exhaust and 1 damage to Luke Cage himself. **61008**: the search
 * is the play (Q102 = A: logged as played from the hand), the deck shuffles after. **61009**: the minion is chosen as
 * part of the cost, so X is read from it. **61011**: the +2 DEF names Jessica Jones, so it is on her identity wherever
 * the upgrade is attached. **61012**: only the form change carries the "if you are in alter-ego form" (its own
 * sentence; the damage and discard are unjoined sentences and always resolve, owner reading B, wave 10 49A and RRG 1.8
 * "Then" p. 43); a villain scheme is the activation against an alter-ego; "that player" is the player activated against.
 * RRG 1.8 pp. 24, 26: the (attack) label makes a stunned identity cancel the whole forced response, and the stun is
 * removed; a form change inside the ability is the identity changing form on the player's behalf (p. 24 "Initiating Abilities").
 * **61013**: "at least 3" is read from the pending damage.
 * **61014**: Stakeout is played unattached, so "in your play area" is true until it is attached.
 */
export const JJ_JESSICA_JONES_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "61003.luke-cage-action": action({ cost: [exhaustThis, damageThisCardCost(1)] }, giveTough(self)),

  "61008.calling-in-favors-action": alterEgoAction(
    { cost: [removeCounter(EVIDENCE, 2, { from: ALIAS }), exhaustThis] },
    playFromDeckReducingCost(2, you, { filter: query("ally"), asIfInHand: true }),
  ),

  "61009.4k-digital-camcorder-action": alterEgoAction(
    {
      cost: [
        exhaustThis,
        chooseTargetCost(NON_ELITE_MINION, "minion"),
        removeCounter(EVIDENCE, CAMCORDER_X, { from: ALIAS }),
      ],
    },
    discard(chosen("minion")),
  ),

  "61010.circumstantial-evidence-response": response(
    on.defeated(query("enemy")),
    { cost: exhaustThis },
    addCounters(EVIDENCE, 1, ALIAS),
  ),

  "61011.leather-jacket-constant": constant(
    gets("def", 2, query("identity", { controller: "you", name: "Jessica Jones" })),
  ),
  "61011.leather-jacket-response": response(on.defends(YOUR_IDENTITY), addCounters(EVIDENCE, 1, ALIAS)),

  "61012.now-im-ticked-off-forced-response": forcedResponse(
    on.enemyActivates(query("villain")),
    { label: "attack" },
    ifThen(isAlterEgo(you), changeForm(you, "hero")),
    dealDamage(5, theVillain),
    dealDamage(5, each(query("minion", { engagedWithPlayer: eventPlayer }))),
    discard(self),
  ),

  "61013.reluctant-flier-interrupt": heroInterrupt(
    on.damage(YOUR_IDENTITY, { fromAttack: true }),
    { label: "defense", cost: discardThis, while: valueAtLeast(eventAmount, 3) },
    preventDamage(),
    takeDamage(1),
  ),

  "61014.stakeout-action": action(
    { while: exists({ self: true, ...inPlayAreaOf() }) },
    chooseTarget("scheme", { ...ENCOUNTER_SIDE_SCHEME, withoutKeyword: "permanent" }),
    attachCard(self, chosen("scheme")),
  ),
  "61014.stakeout-interrupt": interrupt(
    { on: "thwart", targetIs: { hostOfSelf: true } },
    modifyThwart({ extraThreat: 2 }),
    atEndOfThwart(ifThen(eventDealt("defeated"), addCounters(EVIDENCE, 2, ALIAS))),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const JJ_JESSICA_JONES_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
