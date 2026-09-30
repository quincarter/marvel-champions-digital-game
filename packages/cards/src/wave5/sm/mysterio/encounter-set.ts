import {
  boost,
  cards,
  chooseOne,
  choosePlayer,
  chosenPlayer,
  controllerOf,
  dealAsEncounterCard,
  defeatedWithExcessDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardFromHand,
  drawUpTo,
  encounterCards,
  eventSource,
  forcedInterrupt,
  handCountOf,
  handSizeOf,
  heroAction,
  ifThen,
  instead,
  modifyAttack,
  moveCards,
  moveCardsInto,
  option,
  placeThreat,
  query,
  revealCard,
  self,
  spendResources,
  takeDamage,
  theMainScheme,
  when,
  whenDefeated,
  whenRevealed,
  you,
  zone,
} from "../../../dsl/index.js";

/**
 * Mysterio's own encounter set (`sm` 27089–27093, docs/phase7-wave5.md §2.2): Humongous Hallucination, Masterful
 * Mirage, Shifting Apparition, Déjà Vu and Fearmonger.
 */
export const MYSTERIO_ENCOUNTER_SET = defineAbilities({
  // Humongous Hallucination (27089, attachment; "Attach to Mysterio" is data) — Hero Action: Spend 1 resource of
  // any type and shuffle the top 2 cards of the encounter deck into your deck, then discard this card. `resources:
  // 1` alone is a generic spend, "of any type" (`13027.mothers-orders-constant`'s own precedent); the engine has no
  // `AbilityCost` for "shuffle N cards into your deck" as part of a paid cost, so the shuffle is scripted as an
  // effect after the resource cost instead of inside it. Nothing in this ability branches on whether the shuffle is
  // "cost" or "effect", and it can never go unpaid (the deck reshuffles its own discard pile rather than run out,
  // RRG 1.8 "Player Deck", p. 33), so the two readings are observably identical; flagged here rather than silently
  // modeled as if the cost system already supported the printed shape.
  "27089.humongous-hallucination-action": heroAction(
    { cost: { resources: 1 } },
    moveCardsInto(encounterCards(["deck"], undefined, 2), "deckShuffle", you),
    discard(self),
  ),

  // Masterful Mirage (27090, attachment; "Attach to Mysterio"/starIcon are data) — Forced Interrupt: When you would
  // deal any amount of damage to Mysterio, discard the top 4 cards of your deck instead. Discard this card. The
  // `dealDamage` event carries no player subject (`trigger-events.ts`'s own `eventSubjects` case), so "your deck" is
  // read as the controller of the card dealing the damage (`controllerOf(eventSource)`) — the acting player "you"
  // addresses, the same reading Bell Tower's own damage interrupts give "Venom" (`venom/encounter-set.ts`). The data
  // id ("-constant") names what is printed as a Forced Interrupt — `@mc/content`'s own naming, not this file's.
  "27090.masterful-mirage-constant": forcedInterrupt(
    when.damage(query("villain", { name: "Mysterio" })),
    instead(moveCards(zone("deck", controllerOf(eventSource), { top: 4 }), "discard")),
    discard(self),
  ),
  // [star] Boost: Give Mysterio 1 additional boost card this activation — the validator's own "inside a Boost
  // ability" shape for "1 additional boost card for this activation" (`dsl/validate.ts`).
  "27090.boost": boost(modifyAttack({ extraBoostCards: 1 })),

  // Shifting Apparition (27091, minion; Guard/HP/ATK/SCH/boostIcons are data) — When Defeated: If this minion was
  // defeated with excess damage, the defeating player shuffles the top card of the encounter deck into their deck.
  // "Excess damage" is the defeat's own record (docs/phase7-wave5.md §4.1 Q68): damage taken past its remaining hit
  // points from any damage, not only an attack's (RRG 1.8 "Excess Damage", p. 19). "The defeating player" is the
  // controller of the card that dealt it (`defeatingPlayer`); with none (an encounter card's damage) nothing moves.
  "27091.when-defeated": whenDefeated(
    ifThen(
      defeatedWithExcessDamage,
      moveCardsInto(encounterCards(["deck"], undefined, 1), "deckShuffle", defeatingPlayer),
    ),
  ),

  // Déjà Vu (27092, treachery; Peril/starIcon are data) — When Revealed: choose to either take 1 damage or place 1
  // threat on the main scheme. Shuffle Déjà Vu into any player's deck (facedown: MC27 p. 13, docs/phase7-wave5.md
  // §3.5). The reveal flow's own "unmoved" check (`resolve/reveal.ts`) skips the automatic encounter-discard once an
  // effect has already moved the card, so no `instead()` is needed around the move.
  "27092.when-revealed": whenRevealed(
    chooseOne(
      option("Take 1 damage", takeDamage(1)),
      option("Place 1 threat on the main scheme", placeThreat(1, theMainScheme)),
    ),
    choosePlayer(),
    moveCardsInto(cards(self), "deckShuffle", chosenPlayer()),
  ),
  // [star] Boost: Reveal this card.
  "27092.boost": boost(revealCard(self, you)),

  // Fearmonger (27093, treachery; Surge is data) — When Revealed: discard your hand, then draw up to your hand
  // size.
  "27093.when-revealed": whenRevealed(discardFromHand(handCountOf(you), you), drawUpTo(handSizeOf(you))),
  // [star] Boost: choose to either spend [mental][mental] resources or deal this card to yourself as a facedown
  // encounter card.
  "27093.boost": boost(
    chooseOne(
      option("Spend [mental][mental] resources", spendResources({ mental: 2 }, "spent")),
      option("Deal this card to yourself as a facedown encounter card", dealAsEncounterCard(self, you)),
    ),
  ),
});
