import type { TargetQuery } from "@mc/engine";
import {
  andThen,
  bindTargets,
  boost,
  cards,
  chooseCards,
  chooseOne,
  chooseOneBy,
  chooseTarget,
  chosen,
  confuse,
  constant,
  coveredByEngineRule,
  createScenarioArea,
  dealDamage,
  defineAbilities,
  each,
  eachPlayer,
  eitherCost,
  endGame,
  enemyAttack,
  exhaustYourHero,
  exists,
  firstPlayer,
  forcedInterrupt,
  forEachPlayer,
  hasStatus,
  heroAction,
  ifThen,
  made,
  moveCards,
  not,
  oncePerRoundPerPlayer,
  option,
  perHero,
  placeThreat,
  preventDamage,
  printedCostOf,
  putIntoPlay,
  query,
  revealCard,
  rule,
  scenarioArea,
  scenarioAreaCount,
  self,
  selectCards,
  setup,
  spend,
  spendResources,
  stateCheck,
  superlative,
  surge,
  eventAmount,
  takeDamage,
  thatPlayer,
  theMainScheme,
  theVillain,
  topOfDeck,
  valueAtLeast,
  valueAtMost,
  varAtLeast,
  when,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";

/**
 * Infiltrate the Museum: the villain Collector I–III (16070–16072), the main scheme The Grand Collection
 * (16073a/16073b), the Infiltrate the Museum encounter set (16074–16079), and the Menagerie Medley modular set
 * (16135–16137, MC16 p. 9's own recommended modular for this scenario, confirmed directly on 16073a's own printed
 * "Contents" text). 16075 (Monarch Starstalker) and 16136 (Servant Bot) carry no ability refs at all (Villainous
 * and Guard/Patrol are both data-driven keywords) — nothing to script for either.
 *
 * **The out-of-play area "The Collection"** (docs/phase7-wave3.md §3.14) is `createScenarioArea`/`{scenarioArea}`/
 * `scenarioAreaCount`, all landed in the engine; this pass adds the DSL builders (`dsl/effects.ts`'s `scenarioArea`/
 * `createScenarioArea`, `dsl/values.ts`'s `scenarioAreaCount`) that nothing in `@mc/cards` had exposed yet.
 *
 * **Collector III's own printed ability is one Forced Interrupt box** ("…instead, then place 1 threat on the main
 * scheme"), and only the active stage's own abilities apply (RRG 1.8 "Villain Defeat", p. 47) — so the redirect and
 * its follow-up have to be one ability id (`16072.collector-forced-interrupt`), not the redirect plus some other
 * card's own response to the announced `discardRedirected` event (the engine's own `scenario-area.test.ts` only
 * uses two cards to prove the event is independently usable). This needed a minimal, generic engine change:
 * `RuleSpec discardFromPlayDestination` gains an optional `thenPlaceThreat`, applied by `leavePlay` itself right
 * after the redirect, through the ordinary interruptible `placeThreat` event — see `packages/engine/src/abilities.ts`,
 * `rules.ts`'s `discardRedirectArea`/`mainSchemeForRedirect`, and `effects.ts`'s `leavePlay`, with its own test in
 * `packages/engine/src/scenario-area.test.ts`.
 *
 * **Biogram Image's "put this card faceup into The Collection →" is scripted as an ordinary effect, not an
 * `AbilityCost`.** No `AbilityCost` primitive exists for "move this card to an out-of-play area as a cost", and
 * unlike `exhaustSelf` (whose payability gates whether an *already*-exhausted card's ability may even be offered),
 * there is no state in which this attachment is in play, on the villain, with its Forced Interrupt active, and yet
 * unable to move itself to The Collection — so ordering it as the ability's first effect, ahead of the prevention,
 * produces the identical result to modelling it as a cost. Flagged here as a scripting decision, not a guess.
 *
 * `16073b.the-grand-collection-action` ("Hero Action: Choose to either exhaust your hero or spend 2 resources of
 * any type → discard 1 card from The Collection (to its owner's discard pile). (Limit once per round per
 * player.)") was recorded as a primitive gap — a true either/or `AbilityCost`, distinct from `cost: [a, b]`'s AND.
 * Closed by `AbilityCost.either`/`costSelection.branch` and `AbilityLimit.per: "player"` (docs/phase7-wave3.md
 * §3.36).
 *
 * "If this stage is completed, the players lose the game" (16073b's own second clause) needs no ability ref: The
 * Grand Collection is a single-stage main scheme, so completing it is completing the *final* stage, and RRG 1.8
 * "Villain Defeat" (p. 47)'s own default (a completed final main scheme stage loses the game) already covers it —
 * the same reading `gmw/badoon.ts`'s Protect the Planet 2B docblock already recorded for cycle 2's other 1B/2B main
 * schemes.
 *
 * **16077 (View the Cosmos) data note, flagged to `card-data-pipeline`:** its "Choose one:" block uses `-` bullets
 * (rather than the `•` bullets `01165`'s Eviction Notice special-cases into one `obligation` ref), and the raw data
 * carries two extra empty ids, `16077.view-the-cosmos-constant`/`-constant-2`, alongside the real
 * `16077.when-revealed` that already carries the whole "Choose one:" text — the same parser-artifact shape
 * `wave2/trors/absorbing-man.ts`'s Omni-Morph Duplication (04089) already worked around. Stood up empty below.
 */

const COLLECTION = "The Collection";
const collectorRedirect = (thenPlaceThreat?: number) =>
  constant(
    rule({
      kind: "discardFromPlayDestination",
      cards: {},
      area: COLLECTION,
      ...(thenPlaceThreat ? { thenPlaceThreat } : {}),
    }),
  );

const CARDS_YOU_CONTROL: TargetQuery = { categories: ["ally", "support", "upgrade"], controller: "you" };

export const MUSEUM = defineAbilities({
  // Collector I — Forced Interrupt: When a card (player or encounter) would be placed into a discard pile from
  // play, put it faceup into The Collection instead.
  "16070.collector-forced-interrupt": collectorRedirect(),

  // Collector II — When Revealed: In player order, each player must choose to either put the top card of their
  // deck faceup into The Collection or take 3 damage.
  "16071.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      chooseOneBy(
        thatPlayer,
        option(
          "Put the top card of your deck faceup into The Collection",
          moveCards(topOfDeck(1, thatPlayer), { scenarioArea: COLLECTION }),
        ),
        option("Take 3 damage", takeDamage(3, thatPlayer)),
      ),
    ),
  ),
  // Collector II — same Forced Interrupt as Collector I.
  "16071.collector-forced-interrupt": collectorRedirect(),

  // Collector III — When Revealed: Put the top card of each player's deck faceup into The Collection. Place 1
  // threat on the main scheme for each card in The Collection.
  "16072.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, moveCards(topOfDeck(1, thatPlayer), { scenarioArea: COLLECTION })),
    placeThreat(scenarioAreaCount(COLLECTION), theMainScheme),
  ),
  // Collector III — same Forced Interrupt as Collector I/II, plus "then place 1 threat on the main scheme"
  // (`thenPlaceThreat`, engine docblock above).
  "16072.collector-forced-interrupt": collectorRedirect(1),

  // The Grand Collection 1A — Setup: Create "The Collection" game area. Put the top card of each player's deck
  // faceup into The Collection.
  "16073a.setup": setup(
    createScenarioArea(COLLECTION),
    forEachPlayer(eachPlayer, moveCards(topOfDeck(1, thatPlayer), { scenarioArea: COLLECTION })),
  ),
  // The Grand Collection 1B — Hero Action: Choose to either exhaust your hero or spend 2 resources of any type →
  // discard 1 card from The Collection (to its owner's discard pile). (Limit once per round per player.)
  "16073b.the-grand-collection-action": heroAction(
    { cost: eitherCost(exhaustYourHero, spend(2)), limit: oncePerRoundPerPlayer },
    chooseCards("card", scenarioArea(COLLECTION), { min: 1, max: 1 }),
    moveCards(cards(chosen("card")), "discard"),
  ),
  // The Grand Collection 1B — If there are at least 5[per_hero] cards in The Collection, the players lose the
  // game. ("…or if this stage is completed" is the engine's own final-stage-completion default; module docblock.)
  "16073b.the-grand-collection-constant": stateCheck(
    valueAtLeast(scenarioAreaCount(COLLECTION), perHero(5)),
    endGame("loss"),
  ),

  // Biogram Image — Attach to Collector (data). Forced Interrupt: When Collector would take any amount of damage,
  // put this card faceup into The Collection → prevent all of that damage, then place threat on the main scheme
  // equal to the amount prevented this way. (Module docblock: cost-as-effect reading.)
  // `preventDamage` always fully resolves once triggered (there's always damage to prevent), so `andThen` around
  // the "then place threat" is the faithful reading (RRG 1.8 "'Then'", p. 44) without changing behavior today.
  "16074.biogram-image-forced-interrupt": forcedInterrupt(
    when.damage("host"),
    moveCards(cards(self), { scenarioArea: COLLECTION }),
    preventDamage(),
    andThen(placeThreat(eventAmount, theMainScheme)),
  ),
  // Biogram Image — [star] Boost: After this activation ends, reveal this card.
  "16074.boost": boost(revealCard(self, firstPlayer)),

  // Inconspicuous Box — When Revealed: Put the lowest cost card you control faceup into The Collection. If you
  // cannot, this card gains surge.
  "16076.when-revealed": whenRevealed(
    ifThen(
      exists(CARDS_YOU_CONTROL),
      [
        bindTargets("lowest", superlative("lowest", each(CARDS_YOU_CONTROL), printedCostOf(chosen("candidate")))),
        chooseTarget("moved", { inSlot: "lowest" }),
        moveCards(cards(chosen("moved")), { scenarioArea: COLLECTION }),
      ],
      surge(),
    ),
  ),
  // Inconspicuous Box — [star] Boost: If there are 3[per_hero] or fewer cards in The Collection, put the top card
  // of your deck faceup into The Collection.
  "16076.boost": boost(
    ifThen(
      valueAtMost(scenarioAreaCount(COLLECTION), perHero(3)),
      moveCards(topOfDeck(1, you), { scenarioArea: COLLECTION }),
    ),
  ),

  // View the Cosmos — When Revealed: Choose one: put the highest cost card from your hand faceup into The
  // Collection; or discard the highest cost card from your hand, then place threat on the main scheme equal to
  // its printed cost. `chooseCards`, not `chooseTarget`: a hand card is never "in play" (wave1/drs/nemesis.ts's
  // own `discardHighestCostCard` docblock, the same trap).
  "16077.when-revealed": whenRevealed(
    selectCards("hand", zone("hand", you)),
    bindTargets("costly", superlative("highest", chosen("hand"), printedCostOf(chosen("candidate")))),
    chooseOne(
      option(
        "Put the highest cost card from your hand faceup into The Collection",
        chooseCards("picked", cards(chosen("costly")), { min: 1, max: 1, chooser: you }),
        moveCards(cards(chosen("picked")), { scenarioArea: COLLECTION }),
      ),
      option(
        "Discard the highest cost card from your hand, then place threat on the main scheme equal to its printed cost",
        // RRG 1.8 "Choose (Option)" (p. 12) already excludes this option when the hand is empty, so the required
        // `chooseCards` can't leave the frame pre-then-unresolved today; `andThen` is still the faithful reading
        // of the printed "then" (RRG 1.8 "'Then'", p. 44).
        chooseCards("discarded", cards(chosen("costly")), { min: 1, max: 1, chooser: you }),
        moveCards(cards(chosen("discarded")), "discard"),
        andThen(placeThreat(printedCostOf(chosen("discarded")), theMainScheme)),
      ),
    ),
  ),
  // View the Cosmos — parser artifacts (module docblock): the whole "Choose one:" text is already
  // `16077.when-revealed` above.
  "16077.view-the-cosmos-constant": coveredByEngineRule(),
  "16077.view-the-cosmos-constant-2": coveredByEngineRule(),

  // Stay Awhile — When Revealed (Alter-Ego): Choose to either spend [physical][physical] resources or put the top
  // card of your deck faceup into The Collection.
  "16078.when-revealed-alter-ego": whenRevealedAlterEgo(
    spendResources({ physical: 2 }, "paid"),
    ifThen(not(made("paid")), moveCards(topOfDeck(1, you), { scenarioArea: COLLECTION })),
  ),
  // Stay Awhile — When Revealed (Hero): Collector attacks you with +1 ATK. If you take any amount of damage from
  // that attack, put the top card of your deck faceup into The Collection.
  "16078.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you, atkBonus: 1, bind: "attack" }),
    ifThen(varAtLeast("attack.damaged", 1), moveCards(topOfDeck(1, you), { scenarioArea: COLLECTION })),
  ),

  // Caught Off Guard (16079) is a verbatim reprint of Core's own 01188 ("When Revealed: Discard an upgrade or
  // support you control. If no cards were discarded this way, this card gains surge."): `../reprints.ts` already
  // aliases `16079.when-revealed` to `01188.when-revealed`'s definition automatically (same `reprintKey`, "Caught
  // Off Guard treachery") — scripting it here would collide with that alias (`mergeRegistries`'s own duplicate-id
  // guard caught this while writing this file).

  // Menagerie Medley (modular) -------------------------------------------------------------------------------

  // Psionic Ghost — When Revealed: You are confused. If you are already confused, take 1 damage. (Checked before
  // the confuse, so it reads whether you were *already* confused — Badoon Sentry's own tough check, `badoon.ts`,
  // is the same shape.)
  "16135.when-revealed": whenRevealed(
    ifThen(hasStatus(yourIdentity, "confused"), dealDamage(1, yourIdentity)),
    confuse(yourIdentity),
  ),
  // Psionic Ghost — [star] Boost: Put Psionic Ghost into play engaged with you.
  "16135.boost": boost(putIntoPlay(self, you)),

  // Starshark — Quickstrike (data). [star] Starshark's attacks deal indirect damage (docs/phase7-wave3.md §3.16).
  "16137.starshark-constant": constant(rule({ kind: "attacksDealIndirectDamage", attacker: { self: true } })),
  // Starshark — [star] Boost: Deal 1 damage to each character you control.
  "16137.boost": boost(dealDamage(1, each(query("character", { controller: "you" })))),
});
