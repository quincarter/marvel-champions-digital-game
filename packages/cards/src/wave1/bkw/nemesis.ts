import { chooseTarget, chosen, constant, countOf, defineAbilities, discard, engagedPlayerOf, gets, perHero, placeThreat, query, self, takeDamage, theMainScheme, whenRevealed, whenRevealedAlterEgo, whenRevealedHero, you } from "../../dsl/index.js";

const YOUR_UPGRADES = query("upgrade", { controller: "you" });
/** "Discard an upgrade you control" (Deadly Shot). A `chooseTarget` with zero candidates simply resolves to
 * nothing chosen (RRG "cannot" default for an effect, not a cost) — the same reading Core's Iron Man nemesis set
 * uses for its own "discard an upgrade you control" (`packages/cards/src/core/heroes/iron-man.ts`'s `discardAnUpgrade`). */
const discardAnUpgradeYouControl = [chooseTarget("upgrade", YOUR_UPGRADES), discard(chosen("upgrade"))];

/**
 * Black Widow's nemesis set: Taskmaster (08026, nemesis minion), Killer for Hire (08027, side scheme), Hydra
 * Mercenary (08028, minion — a Core reprint aliased by `../reprints.ts`, printing no ability of its own, not
 * scripted here), Deadly Shot (08029, treachery).
 *
 * **Taskmaster's Boost ability (08026.boost) is intentionally SKIPPED** — see `BKW_NEMESIS_SKIPPED` below.
 */
export const BKW_NEMESIS = defineAbilities({
  // Taskmaster — [star] Taskmaster gets +1 SCH and +1 ATK for each upgrade you control. "You" on an encounter card
  // is whoever it's engaged with (RRG "You, Your"; `engagedPlayerOf(self)` reads that player live — the same
  // pattern `msm`'s Thomas Edison nemesis minion uses for its own "while you are engaged" text).
  "08026.taskmaster-constant": constant(
    gets("sch", countOf(query("upgrade", { controlledBy: engagedPlayerOf(self) })), { self: true }),
    gets("atk", countOf(query("upgrade", { controlledBy: engagedPlayerOf(self) })), { self: true }),
  ),

  // Killer for Hire — When Revealed: Place an additional 1[per_hero] threat here.
  "08027.when-revealed": whenRevealed(placeThreat(perHero(1), self)),

  // Deadly Shot — When Revealed (Alter-Ego): Discard an upgrade you control and place 1 threat on the main scheme.
  "08029.when-revealed-alter-ego": whenRevealedAlterEgo(discardAnUpgradeYouControl, placeThreat(1, theMainScheme)),
  // Deadly Shot — When Revealed (Hero): Discard an upgrade you control and take 1 damage.
  "08029.when-revealed-hero": whenRevealedHero(discardAnUpgradeYouControl, takeDamage(1, you)),
});

/**
 * SKIPPED — missing primitive (docs/phase7-wave1-scripting.md §4). Taskmaster (08026), current text unchanged
 * from printed: "[star] Boost: For this activation, the villain gets +1 SCH and +1 ATK for each upgrade you
 * control."
 *
 * The only landed "Boost:" stat-bonus primitive is `EffectSpec.modifyAttack { atkBonus, threatBonus }`
 * (`packages/engine/src/spec.ts`), applied in `packages/engine/src/resolve/apply-effect.ts`'s `modifyAttack` case
 * to `currentActivationFrameId` — i.e. it always bonuses *whichever enemy is currently being activated*. Taskmaster's
 * boost text names a *fixed* target ("the villain") instead: when Taskmaster's own card is drawn as a boost card
 * for a *different* enemy's activation (any minion's, since a card can't be its own boost while it's the one
 * attacking/scheming), `modifyAttack` would incorrectly bonus that minion's activation rather than the villain.
 * No ruling for this exact interaction was found in marvel-champions-rulings-post-rrg-1-7.md.
 *
 * Closest existing primitive: `EffectSpec.modifyAttack`. Proposed shape: an optional `target?: TargetRef` on
 * `modifyAttack` (or a sibling effect) naming a fixed enemy to bonus for the current activation's boost step,
 * defaulting to the current activation's own enemy when absent (every existing scripted "Boost:" ability keeps its
 * current behavior unchanged). Flagged for `game-rules-architect`/`ability-scripting-engineer` coordination.
 */
export const BKW_NEMESIS_SKIPPED = ["08026.boost"] as const;
