import type { AbilityRegistry } from "@mc/engine";
import {
  attachCard,
  chooseCards,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  constant,
  dealDamage,
  defineAbilities,
  declareDefender,
  discardThis,
  draw,
  each,
  exhaustThis,
  gainsKeyword,
  gets,
  heroInterrupt,
  alterEgoResponse,
  on,
  query,
  raiseMoment,
  resource,
  response,
  restrictedLimit,
  shuffleDeck,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
} from "../../../dsl/index.js";

/** "a copy of Bamf!": the upgrade by printed name (48006, three copies in his deck). */
const BAMF = query("upgrade", { name: "Bamf!" });
/** "Nightcrawler" / "Kurt Wagner": the hero by title, so each stat line follows the face that is showing. */
const NIGHTCRAWLER = query("identity", { name: "Nightcrawler" });
const KURT_WAGNER = query("identity", { name: "Kurt Wagner" });

/** The name Bamf!'s ability raises once it has resolved, for Tally Ho! (48011) to answer (docs/phase7-wave8.md section 3.39, 3.72). */
export const BAMF_MOMENT = "bamf";

/**
 * Nightcrawler signature supports, upgrades, allies and resources (docs/phase7-wave8.md section 7.4, 3.72, 3.73, 3.39).
 *
 * Cards (5):
 * - 48002 Daytripper (ally)
 * - 48003 Kurt's Chapel (support)
 * - 48004 Kurt's Cutlasses (upgrade)
 * - 48005 Prehensile Tail (upgrade)
 * - 48006 Bamf! (upgrade)
 *
 * **Bamf! (48006)**: Hero Interrupt (defense) when the attached enemy attacks, anyone: discard it (a cost) and declare
 * Nightcrawler the defender without exhausting him (`declareDefender`, the effect Shieldmaiden uses), then raise the
 * moment `"bamf"` with the discarded copy as its source. Attach to an enemy and the max of 1 per enemy are card data.
 *
 * **Daytripper (48002)**: Response after she enters play: one copy of Bamf! from the deck or discard pile (one choice),
 * attached to an enemy that can hold it (no copy on it, not Azazel), then one shuffle for the searched deck, then 1
 * damage to each enemy with a copy attached, hers or not. A copy that has no legal enemy stays where it was. The
 * `attach` effect does not read "max 1 per enemy", so the host choice excludes an enemy that already has a copy.
 *
 * **Kurt's Chapel (48003)**: +1 REC for Kurt Wagner; Alter-Ego Response after a basic recovery, exhaust it and choose
 * a player, who draws 1.
 *
 * **Kurt's Cutlasses (48004)**: the "counts as 2 restricted cards" sentence is data (`restrictedWeight: 2`), so the
 * script is the stat line: Nightcrawler gets +1 ATK, +1 DEF and retaliate 1.
 *
 * **Prehensile Tail (48005)**: room for 1 additional upgrade with the restricted keyword (the form Side Holster has,
 * narrowed to keyword upgrades, so the Cutlasses cannot use it) and a [wild] resource for an event.
 */
export const NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "48002.daytripper-response": response(
    on.entersPlay("self"),
    chooseCards("copy", zone(["deck", "discard"], you, { filter: BAMF }), { min: 1, max: 1 }),
    shuffleDeck(),
    chooseTarget("enemy", query("enemy", { not: { hasAttachment: BAMF }, canHaveAttached: chosen("copy") })),
    attachCard(chosen("copy"), chosen("enemy")),
    dealDamage(1, each(query("enemy", { hasAttachment: BAMF }))),
  ),

  "48003.kurts-chapel-constant": constant(gets("rec", 1, KURT_WAGNER)),
  "48003.kurts-chapel-response": alterEgoResponse(
    on.basicRecovery(YOUR_IDENTITY),
    { cost: exhaustThis },
    choosePlayer("friend"),
    draw(1, chosenPlayer("friend")),
  ),

  "48004.kurts-cutlasses-constant": constant(
    gets("atk", 1, NIGHTCRAWLER),
    gets("def", 1, NIGHTCRAWLER),
    gainsKeyword({ name: "retaliate", value: 1 }, NIGHTCRAWLER),
  ),

  "48005.prehensile-tail-constant": constant(
    restrictedLimit(1, { cards: query("upgrade", { withKeyword: "restricted" }) }),
  ),
  "48005.prehensile-tail-resource": resource({ wild: 1 }, { cost: exhaustThis, generatesFor: query("event") }),

  "48006.bamf-interrupt": heroInterrupt(
    on.enemyAttacks("host"),
    { label: "defense", cost: discardThis },
    declareDefender(yourIdentity),
    raiseMoment(BAMF_MOMENT),
  ),
});
