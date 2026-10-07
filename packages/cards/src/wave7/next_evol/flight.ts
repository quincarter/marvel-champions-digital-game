import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  attackInProgress,
  attacksGainKeywords,
  boost,
  constant,
  dealIndirectDamage,
  defineAbilities,
  discard,
  each,
  exhaustYourHero,
  gainsTrait,
  gets,
  hasTrait,
  heroAction,
  ifElse,
  ifThen,
  ignoresRetaliate,
  modifyAttack,
  query,
  removeStatus,
  self,
  spend,
  takesDamageOnlyFromAttacks,
  theVillain,
  whenRevealed,
} from "../../dsl/index.js";

/**
 * The Flight set (40151-40154). Mister Sinister's Setup sets it aside and a stage 2B attaches Flight and shuffles the
 * rest in; in any other scenario it is an ordinary modular set and Flight enters play by its setup keyword, attached to
 * whichever villain is in play (data: `attachesTo: villain`; ATK +1 is the stat box).
 */
const AERIAL = trait("AERIAL");
const BRUTE = trait("BRUTE");
const ATTACHED_VILLAIN = query("villain", { hostOfSelf: true });
/** "Each friendly character": a hero or alter-ego and every ally. */
const FRIENDLY = query(["identity", "ally"]);

export const FLIGHT: AbilityRegistry = defineAbilities({
  // Flight — Attached villain gains the AERIAL trait. [star] Attached villain's attacks gain overkill.
  "40151.flight-constant": constant(gainsTrait(AERIAL, ATTACHED_VILLAIN)),
  "40151.flight-constant-2": constant(attacksGainKeywords(["overkill"], { attacker: { hostOfSelf: true } })),

  // Aerial Bombardment — [star] Attached villain gets +1 ATK and ignores the retaliate keyword while attacking a
  // non-AERIAL character (the defender once one is declared: the character the attack is against).
  "40152.aerial-bombardment-constant": constant(
    gets("atk", 1, ATTACHED_VILLAIN, {
      while: attackInProgress({ attacker: { hostOfSelf: true }, target: { withoutTrait: AERIAL } }),
    }),
    ignoresRetaliate(ATTACHED_VILLAIN, { against: { withoutTrait: AERIAL } }),
  ),
  // Hero Action: Exhaust your hero and spend [mental][mental] resources -> discard this card.
  "40152.aerial-bombardment-action": heroAction({ cost: [exhaustYourHero, spend({ mental: 2 })] }, discard(self)),

  // Out of Reach — The villain cannot take damage unless the attacker or attack has the AERIAL trait, or the attack has
  // ranged. Damage with no attack behind it is blocked too (owner answer Q17 = A).
  "40153.out-of-reach-constant": constant(
    takesDamageOnlyFromAttacks(query("villain"), {
      attacker: { trait: AERIAL },
      attackCard: { trait: AERIAL },
      attackKeyword: "ranged",
    }),
  ),
  // Hero Action: Exhaust your hero and spend [energy][energy] resources -> discard this card.
  "40153.out-of-reach-action": heroAction({ cost: [exhaustYourHero, spend({ energy: 2 })] }, discard(self)),

  // High Ground — When Revealed: Discard each tough status card from each friendly character. The players as a group
  // take 2 indirect damage (4 instead if the villain has the BRUTE trait). [star] Boost: If the villain is attacking,
  // this attack gains piercing.
  "40154.when-revealed": whenRevealed(
    removeStatus(each(FRIENDLY), "tough"),
    dealIndirectDamage("group", ifElse(hasTrait(theVillain, BRUTE), 4, 2)),
  ),
  "40154.boost": boost(
    ifThen(attackInProgress({ attacker: { categories: ["villain"] } }), modifyAttack({ keywords: ["piercing"] })),
  ),
});
