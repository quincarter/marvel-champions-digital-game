import {
  andThen,
  action,
  after,
  attack,
  cancelRevealedCard,
  cancelWhenRevealed,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  discardThis,
  doublesResourcesWhilePayingFor,
  enemyAttack,
  eventSource,
  exhaustThis,
  FRIENDLY_CHARACTER,
  gets,
  heal,
  heroInterrupt,
  interrupt,
  query,
  ready,
  removeCounter,
  response,
  revealEncounterCard,
  spend,
  statOf,
  theVillain,
  when,
  YOUR_HERO,
  you,
  yourIdentity,
} from "../../dsl/index.js";

/** The Protection aspect (01075–01082; Luke Cage's Toughness is a keyword). */
export const PROTECTION = defineAbilities({
  // Black Widow — Interrupt: When a card is revealed from the encounter deck, exhaust Black Widow and spend a [mental] resource →
  // cancel the effects of that card and discard it. Then, reveal another card from the encounter deck.
  "01075.black-widow-interrupt": interrupt(
    when.encounterCardRevealed(),
    { cost: [exhaustThis, spend({ mental: 1 })] },
    cancelRevealedCard(),
    // Nothing left to cancel (another cancel got there first): `nothingToCancel` skips the reveal (RRG 1.8 "'Then'",
    // p. 44). A card that cannot be cancelled never offers her at all (docs/phase7-wave4.md §3.27).
    andThen(revealEncounterCard(you)),
  ),
  // Counter-Punch — Response (attack): After your hero defends against an enemy attack, deal damage to that enemy equal to your hero's ATK.
  "01077.counter-punch-response": response(
    after.defends(YOUR_HERO),
    { label: "attack" },
    attack(statOf(yourIdentity, "atk"), eventSource),
  ),
  // Get Behind Me! — Hero Interrupt: When a treachery card is revealed from the encounter deck, cancel its "When Revealed" effects.
  // The villain attacks you instead.
  "01078.get-behind-me-interrupt": heroInterrupt(
    when.encounterCardRevealed(query("treachery")),
    cancelWhenRevealed(),
    enemyAttack(theVillain, { against: you }),
  ),
  // The Power of Protection — Double the number of resources this card generates while paying for a Protection (green) card.
  "01079.the-power-of-protection-constant": constant(doublesResourcesWhilePayingFor({ aspect: "protection" })),
  // Med Team — Uses (3 medical counters). Action: Exhaust Med Team and remove 1 medical counter from it → heal 2 damage from a friendly character.
  "01080.med-team-action": action(
    { cost: [exhaustThis, removeCounter("medical")] },
    chooseTarget("character", FRIENDLY_CHARACTER),
    heal(2, chosen("character")),
  ),
  // Armored Vest — Your hero gets +1 DEF. ("Your" = the player who controls this upgrade.)
  "01081.armored-vest-constant": constant(gets("def", 1, YOUR_HERO)),
  // Indomitable — Response: After your hero defends, discard Indomitable → ready your hero.
  "01082.indomitable-response": response(after.defends(YOUR_HERO), { cost: discardThis }, ready(yourIdentity)),
});
