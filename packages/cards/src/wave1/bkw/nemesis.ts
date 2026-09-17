import { boost, chooseTarget, chosen, constant, countOf, defineAbilities, discard, engagedPlayerOf, gets, modifyStat, perHero, placeThreat, query, self, takeDamage, theMainScheme, theVillain, whenRevealed, whenRevealedAlterEgo, whenRevealedHero, you } from "../../dsl/index.js";

const YOUR_UPGRADES = query("upgrade", { controller: "you" });
/** "Discard an upgrade you control" (Deadly Shot). A `chooseTarget` with zero candidates simply resolves to
 * nothing chosen (RRG "cannot" default for an effect, not a cost) — the same reading Core's Iron Man nemesis set
 * uses for its own "discard an upgrade you control" (`packages/cards/src/core/heroes/iron-man.ts`'s `discardAnUpgrade`). */
const discardAnUpgradeYouControl = [chooseTarget("upgrade", YOUR_UPGRADES), discard(chosen("upgrade"))];

/**
 * Black Widow's nemesis set: Taskmaster (08026, nemesis minion), Killer for Hire (08027, side scheme), Hydra
 * Mercenary (08028, minion — a Core reprint aliased by `../reprints.ts`, printing no ability of its own, not
 * scripted here), Deadly Shot (08029, treachery).
 */
export const BKW_NEMESIS = defineAbilities({
  // Taskmaster — [star] Taskmaster gets +1 SCH and +1 ATK for each upgrade you control. "You" on an encounter card
  // is whoever it's engaged with (RRG "You, Your"; `engagedPlayerOf(self)` reads that player live — the same
  // pattern `msm`'s Thomas Edison nemesis minion uses for its own "while you are engaged" text).
  "08026.taskmaster-constant": constant(
    gets("sch", countOf(query("upgrade", { controlledBy: engagedPlayerOf(self) })), { self: true }),
    gets("atk", countOf(query("upgrade", { controlledBy: engagedPlayerOf(self) })), { self: true }),
  ),

  // Taskmaster — [star] Boost: For this activation, the villain gets +1 SCH and +1 ATK for each upgrade you
  // control. Was skipped: `modifyAttack` only bonuses the current activation's own attacker, wrong here since
  // Taskmaster's own card can be drawn as the boost card for a *different* enemy's activation and its text names a
  // fixed target ("the villain") regardless. Not a new primitive after all (docs/phase7-wave1-scripting.md §6):
  // `modifyStat(stat, n, theVillain, "endOfAttack")` is a lasting modifier on the ref-named card, scoped to the
  // current activation frame (attack or scheme alike), so it reads correctly whichever enemy is actually
  // activating. "You" during a Boost ability resolves to the attacked/scheming player (`frames.ts`
  // `gameAbilityFrames`'s `actingPlayerId`), matching the printed "for each upgrade you control".
  "08026.boost": boost(
    modifyStat("sch", countOf(query("upgrade", { controller: "you" })), theVillain, "endOfAttack"),
    modifyStat("atk", countOf(query("upgrade", { controller: "you" })), theVillain, "endOfAttack"),
  ),

  // Killer for Hire — When Revealed: Place an additional 1[per_hero] threat here.
  "08027.when-revealed": whenRevealed(placeThreat(perHero(1), self)),

  // Deadly Shot — When Revealed (Alter-Ego): Discard an upgrade you control and place 1 threat on the main scheme.
  "08029.when-revealed-alter-ego": whenRevealedAlterEgo(discardAnUpgradeYouControl, placeThreat(1, theMainScheme)),
  // Deadly Shot — When Revealed (Hero): Discard an upgrade you control and take 1 damage.
  "08029.when-revealed-hero": whenRevealedHero(discardAnUpgradeYouControl, takeDamage(1, you)),
});

/** No recorded gaps: Taskmaster's Boost (08026.boost) was the pack's last skip, scripted above once the wave B
 * primitives batch confirmed no new engine primitive was actually needed (docs/phase7-wave1-scripting.md §6). */
export const BKW_NEMESIS_SKIPPED = [] as const;
