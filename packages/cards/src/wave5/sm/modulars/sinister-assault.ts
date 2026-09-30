import {
  after,
  defineAbilities,
  dealDamage,
  dealIndirectDamage,
  discard,
  discardAtRandom,
  discardDeckUntil,
  chooseTarget,
  chosen,
  each,
  eventTarget,
  exists,
  forcedResponse,
  ifThen,
  isStunned,
  on,
  placeThreat,
  query,
  refMatches,
  stun,
  you,
} from "../../../dsl/index.js";

/**
 * Sinister Assault (`sm` 27158-27163, docs/phase7-wave5.md §2.2): six elite minions (Doctor Octopus, Electro,
 * Hobgoblin, Kraven the Hunter, Scorpion, Vulture), each printing a keyword (Incite 2/Retaliate 1/Patrol/Steady/
 * Toughness/Quickstrike — data) plus "Villainous" (data, fully engine-implemented: `spec.ts`/`resolve/apply-effect.ts`/
 * `resolve/enemy-activation.ts`) and one `[star]` Forced Response. The `[star]` marker itself is a reminder icon with
 * no gameplay meaning (`osborn-tech.ts`'s own curation-notes citation).
 *
 * **"Activates against you"** (Doctor Octopus, Electro, Vulture) is `on.enemyActivates`/`after.enemyActivates`
 * (docs/phase7-wave5.md §4.1 Q67; RRG 1.8 "Activation", p. 6): an attack against the player in hero form, a scheme
 * against them in alter-ego form — both covered by one pattern rather than the module previously (wrongly) assuming
 * "activates" always means "attacks". Electro's own "engages you or **activates against you**" adds `minionEngaged`
 * to the same pattern list, following Badoon Engineer's identical wording (`wave3/gmw/badoon.ts` 16065).
 *
 * **"Attacks you" / "attacks and damages a character (you control)"** (Hobgoblin, Kraven, Scorpion) is the narrower
 * `after.enemyAttacks`: it does not fire on a scheme, so an alter-ego-form activation (which schemes, not attacks)
 * never triggers these three, unlike the "activates against you" trio above — the negative case each of their own
 * tests exercises. Scorpion's own "attacks and damages a character" (no "you control") reuses Griffin's own
 * `eventTarget` shape (`wave4/hood/beasty-boys.ts` 24015) rather than Kraven's `controller: "you"`-scoped one.
 */
export const SINISTER_ASSAULT = defineAbilities({
  // Doctor Octopus (27158, minion; ATK 2/SCH 2/HP 6/ELITE/GENIUS, Incite 2, 3 boost icons are data) — [star] Forced
  // Response: After Doctor Octopus activates against you, place 1 threat on each scheme.
  "27158.doctor-octopus-forced-response": forcedResponse(
    after.enemyActivates("self", { againstYou: true }),
    placeThreat(1, each(query("scheme"))),
  ),

  // Electro (27159, minion; ATK 1/SCH 2/HP 6/CRIMINAL/ELITE, Retaliate 1, 3 boost icons are data) — [star] Forced
  // Response: After Electro engages you or activates against you, discard cards from the top of your deck until
  // you discard a [energy] or [wild] resource. The match itself is left in the discard pile (`discardDeckUntil`'s
  // own doc comment); nothing further happens if your deck runs out first (RRG 1.8 "Player Deck", p. 33).
  "27159.electro-forced-response": forcedResponse(
    { on: ["minionEngaged", "enemyAttack", "enemyScheme"], selfIs: "source" },
    discardDeckUntil({ anyPrintedResource: ["energy", "wild"] }, "found"),
  ),

  // Hobgoblin (27160, minion; ATK 2/SCH 1/HP 6/AERIAL/ELITE, Patrol, 3 boost icons are data) — [star] Forced
  // Response: After Hobgoblin attacks you, take 2 indirect damage.
  "27160.hobgoblin-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    dealIndirectDamage(you, 2),
  ),

  // Kraven the Hunter (27161, minion; ATK 2/SCH 1/HP 6/ELITE, Steady, 3 boost icons are data) — [star] Forced
  // Response: After Kraven the Hunter attacks and damages a character you control, discard 1 upgrade or support you
  // control. "A character you control" is checked as an effect-level condition (`refMatches`), not a pattern
  // `targetIs` filter: an encounter card's own ability always resolves with a `null` trigger-match controller (RRG
  // 1.8 "Ability", p. 4's "any player can use it" — `resolve/apply-effect.ts`'s own `engage` sets `controllerId:
  // null`), so a `TargetQuery.controller: "you"` inside `targetIs` can never match anything at match time; "you"
  // only resolves correctly once the ability is actually offered/resolved and `frame.controllerId` is filled in
  // from the event's own player. No "choose" is printed, but a choice among several matches still needs a chooser
  // (RRG 1.8 "Choose (Option)", p. 12) — the player who'd discard it, the same convention Beetle/Boomerang's own
  // "discard 1 X you control" forced responses use (`wave4/hood/sinister-syndicate.ts` 24043/24044).
  "27161.kraven-the-hunter-forced-response": forcedResponse(
    after.enemyAttacks("self", { damages: true }),
    ifThen(
      refMatches(eventTarget, query("character", { controller: "you" })),
      ifThen(exists(query(["upgrade", "support"], { controller: "you" })), [
        chooseTarget("pick", query(["upgrade", "support"], { controller: "you" })),
        discard(chosen("pick")),
      ]),
    ),
  ),

  // Scorpion (27162, minion; ATK 3/SCH 1/HP 6/BRUTE/ELITE, Toughness, 3 boost icons are data) — [star] Forced
  // Response: After Scorpion attacks and damages a character, stun that character. If it is already stunned, deal
  // 2 damage to it (checked before this ability's own stun applies, the "already" convention `drax-obligation-
  // nemesis.ts`/`gamora-obligation-nemesis.ts`/`red-skull.ts` all use).
  "27162.scorpion-forced-response": forcedResponse(
    after.enemyAttacks("self", { damages: true }),
    ifThen(isStunned(eventTarget), dealDamage(2, eventTarget), stun(eventTarget)),
  ),

  // Vulture (27163, minion; ATK 1/SCH 1/HP 6/AERIAL/ELITE, Quickstrike, 3 boost icons are data) — [star] Forced
  // Response: After Vulture activates against you, discard 1 random card from your hand.
  "27163.vulture-forced-response": forcedResponse(on.enemyActivates("self", { againstYou: true }), discardAtRandom(1)),
});
