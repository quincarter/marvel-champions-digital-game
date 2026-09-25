import { trait } from "@mc/content";
import {
  after,
  attacksGainKeywords,
  boost,
  chosen,
  constant,
  countOf,
  dealDamage,
  defineAbilities,
  discardEncounterUntil,
  each,
  eachPlayer,
  enemyAttack,
  enemyScheme,
  exists,
  forcedResponse,
  forEachPlayer,
  gainsKeyword,
  gets,
  giveTough,
  ifThen,
  isHero,
  modifyAttack,
  query,
  revealCard,
  thatPlayer,
  undefendedAttack,
  whenRevealed,
} from "../../dsl/index.js";

/**
 * The Wrecking Crew modular set (`hood` 24064-24070, docs/phase7-wave4.md §2.3): a side scheme (Top Talent), three
 * minions (Wrecker, Bulldozer, Thunderball; Villainous is data) and two treacheries (Combined Effort, Magic
 * Muscle). Piledriver (24067) is a plain-stat minion (Retaliate 1, Villainous both data) with no ability refs.
 */

const ELITE = trait("ELITE");
const BRUTE = trait("BRUTE");
const ELITE_MINION = query("minion", { trait: ELITE });
const BRUTE_ENEMY = query("enemy", { trait: BRUTE });

export const WRECKING_CREW = defineAbilities({
  // Top Talent (24064, side scheme; Hinder is data) — The villain and each Elite minion gain retaliate 1.
  "24064.top-talent-constant": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, { categories: ["villain"] }),
    gainsKeyword({ name: "retaliate", value: 1 }, ELITE_MINION),
  ),

  // Wrecker (24065, minion; BRUTE/ELITE, Villainous are data) — [star] While Wrecker is attacking, he gets +2 ATK
  // if the attack is undefended.
  "24065.wrecker-constant": constant(gets("atk", 2, { self: true }, { while: undefendedAttack })),

  // Bulldozer (24066, minion; BRUTE/ELITE, Villainous are data) — [star] Bulldozer's attacks gain overkill.
  "24066.bulldozer-constant": constant(attacksGainKeywords(["overkill"], { attacker: { self: true } })),

  // Thunderball (24068, minion; BRUTE/ELITE, Villainous are data) — [star] Forced Response: after Thunderball
  // attacks you, deal 1 damage to each character you control.
  "24068.thunderball-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    dealDamage(1, each(query("character", { controller: "you" }))),
  ),

  // Combined Effort (24069, treachery; starIcon is data) — When Revealed: each Elite minion in play activates
  // against the player it is engaged with. If none activated this way, this card gains surge. [star] Boost: for
  // each Elite minion in play, this card gets +1 boost icon for this activation.
  "24069.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, [
      ifThen(
        exists(query("minion", { trait: ELITE, engagedWithPlayer: thatPlayer })),
        ifThen(
          isHero(thatPlayer),
          enemyAttack(each(query("minion", { trait: ELITE, engagedWithPlayer: thatPlayer })), { against: thatPlayer }),
          enemyScheme(each(query("minion", { trait: ELITE, engagedWithPlayer: thatPlayer })), { against: thatPlayer }),
        ),
      ),
    ]),
  ),
  "24069.boost": boost(modifyAttack({ extraBoostCards: countOf(ELITE_MINION) })),

  // Magic Muscle (24070, treachery) — When Revealed: give each Brute enemy in play a tough status card. If none
  // given this way, discard cards from the top of the encounter deck until a Brute minion is discarded and reveal
  // that minion.
  "24070.when-revealed": whenRevealed(
    ifThen(exists(BRUTE_ENEMY), giveTough(each(BRUTE_ENEMY)), [
      discardEncounterUntil(query("minion", { trait: BRUTE }), "found"),
      revealCard(chosen("found")),
    ]),
  ),
});
