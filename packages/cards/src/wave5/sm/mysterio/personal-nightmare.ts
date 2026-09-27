import {
  boost,
  chosen,
  constant,
  countAmong,
  defineAbilities,
  discardFromHand,
  draw,
  gets,
  handCountOf,
  ifThen,
  moveCards,
  placeThreat,
  query,
  self,
  takeDamage,
  theMainScheme,
  valueAtLeast,
  whenRevealed,
  you,
  zone,
} from "../../../dsl/index.js";

/**
 * Personal Nightmare (`sm` 27153–27157, docs/phase7-wave5.md §2.2), the Mysterio scenario's other required
 * encounter set alongside Mysterio's own (`encounter-set.ts`): Induced Panic, Evil Doppelgänger, Fool's Paradise,
 * Weakness from Within and Deepest Fears.
 *
 * - **Induced Panic (27153)** is not scripted here. `@mc/content` assigns it exactly one ability id
 *   ("27153.induced-panic-constant") for a card whose printed text is two independent behaviors — a constant
 *   restriction ("You cannot resolve triggered abilities in your hero's printed text box") and a distinct
 *   Alter-Ego Action ("Discard 1 identity-specific card at random from your hand → discard this card"). One
 *   `AbilityDefinition` is one `trigger` (`AbilityDefinition.trigger`, `abilities.ts`), so a `constant` and an
 *   `alterEgoAction` cannot both live under this single id — the Alter-Ego Action sentence has no ability id of its
 *   own to attach to. **Report to `card-data-pipeline`:** a second ability id is needed for the Alter-Ego Action.
 *   The restriction itself is also an engine gap: it disables only a hero's *triggered* (bold-timing) abilities,
 *   not its whole text box, so `blankTextBox`/`blanksTextBox` (which blanks everything, keywords included) is not a
 *   faithful stand-in — some identities print a non-triggered line (a keyword grant, a constant) in the same box
 *   that Induced Panic must leave alone. **Report to `game-rules-architect`:** a rule that disables only bold-
 *   timing triggered abilities in a card's printed text box. Left unregistered rather than approximated; see
 *   `personal-nightmare.test.ts`.
 *
 * - **Evil Doppelgänger (27154)**'s own stat line ("+X SCH and +X ATK, where X is equal to the number of
 *   identity-specific cards in the engaged player's hand") is also not fully scripted. `ValueSpec countOf`
 *   (`values.ts`) only reads cards in play (`selectTargets`, `select.ts`: `cardsInPlay(state).filter(...)`), and
 *   `ValueSpec handCount` (`{ kind: "handCount"; player }`) has no `filter` the way `scenarioAreaCount`/
 *   `victoryDisplayCount` do — there is no live-hand-count-by-query value at all. `countAmong` reads a *bound*
 *   ref's cards by query, but a constant's target/value has no cost or effect step to bind one from (a constant is
 *   evaluated wherever its stat is read, not run as an effect list). **Report to `game-rules-architect`:** a
 *   `handCount`-shaped `ValueSpec` that takes an optional `filter`. Its `[star] Boost: Draw 3 cards. Discard 3
 *   random cards from your hand.` is scripted; the stat line is not.
 */
export const PERSONAL_NIGHTMARE = defineAbilities({
  // Evil Doppelgänger (27154, minion; ATK/SCH/HP/boostIcons/starIcon are data) — [star] Boost: Draw 3 cards.
  // Discard 3 random cards from your hand. Its own stat line is not scripted; see the module docblock.
  "27154.boost": boost(draw(3, you), discardFromHand(3, you, { random: true })),

  // Fool's Paradise (27155, side scheme; Victory 1/icons/boostIcons are data) — Each identity gets +2 hand size.
  "27155.fools-paradise-constant": constant(gets("handSize", 2, query("identity"))),

  // Weakness from Within (27156, side scheme; startingThreat/icons/boostIcons are data) — When Revealed: place 1
  // additional threat here for each card in your hand.
  "27156.when-revealed": whenRevealed(placeThreat(handCountOf(you), self)),

  // Deepest Fears (27157, treachery; Peril is data) — When Revealed: discard cards from the top of your deck equal
  // to the number of cards in your hand. If at least 1 identity-specific card was discarded this way, place 1
  // threat on the main scheme. If no identity-specific card was discarded this way, take 1 damage (the printed
  // "not identity-specific" reads as "no", the only sense that parses; the card scan matches `@mc/content`'s text).
  "27157.when-revealed": whenRevealed(
    moveCards(zone("deck", you, { top: handCountOf(you) }), "discard", "discarded"),
    ifThen(
      valueAtLeast(countAmong(chosen("discarded"), { identitySetOf: you }), 1),
      placeThreat(1, theMainScheme),
      takeDamage(1),
    ),
  ),
});
