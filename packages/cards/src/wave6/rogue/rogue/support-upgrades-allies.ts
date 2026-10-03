import { trait } from "@mc/content";
import {
  addCounters,
  after,
  alterEgoAction,
  cards,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  dealDamage,
  draw,
  eventSource,
  eventTarget,
  eventPlayer,
  exhaustThis,
  exists,
  forcedResponse,
  gets,
  hasAttachment,
  interrupt,
  modifyStat,
  on,
  ownerOf,
  playTuckedCard,
  query,
  removeCounter,
  resource,
  response,
  self,
  stun,
  treatAsAlly,
  tuckCards,
  tuckedCount,
  valueEquals,
  you,
  YOUR_IDENTITY,
} from "../../../dsl/index.js";
import { DRS_PACK_CARDS } from "../../../wave1/drs/pack-cards.js";
import { MUT_GEN_PRECON_PLAYER_CARDS } from "../../mut_gen/precon-player-cards.js";

const CONTROLLED = trait("CONTROLLED");
const ELITE = trait("ELITE");
const MUTANT = trait("MUTANT");

/** "Touched": Rogue's signature upgrade, read from where it is attached. */
const TOUCHED = query("upgrade", { name: "Touched" });
/** Rogue herself: the identity of the card's owner (RRG 1.8 p. 31), as `identity.ts` reads her from Touched. */
const ROGUE = query("identity", { controlledBy: ownerOf(self) });
/** "Touched is attached to a friendly character": a hero-form or alter-ego identity, or an ally. */
const TOUCHED_ON_FRIENDLY = exists(query(["identity", "ally"], hasAttachment(TOUCHED)));
/** "Touched is attached to an enemy character": a villain or a minion. */
const TOUCHED_ON_ENEMY = exists(query("enemy", hasAttachment(TOUCHED)));

/**
 * Rogue's allies, supports, upgrades and resources (`rogue` 38003, 38004, 38010-38014, 38017-38019, 38021-38023,
 * 38028), docs/phase7-wave6.md §6.2. Her events are `events.ts`.
 *
 * - **Gambit (38003)**: enters play with 3 charge counters; his interrupt removes one as a cost and deals 1 damage to
 *   an enemy of the player's choosing (any enemy, not only the one he is attacking).
 * - **Rogue's Jacket (38004)**: two constants on Rogue herself, each live while Touched sits on a friendly (identity or
 *   ally) or an enemy (villain or minion) character.
 * - **Iceman (38010)**: after any minion enters play, one freeze counter off him is the cost to stun it.
 * - **Karma (38011)**: after you play her from your hand, a non-ELITE minion is taken as a CONTROLLED ally for as long
 *   as she stays in play (`treatAsAlly`, wave 4 §3.29).
 * - **Armor (38012)**: Toughness and the X-MEN play restriction are card data, no ability.
 * - **Judoka Skill (38014)**: uses (3 judo counters) is data; the enemy gets -2 ATK for that attack only.
 * - **Moira MacTaggert (38018)**: the identity's traits before the change are read (§3.56), so a MUTANT alter-ego
 *   triggers it; the hero's controller, not necessarily Moira's, draws.
 * - **X-Gene (38019)**: a wild resource for an identity-specific event of the player's own set.
 * - **Med Lab (38028)**: "an ally" is any player's (the card says neither "you control" nor "your"), defeated by its own
 *   consequential damage; "place it here" tucks it from wherever the defeat left it (the discard pile, or a hand it
 *   was returned to), never from the removed-from-game area (ruling Dec 17, 2025 (4) #2: the response then has no
 *   target and is not offered). "(Limit 1 ally at a time.)" is the response's `while` (§3.57): with an ally already
 *   here it is not offered and Med Lab is not exhausted. The action plays the tucked ally as if from hand, at its cost,
 *   exhausted (RRG 1.8 "Tuck", p. 45; "Play, Put Into Play", p. 32). "Max 1 per player" is card data.
 * - **Reprints, aliased**: Unflappable 38013 (`drs` 09020) and Defensive Energy 38017 (`mut_gen` 32018).
 */
export const ROGUE_SUPPORT_UPGRADES_ALLIES = defineAbilities({
  "38003.gambit-constant": forcedResponse(after.entersPlay("self"), addCounters("charge", 3)),
  "38003.gambit-interrupt": interrupt(
    on.attacks("self"),
    { cost: removeCounter("charge") },
    chooseTarget("enemy", query("enemy")),
    dealDamage(1, chosen("enemy")),
  ),

  "38004.rogues-jacket-constant": constant(gets("thw", 1, ROGUE, { while: TOUCHED_ON_FRIENDLY })),
  "38004.rogues-jacket-constant-2": constant(gets("atk", 1, ROGUE, { while: TOUCHED_ON_ENEMY })),

  "38010.iceman-constant": forcedResponse(after.entersPlay("self"), addCounters("freeze", 3)),
  "38010.iceman-response": response(
    after.entersPlay(query("minion")),
    { cost: removeCounter("freeze") },
    stun(eventTarget),
  ),

  "38011.karma-response": response(
    after.youPlayThis(),
    chooseTarget("minion", query("minion", { withoutTrait: ELITE })),
    treatAsAlly(chosen("minion"), [CONTROLLED], 2),
  ),

  "38013.unflappable-response": DRS_PACK_CARDS["09020.unflappable-response"]!,

  "38014.judoka-skill-interrupt": interrupt(
    on.defends(YOUR_IDENTITY),
    { cost: removeCounter("judo") },
    modifyStat("atk", -2, eventSource, "endOfAttack"),
  ),

  "38017.defensive-energy-interrupt": MUT_GEN_PRECON_PLAYER_CARDS["32018.defensive-energy-interrupt"]!,

  "38018.moira-mactaggert-response": response(
    on.playerChangesForm("hero", { fromTrait: MUTANT }),
    { cost: exhaustThis },
    draw(1, eventPlayer),
  ),

  "38019.x-gene-resource": resource(
    { wild: 1 },
    { cost: exhaustThis, generatesFor: query("event", { identitySetOf: you }) },
  ),

  "38028.med-lab-response": response(
    after.defeated(query("ally"), { consequential: true }),
    { cost: exhaustThis, while: valueEquals(tuckedCount(), 0) },
    tuckCards(cards(eventTarget), self),
  ),
  "38028.med-lab-action": alterEgoAction({ cost: exhaustThis }, playTuckedCard({ entersExhausted: true })),
});
