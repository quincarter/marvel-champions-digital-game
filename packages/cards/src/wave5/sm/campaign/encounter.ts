import {
  action,
  additionalThwartCost,
  addCounters,
  cards,
  constant,
  countersOn,
  defineAbilities,
  discardAtRandom,
  each,
  eachPlayer,
  eventAmount,
  eventPlayer,
  exhaustCardsCost,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  gainsKeyword,
  ifThen,
  inMode,
  inPlay,
  isAttached,
  made,
  moveCards,
  named,
  not,
  on,
  placeThreat,
  query,
  removeCountersFrom,
  response,
  retargetAttack,
  rule,
  self,
  spendResources,
  spendSameType,
  theMainScheme,
  thatPlayer,
  topOfDeck,
  valueAtLeast,
  whenRevealed,
} from "../../../dsl/index.js";

/**
 * MC27 (Sinister Motives)'s three campaign-only encounter sets, scripted from `campaigns/sm.ts`'s own module
 * docblock (`composeCampaignSets`, `putPublicOutcryIntoPlay`, `shuffleSmearCampaign`/`shuffleSmearAndSnitches`,
 * `communityServicePick`/`communityServiceShuffleIn`): Bad Publicity (Public Outcry 174a/b, Smear Campaign 175),
 * Community Service (Back Alley Burglary 176, Cat in a Tree 177, Henchmen Heist 178, Off the Rails 179, Rubble
 * Rescue 180) and Snitches Get Stitches (181, the Venom-Eddie-Brock-only attachment). `campaigns/sm.ts` composes
 * and places these; nothing here builds a scenario or a deck — only the printed ability text.
 *
 * **Public Outcry (174a/b)**: "Victory 1. Uses (2[3][per_hero] notoriety counters)." is data (`BaseCard.keywords`);
 * only its own "Response: After a minion or side scheme is defeated, remove 1 notoriety counter from here." is
 * scripted, identically on both faces (their own `Uses` count differs in standard/expert, per data). "Response:",
 * not "Forced Response:", so accepting it is the controller's choice (RRG 1.8 "Response", p. 37) — matched to both
 * `characterDefeated` (a minion) and `schemeDefeated` (a side scheme) by target category, not by source or player.
 *
 * **Smear Campaign (175)**: "In expert mode, this card gains surge." is the `inMode("expert")` `while` precedent
 * (Surprise!, `sm` 27112, `dsl/values.ts`'s own worked example for that exact card). "When Revealed: If Public
 * Outcry is in play, place 2 notoriety counters on it, then remove this card from the game. If Public Outcry is not
 * in play, place 2 threat on the main scheme." reads Public Outcry by name (`named`, the Bell Tower precedent,
 * `venom/encounter-set.ts`) since only one face is ever in play (`modeOnlyFlipped`, RRG 1.8 "Double-Sided Card",
 * p. 17), so there's no face ambiguity to resolve here.
 *
 * **Back Alley Burglary (176)**: "Forced Response: After you thwart this scheme, choose to either spend a
 * [physical] resource or discard 1 random card from your hand." matches any thwart of this scheme regardless of
 * thwarter (`selfIs: "target"`, the "removeThreat" `selfIs` precedent in `wave3/gmw/escape-the-museum.ts`'s
 * `advanceWhenClear`, applied here to the "thwart" event kind instead); "you"/"your hand" is `eventPlayer` (the
 * thwarting player), not `you` (this card's own controller — an encounter side scheme has none) — the "either
 * spend … or …" shape is `spendResources` + `ifThen(not(made(bind)), …)` (Energy Drain, `spdr` 31028, cited by the
 * builder's own docblock).
 *
 * **Cat in a Tree (177)**: "As an additional cost to thwart this scheme, take 2 indirect damage." is
 * `additionalThwartCost`'s own worked example for this exact card (`dsl/abilities.ts`'s docblock).
 *
 * **Henchmen Heist (178)**: "Forced Response: After any amount of threat is removed from this scheme, place an
 * equal amount of threat on the main scheme." is the "removeThreat" trigger event (`escape-the-museum.ts`'s
 * `advanceWhenClear` precedent again), `eventAmount` reading the amount actually removed.
 *
 * **Off the Rails (179)**: "Forced Interrupt: When the villain phase begins, place 1 speed counter here. If there
 * are at least 2 speed counters here, remove this card from the game and discard the top 3 cards of each player's
 * deck." is `on.phaseBeginning("villain")` (docs/phase7-wave3.md §3.2's own villain/player phase pattern) plus a
 * counter-threshold check, the same "add, then check the printed threshold" shape as the Bell Tower's own chime
 * counters (`venom/encounter-set.ts`) — here a plain one-shot `ifThen`, since nothing else in this box ever changes
 * this card's own speed counters (no shared `flipBellTowerIfThreshold`-style helper is needed).
 *
 * **Rubble Rescue (180)**: "Interrupt: When a character makes a basic thwart against this side scheme, (they may)
 * use their ATK instead of their THW." is word-for-word The Red House's own text (`trors` 04139) modeled there as a
 * *constant* `RuleSpec.thwartWithAtk`, not a scripted Interrupt ability, per that module's own docblock — the same
 * reading applies here (the ability ref keeps its printed "-interrupt" suffix; the trigger it implements is
 * `constant`, per that precedent).
 *
 * **Snitches Get Stitches (181)**: "Victory -1. Attach to Venom (Eddie Brock). If you cannot this card gains
 * surge. Forced Interrupt: When a villain attacks, it attacks Venom. If that attack defeats Venom, add Venom and
 * this card to the victory display. Action: Exhaust Venom and spend 2 resources of the same type → discard this
 * card." Four ability refs:
 * - `-constant` ("if you cannot [attach], gains surge"): `attachesTo` (data) already replaces the discard with a
 *   plain "stays unattached, the engine's own reveal-resolution discards it" path (`resolve/reveal.ts`'s
 *   `cannotAttach` stage) when Venom isn't in play to attach to — no scripted fallback effects are needed (unlike
 *   the Sinister Six's own `AMBUSH_FALLBACK`, which re-attaches elsewhere). The surge grant is the `gainsKeyword`
 *   + `while: not(isAttached(self))` idiom: true exactly when this reveal's attach attempt failed (checked at the
 *   "finish" stage, after the "cannotAttach" stage settles, per `resolve/reveal.ts`), false the instant it attaches.
 * - `-constant-2`: Venom is not itself a Victory X card, so "add Venom … to the victory display" needs Venom
 *   to count as one (RRG 1.8 "Victory X", p. 46's own routing is entirely `hasKeyword(id, "victory")`-driven, with
 *   no separate scriptable "send to the victory display" effect). Granted `value: 0` (Venom carries no printed
 *   Victory value of its own, so it contributes none) while this card is attached to it — which the printed "if
 *   *that* attack defeats Venom" narrows further to the redirected attack specifically. Since this card only exists
 *   attached to Venom (its own "if you cannot" branch above is the only way it exists unattached, and then it is
 *   discarded, not granting anything), and every villain attack is redirected to Venom for as long as this card is
 *   attached (this ability's own Forced Interrupt, below), the two conditions are equivalent in every reachable
 *   game state; **flagged in the report as a simplification**, not a silent guess.
 * - `-forced-interrupt`: `retargetAttack` (Crossfire, `hood` 24026's own precedent) to the ally named Venom,
 *   category-scoped (`query("ally", …)`) since the box's own villain is *also* named "Venom" (27073) and an
 *   unscoped `named("Venom")` would be ambiguous between them.
 * - `-action`: "Exhaust Venom" is `exhaustCardsCost` (the "Exhaust Captain America's Shield" fixed-one-card
 *   precedent, `dsl/abilities.ts`), not `exhaustThis` (this ability's own card is the attachment, not Venom).
 *   "Spend 2 resources of the same type" is `spendSameType(2)` (Kree Combat Armor's own precedent).
 */

const VENOM_ALLY = query("ally", { name: "Venom" });

/** Public Outcry (174a/b) — Response: after a minion or side scheme is defeated, remove 1 notoriety counter. */
const publicOutcryResponse = () =>
  response(
    { on: ["characterDefeated", "schemeDefeated"], targetIs: query(["minion", "sideScheme"]) },
    removeCountersFrom(self, "notoriety", 1),
  );

export const SM_CAMPAIGN_ENCOUNTER = defineAbilities({
  // Public Outcry, standard (174a) and expert (174b) — identical Response on both faces (module docblock).
  "27174a.public-outcry-response": publicOutcryResponse(),
  "27174b.public-outcry-response": publicOutcryResponse(),

  // Smear Campaign (175) — In expert mode, gains surge (`inMode` precedent, module docblock).
  "27175.smear-campaign-constant": constant(
    gainsKeyword({ name: "surge" }, { self: true }, { while: inMode("expert") }),
  ),
  // Smear Campaign (175) — When Revealed: if Public Outcry is in play, 2 notoriety counters on it and remove this
  // card from the game; otherwise 2 threat on the main scheme.
  "27175.when-revealed": whenRevealed(
    ifThen(
      inPlay("Public Outcry"),
      [addCounters("notoriety", 2, named("Public Outcry")), moveCards(cards(self), "removedFromGame")],
      placeThreat(2, theMainScheme),
    ),
  ),

  // Back Alley Burglary (176) — Forced Response: after you thwart this scheme, choose to either spend a [physical]
  // resource or discard 1 random card from your hand (module docblock).
  "27176.back-alley-burglary-forced-response": forcedResponse(
    { on: "thwart", selfIs: "target" },
    spendResources({ physical: 1 }, "paid", eventPlayer),
    ifThen(not(made("paid")), discardAtRandom(1, eventPlayer)),
  ),

  // Cat in a Tree (177) — As an additional cost to thwart this scheme, take 2 indirect damage.
  "27177.cat-in-a-tree-constant": constant(additionalThwartCost({ self: true }, { indirectDamage: 2 })),

  // Henchmen Heist (178) — Forced Response: after any amount of threat is removed from this scheme, place an equal
  // amount of threat on the main scheme.
  "27178.henchmen-heist-forced-response": forcedResponse(
    { on: "removeThreat", selfIs: "target" },
    placeThreat(eventAmount, theMainScheme),
  ),

  // Off the Rails (179) — Forced Interrupt: at the start of the villain phase, place 1 speed counter here; at 2 or
  // more, remove this card from the game and discard the top 3 cards of each player's deck.
  "27179.off-the-rails-forced-interrupt": forcedInterrupt(
    on.phaseBeginning("villain"),
    addCounters("speed", 1, self),
    ifThen(valueAtLeast(countersOn(self, "speed"), 2), [
      moveCards(cards(self), "removedFromGame"),
      forEachPlayer(eachPlayer, moveCards(topOfDeck(3, thatPlayer), "discard")),
    ]),
  ),

  // Rubble Rescue (180) — Interrupt: a basic thwart against this scheme may use ATK instead of THW; modeled as a
  // constant `thwartWithAtk` rule, per The Red House's own precedent (module docblock).
  "27180.rubble-rescue-interrupt": constant(
    rule({ kind: "thwartWithAtk", scheme: query("sideScheme", { self: true }) }),
  ),

  // Snitches Get Stitches (181) — if it cannot attach to Venom, it gains surge instead (module docblock).
  "27181.snitches-get-stitches-constant": constant(
    gainsKeyword({ name: "surge" }, { self: true }, { while: not(isAttached(self)) }),
  ),
  // Snitches Get Stitches (181) — Venom counts as Victory 0 while this is attached to it, so "add Venom … to the
  // victory display" (module docblock's simplification) routes through the ordinary Victory X rule.
  "27181.snitches-get-stitches-constant-2": constant(gainsKeyword({ name: "victory", value: 0 }, { hostOfSelf: true })),
  // Snitches Get Stitches (181) — Forced Interrupt: when a villain attacks, it attacks Venom instead.
  "27181.snitches-get-stitches-forced-interrupt": forcedInterrupt(
    on.villainAttacks(),
    retargetAttack(each(VENOM_ALLY)),
  ),
  // Snitches Get Stitches (181) — Action: Exhaust Venom and spend 2 resources of the same type → discard this
  // card.
  "27181.snitches-get-stitches-action": action(
    { cost: [exhaustCardsCost(VENOM_ALLY), spendSameType(2)] },
    moveCards(cards(self), "discard"),
  ),
});
