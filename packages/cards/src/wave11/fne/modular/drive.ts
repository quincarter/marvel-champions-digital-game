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
  forcedInterrupt,
  hasAttachment,
  identityOf,
  ifThen,
  instead,
  not,
  on,
  option,
  placeDamage,
  query,
  refMatches,
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
 * threat here instead / remove threat from here instead), and the card data gives it a single ability id.
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
export const FNE_MODULAR_DRIVE_SKIPPED: Readonly<Record<string, string>> = {
  "60189.traffic-jam-forced-interrupt":
    "engine gap: one printed ability (one id in the card data) with two bullets that replace opposite events (placeThreat -> placeThreat here, removeThreat -> removeThreat here); the ability DSL has no predicate on the kind of the triggering event, and `instead` replaces with fixed effects, so one trigger cannot choose between them (needs an event-kind predicate, or two ability ids in the card data)",
};
