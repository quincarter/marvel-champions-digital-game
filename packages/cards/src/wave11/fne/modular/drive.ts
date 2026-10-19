import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  attachCard,
  cannotAttach,
  chosen,
  chooseOne,
  damagedAtLeast,
  defineAbilities,
  discard,
  discardEncounterUntil,
  eventAmount,
  eventKindIs,
  eventPlayer,
  forcedInterrupt,
  hasAttachment,
  identityOf,
  ifThen,
  instead,
  not,
  on,
  option,
  placeDamage,
  placeThreat,
  query,
  refMatches,
  removeThreat,
  revealCard,
  self,
  spendResources,
  surge,
  varAtLeast,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const VEHICLE_ATTACHMENT = query("attachment", { trait: trait("VEHICLE") });

/**
 * A Vehicle's Forced Interrupt: "When attached character would take any amount of damage, place it here instead. If
 * there is N or more damage here, discard this card." "Would take", not "would be dealt", so a tough status card on the
 * attached character is used up first and the Vehicle never sees that damage (RRG 1.8 "Damage", p. 14). The discard
 * is the card's own next sentence, checked after the placement, so it is a plain follow-on effect, not a "then".
 */
const vehicleAbsorbs = (limit: number) =>
  forcedInterrupt(
    on.damage("host"),
    instead(placeDamage(eventAmount, self), ifThen(damagedAtLeast(self, limit), discard(self))),
  );

/** "A character with a Vehicle attachment". */
const CHARACTER_WITH_VEHICLE = query("character", hasAttachment(VEHICLE_ATTACHMENT));

/**
 * Traffic Jam's Forced Interrupt: "When a character with a Vehicle attachment would: • Add threat to a scheme, that
 * threat is added here instead. • Remove threat from a scheme, that threat is removed from here instead." One printed
 * ability with one triggering condition met by either event (RRG 1.8 "Triggering Condition", p. 45), so one forced
 * "would" interrupt on `placeThreat` and `removeThreat` whose replacement branches on the kind of the event (RRG 1.8
 * "Replacement Effect", p. 37; "'Would'", p. 48).
 *
 * The character is the event's source: an enemy's scheme activation places threat as that enemy, and a basic thwart,
 * a "(thwart)" ability or a character's own ability removes it as that character. An unlabeled "remove N threat" on a
 * player's event card removes it as that card, not as the identity, so it is not replaced (engine interpretation,
 * authority step 5: no ruling names the character behind an event card's removal). Threat added to or removed from
 * Traffic Jam itself is not replaced (it is already "here"). The threat removed from here is removed by the player who
 * would have removed it (`by: eventPlayer`), and the replacement keeps the original's source and the thwart or scheme
 * activation it belonged to (`Frame<"effects">.replacesEvent`), so that thwart reports the threat and is credited
 * with a defeat. A removal that would be stopped (a crisis icon, patrol, a "cannot" rule) removes no threat and is
 * not replaced (`removalWillApply`). Removing more than is here removes what is here and the rest is lost: the
 * original removal does not happen. Traffic Jam's own crisis icon keeps players off the main scheme (RRG 1.8 "Crisis
 * Icon", p. 14), so a hero's redirected thwart is always one of a side scheme.
 */
const trafficJam = forcedInterrupt(
  {
    on: ["placeThreat", "removeThreat"],
    sourceIs: CHARACTER_WITH_VEHICLE,
    // "To a scheme" / "from a scheme": threat placed on another card (Black Cat 60169, docs/phase7-wave11-scenarios.md
    // §S3.8) is not replaced.
    targetIs: { self: false, categories: ["scheme"] },
    removalWillApply: true,
  },
  { would: true },
  instead(
    ifThen(
      eventKindIs("placeThreat"),
      placeThreat(eventAmount, self),
      removeThreat(eventAmount, self, { by: eventPlayer }),
    ),
  ),
);

/** "If your identity does not have a Vehicle attachment": the revealing player's identity. */
const IDENTITY_HAS_VEHICLE = refMatches(identityOf(you), query([], hasAttachment(VEHICLE_ATTACHMENT)));

/**
 * "Spend 3 resources of the same type": one option per type (a wild resource is any one type, RRG 1.8 "Wild
 * Resource", p. 48).
 */
const attachForThree = (type: "physical" | "mental" | "energy") =>
  option(
    `Spend 3 [${type}] resources and attach it to your identity`,
    spendResources({ [type]: 3 }, "paid"),
    attachCard(chosen("found"), identityOf(you)),
  );

/**
 * The Drive modular set (docs/phase7-wave11-scenarios.md section S6).
 *
 * **60186-60188 Sports Car, Motorcycle, Utility Van**: the host is data (`attachesTo` superlative with
 * `withoutAttachmentTrait`, the enemy with the highest ATK / highest SCH / fewest remaining hit points that has no
 * Vehicle attachment) and so is the stat bonus. "Otherwise, this card gains surge" is `cannotAttach(surge())`. The
 * Forced Interrupt replaces the damage with a placement on the card and discards it at 4 / 3 / 6 damage.
 * **60189 Traffic Jam**: Hinder is data. Its Forced Interrupt is one printed ability with two opposite bullets (add
 * threat here instead / remove threat from here instead): one trigger on either event, branching on `eventKindIs`.
 * **60190 Carjacking**: discards encounter cards until a Vehicle attachment, then the revealing player either reveals
 * it or, if their identity has no Vehicle attachment, pays 3 resources of one type to attach it to their identity
 * "instead" of revealing it (so none of its reveal happens, surge included). The player chooses which; with no
 * Vehicle attachment in the deck nothing is found and nothing happens (RRG 1.8 "Encounter Deck", p. 17).
 *
 * Cards (5):
 * - 60186 Sports Car (attachment)
 * - 60187 Motorcycle (attachment)
 * - 60188 Utility Van (attachment)
 * - 60189 Traffic Jam (side_scheme)
 * - 60190 Carjacking (treachery)
 */
export const FNE_MODULAR_DRIVE: AbilityRegistry = defineAbilities({
  "60186.sports-car-constant": cannotAttach(surge()),
  "60186.sports-car-forced-interrupt": vehicleAbsorbs(4),
  "60187.motorcycle-constant": cannotAttach(surge()),
  "60187.motorcycle-forced-interrupt": vehicleAbsorbs(3),
  "60188.utility-van-constant": cannotAttach(surge()),
  "60188.utility-van-forced-interrupt": vehicleAbsorbs(6),

  "60189.traffic-jam-forced-interrupt": trafficJam,

  "60190.when-revealed": whenRevealed(
    discardEncounterUntil(VEHICLE_ATTACHMENT, "found"),
    ifThen(
      varAtLeast("found.count"),
      ifThen(
        not(IDENTITY_HAS_VEHICLE),
        chooseOne(
          attachForThree("physical"),
          attachForThree("mental"),
          attachForThree("energy"),
          option("Reveal it", revealCard(chosen("found"))),
        ),
        revealCard(chosen("found")),
      ),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_MODULAR_DRIVE_SKIPPED: Readonly<Record<string, string>> = {};
