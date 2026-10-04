import { trait } from "@mc/content";
import {
  after,
  alterEgoAction,
  amount,
  andThen,
  anyOf,
  bindTargets,
  cancelIt,
  chooseTarget,
  chosen,
  confuse,
  constant,
  costModifier,
  damageAnEnemy,
  defineAbilities,
  discard,
  draw,
  eventTarget,
  exhaustThis,
  forcedInterrupt,
  gainsKeyword,
  gets,
  heal,
  hasTrait,
  heroInterrupt,
  heroResponse,
  host,
  identityOf,
  ifThen,
  inAdditionalForm,
  interrupt,
  on,
  playersWhere,
  query,
  removeThreat,
  removeThreatFromAScheme,
  response,
  self,
  spend,
  moveCards,
  cards,
  theMainScheme,
  thatPlayer,
  when,
  yourIdentity,
  youHaveTrait,
  attacksGainKeywords,
  dealDamage,
} from "../../../dsl/index.js";

const ATTACK = trait("ATTACK");
const ELITE = trait("ELITE");
const MUTANT = trait("MUTANT");
const X_MEN = trait("X-MEN");

const SOLID = inAdditionalForm("mass", "Solid");
const PHASED = inAdditionalForm("mass", "Phased");
const THE_ALLY = query("ally", { self: true });
const THE_HOST_ALLY = query("ally", { hostOfSelf: true });
const THE_HOST_MINION = query("minion", { hostOfSelf: true });

/** "Any player whose alter-ego has the MUTANT trait" (X-Mansion, docs/phase7-wave6.md §3.11). */
const MUTANT_ALTER_EGO = playersWhere(hasTrait(identityOf(thatPlayer), MUTANT));

/**
 * Shadowcat's supports, upgrades and allies, and her Aggressive Energy resource (`mut_gen` 32032-32036, 32041-32044,
 * 32047-32049; docs/phase7-wave6.md §3.8, §3.11, §3.22). Her events are `events.ts`.
 *
 * - **Lockheed (32032) / Kitty's Room (32033)**: "if you are in Solid / Phased mass form" reads the mass form upgrade's
 *   face (`inAdditionalForm`). A target is chosen only in the branch that applies. Each is one ref carrying the header and both bullets.
 * - **Acute Control (32034) / Intangible Interference (32035)**: `on.youIgnore` (§3.8, Q6) is heard once per card
 *   whose keyword or icon would have stopped her attack or thwart; "that minion / scheme" is the event's card.
 * - **Phased and Confused (32036)**: Webbed Up's shape (`01009`): the attack is cancelled, the card discarded, and
 *   then the enemy is confused.
 * - **Wolverine (32041)**: his own attacks (basic or not) gain piercing; the heal is the plain "Response", so it is
 *   heard in either form.
 * - **Magik (32042)**: "an X-MEN hero" is a player whose identity currently has the X-MEN trait, so a player in
 *   alter-ego form is not one (the alter-ego face carries MUTANT, not X-MEN). Flagged for review.
 * - **Gatekeeper (32044)**: one `-constant` for the two grants (+2 hit points and patrol).
 * - **Aggressive Energy (32047)**: `modifyCardEffect` on the event being played (the Embiggen! shape).
 * - **Colossus (32048)**: Toughness is data; the cost reduction is read from hand (Martinex's shape).
 * - **X-Mansion (32049)**: `triggerableBy` replaces the controller rule, so its controller may trigger it only when
 *   their own alter-ego is MUTANT (the literal reading of §3.11).
 */
export const SHADOWCAT_SUPPORT_UPGRADES_ALLIES = defineAbilities({
  "32032.lockheed-response": response(
    after.entersPlay("self"),
    ifThen(SOLID, damageAnEnemy(2)),
    ifThen(PHASED, removeThreatFromAScheme(2)),
  ),

  "32033.kittys-room-action": alterEgoAction(
    { cost: exhaustThis },
    ifThen(SOLID, heal(2, yourIdentity)),
    ifThen(PHASED, draw(1)),
  ),

  "32034.acute-control-response": heroResponse(
    on.youIgnore(["guard", "patrol"]),
    { cost: exhaustThis },
    dealDamage(2, eventTarget),
  ),

  "32035.intangible-interference-response": heroResponse(
    on.youIgnore(["crisis"]),
    { cost: exhaustThis },
    removeThreat(2, eventTarget),
  ),

  "32036.phased-and-confused-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("host"),
    bindTargets("enemy", host),
    cancelIt(),
    discard(self),
    andThen(confuse(chosen("enemy"))),
  ),

  "32041.wolverine-constant": constant(attacksGainKeywords(["piercing"], { attacker: THE_ALLY })),
  "32041.wolverine-response": response(on.yourTurnBegins(), heal(1, self)),

  "32042.magik-response": response(
    on.youPlayThis(),
    { cost: spend({ mental: 1 }) },
    chooseTarget(
      "minion",
      query("minion", {
        withoutTrait: ELITE,
        engagedWithPlayer: playersWhere(hasTrait(identityOf(thatPlayer), X_MEN)),
      }),
    ),
    moveCards(cards(chosen("minion")), "encounterDeckShuffle"),
  ),

  "32043.attack-training-constant": constant(gets("atk", 1, THE_HOST_ALLY), gets("hp", 2, THE_HOST_ALLY)),

  "32044.gatekeeper-constant": constant(
    gets("hp", 2, THE_HOST_MINION),
    gainsKeyword({ name: "patrol" }, THE_HOST_MINION),
  ),
  "32044.gatekeeper-interrupt": interrupt(when.defeated("host"), removeThreat(4, theMainScheme)),

  "32047.aggressive-energy-interrupt": heroInterrupt(on.youSpendThis({ toPlay: query("event", { trait: ATTACK }) }), {
    kind: "modifyCardEffect",
    card: eventTarget,
    damage: amount(1),
  }),

  "32048.colossus-constant": constant(
    costModifier({
      delta: -1,
      appliesTo: THE_ALLY,
      while: anyOf(youHaveTrait(MUTANT), youHaveTrait(X_MEN)),
      activeIn: "hand",
    }),
  ),

  "32049.x-mansion-action": alterEgoAction(
    { cost: exhaustThis, triggerableBy: MUTANT_ALTER_EGO },
    chooseTarget("healed", query("character", { anyTrait: [MUTANT, X_MEN] })),
    heal(1, chosen("healed")),
  ),
});
