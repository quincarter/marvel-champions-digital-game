import {
  after,
  chooseTarget,
  chosen,
  dealDamage,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardAtRandom,
  discardDeckUntil,
  each,
  eventTarget,
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
 * Sinister Assault (`sm` 27158–27163, docs/phase7-wave5.md §2.2/§4.1 Q67 survey's own "not scripted yet" list): six
 * Elite minions, one per Sinister Six member — Doctor Octopus, Electro, Hobgoblin, Kraven the Hunter, Scorpion,
 * Vulture. Each card's own stat line, traits and villain-phase keyword (Incite 2, Retaliate 1, Patrol, Steady,
 * Toughness, Quickstrike) plus "Villainous" are all data (`packages/content/src/data/sm/cards.ts`), not scripted
 * here; only the `[star]` Forced Response on each is an ability.
 *
 * Doctor Octopus, Electro and Vulture are worded "activates against you" — `on.enemyActivates`/`after.enemyActivates`
 * (RRG 1.8 "Activation", p. 6; docs/phase7-wave5.md §4.1 Q67): a card-caused attack or scheme against a player is
 * also an activation, so these fire from a card effect that makes the minion attack or scheme, not only from its own
 * villain-phase step 2 activation. Hobgoblin is worded "attacks you" (the Q67 survey's own "stays an attack" list),
 * so it keeps `on.enemyAttacks`. Kraven the Hunter and Scorpion are worded "attacks and damages a character[, …]",
 * naming no activation at all — also `on.enemyAttacks`, following Klaw's Sonic Converter (`core` 01118) and Laufey
 * (`mts` 21156) for the identical "attacks and damages a character, stun that character" shape.
 */
export const SINISTER_ASSAULT = defineAbilities({
  // Doctor Octopus (27158, minion; ATK 2/SCH 2/HP 6/ELITE/GENIUS are data) — Incite 2. Villainous (data). [star]
  // Forced Response: After Doctor Octopus activates against you, place 1 threat on each scheme. The effect names no
  // player ("each scheme" is every main and side scheme in play, `venom-goblin/main-scheme.ts`'s own "each scheme"
  // precedent), so the trigger doesn't need to resolve "you" to anything.
  "27158.doctor-octopus-forced-response": forcedResponse(
    after.enemyActivates("self", { againstYou: true }),
    placeThreat(1, each(query("scheme"))),
  ),

  // Electro (27159, minion; ATK 1/SCH 2/HP 6/CRIMINAL/ELITE are data) — Retaliate 1. Villainous (data). [star]
  // Forced Response: After Electro engages you or activates against you, discard cards from the top of your deck
  // until you discard a [energy] or [wild] resource. "Engages" is a separate event from an activation (RRG 1.8
  // "Engage", p. 18, vs. "Activation" p. 6), so the trigger is a raw multi-kind pattern over `minionEngaged` plus
  // the activation events — the same shape `wave3/gmw/badoon.ts` Badoon Engineer (16065) and Badoon Assassin
  // (16117) already use for "engages you or activates against you". None of these three events carries a
  // controller, so "your deck" resolves through the same "an encounter card's 'you' is the player the event is
  // about" rule (`resolve/triggers.ts` `actingPlayerOf`) the Badoon cards rely on too — no explicit `playerIs`
  // needed for any of them.
  "27159.electro-forced-response": forcedResponse(
    { on: ["minionEngaged", "enemyAttack", "enemyScheme"], selfIs: "source" },
    discardDeckUntil({ anyPrintedResource: ["energy", "wild"] }, "found"),
  ),

  // Hobgoblin (27160, minion; ATK 2/SCH 1/HP 6/AERIAL/ELITE are data) — Patrol. Villainous (data). [star] Forced
  // Response: After Hobgoblin attacks you, take 2 indirect damage.
  "27160.hobgoblin-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    dealIndirectDamage(you, 2),
  ),

  // Kraven the Hunter (27161, minion; ATK 2/SCH 1/HP 6/ELITE are data) — Steady. Villainous (data). [star] Forced
  // Response: After Kraven the Hunter attacks and damages a character you control, discard 1 upgrade or support you
  // control. "A character you control" is checked in the effect body (`refMatches(eventTarget, …)`), not the
  // trigger pattern: `EventPattern.targetIs`'s own query would resolve "you" against this uncontrolled card's null
  // controller (wrong player), where the effect body's `you` instead resolves through `actingPlayerOf` to the
  // attacked player already, matching every other card here.
  "27161.kraven-the-hunter-forced-response": forcedResponse(
    after.enemyAttacks("self", { damages: true }),
    ifThen(refMatches(eventTarget, query("character", { controller: "you" })), [
      chooseTarget("card", query(["upgrade", "support"], { controller: "you" })),
      discard(chosen("card")),
    ]),
  ),

  // Scorpion (27162, minion; ATK 3/SCH 1/HP 6/BRUTE/ELITE are data) — Toughness. Villainous (data). [star] Forced
  // Response: After Scorpion attacks and damages a character, stun that character. If it is already stunned, deal 2
  // damage to it. The "already" check reads the character's status before this ability's own stun would apply it
  // (Sonic Converter/Laufey's shape, extended with the "if it is already stunned" branch this card adds).
  "27162.scorpion-forced-response": forcedResponse(
    after.enemyAttacks("self", { damages: true }),
    ifThen(isStunned(eventTarget), dealDamage(2, eventTarget), stun(eventTarget)),
  ),

  // Vulture (27163, minion; ATK 1/SCH 1/HP 6/AERIAL/ELITE are data) — Quickstrike. Villainous (data). [star] Forced
  // Response: After Vulture activates against you, discard 1 random card from your hand.
  "27163.vulture-forced-response": forcedResponse(on.enemyActivates("self", { againstYou: true }), discardAtRandom(1)),
});
