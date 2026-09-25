import {
  attacksGainKeywords,
  boost,
  chooseTarget,
  chosen,
  constant,
  dealEncounterCard,
  defeatingPlayer,
  discard,
  exists,
  ifThen,
  modifyAttack,
  query,
  whenDefeated,
} from "../../dsl/index.js";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Children of Thanos (`mts` modular, 21125–21128, docs/phase7-wave4.md §2.2, §3.23): Thanos's own recommended
 * modular set (Black Order, `mts` 21100–21110, is scripted by Tower Defense — docs/phase7-wave4.md's own note on
 * `ebony-maw.ts`). Corvus Glaive and Ebony Maw (21125, 21127; Elite, Retaliate 1, Toughness, Villainous are data)
 * each print only a Boost line; Proxima Midnight (21126) also prints a standing "attacks gain piercing" line above
 * her Boost (the `[star]` marking both is the card's own bullet-icon convention, not a boost-only condition — the
 * same convention Black Panther's "Special" abilities use, `bp` 20003/20501/etc., not tied to being dealt as a
 * boost card); Tribute (21128, side scheme, Crisis icon is data) is a plain When Defeated.
 */
export const CHILDREN_OF_THANOS = defineAbilities({
  // Corvus Glaive (minion, 21125) — [star] Boost: Discard an ally or support you control.
  "21125.boost": boost(
    ifThen(exists(query(["ally", "support"], { controller: "you" })), [
      chooseTarget("discard", query(["ally", "support"], { controller: "you" })),
      discard(chosen("discard")),
    ]),
  ),

  // Proxima Midnight (minion, 21126) — Proxima Midnight's attacks gain piercing (a standing constant, not a boost
  // effect — see the module docblock). [star] Boost: Discard an ally or upgrade you control.
  "21126.proxima-midnight-constant": constant(attacksGainKeywords(["piercing"], { attacker: { self: true } })),
  "21126.boost": boost(
    ifThen(exists(query(["ally", "upgrade"], { controller: "you" })), [
      chooseTarget("discard", query(["ally", "upgrade"], { controller: "you" })),
      discard(chosen("discard")),
    ]),
  ),

  // Ebony Maw (minion, 21127; Villainous is data) — [star] Boost: Give this enemy 1 additional boost card (for
  // this activation — the raw MarvelCDB text is truncated before that clause, but the shape is the standard "1
  // additional boost card" idiom, `modifyAttack({ extraBoostCards })`; `enemy-activation.ts` reads `extraBoost` in
  // both the attack and the scheme `giveBoost` step, so this works whichever kind of activation the boost lands on).
  "21127.boost": boost(modifyAttack({ extraBoostCards: 1 })),

  // Tribute (side scheme x2, 21128; Crisis icon is data) — When Defeated: Deal the player who defeated this scheme
  // a facedown encounter card.
  "21128.when-defeated": whenDefeated(dealEncounterCard(defeatingPlayer)),
});
