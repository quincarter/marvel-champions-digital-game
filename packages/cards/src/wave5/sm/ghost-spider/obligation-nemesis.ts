import { trait } from "@mc/content";
import {
  alterEgoAction,
  anyOfCards,
  applyRuleUntil,
  attachCard,
  cards,
  chooseCards,
  chosen,
  constant,
  defineAbilities,
  each,
  enemyAttack,
  exhaustYourHero,
  forcedInterrupt,
  gainsTrait,
  gets,
  heal,
  ifThen,
  isAttached,
  made,
  moveCards,
  named,
  not,
  on,
  query,
  self,
  surge,
  whenRevealed,
  you,
  zone,
} from "../../../dsl/index.js";

/**
 * Worried Father (27025), Ghost-Spider's obligation, and her nemesis set: Regenerative Research (27026, side
 * scheme), The Lizard (27027, nemesis minion), Experimental Injection (27028, attachment), In Cold Blood ×2
 * (27029, treachery).
 *
 * **Worried Father** does not fit the shared `obligation()` shape (`core/obligations.ts`): it is not a "you may
 * flip; choose one of two options" card at all — it is "Give to the Gwen Stacy player. [a search-and-attach line].
 * Alter-Ego Action: [a retrieval line]", so both halves are scripted directly. Card data names the search-and-
 * attach ability `27025.worried-father-constant` (`packages/content/src/data/sm/cards.ts`), but its actual timing
 * is "when this obligation is revealed", not a persistent constant — the `-constant` suffix is this content
 * record's own naming convention for "the ability that isn't the action" (`nova` 28021's own middle line, a real
 * `constant`, uses the same suffix; the pipeline did not distinguish the two shapes when assigning ids). Built as
 * `whenRevealed`, matching every other obligation's own resolution point (RRG 1.8 "Obligation", p. 30; this
 * engine's own `obligation()` helper, `core/obligations.ts`).
 *
 * The search itself (§3.15, docs/phase7-wave5.md; "Facedown attached cards") mirrors `trors/hawkeye-obligation-
 * nemesis.ts`'s Marked for Death: `anyOfCards` unions the out-of-play zones (`zone(["deck","hand","discard"], you,
 * …)`) with the play area (`cards(each(query("support", { controller: "you", … })))`) into one pool for a single
 * `chooseCards`, min/max 1 — George Stacy (27007) is `deckLimit: 1` and printed in Ghost-Spider's own precon, so
 * exactly one copy exists somewhere in these four zones for any legal deck.
 *
 * **The Alter-Ego Action retrieves George Stacy before removing Worried Father, not after** despite the printed
 * order ("remove this obligation from the game → add George Stacy to your hand"): RRG 1.8 "Leaves Play" (p. 27)
 * discards every card attached to a card as it leaves play, "carried out simultaneously with the card leaving
 * play" (ruling, Jan 17, 2026 (1) #2) — removing Worried Father first would discard the facedown George Stacy
 * along with it, defeating the entire point of the action. Moving George Stacy to hand first, then removing
 * Worried Father from the game, is the only order that can resolve as printed. The same "print order isn't
 * resolution order when no cost primitive exists for a same-sentence self-removal" reasoning as Ticket to the
 * Multiverse (27008, `support-upgrades-allies.ts`'s own docblock).
 *
 * **Regenerative Research** and **The Lizard** print the identical "Forced Interrupt: When the villain phase
 * begins, heal 1 damage from [target]" line (the side scheme healing every enemy, the minion healing only
 * itself) — Marvel Champions' way of keeping The Lizard relevant despite heavy incoming damage between his own
 * activations.
 *
 * **Experimental Injection**'s host selection ("Attach to the minion with the most remaining hit points") is
 * schema-level (`AttachmentHost` `attachesTo: { kind: "superlative", among: "minion", order: "highest", measure:
 * "remainingHp" }`, resolved automatically by the engine's own reveal handling, `packages/engine/src/resolve/
 * reveal.ts`'s `resolveAttachmentTarget`), not scripted here. Only the "if you cannot, gains surge" check
 * (`isAttached(self)`, read after that resolution — the `values.ts` docblock's own "Attach to X. If you cannot, …"
 * worked example) and "Attached minion gains the Creature trait and gets +4 hit points" (`hostOfSelf`) are
 * scripted, matching the card data's own 2 ability refs (`-constant`/`-constant-2`, the Core "Genetically
 * Enhanced" 01163 precedent for both the naming and the split).
 *
 * **In Cold Blood**'s "You cannot play events until after that attack resolves" is `applyRuleUntil(cannotPlay
 * events, "endOfAttack", …, { attack: "initiated" })`, written *before* the `enemyAttack`: "that attack" is the one
 * this same ability initiates, so the rule is active from the attack's start (its interrupt windows included) and
 * expires when the attack's event frame finishes. If The Lizard is not in play (or is stunned), no attack is made
 * and the rule ends at once (engine `spec.ts` `applyRuleUntil` docblock).
 */
export const GHOST_SPIDER_OBLIGATION_NEMESIS = defineAbilities({
  // Worried Father — Give to the Gwen Stacy player. Search your deck, hand, discard pile, and play area for
  // George Stacy and attach him facedown to this card.
  "27025.worried-father-constant": whenRevealed(
    chooseCards(
      "stacy",
      anyOfCards(
        zone(["deck", "hand", "discard"], you, { filter: { name: "George Stacy" } }),
        cards(each(query("support", { controller: "you", name: "George Stacy" }))),
      ),
      { min: 1, max: 1 },
    ),
    attachCard(chosen("stacy"), self, { facedown: true }),
  ),
  // Worried Father — Alter-Ego Action: Exhaust Gwen Stacy and remove this obligation from the game → add George
  // Stacy to your hand. (Module docblock: George Stacy is moved to hand before Worried Father is removed.)
  "27025.worried-father-action": alterEgoAction(
    { cost: exhaustYourHero },
    moveCards(cards(each(query("support", { host: self, facedown: true }))), "hand"),
    moveCards(cards(self), "removedFromGame"),
  ),

  // Regenerative Research — Forced Interrupt: When the villain phase begins, heal 1 damage from each enemy.
  "27026.regenerative-research-forced-interrupt": forcedInterrupt(
    on.phaseBeginning("villain"),
    heal(1, each(query("enemy"))),
  ),

  // The Lizard (nemesis minion) — Forced Interrupt: When the villain phase begins, heal 1 damage from The Lizard.
  // (Toughness/traits/ATK/SCH/HP are data.)
  "27027.the-lizard-forced-interrupt": forcedInterrupt(on.phaseBeginning("villain"), heal(1, self)),

  // Experimental Injection — If you cannot attach to the minion with the most remaining hit points (schema-level
  // `attachesTo`, resolved before this ability's own reveal frame), this card gains surge.
  "27028.experimental-injection-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // Experimental Injection — Attached minion gains the Creature trait and gets +4 hit points.
  "27028.experimental-injection-constant-2": constant(
    gainsTrait(trait("CREATURE"), { hostOfSelf: true }),
    gets("hp", 4, { hostOfSelf: true }),
  ),

  // In Cold Blood — When Revealed: The Lizard attacks you. You cannot play events until after that attack resolves.
  // If no attack was made this way, this card gains surge. (The restriction comes first so it covers the whole
  // attack — module docblock.)
  "27029.when-revealed": whenRevealed(
    applyRuleUntil({ kind: "cannotPlay", player: you, cards: query("event") }, "endOfAttack", undefined, {
      attack: "initiated",
    }),
    enemyAttack(named("The Lizard"), { against: you, bind: "attack" }),
    ifThen(not(made("attack")), surge()),
  ),
});
