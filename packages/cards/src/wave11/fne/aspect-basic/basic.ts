import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  canAttachToCategory,
  cards,
  chooseCards,
  chooseOne,
  chooseOptions,
  chosen,
  constant,
  damageAnEnemy,
  dealDamage,
  defineAbilities,
  discardThis,
  exhaust,
  heroAction,
  host,
  interrupt,
  modifyBasicPower,
  on,
  option,
  playableTucked,
  query,
  ready,
  refMatches,
  removeThreatFromAScheme,
  self,
  tuckCards,
  tuckLimit,
  you,
  zone,
} from "../../../dsl/index.js";
import { WAVE10_ABILITIES } from "../../../wave10/index.js";

const MARTIAL_ARTIST = trait("MARTIAL ARTIST");
/** "A friendly Martial Artist character": an identity or ally of any player (RRG 1.8 "Friendly", p. 20). */
const FRIENDLY_MARTIAL_ARTIST = query(["identity", "ally"], { trait: MARTIAL_ARTIST });
/** "An upgrade that can attach to a minion or side scheme" (spec 3.11), read from card data. */
const UPGRADE_FOR_MINION_OR_SIDE_SCHEME = query("upgrade", canAttachToCategory("minion", "sideScheme"));

/**
 * Wave 11 scripting module `fne/aspect-basic/basic` (docs/phase7-wave11.md §8.4).
 *
 * Cards (8):
 * - 60029 Stick (support)
 * - 60030 Contingency Planning (upgrade)
 * - 60031 Dance with the Devil (upgrade)
 * - 60055 See No Evil, Hear No Evil (event)
 * - 60056 Superpower Training (player_side_scheme)
 * - 60057 Energy (resource)
 * - 60058 Genius (resource)
 * - 60059 Strength (resource)
 *
 * Prints no ability, nothing to script: 60057 Energy, 60058 Genius, 60059 Strength.
 *
 * Reprints, aliased to the original script: 60056.when-defeated. The test checks the printed text matches.
 *
 * **60029.stick-interrupt**: "choose": exhausting Stick is offered only while it is ready; the other option's "Ready
 * Stick" is a no-op on a ready Stick. The power is the one in use (an attack, thwart, defense or recovery).
 * **60030**: the tucked upgrade is playable as if in hand (spec 3.8); the action tucks one from the hand that can attach
 * to a minion or side scheme (spec 3.11), at most 1 under here (`tuckLimit`). Max 1 per player is data.
 * **60031 / 60055**: Team-Up and Max 1 per deck are data. 60055's "choose 2, the same option twice" allows a repeat.
 */
export const FNE_ASPECT_BASIC_BASIC: AbilityRegistry = defineAbilities({
  "60029.stick-interrupt": interrupt(
    on.basicPowerUsing(FRIENDLY_MARTIAL_ARTIST),
    chooseOne(
      option(
        "Exhaust Stick: +1 to that basic power",
        { when: refMatches(self, query("support", { exhausted: false })) },
        [exhaust(self), modifyBasicPower(1)],
      ),
      option("-1 to that basic power, ready Stick", [modifyBasicPower(-1), ready(self)]),
    ),
  ),

  "60030.contingency-planning-constant": constant(playableTucked({ cards: { categories: ["upgrade"] } }), tuckLimit(1)),
  "60030.contingency-planning-action": action(
    chooseCards("upgrade", zone("hand", you, { filter: UPGRADE_FOR_MINION_OR_SIDE_SCHEME }), { min: 1, max: 1 }),
    tuckCards(cards(chosen("upgrade")), self),
  ),

  "60031.dance-with-the-devil-action": heroAction({ label: "attack", cost: discardThis }, dealDamage(3, host)),

  "60055.see-no-evil-hear-no-evil-constant": heroAction(
    { label: ["attack", "thwart"] },
    chooseOptions(
      2,
      [
        option("Deal 3 damage to an enemy", damageAnEnemy(3)),
        option("Remove 3 threat from a scheme", removeThreatFromAScheme(3)),
      ],
      { allowRepeat: true },
    ),
  ),

  "60056.when-defeated": WAVE10_ABILITIES["40059.when-defeated"]!,
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_ASPECT_BASIC_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
