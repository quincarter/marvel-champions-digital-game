import { trait } from "@mc/content";
import {
  anAttackableEnemy,
  anEnemy,
  aScheme,
  andThen,
  attack,
  attachCost,
  cards,
  chooseCards,
  chosen,
  confuse,
  defineAbilities,
  dealDamageCost,
  draw,
  each,
  exists,
  find,
  gainTraitsOfUntil,
  giveTough,
  hasAttachment,
  heal,
  heroAction,
  heroInterrupt,
  ifElse,
  ifThen,
  modifyAttack,
  moveCardsInto,
  on,
  ownerOf,
  query,
  ready,
  refMatches,
  sameClassificationAs,
  stun,
  thwart,
  yourIdentity,
  you,
  youHaveTrait,
  zone,
} from "../../../dsl/index.js";

/** "Touched": the upgrade Rogue's identity and these events name. */
const TOUCHED = query("upgrade", { name: "Touched" });
/** "If Rogue has [keyword]": her current keywords, so Touched's grants and printed ones both count. */
const rogueHas = (keyword: "retaliate" | "stalwart") =>
  refMatches(yourIdentity, query("identity", { withKeyword: keyword }));
const AERIAL = youHaveTrait(trait("AERIAL"));
/** "The character Touched is attached to". */
const TOUCHED_HOST = each(query("character", hasAttachment(TOUCHED)));

/**
 * Rogue's events (`rogue` 38005-38009), docs/phase7-wave6.md §6.2, §3.48-§3.51.
 *
 * - **Goin' Rogue (38005) / Southern Cross (38006)**: the amount and each bullet are read from Rogue as the effect
 *   resolves, so what Touched and Skin Contact give her counts. The AERIAL bullet is one removal / one attack of the
 *   larger amount ("2 additional"). Retaliate's confuse (an enemy of her choosing) and stun (that enemy, if it is
 *   still in play after the attack) and Stalwart's draw are separate bullets, each applying on its own.
 * - **Energy Transfer (38007)**: RRG 1.8 erratum p. 69, "Find Touched and attach it to a character other than Rogue
 *   and deal 2 damage to that character → ...". Attaching and the 2 damage are the cost (paid even if the damage is
 *   prevented, RRG p. 14); the heal, ready and trait grant are the effect. The grant ends at the end of the round or
 *   when Touched leaves that host (§4 Q28).
 * - **Bulletproof Belle (38008)**: "an enemy with Touched attached to it" is read from where Touched is; the damage is
 *   prevented on the attack itself, the tough card goes to Rogue.
 * - **Superpower Adaptation (38009)**: "friendly" is an identity or ally; the search reads the host owner's discard
 *   pile and the card goes to your hand but stays its owner's (§4 Q29). The arrow's search is an effect here:
 *   `chooseCardCost` reads only the payer's own zone, so another player's discard pile is out of its reach (reported).
 */
export const ROGUE_EVENTS = defineAbilities({
  "38005.goin-rogue-action": heroAction(
    { label: "thwart" },
    aScheme("scheme"),
    thwart(ifElse(AERIAL, 5, 3), chosen("scheme")),
    ifThen(rogueHas("retaliate"), [anEnemy("enemy"), confuse(chosen("enemy"))]),
    ifThen(rogueHas("stalwart"), draw(1)),
  ),

  "38006.southern-cross-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(ifElse(AERIAL, 8, 6), chosen("enemy")),
    ifThen(rogueHas("retaliate"), ifThen(refMatches(chosen("enemy"), query("enemy")), stun(chosen("enemy")))),
    ifThen(rogueHas("stalwart"), draw(1)),
  ),

  "38007.energy-transfer-action": heroAction(
    {
      cost: [
        attachCost(find(TOUCHED, { owner: you }), query("character", { excluding: yourIdentity }), "host", {
          bind: "touched",
        }),
        dealDamageCost(chosen("host"), 2),
      ],
    },
    heal(2, yourIdentity),
    ready(yourIdentity),
    gainTraitsOfUntil(chosen("host"), yourIdentity, "endOfRound", { whileAttached: chosen("touched") }),
  ),

  "38008.bulletproof-belle-interrupt": heroInterrupt(
    on.enemyAttacks(query("enemy", hasAttachment(TOUCHED))),
    { label: "defense" },
    modifyAttack({ preventAllDamage: true }),
    giveTough(yourIdentity),
  ),

  "38009.superpower-adaptation-action": heroAction(
    ifThen(
      exists(query(["identity", "ally"], hasAttachment(TOUCHED))),
      andThen(
        chooseCards(
          "found",
          zone("discard", ownerOf(TOUCHED_HOST), { filter: query("event", sameClassificationAs(TOUCHED_HOST)) }),
          { min: 1, max: 1 },
        ),
        moveCardsInto(cards(chosen("found")), "hand", you),
      ),
    ),
  ),
});
