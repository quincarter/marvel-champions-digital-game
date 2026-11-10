import {
  after,
  anEnemy,
  cards,
  chooseCards,
  chosen,
  confuse,
  damageAnEnemy,
  defineAbilities,
  giveTough,
  moveCards,
  ofIdentitySetTitled,
  query,
  response,
  self,
  special,
  stun,
  you,
  zone,
} from "../../../dsl/index.js";

/**
 * Spider-Man / Miles Morales (27030a/b, MC27 p. 20): docs/phase7-wave5.md §2.1, §3.32. His obligation (Keeping
 * Secrets, 27056) and nemesis set (Prowler, 27057–27060) are scripted separately (`obligation-nemesis.ts`, not yet
 * built); his signature events/support/upgrade/allies (27031–27055) are likewise a separate module
 * (`events.ts`/`support-upgrades-allies.ts`, not yet built).
 *
 * **Spider-Man (hero, 27030a)** prints two Special abilities, resolved only when another card's effect names them
 * ("Resolve Spider-Man's 'Venom Blast'/'Spider Camouflage' ability", §3.32's `resolveSpecialsOf`; the callers live
 * in his own kit and other `sm` sets, not yet scripted):
 * - "Venom Blast - Special: Deal 2 damage to an enemy. Stun that enemy."
 * - "Spider Camouflage - Special: Give Spider-Man a tough status card. Confuse an enemy."
 *
 * Ability ids follow the card data's own naming (`27030a.spider-man-constant`, `-constant-2`) despite being
 * `special()` kind — the same "-constant" suffix on a `special()` ability that The Hood's stage abilities
 * (`wave4/hood/hood.ts`) and Nebula's Technique attachments (`wave3/gmw/nebula.ts`, `wave4/nebu/nebula-kit.ts`)
 * already use; nothing here is a `kind: "constant"` ability.
 *
 * **Miles Morales (alter-ego, 27030b)** — "Response: After you change to this form, shuffle 1 Spider-Man card from
 * your discard pile into your deck." Mirrors She-Hulk's `01019a.do-you-even-lift` (`core/heroes/she-hulk.ts`):
 * plain `response(after.youChangeForm(), …)` on the alter-ego face, live only once you're in alter-ego form since
 * the engine only offers a face's own abilities in the matching form. "1 Spider-Man card" is a card of his own
 * identity-specific set (RRG 1.8 "Identity-Specific Card", p. 23), not any card titled "Spider-Man": the Sinister
 * Motives rulebook's deck list files Arachnobatics, Web-Shot, Power Within and the rest under "Spider-Man cards" and
 * the Peter Parker ally under "Basic cards", and RRG 1.8 "Referential Ability" (p. 36) puts the cards associated
 * with the same identity first. So the basic allies titled "Spider-Man" (27011, 27017, 27049, Otto Octavius's
 * 31022) never qualify (issue #640). This is the `ofIdentitySetTitled` reading Colossus's "a Colossus card" uses
 * (`wave6/mut_gen/colossus/identity.ts`). `chooseCards` with `min: 0, max: 1` is a no-op when the discard pile holds no matching card, the same forgiving
 * shape Ghost-Spider's own alter-ego action already uses for an absent target.
 */
export const SPIDER_MAN_MORALES_IDENTITY = defineAbilities({
  "27030a.spider-man-constant": special(...damageAnEnemy(2, "enemy"), stun(chosen("enemy"))),
  "27030a.spider-man-constant-2": special(giveTough(self), anEnemy("camouflaged"), confuse(chosen("camouflaged"))),

  "27030b.miles-morales-response": response(
    after.youChangeForm(),
    chooseCards(
      "spiderMan",
      zone("discard", you, {
        filter: query(["ally", "event", "upgrade", "support"], ofIdentitySetTitled("Spider-Man")),
      }),
      { min: 0, max: 1 },
    ),
    moveCards(cards(chosen("spiderMan")), "deckShuffle"),
  ),
});
