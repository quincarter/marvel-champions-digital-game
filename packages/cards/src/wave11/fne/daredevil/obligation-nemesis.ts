import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  alterEgoResponse,
  attachCard,
  attacksGainKeywords,
  boost,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  coveredByEngineRule,
  defineAbilities,
  discard,
  each,
  enemyAttack,
  exists,
  findCard,
  forcedInterrupt,
  forcedResponse,
  giveBoostCard,
  heroAction,
  ifThen,
  modifyAttack,
  moveCards,
  on,
  option,
  query,
  self,
  spend,
  takeDamage,
  whenRevealed,
  YOUR_IDENTITY,
  you,
} from "../../../dsl/index.js";

const SENSE = trait("SENSE");
const PERSONA = trait("PERSONA");
const BULLSEYE = "Bullseye";
/**
 * "Bullseye" on these cards is this nemesis set's minion (RRG 1.8 "Referential Ability", p. 36: a nemesis-set card's
 * title reference resolves to the same identity's nemesis set, item 2, before encounter cards, item 3; June 25, 2026
 * Ruling 4 (1)). A discarded minion is still in the game, so minion-only is enough.
 */
const BULLSEYE_CARD = query("minion", { name: BULLSEYE });
const YOUR_PERSONA_SUPPORT = query("support", { trait: PERSONA, controller: "you" });
const YOUR_ALLY_OR_PERSONA = { anyOf: [query("ally", { controller: "you" }), YOUR_PERSONA_SUPPORT] };
const ELEKTRA = query("ally", { name: "Elektra" });
/** "After you recover": the basic recovery has resolved (`basicPowerUsed` narrowed to the recover power). */
const YOU_RECOVER = { ...on.basicPowerUsed(YOUR_IDENTITY), eventIs: { power: "recover" } } as const;

/**
 * Wave 11 scripting module `fne/daredevil/obligation-nemesis` (docs/phase7-wave11.md §8.4 line 5).
 *
 * Cards (5):
 * - 60032 Sensory Overload (obligation)
 * - 60033 Bullseye (minion)
 * - 60034 Deadliest Man Alive (side_scheme)
 * - 60035 Stolen Sai (attachment)
 * - 60036 Eye on the Target (treachery)
 *
 * **60032**: "Give to the Matt Murdock player" is engine data (`obligationCardId`); the card stays in play. The Forced
 * Response hears any Sense upgrade entering play (put into play or played) and the Matt Murdock player takes 1 damage.
 * The Alter-Ego Response (optional) discards it after a basic recovery, as Hot-Headed (46024) does.
 *
 * **60033**: When Revealed, choose: discard a Persona support you control (offered only with one), or Bullseye attacks
 * you. A revealed minion engages the revealing player first; an attack is made against the identity in either form.
 *
 * **60034**: Forced Interrupt: when Bullseye attacks, he is given a facedown boost card (flipped in this attack).
 *
 * **60035**: "Attach to the enemy with the highest ATK" and +1 ATK are data. Attached character's attacks gain piercing
 * (an enemy or Elektra). Hero Action: spend two [physical] resources, choose to attach it to Elektra (offered only with
 * Elektra in play) or discard it. Boost: if the activation is an attack it gains piercing.
 *
 * **60036**: When Revealed, choose: remove an ally or Persona support you control from the game (offered only with
 * one), or Bullseye attacks you; "if he is not in play, find him and reveal him" is read as the attack's alternative
 * (he cannot attack from outside play), so with him in play he attacks and otherwise he is found and revealed, his own
 * When Revealed then resolving.
 */
export const FNE_DAREDEVIL_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "60032.obligation": coveredByEngineRule(),
  "60032.sensory-overload-forced-response": forcedResponse(
    after.entersPlay(query("upgrade", { trait: SENSE })),
    takeDamage(1),
  ),
  "60032.sensory-overload-response": alterEgoResponse(YOU_RECOVER, discard(self)),

  "60033.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Discard a Persona support you control",
        { when: exists(YOUR_PERSONA_SUPPORT) },
        chooseTarget("persona", YOUR_PERSONA_SUPPORT),
        discard(chosen("persona")),
      ),
      option("Bullseye attacks you", enemyAttack(self, { against: you })),
    ),
  ),

  "60034.deadliest-man-alive-forced-interrupt": forcedInterrupt(
    on.enemyAttacks(BULLSEYE_CARD),
    giveBoostCard(each(BULLSEYE_CARD)),
  ),

  "60035.stolen-sai-constant": constant(attacksGainKeywords(["piercing"], { attacker: { hostOfSelf: true } })),
  "60035.stolen-sai-action": heroAction(
    { cost: spend({ physical: 2 }) },
    chooseOne(
      option(
        "Attach this card to Elektra",
        { when: exists(ELEKTRA) },
        chooseTarget("elektra", ELEKTRA),
        attachCard(self, chosen("elektra")),
      ),
      option("Discard this card", discard(self)),
    ),
  ),
  "60035.boost": boost(modifyAttack({ keywords: ["piercing"] })),

  "60036.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Remove an ally or Persona support you control from the game",
        { when: exists(YOUR_ALLY_OR_PERSONA) },
        chooseTarget("removed", YOUR_ALLY_OR_PERSONA),
        moveCards(cards(chosen("removed")), "removedFromGame"),
      ),
      option(
        "Bullseye attacks you",
        ifThen(
          exists(BULLSEYE_CARD),
          enemyAttack(each(BULLSEYE_CARD), { against: you }),
          findCard(BULLSEYE_CARD, "reveal"),
        ),
      ),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_DAREDEVIL_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
