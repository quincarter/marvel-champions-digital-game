import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  aScheme,
  anAttackableEnemy,
  allOf,
  attack,
  attacksGainKeywords,
  chooseCards,
  chosen,
  constant,
  defeatingPlayer,
  defineAbilities,
  eachPlayer,
  eventTarget,
  exhaustThis,
  exhaustYourHero,
  gets,
  heal,
  heroResponse,
  isHero,
  on,
  onlyCharacterRemovesThreat,
  paidTypeCount,
  putIntoPlay,
  query,
  readsPaymentTypesOf,
  refMatches,
  removeThreat,
  response,
  self,
  shuffleDeck,
  thwart,
  valueAtLeast,
  whenDefeated,
  YOUR_IDENTITY,
  zone,
} from "../../../dsl/index.js";

/**
 * Jubilee signature supports, upgrades, allies and resources (docs/phase7-wave8.md section 7.3, 3.62, 3.66, 3.68, 3.69;
 * Q33 = B, Q34 = A, Q36 = A).
 *
 * Cards (7):
 * - 47002 Wolverine (ally)
 * - 47003 Shopping Spree (player_side_scheme)
 * - 47004 Jubilee's Coat (upgrade)
 * - 47005 Jubilee's Sunglasses (upgrade)
 * - 47010a Plasmoid Energy (resource)
 * - 47010b Plasmoid Energy (resource)
 * - 47010c Plasmoid Energy (resource)
 *
 * Wolverine (ally, cost 4): his attacks (any attack he makes) gain piercing; Response, after you change to alter-ego
 * form, heal 3 damage from him. The unique rule beside the Wolverine hero or another Wolverine ally is the engine's
 * (section 3.68), not a ref.
 *
 * Shopping Spree (player side scheme, cost 0, starting threat 2): threat cannot be removed from it by heroes or allies
 * (`threatCannotBeRemoved` excepting an identity in alter-ego form, so only a hero-form identity or an ally is barred,
 * and a removal no character performs gets through: Q36 = A). Alter-Ego Action, any player may trigger it: exhaust your
 * identity, remove 1 threat from it; the player who used it removes it, so they are the one who defeated it. When
 * Defeated: that player searches their own deck and discard pile for an ITEM card and puts it into play under their
 * control (one shuffle; an upgrade without an "attach to" line goes onto its controller's identity).
 *
 * Jubilee's Coat and Jubilee's Sunglasses (upgrades, cost 2, no "attach to" line, so on their controller's identity):
 * +1 THW / +1 ATK for the hero face. The Hero Response reads the resource types that paid for an event of the printed
 * trait the player just played. `readsPaymentTypesOf` (the constant) makes that payment one whose wilds the player
 * declares (Q33 = B), and only while this upgrade is ready and its hero is in hero form, which is when its Response
 * could be used: an exhausted upgrade or an alter-ego form makes the payment read nothing, so no prompt. The Response
 * is not offered when no type paid (a cost of 0: `paidTypeCount` of the event is 0). Any THWART / ATTACK event of
 * the controller counts, not only Jubilee's own (the text says no more). Labeled (thwart) / (attack): the removal is a
 * thwart made by her identity (barred from Shopping Spree), the damage an attack made by her identity (guard applies).
 *
 * Plasmoid Energy 47010a/b/c are resource cards with no text and no ability refs: nothing is registered for them (the
 * emitted data lists none); what they pay as is their printed icons.
 */
const THWART = trait("THWART");
const ATTACK = trait("ATTACK");
const ITEM = trait("ITEM");

/** This upgrade is ready and its player is in hero form: the Response could be used. */
const COULD_RESPOND = allOf(isHero(), refMatches(self, { exhausted: false }));
const AT_LEAST_ONE_TYPE = valueAtLeast(paidTypeCount(eventTarget), 1);

export const JUBILEE_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "47002.wolverine-constant": constant(attacksGainKeywords(["piercing"], { attacker: { self: true } })),
  "47002.wolverine-response": response(
    { ...on.youChangeIdentityForm(), eventIs: { change: "identity", to: "alterEgo" } },
    heal(3, self),
  ),

  "47003.shopping-spree-constant": constant(onlyCharacterRemovesThreat({ self: true }, query("alterEgo"))),
  "47003.shopping-spree-action": alterEgoAction(
    { cost: exhaustYourHero, triggerableBy: eachPlayer },
    removeThreat(1, self),
  ),
  "47003.when-defeated": whenDefeated(
    chooseCards(
      "found",
      zone(["deck", "discard"], defeatingPlayer, { filter: query(["upgrade", "support"], { trait: ITEM }) }),
      {
        min: 0,
        max: 1,
        chooser: defeatingPlayer,
      },
    ),
    putIntoPlay(chosen("found"), defeatingPlayer),
    shuffleDeck(defeatingPlayer),
  ),

  "47004.jubilees-coat-constant": constant(
    gets("thw", 1, YOUR_IDENTITY, { while: isHero() }),
    readsPaymentTypesOf(query("event", { trait: THWART }), { while: COULD_RESPOND }),
  ),
  "47004.jubilees-coat-response": heroResponse(
    on.youPlayedCard(query("event", { trait: THWART })),
    { label: "thwart", cost: exhaustThis, while: AT_LEAST_ONE_TYPE },
    aScheme("scheme"),
    thwart(paidTypeCount(eventTarget), chosen("scheme")),
  ),

  "47005.jubilees-sunglasses-constant": constant(
    gets("atk", 1, YOUR_IDENTITY, { while: isHero() }),
    readsPaymentTypesOf(query("event", { trait: ATTACK }), { while: COULD_RESPOND }),
  ),
  "47005.jubilees-sunglasses-response": heroResponse(
    on.youPlayedCard(query("event", { trait: ATTACK })),
    { label: "attack", cost: exhaustThis, while: AT_LEAST_ONE_TYPE },
    anAttackableEnemy("enemy"),
    attack(paidTypeCount(eventTarget), chosen("enemy")),
  ),
});

/** Refs left unregistered, each with its reason (the coverage test reads this through its own `skipped` list). */
export const JUBILEE_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
