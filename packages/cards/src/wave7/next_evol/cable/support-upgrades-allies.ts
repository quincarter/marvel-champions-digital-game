import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  addToVictoryDisplay,
  after,
  alterEgoAction,
  anAttackableEnemy,
  attack,
  aScheme,
  cards,
  chooseCards,
  chooseOne,
  chosen,
  constant,
  defineAbilities,
  draw,
  eventTarget,
  discardThis,
  exhaustThis,
  gainsTrait,
  gets,
  heroAction,
  heroInterrupt,
  heroResponse,
  response,
  inForm,
  inVictoryDisplay,
  moveCards,
  moveThreat,
  on,
  onlyCharacterRemovesThreat,
  option,
  preventDamage,
  putIntoPlay,
  query,
  ready,
  resource,
  self,
  shuffleDeck,
  spend,
  statOf,
  theMainScheme,
  thwart,
  min,
  valueAtLeast,
  victoryDisplayCards,
  victoryDisplayCount,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
  FRIENDLY_CHARACTER,
} from "../../../dsl/index.js";

const PSIONIC = trait("PSIONIC");
const SIDE_SCHEMES_IN_VICTORY_DISPLAY = victoryDisplayCount(query("sideScheme"));
const HERO_FORM = { while: inForm("hero") };

/**
 * Cable's player side scheme, supports and upgrades (40006-40013), docs/phase7-wave7.md §7.1, §3.49-§3.54.
 *
 * - **Technovirus Purge (40006)**: Victory 0 is keyword data. Constant 1: only Cable removes threat from it
 *   (`onlyCharacterRemovesThreat`; his events and upgrades are him, his allies and other heroes are not, and a
 *   non-character remover is not barred, §4.1 Q29; Nathan Summers is not "Cable"). Constant 2 works from the victory
 *   display only: both faces gain PSIONIC, the hero face gets +1 THW / ATK / DEF.
 * - **Graymalkin (40007)**: ready on any side scheme defeated (any defeater); Resource: exhaust, 1 energy.
 * - **Professor (40008)**: Alter-Ego Action, exhaust: draw 1 card, or search deck and discard pile for a player side
 *   scheme (may find none), add it to hand, shuffle.
 * - **Askani'son (40009)**: after your hero defends, exhaust + spend 1 energy: thwart equal to your hero's THW. The
 *   "(thwart)" label makes it a thwart by Cable for his identity response.
 * - **Forced Amnesia (40010)**: after a side scheme is defeated, it and this upgrade go to the victory display
 *   (a permanent scheme is never "defeated", so no `schemeDefeated` is announced for it).
 * - **Plasma Rifle (40011)**: Restricted is data. Attack: 1 damage per side scheme in the victory display, max 4,
 *   ranged. The attack is the effect's, so Retaliate and Toughness apply.
 * - **Telekinetic Force Field (40012)**: hero form only is data (`playRestrictions.form`); discard to prevent all
 *   damage a friendly character would take.
 * - **Temporal Leap (40013)**: interrupt to the main scheme completing. The printed "remove this card from the game
 *   and put a side scheme from the victory display into play" is a cost, but the engine has no effect-as-cost, so it
 *   is the first part of the effect, gated by a `while` that a side scheme is in the victory display; the threat then
 *   moves 4 from the main scheme to it (not revealed, §4.1 Q30).
 */
export const CABLE_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "40006.technovirus-purge-constant": constant(
    onlyCharacterRemovesThreat({ self: true }, query("identity", { name: "Cable" })),
  ),
  "40006.technovirus-purge-constant-2": inVictoryDisplay(
    constant(
      gainsTrait(PSIONIC, YOUR_IDENTITY),
      gets("thw", 1, YOUR_IDENTITY, HERO_FORM),
      gets("atk", 1, YOUR_IDENTITY, HERO_FORM),
      gets("def", 1, YOUR_IDENTITY, HERO_FORM),
    ),
  ),

  "40007.graymalkin-response": response(after.schemeDefeated(query("sideScheme")), ready(self)),
  "40007.graymalkin-resource": resource({ energy: 1 }, { cost: exhaustThis }),

  "40008.professor-action": alterEgoAction(
    { cost: exhaustThis },
    chooseOne(
      option("Draw 1 card", draw(1)),
      option(
        "Search for a player side scheme",
        chooseCards("found", zone(["deck", "discard"], you, { filter: query("sideScheme") }), { min: 0, max: 1 }),
        moveCards(cards(chosen("found")), "hand"),
        shuffleDeck(),
      ),
    ),
  ),

  "40009.askanison-response": heroResponse(
    on.defends(YOUR_IDENTITY),
    { label: "thwart", cost: [exhaustThis, spend({ energy: 1 })] },
    aScheme(),
    thwart(statOf(yourIdentity, "thw"), chosen("scheme")),
  ),

  "40010.forced-amnesia-response": heroResponse(
    after.schemeDefeated(query("sideScheme")),
    addToVictoryDisplay(cards(self)),
    addToVictoryDisplay(cards(eventTarget)),
  ),

  "40011.plasma-rifle-action": heroAction(
    { label: "attack", cost: [exhaustThis, spend({ energy: 1 })] },
    anAttackableEnemy(),
    attack(min(SIDE_SCHEMES_IN_VICTORY_DISPLAY, 4), chosen("enemy"), { keywords: ["ranged"] }),
  ),

  "40012.telekinetic-force-field-interrupt": heroInterrupt(
    on.damage(FRIENDLY_CHARACTER),
    { cost: discardThis },
    preventDamage(),
  ),

  "40013.temporal-leap-interrupt": heroInterrupt(
    on.mainSchemeCompleting(query("mainScheme")),
    { while: valueAtLeast(SIDE_SCHEMES_IN_VICTORY_DISPLAY, 1) },
    moveCards(cards(self), "removedFromGame"),
    chooseCards("revived", victoryDisplayCards(query("sideScheme")), { min: 1, max: 1 }),
    putIntoPlay(chosen("revived")),
    moveThreat(theMainScheme, chosen("revived"), { amount: 4 }),
  ),
});
