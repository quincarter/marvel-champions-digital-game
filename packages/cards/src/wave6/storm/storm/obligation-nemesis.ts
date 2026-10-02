import {
  alterEgoAction,
  anyOfCards,
  attacksGainKeywords,
  bindTargets,
  cards,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  defeatingPlayer,
  defineAbilities,
  each,
  encounterCards,
  exhaustYourHero,
  forcedInterrupt,
  giveTough,
  isAttached,
  moveCards,
  not,
  oneCopyOf,
  query,
  revealCard,
  rule,
  selectCards,
  self,
  setAside,
  shuffleEncounterDeck,
  statOf,
  superlative,
  surge,
  takeDamage,
  ifThen,
  when,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
  you,
} from "../../../dsl/index.js";

const KNIFE_FIGHT = "Knife Fight";

/**
 * Claustrophobia (36030), Storm's obligation, and her Callisto nemesis set (`storm_nemesis`): Callisto (36031, nemesis
 * minion), Leader of the Morlocks (36032, side scheme), Switchblade (36033, attachment) and Knife Fight x2 (36034,
 * treachery). docs/phase7-wave6.md §6.2, §3.58.
 *
 * - **Claustrophobia** stays in play (the Lost Visor shape, not the shared `obligation()` helper). "You cannot change to
 *   hero form" (erratum, RRG 1.8 p. 68) is a bare `cannotChangeForm` rule, which also blocks a change to alter-ego
 *   form. Engine gap: the card should only block the change out of alter-ego form (a `while` form predicate), but
 *   `activeRules` (`select.ts`) evaluates a rule's `while` with the card's controller, and an obligation has none, so
 *   neither `isAlterEgo()` nor `ownerOf(self)` (an obligation's `ownerId` is null) can be true there. In practice she
 *   is in alter-ego form while it is in play, so the difference needs another effect to put her in hero form.
 *   (Spec §3.58 assumed the `while` form works.)
 *   NOT SCRIPTED: the printed "Flip to alter-ego form." (its
 *   When Revealed). The card data names no ref for it (no When Revealed header, so the parser emitted only the
 *   constant and the action); it needs a curated `unheadedWhenRevealed` (as Lost Visor 33027 has) and a regen.
 * - **Leader of the Morlocks** searches the encounter deck, its discard pile and every player's set-aside area
 *   (where the nemesis cards start) for one Knife Fight; the defeating player reveals it.
 * - **Switchblade**: the host is `attachesTo` data (highest printed ATK); "otherwise gains surge" and the piercing grant
 *   are scripted (Razor Claws' shape).
 */
export const STORM_OBLIGATION_NEMESIS = defineAbilities({
  "36030.claustrophobia-constant": constant(rule({ kind: "cannotChangeForm", player: you })),
  "36030.claustrophobia-action": alterEgoAction({ cost: exhaustYourHero }, moveCards(cards(self), "removedFromGame")),

  // Callisto — Quickstrike (data). Forced Interrupt: When a Knife Fight treachery is revealed, give Callisto a tough
  // status card.
  "36031.callisto-forced-interrupt": forcedInterrupt(
    when.encounterCardRevealed(query("treachery", { name: KNIFE_FIGHT })),
    giveTough(self),
  ),

  // Leader of the Morlocks — When Defeated: The player who defeated this scheme searches the encounter deck, discard
  // pile, and set-aside area for Knife Fight and reveals it.
  "36032.when-defeated": whenDefeated(
    selectCards(
      "found",
      oneCopyOf(
        anyOfCards(
          encounterCards(["deck", "discard"], query("treachery", { name: KNIFE_FIGHT })),
          setAside({ kind: "each" }, query("treachery", { name: KNIFE_FIGHT })),
        ),
      ),
    ),
    revealCard(chosen("found"), defeatingPlayer),
    shuffleEncounterDeck(),
  ),

  // Switchblade — if no minion can host it (schema-level `attachesTo`), this card gains surge.
  "36033.switchblade-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // [star] Attached minion's attacks gain piercing.
  "36033.switchblade-constant-2": constant(attacksGainKeywords(["piercing"], { attacker: { hostOfSelf: true } })),

  // Knife Fight — When Revealed (Alter-Ego): this card gains surge.
  "36034.when-revealed-alter-ego": whenRevealedAlterEgo(surge()),
  // When Revealed (Hero): Choose an enemy with the highest ATK -> take damage equal to its ATK. Deal damage to that
  // enemy equal to your ATK. Ties for highest are the chosen enemy's choice (the revealing player picks).
  "36034.when-revealed-hero": whenRevealedHero(
    bindTargets("highest", superlative("highest", each(query("enemy")), statOf(chosen("candidate"), "atk"))),
    chooseTarget("fighter", query("enemy", { inSlot: "highest" })),
    takeDamage(statOf(chosen("fighter"), "atk")),
    dealDamage(statOf(yourIdentity, "atk"), chosen("fighter")),
  ),
});
