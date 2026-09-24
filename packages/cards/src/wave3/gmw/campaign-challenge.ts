import {
  addCounters,
  chooseOneBy,
  constant,
  defineAbilities,
  draw,
  discardFromHand,
  eachPlayer,
  forEachPlayer,
  moveCards,
  named,
  option,
  takeDamage,
  thatPlayer,
  topOfDeck,
  whenDefeated,
  zone,
} from "../../dsl/index.js";

/**
 * The Campaign Challenge side schemes (16178a/b–16182a/b, MC16 p. 4/p. 8/p. 10/p. 12/p. 14/p. 18): Badoon Blitz,
 * Gallery of Splendor, "There Is No Escape", Guerrilla Tactics, Kree Supremacy — each printed as a standard-mode
 * ("a") and expert-mode ("b") face of the same card, revealed by `campaigns/gmw.ts`'s `revealChallengeSideScheme`
 * (`TargetQuery.printedId`, since both faces share a title). Only one face is ever in the encounter set-aside pool
 * at once — see that file's own docblock — so this module never needs to read which mode is active itself.
 *
 * **Every `*-constant` ref is an empty `constant()`.** Each card's only mechanical text besides "Standard/Expert
 * Mode Only" (a setup/reveal instruction, not a card ability — `campaigns/gmw.ts` reveals the right face) and its
 * `When Defeated:` is "Hinder N[per_hero]. Victory 1.", both data-driven keywords (`KeywordInstance` `hinder`
 * `perPlayer`, `victory`; docs/phase7-wave3.md §1.3/§1.6). `wave1/twc/breakout.ts`'s `07001a.breakout-constant` is
 * the established shape for a ref with printed text but no behavior of its own.
 *
 * Kree Supremacy (16182a/16182b) prints no `When Defeated:` at all, so it gets only its `-constant` ref — matching
 * `KNOWN_SKIPPED.gmw`'s own count (16182a/16182b: one ref each, every other card: two).
 */
export const CAMPAIGN_CHALLENGE = defineAbilities({
  // Badoon Blitz (16178a, standard) — Hinder 3[per_hero]. Victory 1. (data.)
  "16178a.badoon-blitz-constant": constant(),
  // When Defeated: Each player may draw 1 card.
  "16178a.when-defeated": whenDefeated(
    forEachPlayer(eachPlayer, chooseOneBy(thatPlayer, option("Draw 1 card", draw(1, thatPlayer)), option("Do not"))),
  ),

  // Badoon Blitz (16178b, expert) — Hinder 4[per_hero]. Victory 1. (data.)
  "16178b.badoon-blitz-constant": constant(),
  // When Defeated: Each player must choose and discard 1 card from their hand. `discardFromHand`'s `player` accepts
  // `eachPlayer` directly — each player chooses from their own hand, in player order (its own docblock).
  "16178b.when-defeated": whenDefeated(discardFromHand(1, eachPlayer)),

  // Gallery of Splendor (16179a, standard) — Hinder 3[per_hero]. Victory 1. (data.)
  "16179a.gallery-of-splendor-constant": constant(),
  // When Defeated: Place the top card of each player's deck faceup into the Collection. Same shape as Collector III
  // (`museum.ts`'s `16072.when-revealed`) — `forEachPlayer` + `thatPlayer`, one `topOfDeck` per player.
  "16179a.when-defeated": whenDefeated(
    forEachPlayer(eachPlayer, moveCards(topOfDeck(1, thatPlayer), { scenarioArea: "The Collection" })),
  ),

  // Gallery of Splendor (16179b, expert) — Hinder 4[per_hero]. Victory 1. (data.)
  "16179b.gallery-of-splendor-constant": constant(),
  // When Defeated: Each player must place 1 card at random from their hand faceup into The Collection. Same shape
  // as The Vulture's Plans (`core/heroes/spider-man.ts`'s `01169.when-revealed`) — `zone("hand", eachPlayer,
  // { random: 1 })` needs no `forEachPlayer` wrapper; each player randomizes from their own hand independently.
  "16179b.when-defeated": whenDefeated(
    moveCards(zone("hand", eachPlayer, { random: 1 }), { scenarioArea: "The Collection" }),
  ),

  // "There Is No Escape" (16180a, standard) — Hinder 3[per_hero]. Victory 1. (data.)
  "16180a.there-is-no-escape-constant": constant(),
  // When Defeated: Deal 1 damage to each player.
  "16180a.when-defeated": whenDefeated(forEachPlayer(eachPlayer, takeDamage(1, thatPlayer))),

  // "There Is No Escape" (16180b, expert) — Hinder 4[per_hero]. Victory 1. (data.)
  "16180b.there-is-no-escape-constant": constant(),
  // When Defeated: Deal 2 damage to each player.
  "16180b.when-defeated": whenDefeated(forEachPlayer(eachPlayer, takeDamage(2, thatPlayer))),

  // Guerrilla Tactics (16181a, standard) — Hinder 3[per_hero]. Victory 1. (data.)
  "16181a.guerrilla-tactics-constant": constant(),
  // When Defeated: Place 2 evasion counters on Nebula's Ship. Same target as `nebula.ts`/`ruthless.ts`'s own evasion
  // counter placements — `named("Nebula's Ship")`, the environment `nebula.ts` puts into play.
  "16181a.when-defeated": whenDefeated(addCounters("evasion", 2, named("Nebula's Ship"))),

  // Guerrilla Tactics (16181b, expert) — Hinder 4[per_hero]. Victory 1. (data.)
  "16181b.guerrilla-tactics-constant": constant(),
  // When Defeated: Place 3 evasion counters on Nebula's Ship.
  "16181b.when-defeated": whenDefeated(addCounters("evasion", 3, named("Nebula's Ship"))),

  // Kree Supremacy (16182a, standard) — Hinder 3[per_hero]. Victory 1. No When Defeated: printed (see module
  // docblock) — its "(Optional)" reveal is handled entirely by `campaigns/gmw.ts`'s own reveal-with-`selectCards`
  // bridge, not a card ability.
  "16182a.kree-supremacy-constant": constant(),

  // Kree Supremacy (16182b, expert) — Hinder 4[per_hero]. Victory 1. No When Defeated: printed.
  "16182b.kree-supremacy-constant": constant(),
});
