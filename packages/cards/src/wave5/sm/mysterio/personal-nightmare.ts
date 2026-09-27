import {
  alterEgoAction,
  boost,
  cannotResolveTriggeredAbilities,
  chosen,
  constant,
  countAmong,
  defineAbilities,
  discard,
  discardFromHand,
  discardRandomFromHandCost,
  draw,
  eachPlayer,
  engagedPlayerOf,
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
 * - **Induced Panic (27153)**'s restriction is `RuleSpec cannotResolveTriggeredAbilities` on its host identity's hero
 *   face (docs/phase7-wave5.md §4.1 Q70). "Triggered abilities are ones with bold timing triggers", which RRG 1.8
 *   "Ability" (p. 4) and "Action" (p. 6) make include Hero Actions and Hero Resources as well as interrupts and
 *   responses; a forced one is skipped ("'Cannot'", p. 11). The alter-ego face's abilities, constants and keywords
 *   stay live. Its Alter-Ego Action pays a random discard narrowed to identity-specific cards
 *   (`discardRandomFromHandCost(1, filter)`), so it cannot be used with none in hand.
 *
 * - **Evil Doppelgänger (27154)**'s stat line ("+X SCH and +X ATK, where X is equal to the number of
 *   identity-specific cards in the engaged player's hand") reads `handCountOf` with a filter (docs/phase7-wave5.md
 *   §4.1 Q69), live on every stat read. "Identity-specific" is the RRG 1.8 classification (p. 23), which names no
 *   particular identity, so the filter is `identitySetOf: eachPlayer`; a player only ever holds their own identity's
 *   set in practice. A minion engaged with no one has no engaged player, so X is 0.
 */
const identitySpecificInEngagedHand = handCountOf(engagedPlayerOf(self), { identitySetOf: eachPlayer });

export const PERSONAL_NIGHTMARE = defineAbilities({
  // Induced Panic (27153, attachment; attaches to your identity, data) — You cannot resolve triggered abilities in your
  // hero's printed text box. (Triggered abilities are ones with bold timing triggers.)
  "27153.induced-panic-constant": constant(
    cannotResolveTriggeredAbilities(query("identity", { hostOfSelf: true }), { identityFace: "hero" }),
  ),
  // Alter-Ego Action: Discard 1 identity-specific card at random from your hand → discard this card.
  "27153.induced-panic-action": alterEgoAction(
    { cost: discardRandomFromHandCost(1, { identitySetOf: you }) },
    discard(self),
  ),

  // Evil Doppelgänger (27154, minion; ATK/SCH/HP/boostIcons/starIcon are data) — Evil Doppelgänger gets +X SCH and
  // +X ATK, where X is equal to the number of identity-specific cards in the engaged player's hand.
  "27154.evil-doppelganger-constant": constant(
    gets("sch", identitySpecificInEngagedHand, { self: true }),
    gets("atk", identitySpecificInEngagedHand, { self: true }),
  ),
  // [star] Boost: Draw 3 cards. Discard 3 random cards from your hand.
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
