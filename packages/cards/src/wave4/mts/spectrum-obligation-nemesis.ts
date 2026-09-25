import {
  alterEgoAction,
  boost,
  cards,
  constant,
  dealDamage,
  defineAbilities,
  each,
  exhaustYourHero,
  FRIENDLY_CHARACTER,
  forcedResponse,
  moveCards,
  on,
  placeThreat,
  query,
  rule,
  self,
  spend,
  takeDamage,
  theMainScheme,
  whenDefeated,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../dsl/index.js";

/**
 * Spectrum's obligation (Loss of Control, 21026) and nemesis set: Radioactive Man (21027, minion), Reactor Meltdown
 * (21028, side scheme), Sap Power (21029, attachment), Radioactive Blast (21030, treachery).
 */
export const SPECTRUM_OBLIGATION_NEMESIS = defineAbilities({
  // Loss of Control (21026) — Give to the Monica Rambeau player. You cannot change energy forms. Alter-Ego Action:
  // exhaust Monica Rambeau → remove Loss of Control from the game (docs/phase7-wave4.md §3.1's own
  // `cannotChangeForm` primitive test names "Loss of Control (21026)" for exactly this constant).
  "21026.loss-of-control-constant": constant(rule({ kind: "cannotChangeForm", player: you, formType: "energy" })),
  "21026.loss-of-control-action": alterEgoAction({ cost: exhaustYourHero }, moveCards(cards(self), "removedFromGame")),

  // Radioactive Man (21027) — Elite, Genius (data). [star] Forced Response: After Radioactive Man activates against
  // you, deal 1 damage to each character you control. [star] Boost: Deal 1 damage to each character you control
  // (the Core Concussive Blast/museum shape, `core/scenarios/ultron.ts` `01154.boost`).
  "21027.radioactive-man-forced-response": forcedResponse(
    on.enemyAttacks("self", { againstYou: true }),
    dealDamage(1, each(query("character", { controller: "you" }))),
  ),
  "21027.boost": boost(dealDamage(1, each(query("character", { controller: "you" })))),

  // Reactor Meltdown (21028) — side scheme. When Defeated: deal 1 damage to each friendly character in play.
  "21028.when-defeated": whenDefeated(dealDamage(1, each(FRIENDLY_CHARACTER))),

  // Sap Power (21029) — Attach to your identity (data). Forced Response: After your turn ends, take 1 damage.
  // Alter-Ego Action: Spend [energy][energy] resources → discard this card. No `on.yourTurnEnds()` wrapper exists
  // yet; the engine's own `turnEnding` trigger event ("A player's turn is about to end", `trigger-events.ts`) is
  // composed directly, the same idiom `wave4-hero-primitives.test.ts` uses for inline `EventPattern`s with no
  // `on.*` sugar yet.
  "21029.sap-power-constant": forcedResponse({ on: "turnEnding", playerIs: "controller" }, takeDamage(1)),
  "21029.sap-power-action": alterEgoAction({ cost: spend({ energy: 2 }) }, moveCards(cards(self), "discard")),

  // Radioactive Blast (21030) — treachery. When Revealed (Alter-Ego): place 2 threat on the main scheme. When
  // Revealed (Hero): take 2 damage.
  "21030.when-revealed-alter-ego": whenRevealedAlterEgo(placeThreat(2, theMainScheme)),
  "21030.when-revealed-hero": whenRevealedHero(takeDamage(2)),
});
