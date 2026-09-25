import {
  atEndOfActivation,
  boost,
  chosen,
  dealEncounterCard,
  dealIndirectDamage,
  defineAbilities,
  discardAtRandom,
  discardCardsCost,
  discardEncounterUntil,
  discardThis,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  on,
  putIntoPlay,
  query,
  revealCard,
  self,
  stun,
  you,
  yourIdentity,
} from "../../dsl/index.js";
import type { EffectArg } from "../../dsl/index.js";

/**
 * The Brothers Grimm modular set (`hood` 24018-24022, docs/phase7-wave4.md §2.3): a minion (Brothers Grimm) and four
 * Mystic-minion/villain attachments (Blackbird Pellets, Corrosive Egg Bomb, Paralytic Stardust, Unbreakable Thread)
 * sharing an identical shape: "Attach to a Mystic minion. If you cannot, attach to the villain" (data,
 * `attachesTo.ifAble`) and "[star] Forced Response: After attached enemy activates against you, discard this card
 * → <its own effect> and deal yourself 1 facedown encounter card."
 */

/** "[star] Forced Response: After attached enemy activates against you, discard this card → <then> and deal
 * yourself 1 facedown encounter card." */
const afterAttachedActivates = (...then: readonly EffectArg[]) =>
  forcedResponse(on.enemyAttacks("host", { againstYou: true }), { cost: discardThis }, ...then, dealEncounterCard(you));

export const BROTHERS_GRIMM = defineAbilities({
  // Brothers Grimm (24018, minion; MASTERS OF EVIL/MYSTIC, starIcon are data) — [star] Forced Interrupt: when
  // Brothers Grimm activates against you, discard cards from the top of the encounter deck until an attachment is
  // discarded; reveal that card. [star] Boost: after this activation ends, put Brothers Grimm into play engaged
  // with the first player.
  "24018.brothers-grimm-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    discardEncounterUntil(query("attachment"), "found"),
    revealCard(chosen("found")),
  ),
  "24018.boost": boost(atEndOfActivation(putIntoPlay(self, firstPlayer))),

  // Blackbird Pellets (24019) — → discard 1 card at random from your hand and deal yourself 1 facedown encounter card.
  "24019.blackbird-pellets-forced-response": afterAttachedActivates(discardAtRandom(1)),

  // Corrosive Egg Bomb (24020) — → take 3 indirect damage and deal yourself 1 facedown encounter card.
  "24020.corrosive-egg-bomb-forced-response": afterAttachedActivates(dealIndirectDamage(you, 3)),

  // Paralytic Stardust (24021) — → stun your identity and deal yourself 1 facedown encounter card.
  "24021.paralytic-stardust-forced-response": afterAttachedActivates(stun(yourIdentity)),

  // Unbreakable Thread (24022) — → choose and discard 1 ally, support, or upgrade you control, and deal yourself
  // 1 facedown encounter card.
  "24022.unbreakable-thread-forced-response": forcedResponse(
    on.enemyAttacks("host", { againstYou: true }),
    { cost: [discardThis, discardCardsCost(query(["ally", "support", "upgrade"], { controller: "you" }))] },
    dealEncounterCard(you),
  ),
});
