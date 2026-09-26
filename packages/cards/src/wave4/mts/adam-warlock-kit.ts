import type { EventPattern, TargetQuery } from "@mc/engine";
import {
  addCounters,
  alterEgoAction,
  cancelRevealedCard,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  coveredByEngineRule,
  damageAnEnemy,
  damageOn,
  defineAbilities,
  discardFromHandCost,
  draw,
  eventPlayer,
  exhaustThis,
  exists,
  forcedInterrupt,
  heal,
  heroAction,
  heroResponse,
  ifThen,
  inHand,
  interrupt,
  modifyStat,
  moveCards,
  on,
  option,
  putIntoPlay,
  query,
  ready,
  refMatches,
  removeCounter,
  removeStatus,
  removeThreatFromAScheme,
  resource,
  response,
  self,
  spend,
  yourIdentity,
  zone,
} from "../../dsl/index.js";

/** "After you resolve Adam Warlock's 'Battle Mage' ability" (Warlock's Cape, Mystic Senses): the `abilityResolved`
 * trigger event, matched by source card — the same idiom `wave1/bkw/local.ts`'s `onAbilityResolvedOf` uses for
 * Black Widow's "resolve the ability of a Preparation card" (no shared `dsl/abilities.ts` wrapper for it yet). */
const onAbilityResolvedOf = (source: TargetQuery): EventPattern => ({
  on: "abilityResolved",
  playerIs: "controller",
  sourceIs: source,
});
const YOUR_IDENTITY_QUERY: TargetQuery = query("identity", { controller: "you" });

/**
 * Adam Warlock (21031a/b) and his signature hero kit (21032–21043, printed `aspect: "hero:21031a"`).
 *
 * **Battle Mage** (21031a) is a single Action with a printed "If that card is: …" branch per aspect
 * (docs/phase7-wave4.md §3.12: `refMatches(chosen, { aspect }, { anywhere: true })`) — scripted whole under
 * `-constant`; the four bulleted branches the parser also carved off (`-constant-2` through `-constant-5`) are the
 * same "stood up empty, already exercised by the real ability's own test" shape `nebu`'s Combat Ready uses for its
 * own bulleted "Choose one:" lines (`coveredByEngineRule()`).
 *
 * **Pip the Troll's (21032)** hand-active Interrupt is the exact composition docs/phase7-wave4.md §3.13 gives for
 * this card.
 */
export const ADAM_WARLOCK_KIT = defineAbilities({
  // Adam Warlock (hero, 21031a) — Battle Mage, Action: Discard 1 card from your hand. Limit once per phase. If that
  // card is: Aggression – Deal 2 damage to an enemy. Justice – Remove 2 threat from a scheme. Protection – Heal 1
  // damage from an ally. Leadership – Give a hero +1 THW, +1 ATK and +1 DEF this round.
  "21031a.adam-warlock-constant": heroAction(
    { limit: { count: 1, period: "phase" } },
    chooseCards("discarded", zone("hand"), { min: 1, max: 1 }),
    moveCards(cards(chosen("discarded")), "discard"),
    ifThen(refMatches(chosen("discarded"), { aspect: "aggression" }, { anywhere: true }), damageAnEnemy(2)),
    ifThen(refMatches(chosen("discarded"), { aspect: "justice" }, { anywhere: true }), removeThreatFromAScheme(2)),
    ifThen(refMatches(chosen("discarded"), { aspect: "protection" }, { anywhere: true }), [
      chooseTarget("ally", query("ally", { controller: "you" })),
      heal(1, chosen("ally")),
    ]),
    ifThen(refMatches(chosen("discarded"), { aspect: "leadership" }, { anywhere: true }), [
      chooseTarget("hero", query("hero")),
      modifyStat("thw", 1, chosen("hero"), "endOfRound"),
      modifyStat("atk", 1, chosen("hero"), "endOfRound"),
      modifyStat("def", 1, chosen("hero"), "endOfRound"),
    ]),
  ),
  "21031a.adam-warlock-constant-2": coveredByEngineRule(),
  "21031a.adam-warlock-constant-3": coveredByEngineRule(),
  "21031a.adam-warlock-constant-4": coveredByEngineRule(),
  "21031a.adam-warlock-constant-5": coveredByEngineRule(),

  // Adam Warlock (alter-ego, 21031b) — Avatar of Life: deckbuilding text is data (§1.4, `IdentityDeckbuilding`), no
  // ability of its own. Action: Discard a card from your hand → remove a status card from Adam Warlock (the
  // Creative Solution shape, `wave3/gmw/market.ts`, restricted to a fixed target and no branch effect).
  "21031b.adam-warlock-constant": coveredByEngineRule(),
  "21031b.adam-warlock-action": alterEgoAction(
    { cost: discardFromHandCost(1, 1) },
    chooseOne(
      option(
        "Remove a tough status card",
        { when: exists(query("identity", { controller: "you", hasStatus: "tough" })) },
        removeStatus(yourIdentity, "tough"),
      ),
      option(
        "Remove a stun status card",
        { when: exists(query("identity", { controller: "you", hasStatus: "stunned" })) },
        removeStatus(yourIdentity, "stunned"),
      ),
      option(
        "Remove a confuse status card",
        { when: exists(query("identity", { controller: "you", hasStatus: "confused" })) },
        removeStatus(yourIdentity, "confused"),
      ),
    ),
  ),

  // Pip the Troll (ally, 21032) — Toughness (data). While Pip the Troll is in your hand, he gains "Interrupt: When a
  // player is attacked, spend [energy][mental] resources → put Pip the Troll into play under that player's
  // control."
  "21032.pip-the-troll-constant": inHand(
    interrupt(on.villainAttacks(), { cost: spend({ energy: 1, mental: 1 }) }, putIntoPlay(self, eventPlayer)),
  ),

  // Soul World (support, 21033) — Response: After your deck runs out of cards, place 1 soul counter here.
  // Alter-Ego Action: Exhaust Soul World and remove 1 soul counter from it → heal all damage from your identity.
  "21033.soul-world-response": response(on.yourDeckRunsOut(), addCounters("soul", 1)),
  "21033.soul-world-action": alterEgoAction(
    { cost: [exhaustThis, removeCounter("soul", 1)] },
    heal(damageOn(yourIdentity), yourIdentity),
  ),

  // Karmic Staff (upgrade, 21034) — Resource: Exhaust Karmic Staff → generate a [wild] resource.
  "21034.karmic-staff-resource": resource({ wild: 1 }, { cost: exhaustThis }),

  // Warlock's Cape (upgrade, 21035) — Hero Response: After you resolve Adam Warlock's "Battle Mage" ability,
  // exhaust Warlock's Cape → ready Adam Warlock.
  "21035.warlocks-cape-response": heroResponse(
    onAbilityResolvedOf(YOUR_IDENTITY_QUERY),
    { cost: exhaustThis },
    ready(yourIdentity),
  ),

  // Cosmic Ward (upgrade, 21036) — Forced Interrupt: When you reveal a treachery card, cancel its "When Revealed"
  // effects and discard it. Then, discard Cosmic Ward.
  "21036.cosmic-ward-forced-interrupt": forcedInterrupt(
    on.encounterCardRevealed(query("treachery")),
    cancelRevealedCard(),
    moveCards(cards(self), "discard"),
  ),

  // Mystic Senses (upgrade, 21037) — Hero Response: After you resolve Adam Warlock's "Battle Mage" ability, draw 1
  // card.
  "21037.mystic-senses-response": heroResponse(onAbilityResolvedOf(YOUR_IDENTITY_QUERY), draw(1)),

  // Karmic Blast (event, 21038) through Zone of Silence (21050): `adam-warlock-pack-cards.ts`.
});
