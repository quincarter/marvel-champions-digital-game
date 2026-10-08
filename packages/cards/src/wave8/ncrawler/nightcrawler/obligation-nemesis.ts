import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  attacksGainKeywords,
  boost,
  constant,
  dealAsEncounterCard,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardRandomFromHandCost,
  enemyScheme,
  find,
  heroResponse,
  moveCards,
  named,
  playersWhere,
  query,
  refMatches,
  revealCard,
  rule,
  self,
  thatPlayer,
  whenDefeated,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  zone,
} from "../../../dsl/index.js";
import { trait } from "@mc/content";
import { obligation } from "../../../core/obligations.js";

const AZAZEL = "Azazel";

/**
 * "The Kurt Wagner player": the player whose nemesis minion this card is. Encounter cards have no owner (`ownerOf(self)`
 * names nobody: the nemesis set is set aside per player but its instances are the scenario's), so the player is found
 * by the nemesis relation, which holds in either form of the identity and whoever is being attacked.
 */
const KURT_WAGNER_PLAYER = playersWhere(
  refMatches(self, query("minion", { nemesisMinionOf: thatPlayer }), { anywhere: true }),
);

/** "Each Attack and Defense event": the two printed event types are traits (ATTACK, DEFENSE) in the card data. */
const ATTACK_OR_DEFENSE_EVENT = query("event", { anyTrait: [trait("ATTACK"), trait("DEFENSE")] });

/**
 * Nightcrawler's obligation and nemesis set (docs/phase7-wave8.md section 7.4, 3.1, 3.75, 3.72, 3.81).
 *
 * Cards (5):
 * - 48026 Crisis of Faith (obligation)
 * - 48027 Azazel (minion)
 * - 48028 Brimstone Dimension (side_scheme)
 * - 48029 Azazel's Sword (attachment)
 * - 48030 Brimstone Strike (treachery)
 *
 * **Crisis of Faith (48026)**: Core's shared `obligation()` shape: "Give to the Kurt Wagner player" is engine data
 * (`obligationCardId`); the player may flip to alter-ego form (a card effect, not the once-per-round form change), then
 * chooses: exhaust Kurt Wagner to remove it from the game, or discard each Attack and Defense event from their hand and
 * discard the obligation. The second option may be chosen with no such event in hand (section 3.81).
 *
 * **Azazel (48027)**: Quickstrike is data. "Azazel cannot have upgrades attached" is `cannotHaveAttachments` narrowed
 * to upgrades, so Bamf!, Under Control and every other upgrade is refused as an attach target (an encounter attachment,
 * Azazel's Sword, is still legal). The Boost deals the boost card itself to the Kurt Wagner player (the nemesis set's own
 * player, found by the nemesis relation: an encounter card has no `ownerOf`), whoever is being attacked, as a facedown encounter card.
 *
 * **Brimstone Dimension (48028)**: 5 threat whatever the player count and a hazard icon are data. When Defeated: the
 * defeating player finds Azazel wherever a find reaches and deals him to themself facedown. A copy in play leaves play
 * undefeated through the ordinary leave (section 3.75 (a)) and is revealed as a fresh card in the next reveal step.
 *
 * **Azazel's Sword (48029)**: "Attach to Azazel. Otherwise, attach to the villain." and its +1 ATK are data. The star
 * constant gives the attached enemy's attacks piercing. Hero Response: after the attached enemy attacks you, discard 1
 * random card from your hand (the cost) to discard this card.
 *
 * **Brimstone Strike (48030)**: When Revealed (Alter-Ego): find Azazel, reveal him (he engages the revealing player),
 * then he schemes (nothing to scheme when he was found nowhere). When Revealed (Hero): the find and reveal only.
 */
export const NIGHTCRAWLER_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "48026.obligation": obligation("Kurt Wagner", {
    label: "Discard each Attack and Defense event from your hand",
    effects: [moveCards(zone("hand", you, { filter: ATTACK_OR_DEFENSE_EVENT }), "discard")],
  }),

  "48027.azazel-constant": constant(rule({ kind: "cannotHaveAttachments", target: { self: true }, from: "upgrade" })),
  "48027.boost": boost(dealAsEncounterCard(self, KURT_WAGNER_PLAYER)),

  "48028.when-defeated": whenDefeated(dealAsEncounterCard(find(query("minion", { name: AZAZEL })), defeatingPlayer)),

  "48029.azazels-sword-constant": constant(
    attacksGainKeywords(["piercing"], { attacker: query("enemy", { hostOfSelf: true }) }),
  ),
  "48029.azazels-sword-response": heroResponse(
    after.enemyAttacks("host", { againstYou: true }),
    { cost: discardRandomFromHandCost(1) },
    discard(self),
  ),

  "48030.when-revealed-alter-ego": whenRevealedAlterEgo(
    revealCard(find(query("minion", { name: AZAZEL })), you),
    enemyScheme(named(AZAZEL)),
  ),
  "48030.when-revealed-hero": whenRevealedHero(revealCard(find(query("minion", { name: AZAZEL })), you)),
});

/** Refs left unregistered, each with its reason (the coverage test reads this through its own `skipped` list). */
export const NIGHTCRAWLER_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
