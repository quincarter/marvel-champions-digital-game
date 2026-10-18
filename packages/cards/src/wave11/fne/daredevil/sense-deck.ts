import type { AbilityRegistry } from "@mc/engine";
import {
  attack,
  defineAbilities,
  discardThis,
  eventTarget,
  heroInterrupt,
  interrupt,
  modifyAttack,
  on,
  ready,
  reduceNextCardCost,
  response,
  thwart,
  you,
  yourIdentity,
  YOUR_IDENTITY,
} from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `fne/daredevil/sense-deck` (docs/phase7-wave11.md §8.4).
 *
 * Cards (5):
 * - 60002 Acute Tactility (upgrade)
 * - 60003 Enhanced Olfaction (upgrade)
 * - 60004 Heightened Hearing (upgrade)
 * - 60005 Radar Sense (upgrade)
 * - 60006 Superior Taste (upgrade)
 *
 * Every Sense upgrade is an extension of its controller's identity (RRG 1.8 "You, Your", p. 49) and only the
 * controller triggers it (MC60 FAQ p. 26; §3.13). The discard in each cost is paid even though Daredevil's identity
 * sends the leaving upgrade to the bottom of the Sense deck instead (RRG FAQ "Rocket Raccoon", p. 61; §3.3).
 *
 * Acute Tactility (60002) and Enhanced Olfaction (60003): "Interrupt: When you defeat attached enemy or remove
 *   the last threat from attached scheme, discard this card -> ...". An interrupt to the defeat and to the last
 *   threat's removal, so it precedes the scheme's defeat and its When Defeated (August 3, 2026 R1; August 13, 2026 R2).
 * Heightened Hearing (60004): "Hero Interrupt (defense): When attached enemy attacks, discard this card -> that
 *   enemy gets -3 ATK for that attack." The (defense) label makes the identity the defender and the target player
 *   (RRG 1.8 "Labeled Ability", p. 26; "Defend, Defense", p. 15).
 * Radar Sense (60005): "Response (attack): After you attack attached enemy, discard this card -> deal 3 damage to
 *   that enemy." The (attack) label makes the 3 damage an attack by the identity.
 * Superior Taste (60006): "Response (thwart): After you thwart attached scheme, discard this card -> remove 2
 *   threat from that scheme." The (thwart) label makes the removal a thwart by the identity.
 */
/**
 * "You" is the identity (RRG 1.8 "You, Your", p. 49): the defeating or removing card is the controller's identity or an
 * extension of it (an event they played, an upgrade of theirs), never an ally or a support (spec 3.13).
 */
const BY_YOUR_IDENTITY = { sourceIs: { extensionOf: { kind: "controller" as const } } };
const YOU_DEFEAT_OR_CLEAR_HOST = on.either(
  { ...on.defeated("host"), ...BY_YOUR_IDENTITY },
  { ...on.removesLastThreat("host"), ...BY_YOUR_IDENTITY },
);

export const FNE_DAREDEVIL_SENSE_DECK: AbilityRegistry = defineAbilities({
  "60002.acute-tactility-interrupt": interrupt(YOU_DEFEAT_OR_CLEAR_HOST, { cost: discardThis }, ready(yourIdentity)),
  "60003.enhanced-olfaction-interrupt": interrupt(
    YOU_DEFEAT_OR_CLEAR_HOST,
    { cost: discardThis },
    reduceNextCardCost(you, 2, "phase"),
  ),
  "60004.heightened-hearing-interrupt": heroInterrupt(
    on.enemyAttacks("host"),
    { label: "defense", cost: discardThis },
    modifyAttack({ atkBonus: -3 }),
  ),
  "60005.radar-sense-response": response(
    on.attacks(YOUR_IDENTITY, { target: { hostOfSelf: true }, byYou: true }),
    { label: "attack", cost: discardThis },
    attack(3, eventTarget),
  ),
  "60006.superior-taste-response": response(
    { ...on.thwarts(YOUR_IDENTITY), targetIs: { hostOfSelf: true } },
    { label: "thwart", cost: discardThis },
    thwart(2, eventTarget),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_DAREDEVIL_SENSE_DECK_SKIPPED: Readonly<Record<string, string>> = {};
