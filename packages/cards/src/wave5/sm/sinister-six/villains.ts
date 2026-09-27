import type { AbilityDefinition } from "@mc/engine";
import {
  after,
  cards,
  chooseCards,
  dealIndirectDamage,
  discard,
  chooseTarget,
  chosen,
  defineAbilities,
  each,
  exists,
  firstPlayer,
  forcedResponse,
  ifThen,
  moveActiveCounterToNextVillain,
  moveCards,
  placeThreat,
  query,
  removeThreat,
  self,
  setVillainAside,
  stun,
  topOfDeck,
  whenDefeated,
  you,
  zone,
  type EffectArg,
} from "../../../dsl/index.js";

/**
 * The six Sinister Six villains (`sm` 27094-27099, MC27 p. 15, docs/phase7-wave5.md §1.5/§3.1) print identical
 * structure and differ only in their Forced Response's own effect:
 *
 *   "[star] Forced Response: After <Villain> attacks and damages you, <EFFECT>. Move the active counter to the next
 *   villain in the activation order.
 *   When Defeated: Remove 4 threat from a side scheme (7 threat instead if no other villain is in play). Set this
 *   villain aside."
 *
 * `sinisterSixVillain` builds both ability definitions once per villain; callers only supply `<EFFECT>` and register
 * the pair under that villain's own printed ability ids.
 *
 * Rulings:
 * - "Move the active counter to the next villain in the activation order" wrapping past the highest activation order
 *   value back to the lowest, and a lone villain simply keeping the counter, is `moveActiveCounterToNextVillain`'s own
 *   engine behavior (MC27 p. 15 "Activation Order"; its p. 21 FAQ), not scripted again here.
 * - "A side scheme" with more than one in play is a choice among several; nothing in the printed text says who
 *   chooses, so the first player does (RRG 1.8 "First Player", p. 19 — the same reading as Crime Pays's "search…and
 *   put it into play" in `hood/sinister-syndicate.ts`). With zero side schemes in play there is no legal target, so
 *   the whole ability does nothing beyond moving the counter and setting the villain aside — not a forced failure to
 *   remove threat (RRG 1.8 "Choose (Game Element)", p. 12).
 * - "No other villain is in play" is read at the moment When Defeated resolves, excluding this villain itself
 *   (`query("villain", { excluding: self })`) so it reads correctly whether or not the defeated villain has already
 *   left the villain area by then.
 * - "Set this villain aside" (`setVillainAside(self)`) returns the card to the `encounterSetAside` pool that Sinister
 *   Synchronization/Beatdown's own "Ambush!" draws a random villain from (`main-scheme.ts`), as a new copy per RRG 1.8
 *   "Leaves Play" (p. 27).
 */
export function sinisterSixVillain(effect: EffectArg): readonly [AbilityDefinition, AbilityDefinition] {
  const forcedResponseAbility = forcedResponse(
    after.enemyAttacks("self", { againstYou: true, damages: true }),
    effect,
    moveActiveCounterToNextVillain,
  );
  const whenDefeatedAbility = whenDefeated(
    chooseTarget("scheme", query("sideScheme"), { chooser: firstPlayer }),
    ifThen(
      exists(query("villain", { excluding: self })),
      removeThreat(4, chosen("scheme")),
      removeThreat(7, chosen("scheme")),
    ),
    setVillainAside(self),
  );
  return [forcedResponseAbility, whenDefeatedAbility];
}

const [doctorOctopusForcedResponse, doctorOctopusWhenDefeated] = sinisterSixVillain(
  placeThreat(1, each(query("scheme"))),
);

// "Discard the top 7 cards of your deck": a deck with fewer than 7 cards discards what it has, and running out is the
// engine's own deck-empty rule (RRG 1.8 "Player Deck", p. 35), not scripted here.
const [electroForcedResponse, electroWhenDefeated] = sinisterSixVillain(moveCards(topOfDeck(7, you), "discard"));

const [hobgoblinForcedResponse, hobgoblinWhenDefeated] = sinisterSixVillain(dealIndirectDamage(you, 2));

// "Choose and discard 1 support or upgrade you control" / Vulture's "…1 card from your hand": with nothing to choose,
// the choice finds nothing and the rest of the Forced Response (moving the active counter) still resolves, since it
// doesn't depend on the choice (RRG 1.8 "Choose (Game Element)", p. 12; the engine's `hasIndependentPart`).
const [kravenForcedResponse, kravenWhenDefeated] = sinisterSixVillain([
  chooseTarget("hunted", query(["support", "upgrade"], { controller: "you" })),
  discard(chosen("hunted")),
]);

const [scorpionForcedResponse, scorpionWhenDefeated] = sinisterSixVillain([
  // "Stun a character you control": the attacked player chooses among their identity and allies, as Double Trouble
  // (`hood/beasty-boys.ts` 24017) does.
  chooseTarget("stunned", query("character", { controller: "you" })),
  stun(chosen("stunned")),
]);

const [vultureForcedResponse, vultureWhenDefeated] = sinisterSixVillain([
  // "Choose and discard 1 card from your hand", the same shape as Experimental Research (`hlk/kit.ts` 10001b); an
  // empty hand is Kraven's case above.
  chooseCards("discarded", zone("hand", you), { min: 1, max: 1 }),
  moveCards(cards(chosen("discarded")), "discard"),
]);

export const SINISTER_SIX_VILLAINS = defineAbilities({
  // Doctor Octopus (27094, activation order 1) — [star] Forced Response: after Doctor Octopus attacks and damages
  // you, place 1 threat on each scheme (main scheme and every side scheme in play). Move the active counter to the
  // next villain in the activation order.
  "27094.doctor-octopus-forced-response": doctorOctopusForcedResponse,
  // Doctor Octopus — When Defeated: remove 4/7 threat from a side scheme, then set this villain aside.
  "27094.when-defeated": doctorOctopusWhenDefeated,

  // Electro (27095, activation order 2) — [star] Forced Response: after Electro attacks and damages you, discard the
  // top 7 cards of your deck.
  "27095.electro-forced-response": electroForcedResponse,
  "27095.when-defeated": electroWhenDefeated,

  // Hobgoblin (27096, activation order 3) — [star] Forced Response: after Hobgoblin attacks and damages you, take 2
  // indirect damage.
  "27096.hobgoblin-forced-response": hobgoblinForcedResponse,
  "27096.when-defeated": hobgoblinWhenDefeated,

  // Kraven the Hunter (27097, activation order 4) — [star] Forced Response: after Kraven attacks and damages you,
  // choose and discard 1 support or upgrade you control.
  "27097.kraven-the-hunter-forced-response": kravenForcedResponse,
  "27097.when-defeated": kravenWhenDefeated,

  // Scorpion (27098, activation order 5) — [star] Forced Response: after Scorpion attacks and damages you, stun a
  // character you control. Move the active counter to the next villain in the activation order.
  "27098.scorpion-forced-response": scorpionForcedResponse,
  // Scorpion — When Defeated: remove 4/7 threat from a side scheme, then set this villain aside.
  "27098.when-defeated": scorpionWhenDefeated,

  // Vulture (27099, activation order 6) — [star] Forced Response: after Vulture attacks and damages you, choose and
  // discard 1 card from your hand. Move the active counter to the next villain in the activation order.
  "27099.vulture-forced-response": vultureForcedResponse,
  // Vulture — When Defeated: remove 4/7 threat from a side scheme, then set this villain aside.
  "27099.when-defeated": vultureWhenDefeated,
});
