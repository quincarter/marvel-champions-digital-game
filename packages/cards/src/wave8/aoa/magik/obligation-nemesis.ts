import { cardId, trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  allOf,
  attachCard,
  bindTargets,
  boost,
  constant,
  dealDamage,
  defineAbilities,
  each,
  enemyActivates,
  eventDealt,
  eventTarget,
  exists,
  find,
  forcedResponse,
  identityOf,
  ifThen,
  made,
  moveCards,
  named,
  not,
  on,
  placeThreat,
  playersWhere,
  putIntoPlay,
  query,
  refMatches,
  rule,
  chosen,
  self,
  surge,
  theMainScheme,
  thatPlayer,
  topOfDeck,
  forcedInterrupt,
  whenRevealed,
  you,
} from "../../../dsl/index.js";
import { obligation } from "../../../core/obligations.js";

const RULER = "Ruler of Limbo";
const BELASCO = "Belasco";
const LIMBO = trait("LIMBO");

const RULER_IN_PLAY = exists(query("sideScheme", { name: RULER }));

/**
 * "The Illyana Rasputin player": the player whose identity is Magik in either form (the hero face is named Magik, the
 * alter-ego Illyana Rasputin). An encounter card has no `ownerOf`, and Ruler of Limbo is not a minion, so the nemesis
 * relation does not reach it; the identity is read instead.
 */
const ILLYANA_PLAYER = playersWhere(
  refMatches(
    identityOf(thatPlayer),
    query("identity", {
      anyOf: [query("identity", { name: "Magik" }), query("identity", { name: "Illyana Rasputin" })],
    }),
  ),
);

/** "After Witchfire attacks and defeats an ally": the attack's `defeated` result against an ally (read after the fact). */
const WITCHFIRE_DEFEATED_ALLY = allOf(
  eventDealt("defeated"),
  refMatches(eventTarget, query("ally"), { anywhere: true }),
);

/**
 * Magik's obligation and nemesis set (docs/phase7-wave8.md section 7.1, 3.57, 3.60; section 4.1 Q31).
 *
 * Cards (6):
 * - 45053 Darkchilde (obligation)
 * - 45054 Belasco (minion)
 * - 45055 Ruler of Limbo (side_scheme)
 * - 45056 S'ym (minion)
 * - 45057 Witchfire (minion)
 * - 45058 Battle for Limbo (treachery)
 *
 * **Darkchilde (45053)**: Core's shared `obligation()` shape ("Give to the Illyana Rasputin player" is engine data). The
 * second option deals 1 damage to each character the player controls (identity and allies), then discards the card.
 *
 * **Belasco (45054)**: Villainous is data. Forced Response after he activates against you (a scheme or an attack):
 * discard the top 3 cards of your deck, bound as "milled"; with Ruler of Limbo in play they are attached to it facedown.
 *
 * **Ruler of Limbo (45055)**: amplify and 3 flat threat are data. Threat cannot be removed from it while Belasco is in
 * play. When Revealed: the Illyana Rasputin player finds Limbo and attaches it facedown here. When Defeated: a Forced
 * Interrupt on `schemeDefeated` (a `whenDefeated` runs after the scheme's attachments are already discarded) puts Limbo
 * (the facedown card attached here, read by printed id: a facedown card has no name) into play under that player's
 * control; nothing when there is none.
 *
 * **S'ym (45056)**: Guard is data. When Revealed: 2 threat on Ruler of Limbo if in play, otherwise on the main scheme.
 *
 * **Witchfire (45057)** (RAW pending FFG clarification (Q31)): Quickstrike is data. Built as printed: her Forced Response
 * answers every attack of hers. If it defeated an ally, 1 threat on Ruler of Limbo (nothing when it is not in play);
 * "Otherwise" (it hit an identity, or the ally survived) 1 threat on the main scheme.
 *
 * **Battle for Limbo (45058)**: When Revealed: each LIMBO minion in play activates against the player it is engaged
 * with (an attack on a hero, a scheme against an alter-ego); with none activated this way the card gains surge. Boost:
 * 2 threat on Ruler of Limbo if in play.
 */
export const MAGIK_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "45053.obligation": obligation("Illyana Rasputin", {
    label: "Deal 1 damage to each character you control",
    effects: [dealDamage(1, each(query("character", { controller: "you" })), { perTarget: true })],
  }),

  "45054.belasco-forced-response": forcedResponse(
    on.enemyActivates("self", { againstYou: true }),
    moveCards(topOfDeck(3, you), "discard", "milled"),
    ifThen(RULER_IN_PLAY, attachCard(chosen("milled"), named(RULER), { facedown: true })),
  ),

  "45055.ruler-of-limbo-constant": constant(
    rule({ kind: "threatCannotBeRemoved", target: { self: true }, while: exists(query("minion", { name: BELASCO })) }),
  ),
  "45055.when-revealed": whenRevealed(
    bindTargets("limbo", find(query("support", { name: "Limbo" }), { owner: ILLYANA_PLAYER })),
    attachCard(chosen("limbo"), self, { facedown: true }),
  ),
  "45055.when-defeated": forcedInterrupt(
    on.schemeDefeated("self"),
    bindTargets("limbo", each(query([], { printedId: cardId("45032"), host: self, facedown: true }))),
    putIntoPlay(chosen("limbo"), ILLYANA_PLAYER),
  ),

  "45056.when-revealed": whenRevealed(
    ifThen(RULER_IN_PLAY, placeThreat(2, named(RULER)), placeThreat(2, theMainScheme)),
  ),

  "45057.witchfire-forced-response": forcedResponse(
    on.enemyAttacks("self"),
    ifThen(WITCHFIRE_DEFEATED_ALLY, ifThen(RULER_IN_PLAY, placeThreat(1, named(RULER))), placeThreat(1, theMainScheme)),
  ),

  "45058.when-revealed": whenRevealed(
    enemyActivates(each(query("minion", { trait: LIMBO })), { bind: "act" }),
    ifThen(not(made("act")), surge()),
  ),
  "45058.boost": boost(ifThen(RULER_IN_PLAY, placeThreat(2, named(RULER)))),
});

/** Refs left unregistered, each with its reason (the coverage test reads this through its own `skipped` list). */
export const MAGIK_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
