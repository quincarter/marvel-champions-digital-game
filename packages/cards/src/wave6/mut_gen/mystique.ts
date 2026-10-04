import { trait } from "@mc/content";
import type { RuleSpec } from "@mc/engine";
import {
  chosen,
  constant,
  defeatingPlayer,
  defineAbilities,
  discard,
  each,
  encounterCards,
  enemyActivates,
  exists,
  forcedResponse,
  gets,
  ifThen,
  inHand,
  moveCardsInto,
  on,
  query,
  rule,
  searchAndReveal,
  self,
  statOf,
  surge,
  theVillain,
  whenDefeated,
  whenRevealed,
  you,
  cards,
  chooseTarget,
} from "../../dsl/index.js";

const SHAPESHIFTER = trait("SHAPESHIFTER");
const MYSTIQUE = query("minion", { name: "Mystique" });
/** "An ally or support you control." */
const YOUR_ALLY_OR_SUPPORT = query(["ally", "support"], { controlledBy: you });

/**
 * "These treachery cards" the Mystique modular set's encounter deck puts into a player's deck (MC32 p. 7): a drawn one
 * stays in the hand, with no replacement draw (docs/phase7-wave6.md §3.10, §4.1 Q7). The cards carry no ability ref
 * for it (their data has only the When Revealed and the Forced Response), so it is a scenario rule the setup adds
 * whenever the Mystique set is in the game (`../setup.ts`).
 */
export const MYSTIQUE_SCENARIO_RULES: readonly RuleSpec[] = [
  { kind: "staysInHand", cards: { categories: ["treachery"], trait: SHAPESHIFTER } },
];

/**
 * The Mystique modular set (`mystique`, `mut_gen` 32080-32083, MC32 p. 7, docs/phase7-wave6.md §2.2): Mystique, Metamorphic
 * Mayhem, Infiltration (x2) and Shapeshifter Surprise. Toughness is a data keyword.
 *
 * **Mystique**: her printed ATK and SCH are "★" (data: 0), replaced by the villain's current ATK and SCH (a base
 * replacement, so the villain's own modifiers count and her own cards add on top). While she is in play, players
 * cannot attack the villain.
 *
 * **Infiltration / Shapeshifter Surprise** (MC32 p. 7): When Revealed shuffles the card into the revealing player's
 * deck (it is the encounter card's own move, so it stays an unowned encounter card there) and it gains surge. Drawn, it
 * stays in the hand (`MYSTIQUE_SCENARIO_RULES`, §4.1 Q7) and its Forced Response answers `cardEntersHand`. A discard
 * from the hand goes to the encounter discard pile.
 */
export const MYSTIQUE_ABILITIES = defineAbilities({
  // Mystique (32080) — Players cannot attack the villain.
  "32080.mystique-constant": constant(rule({ kind: "cannotAttack", target: query("villain") })),
  // [star] Mystique's SCH is equal to the villain's SCH, and her ATK is equal to the villain's ATK.
  "32080.mystique-constant-2": constant(
    gets("sch", statOf(theVillain, "sch"), { self: true }, { setBase: true }),
    gets("atk", statOf(theVillain, "atk"), { self: true }, { setBase: true }),
  ),

  // Metamorphic Mayhem (32081) — When Defeated: The player who defeated this scheme shuffles each Shapeshifter card
  // from the encounter discard pile into their deck.
  "32081.when-defeated": whenDefeated(
    moveCardsInto(encounterCards(["discard"], { trait: SHAPESHIFTER }), "deckShuffle", defeatingPlayer),
  ),

  // Infiltration (32082) — When Revealed: Shuffle this card into your deck. This card gains surge.
  "32082.when-revealed": whenRevealed(moveCardsInto(cards(self), "deckShuffle", you), surge()),
  // Forced Response: After this card enters your hand, discard an ally or support you control.
  "32082.infiltration-forced-response": inHand(
    forcedResponse(on.thisEntersYourHand(), chooseTarget("victim", YOUR_ALLY_OR_SUPPORT), discard(chosen("victim"))),
  ),

  // Shapeshifter Surprise (32083) — When Revealed: Shuffle this card into your deck. This card gains surge.
  "32083.when-revealed": whenRevealed(moveCardsInto(cards(self), "deckShuffle", you), surge()),
  // Forced Response: After this card enters your hand, Mystique activates against you. Otherwise (she is not in play),
  // search the encounter deck and discard pile for Mystique and reveal her.
  "32083.shapeshifter-surprise-forced-response": inHand(
    forcedResponse(
      on.thisEntersYourHand(),
      ifThen(exists(MYSTIQUE), enemyActivates(each(MYSTIQUE), { against: you }), searchAndReveal("Mystique")),
    ),
  ),
});
