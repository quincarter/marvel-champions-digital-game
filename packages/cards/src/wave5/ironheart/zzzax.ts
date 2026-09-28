import type { TargetQuery } from "@mc/engine";
import {
  boost,
  cards,
  chosen,
  constant,
  dealIndirectDamage,
  defineAbilities,
  discardCardsCost,
  discardFromHandCost,
  each,
  eachPlayer,
  eitherCost,
  engagedPlayerOf,
  eventTarget,
  exhaustThis,
  forcedInterrupt,
  forEachPlayer,
  gets,
  heroAction,
  heroInterrupt,
  ifThen,
  ignores,
  instead,
  moveCards,
  not,
  on,
  placeThreat,
  printedResourcesInHandAs,
  putIntoPlay,
  query,
  rule,
  self,
  selectCards,
  sum,
  surge,
  takeIndirectDamageCost,
  thatPlayer,
  totalPrintedResources,
  valueAtLeast,
  varAtLeast,
  whenRevealed,
  you,
  zone,
} from "../../dsl/index.js";

/**
 * The Zzzax modular set (`ironheart` 29033–29040, docs/phase7-wave5.md): three Champion-trait player allies
 * (Bombshell 29033, Wasp 29034, Pinpoint 29035, aspect cards with no `encounterSetIds` — not encounter-deck cards,
 * confirmed against `packages/content/src/data/ironheart/cards.ts`), the side scheme Feedback Loop (29036), the
 * minion Zzzax (29037), the attachment Haywire (29038, quantity 2), the environment Air Static (29039) and the
 * treachery Zzzap! (29040, quantity 2). Every scan (`assets/card-art/bundles/cards/29033-29040.png`) matches the
 * ingested text exactly, including Zzzax's own Boost ("at least [energy] [energy] resources" = 2).
 *
 * **"Total number of [energy] resources"** (Feedback Loop, Zzzax, Zzzap!) counts printed icons, not cards — a card
 * with two energy icons contributes 2 — the same read `wave5/nova/obligation-nemesis.ts`'s "The War's Been
 * Brought" already established for `[wild]`: `selectCards` binds a zone's cards (there is no bare `TargetRef` for
 * "cards in a player's hand", unlike `each(query(...))` for cards in play), then `totalPrintedResources(chosen(
 * <slot>), ["energy"])` sums that pool's icons. "In their hand and on cards they control" (Feedback Loop, Air
 * Static) is the hand pool plus `each(query([], { controlledBy: <player> }))` (cards in play only, not hand —
 * `nova`'s own precedent distinguishes the two), summed together.
 *
 * **Bombshell (29033)** — "Divide damage from Bombshell's attack among each enemy as evenly as possible."
 * docs/phase7-wave5.md §3.32 marks this "reusable as is" via the existing `divideBasicPower` rule (Wasp's Giant
 * form precedent, `wave2/wsp/kit.ts`): the engine already lets a matching character's controller split its basic
 * ATK across several enemies of their choosing when they use it to attack; this constant only grants Bombshell that
 * capacity (`target: { self: true }`, not an identity). The January 11, 2026 (4) ruling ("You resolve Bombshell's
 * ability by dividing her attack as evenly as possible among valid targets… the villain is not a valid target due
 * to Guard, so the villain is ignored") is about *which* targets are legal (the basic attack's own existing target
 * validity check, unchanged) and the even split itself, both of which the printed instruction leaves to whoever
 * performs the attack to carry out correctly — there is no separate "automatic even split" primitive to build.
 *
 * **Wasp (29034)** — "Wasp ignores the guard keyword, patrol keyword, and crisis icon." `characterIgnores`
 * (`ignores`, wave 4 §3.24, Evasive Maneuvering/Nebula's own precedent) targeted at herself, not an identity, so no
 * `while` (hero-form) gate.
 *
 * **Pinpoint (29035)** — "Hero Interrupt: When a player card would be placed into a discard pile from play, exhaust
 * Pinpoint → shuffle that card into its owner's deck instead." A replacement (RRG 1.8 "Replacement Effect", p. 37) on
 * the generic `cardLeavesPlay` leaving (docs/phase7-wave5.md §4.1 Q17, Q32–Q34), not on `characterDefeated`: every
 * route from play to a discard pile — a defeat, a discard effect or cost, a move to the discard pile, an attachment
 * going with its host — waits for this interrupt window with the card still in play, and `instead(...)` cancels that
 * leaving and moves the card itself. `on.playerCardDiscardedFromPlay()` is "leaving for a player's discard pile",
 * which only player cards reach (RRG 1.8 "Discard", p. 16), so an encounter card going to the encounter discard pile
 * is never offered; an event card resolving is never in play (RRG 1.8 "In Play and Out of Play", p. 23), so it is not
 * either. `moveCards(…, "deckShuffle")` sends a card to its owner's deck and shuffles it, whoever controls Pinpoint.
 * An ally that is defeated this way is still defeated; only where it goes is replaced.
 *
 * **Zzzax (29037)** — the constant "gets +X ATK and +X hit points" reads `engagedPlayerOf(self)` live (no
 * `selectCards`/`chosen` needed outside an effect list: `totalPrintedResources` takes any `TargetRef`, including
 * `each(query(...))`, which is fine to read continuously). The Boost is `boost`'s own effect list, so it can use
 * `selectCards`/`chosen` as the When Revealed cards above do.
 *
 * **Haywire (29038) / Air Static (29039)** share one Hero Action shape: "Choose to either discard a card you
 * control with a printed [energy] resource or take 2 indirect damage → discard this card." RRG 1.8 "Ownership and
 * Control" (p. 31): "A player controls the cards in their own out-of-play areas (such as the hand… )" — so "a card
 * you control" spans hand *and* in-play cards, which needs two different existing cost primitives
 * (`discardFromHandCost`, hand only; `discardCardsCost`, in-play only). `eitherCost`'s own contract ("exactly one
 * branch is paid, the player's choice", `gmw/museum.ts`'s Grand Collection 1B precedent) already generalizes to any
 * number of branches, so a third branch alongside the two discard pools is the same primitive, not a special case —
 * together the three branches are exactly "discard a card you control (hand or in play) with a printed energy
 * resource, or take 2 indirect damage". Once Haywire is attached, its own `printedResourcesInHandAs` (wave 5 §3.20)
 * is "read by… every printed-resource query and count" (its own docblock), so `discardFromHandCost`'s `energy`
 * filter automatically accepts *any* hand card without extra plumbing — matching the printed interaction (a hand
 * card no longer needs a real energy icon to pay Haywire's own action once it is in play).
 */
const ENERGY: Pick<TargetQuery, "printedResource"> = { printedResource: "energy" };

/** "Discard a card you control with a printed [energy] resource" (hand or in-play), shared by 29038/29039. */
const A_CARD_WITH_ENERGY = query(["ally", "upgrade", "support"], ENERGY);

/** "Choose to either discard a card you control with a printed [energy] resource or take 2 indirect damage →
 * discard this card" (Haywire 29038, Air Static 29039). */
const discardEnergyOrTakeDamageThenDiscardSelf = () =>
  heroAction(
    {
      cost: eitherCost(
        discardFromHandCost(1, 1, "discarded", ENERGY),
        discardCardsCost(A_CARD_WITH_ENERGY),
        takeIndirectDamageCost(2),
      ),
    },
    moveCards(cards(self), "discard"),
  );

export const IRONHEART_ZZZAX = defineAbilities({
  // Bombshell (29033) — [star] Divide damage from Bombshell's attack among each enemy as evenly as possible
  // (module docblock; ruling Jan 11, 2026 (4)).
  "29033.bombshell-constant": constant(rule({ kind: "divideBasicPower", power: "attack", target: { self: true } })),

  // Wasp (29034) — Wasp ignores the guard keyword, patrol keyword, and crisis icon.
  "29034.wasp-constant": constant(ignores({ self: true }, ["guard", "patrol", "crisis"])),

  // Pinpoint (29035) — Hero Interrupt: When a player card would be placed into a discard pile from play, exhaust
  // Pinpoint → shuffle that card into its owner's deck instead.
  "29035.pinpoint-interrupt": heroInterrupt(
    on.playerCardDiscardedFromPlay(),
    { cost: exhaustThis },
    instead(moveCards(cards(eventTarget), "deckShuffle")),
  ),

  // Feedback Loop (29036) — When Revealed: Each player must place threat here equal to the total number of
  // [energy] resources in their hand and on cards they control.
  "29036.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      selectCards("handCards", zone("hand", thatPlayer)),
      selectCards("controlCards", cards(each(query([], { controlledBy: thatPlayer })))),
      placeThreat(
        sum(
          totalPrintedResources(chosen("handCards"), ["energy"]),
          totalPrintedResources(chosen("controlCards"), ["energy"]),
        ),
        self,
      ),
    ),
  ),

  // Zzzax (29037) — [star] Zzzax gets +X ATK and +X hit points, where X is the total number of [energy] resources
  // on cards the engaged player controls.
  "29037.zzzax-constant": constant(
    gets("atk", totalPrintedResources(each(query([], { controlledBy: engagedPlayerOf(self) })), ["energy"]), {
      self: true,
    }),
    gets("hp", totalPrintedResources(each(query([], { controlledBy: engagedPlayerOf(self) })), ["energy"]), {
      self: true,
    }),
  ),
  // Zzzax — [star] Boost: If you have at least 2 [energy] resources in your hand, put Zzzax into play engaged with
  // you.
  "29037.boost": boost(
    selectCards("handCards", zone("hand", you)),
    ifThen(valueAtLeast(totalPrintedResources(chosen("handCards"), ["energy"]), 2), [putIntoPlay(self, you)]),
  ),

  // Haywire (29038) — Attach to your identity. Treat the printed resource of each card in your hand as if it were
  // [energy] (wave 5 §3.20). Hero Action: see module docblock.
  "29038.haywire-constant": constant(printedResourcesInHandAs(you, "energy")),
  "29038.haywire-action": discardEnergyOrTakeDamageThenDiscardSelf(),

  // Air Static (29039) — Forced Interrupt: When the villain phase begins, deal 2 indirect damage to each player
  // with an [energy] resource in their hand and/or on a card they control. Hero Action: see module docblock.
  "29039.air-static-forced-interrupt": forcedInterrupt(
    on.phaseBeginning("villain"),
    forEachPlayer(
      eachPlayer,
      selectCards("handCards", zone("hand", thatPlayer)),
      selectCards("controlCards", cards(each(query([], { controlledBy: thatPlayer })))),
      ifThen(
        valueAtLeast(
          sum(
            totalPrintedResources(chosen("handCards"), ["energy"]),
            totalPrintedResources(chosen("controlCards"), ["energy"]),
          ),
          1,
        ),
        [dealIndirectDamage(thatPlayer, 2)],
      ),
    ),
  ),
  "29039.air-static-action": discardEnergyOrTakeDamageThenDiscardSelf(),

  // Zzzap! (29040) — When Revealed: Take indirect damage equal to the total number of [energy] resources in your
  // hand. If your identity was dealt 1 or fewer damage this way, this card gains surge.
  "29040.when-revealed": whenRevealed(
    selectCards("handCards", zone("hand", you)),
    dealIndirectDamage(you, totalPrintedResources(chosen("handCards"), ["energy"]), { bind: "dealt" }),
    ifThen(not(varAtLeast("dealt.amount", 2)), surge()),
  ),
});
