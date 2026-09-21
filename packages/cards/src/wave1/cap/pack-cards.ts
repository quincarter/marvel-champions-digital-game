import {
  constant,
  damageAnEnemy,
  defineAbilities,
  exhaustThis,
  gets,
  heroInterrupt,
  heroResource,
  interrupt,
  modifyStat,
  removeCounter,
  when,
  yourIdentity,
  YOUR_HERO,
} from "../../dsl/index.js";

/**
 * Aggression/Justice/Protection/basic-aspect filler cards bundled in the Captain America pack, not part of his
 * signature hero-kit set (`aspect` is the generic aspect, not `hero:03001a`): Enraged (03031, aggression),
 * Followed (03032, justice), Expert Defense (03033, protection), Enhanced Awareness (03034, basic).
 */
export const CAP_PACK_CARDS = defineAbilities({
  // Enraged — Attach to an ally (data). Attached ally gets +2 ATK and takes +1 consequential damage after it attacks.
  "03031.enraged-constant": constant(
    gets("atk", 2, { hostOfSelf: true }),
    gets("consequentialAttack", 1, { hostOfSelf: true }),
  ),

  // Followed — Attach to a side scheme (data; "Max 1 per scheme" is `playRestrictions.maxPerHost`). No separate
  // effect: the printed text is only the attach restriction plus the interrupt below.
  "03032.followed-constant": { trigger: { kind: "constant" }, effects: [] },
  // Followed — Interrupt: When attached scheme is defeated, deal 4 damage to an enemy.
  "03032.followed-interrupt": interrupt(when.schemeDefeated("host"), damageAnEnemy(4)),

  // Expert Defense — Hero Interrupt (defense): When your hero defends against an attack, it gets +3 DEF for that attack.
  "03033.expert-defense-interrupt": heroInterrupt(
    when.defends(YOUR_HERO),
    { label: "defense" },
    modifyStat("def", 3, yourIdentity, "endOfAttack"),
  ),

  // Enhanced Awareness — Uses (3 mental counters) (data). Hero Resource: Exhaust and remove 1 mental counter →
  // generate a [mental] resource.
  "03034.enhanced-awareness-resource": heroResource({ mental: 1 }, { cost: [exhaustThis, removeCounter("mental")] }),
});
