import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  aScheme,
  action,
  anAttackableEnemy,
  anEnemy,
  applyRuleUntil,
  attack,
  changeForm,
  chosen,
  confuse,
  dealDamage,
  defineAbilities,
  draw,
  enemyAttack,
  exhaustCardsCost,
  gainKeywordUntil,
  giveStatus,
  heroAction,
  heroInterrupt,
  ifThen,
  ignoreBoostForThisAttack,
  interrupt,
  on,
  preventDamage,
  query,
  ready,
  removeThreat,
  stun,
  theMainScheme,
  theVillain,
  thwart,
  you,
  youAreNamed,
  yourIdentity,
} from "../../dsl/index.js";
import { PSYLOCKE_EVENTS } from "../psylocke/events.js";

const AERIAL = trait("AERIAL");
const ANGEL = youAreNamed("Angel");
const ARCHANGEL = youAreNamed("Archangel");
const WARREN = youAreNamed("Warren Worthington III");

/**
 * Angel's hero events and his pack's aspect and basic events (42003-42007, 42014-42016, 42021), docs/phase7-wave7.md
 * §7.2, §3.62, §3.67. "If you are Angel / Archangel / Warren Worthington III" reads the title of the face showing
 * (RRG "Identity", p. 23), since both hero faces print the same traits. The event is playable on any face its own
 * restrictions allow, and the branch that does not match simply does nothing.
 *
 * - **Adaptive Plumage (42003)**: two Hero Actions on one card, each reading its own "If you are Angel / Archangel".
 *   The player triggers one of them (RRG "Event", p. 18), and each is gated by `while`, so exactly one is usable per
 *   hero face: the thwart removes 3 threat and confuses an enemy as Angel; the attack deals 4 damage and stuns it as
 *   Archangel. The card cannot be played when the showing face's ability has no valid target (RRG "Target", p. 42).
 * - **Aerial Agility (42004), Hero Interrupt (defense)**: answers any enemy attack (Q41). As Angel the boost cards of
 *   that attack are ignored (§3.67); as Archangel a tough status card and retaliate 1 until the attack ends.
 * - **Metamorphosis (42005), Action**: change form (any other face, asked), then the effect of the face reached.
 * - **Natural Flight (42006), Hero Action (thwart)**: 4 threat; as Angel it ignores the crisis icon and patrol.
 * - **Razor Dive (42007), Hero Action (attack)**: 6 damage; as Archangel the attack gains overkill and piercing.
 * - **Aerial Intervention (42014), Interrupt**: any character about to take attack damage; exhaust an AERIAL
 *   character you control to prevent up to 3 of it. The exhaust is a cost, so it must be payable (Warren is not AERIAL).
 * - **Ever Vigilant (42015), Hero Action**: the AERIAL identity requirement is card data (`requiresIdentityTrait`).
 * - **Taunt (42016), Hero Action**: the villain attacks you; every other character cannot defend against that one
 *   attack (the rule is applied before the attack and ends with it); then draw 3.
 * - **Soaring Hearts (42021)**: the reprint of Psylocke's 41020, aliased. Team-Up (Angel and Psylocke) is data, and
 *   Archangel is not "Angel" (Q37), so it cannot be played while he is Archangel.
 */
export const ANGEL_EVENTS: AbilityRegistry = defineAbilities({
  "42003.adaptive-plumage-action": heroAction(
    { label: "thwart", while: ANGEL },
    aScheme("scheme"),
    thwart(3, chosen("scheme")),
    anEnemy("enemy"),
    confuse(chosen("enemy")),
  ),
  "42003.adaptive-plumage-hero-action": heroAction(
    { label: "attack", while: ARCHANGEL },
    anAttackableEnemy("enemy"),
    attack(4, chosen("enemy")),
    stun(chosen("enemy")),
  ),

  "42004.aerial-agility-interrupt": heroInterrupt(
    on.enemyAttacks(query("enemy")),
    { label: "defense" },
    ifThen(ANGEL, ignoreBoostForThisAttack()),
    ifThen(ARCHANGEL, [
      giveStatus(yourIdentity, "tough"),
      gainKeywordUntil({ name: "retaliate", value: 1 }, yourIdentity, "endOfAttack"),
    ]),
  ),

  "42005.metamorphosis-action": action(
    changeForm(),
    ifThen(WARREN, draw(1)),
    ifThen(ANGEL, [aScheme("scheme"), removeThreat(2, chosen("scheme"))]),
    ifThen(ARCHANGEL, [anEnemy("enemy"), dealDamage(3, chosen("enemy"))]),
  ),

  "42006.natural-flight-action": heroAction(
    { label: "thwart" },
    // The choice sits inside each branch so the engine judges the schemes offered by the thwart that will be made.
    ifThen(
      ANGEL,
      [aScheme("scheme"), thwart(4, chosen("scheme"), { ignoreCrisis: true, ignorePatrol: true })],
      [aScheme("scheme"), thwart(4, chosen("scheme"))],
    ),
  ),

  "42007.razor-dive-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    ifThen(ARCHANGEL, attack(6, chosen("enemy"), { keywords: ["overkill", "piercing"] }), attack(6, chosen("enemy"))),
  ),

  "42014.aerial-intervention-interrupt": interrupt(
    on.damage(query("character"), { fromAttack: true }),
    { cost: exhaustCardsCost(query("character", { trait: AERIAL, controller: "you" })) },
    preventDamage(3),
  ),

  "42015.ever-vigilant-action": heroAction(ready(yourIdentity), removeThreat(2, theMainScheme)),

  "42016.taunt-action": heroAction(
    applyRuleUntil(
      { kind: "cannotDefend", target: query("character", { excluding: yourIdentity }) },
      "endOfAttack",
      undefined,
      { attack: "initiated" },
    ),
    enemyAttack(theVillain, { against: you }),
    draw(3),
  ),

  // The reprint of Psylocke's Soaring Hearts: one card, one script.
  "42021.soaring-hearts-action": PSYLOCKE_EVENTS["41020.soaring-hearts-action"]!,
});
