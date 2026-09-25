import { trait } from "@mc/content";
import {
  attachCard,
  bindTargets,
  chooseOne,
  chooseOneBy,
  chooseTarget,
  chosen,
  constant,
  countOf,
  defineAbilities,
  discard,
  discardDeckUntil,
  each,
  eachPlayer,
  engage,
  exists,
  forEachPlayer,
  ifThen,
  option,
  placeThreat,
  printedCostOf,
  putIntoPlay,
  query,
  scaled,
  self,
  superlative,
  surge,
  takeDamage,
  thatPlayer,
  theMainScheme,
  treatAttachedAllyAsMinion,
  whenRevealed,
  you,
} from "../../dsl/index.js";

const UNDEAD = trait("Undead");

/**
 * Legions of Hel (`mts` 21152–21155), one of Hela's own two recommended modular sets (MC21 p. 20). Draugr (a
 * minion), Fallen Warrior (an attachment, §3.9's own "ally treated as a minion" primitive), No Place for the Living
 * (a treachery) and its own signature side scheme, Legions of Hel.
 *
 * **Fallen Warrior (21153) is scripted exactly on Beguiled's own model** (`wave4/valk/valkyrie-obligation-nemesis.ts`
 * 25031, docs/phase7-wave4.md §3.9, landed): `treatAttachedAllyAsMinion([UNDEAD])` already gives the printed "SCH
 * equal to printed THW" (`schFromThw`) and "does not take consequential damage" (§3.29's own note: a treated-as-
 * minion ally can no longer be chosen as a basic attacker/thwarter, the only way consequential damage is assessed).
 * Unlike Beguiled, Fallen Warrior's own When Revealed does not attach to an *existing* ally — it finds one by
 * milling the revealing player's own deck (`discardDeckUntil`, the player-deck sibling of `discardEncounterUntil`)
 * until an ally turns up, puts *that* one into play, then attaches itself. No "if none found" clause is printed
 * (unlike Beguiled's own superlative-host case), so an empty `chosen("ally")` (the player's deck and discard both
 * ran out) makes every effect after it a no-op — the same reading `nebu/nebula-kit.ts`'s own `discardDeckUntil` use
 * already takes for an unguarded chain.
 */
export const LEGIONS_OF_HEL = defineAbilities({
  // Draugr (21152) — Guard (data). When Revealed: Choose to either take 1 damage or place 1 threat on the main
  // scheme.
  "21152.when-revealed": whenRevealed(
    chooseOne(
      option("Take 1 damage", takeDamage(1)),
      option("Place 1 threat on the main scheme", placeThreat(1, theMainScheme)),
    ),
  ),

  // Fallen Warrior (21153) — module docblock.
  "21153.fallen-warrior-constant": constant(treatAttachedAllyAsMinion([UNDEAD])),
  "21153.when-revealed": whenRevealed(
    discardDeckUntil(query("ally"), "ally", you),
    putIntoPlay(chosen("ally"), you),
    attachCard(self, chosen("ally")),
    engage(chosen("ally"), you),
  ),

  // No Place for the Living (21154) — When Revealed: Each player must choose to either discard the upgrade or
  // support they control with the highest cost, or take damage equal to the total number of upgrades and supports
  // they control. `controlledBy: thatPlayer` (not `controller: "you"`, which `forEachPlayer` never rebinds per
  // iteration — `packages/engine/src/select.ts` reads `context.controllerId`, not `scopedPlayerId`, for the fixed
  // `"you"` enum) and the tie-break-by-choice shape are both `wave1/twc/piledriver.ts`'s own "Pile Drive" (07034),
  // scripting the identical "discards the upgrade or support they control with the highest cost" sentence.
  "21154.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      chooseOneBy(
        thatPlayer,
        option(
          "Discard the upgrade or support you control with the highest cost",
          { when: exists(query(["upgrade", "support"], { controlledBy: thatPlayer })) },
          bindTargets(
            "highestCost",
            superlative(
              "highest",
              each(query(["upgrade", "support"], { controlledBy: thatPlayer })),
              printedCostOf(chosen("candidate")),
            ),
          ),
          chooseTarget("discarded", { inSlot: "highestCost" }, { chooser: thatPlayer }),
          discard(chosen("discarded")),
        ),
        option(
          "Take damage equal to the total number of upgrades and supports you control",
          takeDamage(countOf(query(["upgrade", "support"], { controlledBy: thatPlayer })), thatPlayer),
        ),
      ),
    ),
  ),

  // Legions of Hel (21155, signature side scheme) — Crisis (data). When Revealed: Place 2 additional threat here
  // for each undead minion in play. If there are no undead minions in play, this card gains surge.
  "21155.when-revealed": whenRevealed(
    ifThen(
      exists(query("minion", { trait: UNDEAD })),
      placeThreat(scaled(countOf(query("minion", { trait: UNDEAD })), { times: 2 }), self),
      surge(),
    ),
  ),
});
