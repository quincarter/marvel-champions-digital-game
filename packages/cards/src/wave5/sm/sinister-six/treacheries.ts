import type { TargetQuery } from "@mc/engine";
import {
  activationOrderOf,
  addVillain,
  bindTargets,
  cannotBeCanceled,
  chooseTarget,
  chosen,
  confuse,
  constant,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardAtRandom,
  each,
  enemyAttack,
  enemyScheme,
  encounterSetAside,
  exists,
  gainsKeyword,
  gainsKeywordX,
  ifThen,
  inMode,
  named,
  not,
  placeThreat,
  printedCostOf,
  query,
  resolveSpecialsOf,
  selectCards,
  stun,
  superlative,
  theMainScheme,
  totalStatOf,
  varAtLeast,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  type EffectArg,
} from "../../../dsl/index.js";

/**
 * The Sinister Six's own five treacheries (`sm` 27108–27112, MC27 pp. 15–16, docs/phase7-wave5.md §3.1/§3.11):
 * Frequent Flyers, High Fashion, Robotic Enhancements (all three the same "put a named pair of set-aside villains
 * into play, with a per-villain bonus if that one was already in play" shape), Partnership of Pain ("the villain
 * with the lowest/highest activation order value" schemes/attacks with the other villains' pooled SCH/ATK) and
 * Surprise! (the main scheme's own "Ambush!" Special, docs/phase7-wave5.md §3.2, resolved from a treachery instead
 * of a villain activation).
 *
 * The six villains themselves (Doctor Octopus, Electro, Hobgoblin, Kraven the Hunter, Scorpion, Vulture,
 * `sm` 27094–27099) and Guerrilla Tactics are other agents' work — nothing here scripts them.
 */

/**
 * "Put the set-aside [name] into play." `addVillain` is a no-op when `name` is not currently set aside (its
 * instance is already in play, so `encounterSetAside` finds nothing to select) — the same "a villain already in
 * play is not put in again" reading docs/phase7-wave5.md §3.1's own plan calls for. `slot` keeps the three cards'
 * (27108/27109/27110) two per-villain selections from colliding with each other in the same ability.
 */
const putSetAsideVillainIntoPlay = (name: string, slot: string): readonly EffectArg[] => [
  selectCards(slot, encounterSetAside(query("villain", { name }))),
  addVillain(chosen(slot)),
];

/** "If [name] is already in play" — read *before* this ability's own (no-op, once already true) `addVillain`. */
const villainAlreadyInPlay = (name: string) => exists(query("villain", { name }));

/**
 * "In expert mode, this card gains incite 1 and cannot be canceled." (Frequent Flyers, High Fashion, Robotic
 * Enhancements). The same `inMode`/`gainsKeywordX`/`cannotBeCanceled` shape `dsl/values.ts`'s own `inMode` docblock
 * spells out for Surprise!'s "gains surge" sibling.
 */
const gainsInciteInExpertMode = () =>
  constant(
    gainsKeywordX("incite", 1, { self: true }, { while: inMode("expert") }),
    cannotBeCanceled({ self: true }, inMode("expert")),
  );

/** "A card [ally/support/upgrade] you control" (High Fashion's "the highest-/lowest-cost card you control"). */
const CARDS_YOU_CONTROL: TargetQuery = { categories: ["ally", "support", "upgrade"], controller: "you" };

/** "A character you control" (Robotic Enhancements' "confuse/stun a character you control"). */
const CHARACTER_YOU_CONTROL: TargetQuery = query("character", { controller: "you" });

export const SINISTER_SIX_TREACHERIES = defineAbilities({
  // Frequent Flyers (27108) — In expert mode, gains incite 1 and cannot be canceled.
  "27108.frequent-flyers-constant": gainsInciteInExpertMode(),
  // Frequent Flyers — When Revealed: Put the set-aside Hobgoblin and Vulture into play. If Hobgoblin is already in
  // play, take 2 indirect damage. If Vulture is already in play, discard 1 card at random from your hand.
  "27108.when-revealed": whenRevealed(
    ifThen(
      villainAlreadyInPlay("Hobgoblin"),
      dealIndirectDamage(you, 2),
      putSetAsideVillainIntoPlay("Hobgoblin", "hobgoblin"),
    ),
    ifThen(villainAlreadyInPlay("Vulture"), discardAtRandom(1), putSetAsideVillainIntoPlay("Vulture", "vulture")),
  ),

  // High Fashion (27109) — In expert mode, gains incite 1 and cannot be canceled.
  "27109.high-fashion-constant": gainsInciteInExpertMode(),
  // High Fashion — When Revealed: Put the set-aside Electro and Kraven the Hunter into play. If Electro is already
  // in play, discard the highest-cost card you control. If Kraven the Hunter is already in play, discard the
  // lowest-cost card you control. `ties: "first"` (Oversized Hands, `twc` 07042's precedent): no fallback text for
  // "nothing to discard", so an empty `CARDS_YOU_CONTROL` simply discards nothing.
  "27109.when-revealed": whenRevealed(
    ifThen(
      villainAlreadyInPlay("Electro"),
      discard(superlative("highest", each(CARDS_YOU_CONTROL), printedCostOf(chosen("candidate")), { ties: "first" })),
      putSetAsideVillainIntoPlay("Electro", "electro"),
    ),
    ifThen(
      villainAlreadyInPlay("Kraven the Hunter"),
      discard(superlative("lowest", each(CARDS_YOU_CONTROL), printedCostOf(chosen("candidate")), { ties: "first" })),
      putSetAsideVillainIntoPlay("Kraven the Hunter", "kraven"),
    ),
  ),

  // Robotic Enhancements (27110) — In expert mode, gains incite 1 and cannot be canceled.
  "27110.robotic-enhancements-constant": gainsInciteInExpertMode(),
  // Robotic Enhancements — When Revealed: Put the set-aside Doctor Octopus and Scorpion into play. If Doctor
  // Octopus is already in play, confuse a character you control. If Scorpion is already in play, stun a character
  // you control. `chooseTarget`/`confuse`/`stun` (Double Trouble, `hood` 24017's precedent).
  "27110.when-revealed": whenRevealed(
    ifThen(
      villainAlreadyInPlay("Doctor Octopus"),
      [chooseTarget("confused", CHARACTER_YOU_CONTROL), confuse(chosen("confused"))],
      putSetAsideVillainIntoPlay("Doctor Octopus", "octopus"),
    ),
    ifThen(
      villainAlreadyInPlay("Scorpion"),
      [chooseTarget("stunned", CHARACTER_YOU_CONTROL), stun(chosen("stunned"))],
      putSetAsideVillainIntoPlay("Scorpion", "scorpion"),
    ),
  ),

  // Partnership of Pain (27111) — When Revealed (Alter-Ego): the villain with the lowest activation order value
  // schemes with +X SCH, X the total SCH of all other villains in play (`totalStatOf`, wave 4 §3.41's own worked
  // example for this exact card). `bindTargets` fixes which villain "the villain with the lowest/highest…" names
  // before `totalStatOf` reads every *other* in-play villain's SCH/ATK relative to it.
  "27111.when-revealed-alter-ego": whenRevealedAlterEgo(
    bindTargets("actor", superlative("lowest", each(query("villain")), activationOrderOf(chosen("candidate")))),
    enemyScheme(chosen("actor"), {
      schBonus: totalStatOf(each(query("villain", { excluding: chosen("actor") })), "sch"),
    }),
  ),
  // Partnership of Pain — When Revealed (Hero): the villain with the highest activation order value attacks you
  // with +X ATK, X the total ATK of all other villains in play.
  "27111.when-revealed-hero": whenRevealedHero(
    bindTargets("actor", superlative("highest", each(query("villain")), activationOrderOf(chosen("candidate")))),
    enemyAttack(chosen("actor"), {
      against: you,
      atkBonus: totalStatOf(each(query("villain", { excluding: chosen("actor") })), "atk"),
    }),
  ),

  // Surprise! (27112) — In expert mode, gains surge and cannot be canceled (`dsl/values.ts`'s `inMode` docblock's
  // own worked example for this exact card).
  "27112.surprise-constant": constant(
    gainsKeyword({ name: "surge" }, { self: true }, { while: inMode("expert") }),
    cannotBeCanceled({ self: true }, inMode("expert")),
  ),
  // Surprise! — When Revealed: Resolve the "Ambush!" ability on the main scheme. If no villain was put into play
  // this way, place 3 threat on Light at the End. The main scheme's own Ambush! Special binds its own `addVillain`
  // as "ambush" (`main-scheme.ts`'s `AMBUSH`); wrapping it in `resolveSpecialsOf(…, { bind: "surprise" })` surfaces
  // that inner bind as `surprise.ambush.count` (Sandslide's `sands.discarded` precedent for the outer-bind-as-
  // namespace reading, `sandman/encounter-set.ts`).
  "27112.when-revealed": whenRevealed(
    resolveSpecialsOf(theMainScheme, undefined, { bind: "surprise" }),
    ifThen(not(varAtLeast("surprise.ambush.count", 1)), placeThreat(3, named("Light at the End"))),
  ),
});
