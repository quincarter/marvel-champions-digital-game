import {
  alterEgoAction,
  blanksTextBox,
  chooseCards,
  chooseOne,
  choosePlayer,
  chosen,
  chosenPlayer,
  chooseTarget,
  constant,
  costModifier,
  countOf,
  cards,
  defineAbilities,
  discard,
  discardFromHandCost,
  discardStatusCost,
  draw,
  encounterCard,
  eventPlayer,
  exists,
  gainsIcon,
  gainsKeyword,
  ifThen,
  moveCards,
  on,
  option,
  query,
  response,
  revealedFromEncounterDeck,
  rule,
  selectCards,
  self,
  sum,
  surge,
  valueAtLeast,
  varOf,
  whenRevealed,
  yourIdentity,
  zone,
  you,
  each,
  exhaustYourHero,
  exhaustCardsCost,
} from "../../dsl/index.js";
import { trait } from "@mc/content";

const SETTING = trait("SETTING");
const OBLIGATION = query("obligation");
const YOUR_UPGRADES = query("upgrade", { controller: "you" });

/**
 * MojoMania (`mojo`), the Sitcom genre set (`sitcom` 39060-39065; docs/phase7-wave6.md §7.4): Mojo in the Middle (the
 * SHOW environment) and five encounter obligations. Each obligation is revealed into the revealing player's play area
 * and stays there until its own Alter-Ego Action discards it (an alter-ego action is not usable in hero form).
 *
 * **Mojo in the Middle**: "After a player discards an obligation, that player draws 1 card" hears an obligation leaving
 * play for the encounter discard pile by any route (§4.1 Q46, the user's decision of 2026-10-02: not only the
 * obligation's own text or its player's ability), with "that player" the one whose play area it left. The surge is only
 * for a reveal that began at the encounter deck (§3.64).
 *
 * **Watch Me Play**: incite 3 and peril are printed keywords the engine reads from the card data (§3.65). Its "When you
 * look up a rule, you are confused" is deliberately no game effect (§4.1 Q45), so its ref is an empty constant.
 */
export const SITCOM_ABILITIES = defineAbilities({
  // Mojo in the Middle (39060) — Each obligation gains 1 acceleration icon.
  "39060.mojo-in-the-middle-constant": constant(gainsIcon("acceleration", OBLIGATION)),
  // Response: After a player discards an obligation, that player draws 1 card. The discarding player is the one the
  // obligation was in play for (`eventPlayer`), who is also the one offered the response.
  "39060.mojo-in-the-middle-response": response(
    on.encounterCardDiscardedFromPlay(OBLIGATION),
    { triggerableBy: eventPlayer },
    draw(1),
  ),
  // When Revealed: Discard each other Setting environment in play. If this card was revealed from the encounter deck,
  // it gains surge.
  "39060.when-revealed": whenRevealed(
    discard(each(query("environment", { trait: SETTING, excluding: self }))),
    ifThen(revealedFromEncounterDeck, surge()),
  ),

  // Family Matters (39061) — Treat the printed text box of each support you control as if it were blank (except for
  // Traits).
  "39061.family-matters-constant": constant(blanksTextBox(query("support", { controller: "you" }))),
  // 39061.family-matters-action is NOT scripted: "Exhaust your identity and each support you control →" needs a cost
  // that exhausts every matching card (`exhaustCards` picks a fixed or "any number" count, never "each").

  // Growing Pains (39062) — Increase the cost to play each of your upgrades by 2.
  "39062.growing-pains-constant": constant(costModifier({ delta: 2, appliesTo: YOUR_UPGRADES })),
  // Alter-Ego Action: Discard an upgrade you control or discard an upgrade from your hand. If you have more upgrades
  // in your discard pile than in play, discard this obligation. (No arrow: the discard is an effect, so the action can
  // always be used.)
  "39062.growing-pains-action": alterEgoAction(
    chooseOne(
      option(
        "Discard an upgrade you control",
        { when: exists(YOUR_UPGRADES) },
        chooseTarget("upgrade", YOUR_UPGRADES),
        discard(chosen("upgrade")),
      ),
      option(
        "Discard an upgrade from your hand",
        chooseCards("fromHand", zone("hand", you, { filter: query("upgrade") }), { min: 1, max: 1 }),
        moveCards(cards(chosen("fromHand")), "discard"),
      ),
    ),
    selectCards("pile", zone("discard", you, { filter: query("upgrade") })),
    ifThen(valueAtLeast(varOf("pile.count"), sum(countOf(YOUR_UPGRADES), 1)), discard(self)),
  ),

  // The Odd Couple (39063) — Reduce your ally limit by 2.
  "39063.the-odd-couple-constant": constant(rule({ kind: "allyLimit", amount: -2 })),
  // Alter-Ego Action: Exhaust 2 characters you control → shuffle an ally from your discard pile into your deck and
  // discard this obligation.
  "39063.the-odd-couple-action": alterEgoAction(
    { cost: exhaustCardsCost(query(["identity", "ally"], { controller: "you" }), { min: 2 }) },
    chooseCards("ally", zone("discard", you, { filter: query("ally") }), { min: 1, max: 1 }),
    moveCards(cards(chosen("ally")), "deckShuffle"),
    discard(self),
  ),

  // The One with the Breakup (39064) — Each encounter card gains peril.
  "39064.the-one-with-the-breakup-constant": constant(gainsKeyword({ name: "peril" }, encounterCard())),
  // Alter-Ego Action: Discard 3 cards from your hand and choose a player → the chosen player draws 1 card and you
  // discard this obligation.
  "39064.the-one-with-the-breakup-action": alterEgoAction(
    { cost: discardFromHandCost(3) },
    choosePlayer("friend"),
    draw(1, chosenPlayer("friend")),
    discard(self),
  ),

  // Watch Me Play (39065) — Incite 3. Peril. Both are printed keywords read from the card data (§3.65), so the
  // obligation ref itself carries no ability.
  "39065.obligation": constant({}),
  // Forced Interrupt: When you look up a rule, you are confused. No game effect (§4.1 Q45): the engine has no rule
  // lookup to hear.
  "39065.watch-me-play-forced-interrupt": constant({}),
  // Alter-Ego Action: Exhaust your identity and discard a confused status card from it → discard this obligation.
  "39065.watch-me-play-action": alterEgoAction(
    { cost: [exhaustYourHero, discardStatusCost("confused", yourIdentity)] },
    discard(self),
  ),
});
