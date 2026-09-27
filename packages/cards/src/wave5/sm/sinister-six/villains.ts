import type { AbilityDefinition } from "@mc/engine";
import {
  after,
  chooseTarget,
  chosen,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardFromHand,
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

// Electro (27095, activation order 2) — "discard the top 7 cards of your deck": `you` is the attacked player, whose
// own deck this discards from. Fewer than 7 cards left in the deck is not an error — `moveCards`/`topOfDeck` cap at
// however many cards are actually there, discarding just those (the same reading `bulldozer.ts`'s own
// `topOfDeck(eventResult("damage"), you)` and `market.ts`'s `topOfDeck(4)` use) and stopping there (RRG 1.8 "Player
// Deck", p. 33: "if the player's deck empties while the player was discarding cards from their deck, no further
// cards are discarded from the newly shuffled deck" — there is no "until" search here to keep going anyway). A deck
// that empties this way resets — shuffling the discard pile into a new deck and dealing that player one facedown
// encounter card — automatically, at the engine level, the instant it empties (`settlePlayerDecks`,
// `packages/engine/src/ctx.ts`, exercised generically by `packages/engine/src/player-deck-reset.test.ts`), not
// anything this ability needs to script itself.
const [electroForcedResponse, electroWhenDefeated] = sinisterSixVillain(moveCards(topOfDeck(7, you), "discard"));

// Hobgoblin (27096, activation order 3) — "take 2 indirect damage": the attacked player divides it among the
// characters they control (RRG 1.8 "Indirect Damage", p. 27).
const [hobgoblinForcedResponse, hobgoblinWhenDefeated] = sinisterSixVillain(dealIndirectDamage(you, 2));

// Kraven the Hunter (27097, activation order 4) — "choose and discard 1 support or upgrade you control": with none in
// play there is no legal target, so (as with When Defeated's own side-scheme choice above) the ability does nothing
// beyond moving the counter (RRG 1.8 "Choose (Game Element)", p. 12).
const [kravenTheHunterForcedResponse, kravenTheHunterWhenDefeated] = sinisterSixVillain([
  chooseTarget("supportOrUpgrade", query(["support", "upgrade"], { controller: "you" })),
  discard(chosen("supportOrUpgrade")),
]);

// Scorpion (27098, activation order 5) — "stun a character you control": a choice among the attacked player's own
// characters (identity and allies), not necessarily the character Scorpion just attacked — unlike `gob` 02038's own
// "stun that character" (`a-mess-of-things.ts`), which is `eventTarget`. No character in play (a downed identity is
// still in play, so this is effectively unreachable) again leaves the ability with nothing to do.
const [scorpionForcedResponse, scorpionWhenDefeated] = sinisterSixVillain([
  chooseTarget("character", query(["identity", "ally"], { controller: "you" })),
  stun(chosen("character")),
]);

// Vulture (27099, activation order 6) — "choose and discard 1 card from your hand": `discardFromHand(1, you)`'s
// default (no `random`) is already the attacked player's own choice of which card. An empty hand again leaves
// nothing to discard.
const [vultureForcedResponse, vultureWhenDefeated] = sinisterSixVillain(discardFromHand(1, you));

export const SINISTER_SIX_VILLAINS = defineAbilities({
  // Doctor Octopus (27094, activation order 1) — [star] Forced Response: after Doctor Octopus attacks and damages
  // you, place 1 threat on each scheme (main scheme and every side scheme in play). Move the active counter to the
  // next villain in the activation order.
  "27094.doctor-octopus-forced-response": doctorOctopusForcedResponse,
  // Doctor Octopus — When Defeated: remove 4/7 threat from a side scheme, then set this villain aside.
  "27094.when-defeated": doctorOctopusWhenDefeated,
  // Electro — [star] Forced Response: after Electro attacks and damages you, discard the top 7 cards of your deck.
  "27095.electro-forced-response": electroForcedResponse,
  // Electro — When Defeated: remove 4/7 threat from a side scheme, then set this villain aside.
  "27095.when-defeated": electroWhenDefeated,
  // Hobgoblin — [star] Forced Response: after Hobgoblin attacks and damages you, take 2 indirect damage.
  "27096.hobgoblin-forced-response": hobgoblinForcedResponse,
  // Hobgoblin — When Defeated: remove 4/7 threat from a side scheme, then set this villain aside.
  "27096.when-defeated": hobgoblinWhenDefeated,
  // Kraven the Hunter — [star] Forced Response: after Kraven the Hunter attacks and damages you, choose and discard
  // 1 support or upgrade you control.
  "27097.kraven-the-hunter-forced-response": kravenTheHunterForcedResponse,
  // Kraven the Hunter — When Defeated: remove 4/7 threat from a side scheme, then set this villain aside.
  "27097.when-defeated": kravenTheHunterWhenDefeated,
  // Scorpion — [star] Forced Response: after Scorpion attacks and damages you, stun a character you control.
  "27098.scorpion-forced-response": scorpionForcedResponse,
  // Scorpion — When Defeated: remove 4/7 threat from a side scheme, then set this villain aside.
  "27098.when-defeated": scorpionWhenDefeated,
  // Vulture — [star] Forced Response: after Vulture attacks and damages you, choose and discard 1 card from your
  // hand.
  "27099.vulture-forced-response": vultureForcedResponse,
  // Vulture — When Defeated: remove 4/7 threat from a side scheme, then set this villain aside.
  "27099.when-defeated": vultureWhenDefeated,
});
