import {
  chosen,
  defineAbilities,
  each,
  encounterCards,
  firstAttackThisTurn,
  forcedResponse,
  giveBoostCard,
  ifThen,
  oneCopyOf,
  on,
  putIntoPlay,
  query,
  selectCards,
  shuffleEncounterDeck,
  whenRevealed,
  yourIdentity,
} from "../../../dsl/index.js";

/**
 * "Vengeance"/"Retribution" (every Venom stage's own Forced Response, `sm` 27073–27075, docs/phase7-wave5.md §2.2,
 * §3.6, §3.12): "After you or an ally you control attacks and damages Venom, place 1 facedown boost card on your
 * identity (2 instead if this is the first attack this turn, Venom (III) only)." `giveBoostCard`'s own docblock
 * widens it to any card in play, so an identity can hold one until "Leave Us Alone!" 1B's own Forced Interrupt moves
 * it on with `moveBoostCards` (`main-scheme.ts`).
 */
const vengeance = (twoOnFirstAttack: boolean) =>
  forcedResponse(
    on.attacks({ categories: ["hero", "ally"] }, { target: { self: true }, damages: true }),
    twoOnFirstAttack
      ? ifThen(firstAttackThisTurn(), giveBoostCard(yourIdentity, 2), giveBoostCard(yourIdentity))
      : giveBoostCard(yourIdentity),
  );

export const VENOM = defineAbilities({
  // Venom (I) (27073, Toughness is data) — Vengeance: see `vengeance` above.
  "27073.vengeance": vengeance(false),

  // Venom (II) (27074, Toughness/Steady are data) — When Revealed: Search the encounter deck and discard pile for
  // the Tooth and Nail side scheme and put it into play. (Shuffle.) Vengeance: same as (I).
  "27074.when-revealed": whenRevealed(
    selectCards("toothAndNail", oneCopyOf(encounterCards(["deck", "discard"], { name: "Tooth and Nail" }))),
    putIntoPlay(chosen("toothAndNail")),
    shuffleEncounterDeck(),
  ),
  "27074.vengeance": vengeance(false),

  // Venom (III) (27075, Retaliate 1/Steady/Toughness are data) — When Revealed: Place 2 facedown boost cards on each
  // identity. Retribution: as `vengeance`, but 2 facedown boost cards instead of 1 if this is the first attack this
  // turn (docs/phase7-wave5.md §3.12/§4.1 Q16's own default: every attack made this turn, not only attacks on Venom).
  "27075.when-revealed": whenRevealed(giveBoostCard(each(query("identity")), 2)),
  "27075.retribution": vengeance(true),
});
