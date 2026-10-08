/**
 * Words for the durations of lasting effects and for the rule kinds wave 8 added, for the Inspect view and any panel
 * that lists what is in force on a card. A few words each; the full rule belongs in the card's own text. The client
 * restates no rule here: these name what the engine's data says, and `null` means "no wording yet" so a caller can
 * skip a row rather than print a camelCase id.
 */

import type { LastingDuration, LastingEffect, RuleSpec } from "@mc/engine";

/** "until the villain phase begins": when a lasting effect ends. Exhaustive over the engine's union. */
export function lastingDurationWords(duration: LastingDuration): string {
  switch (duration.kind) {
    case "endOfPhase":
      return "until the end of the phase";
    case "endOfRound":
      return "until the end of the round";
    // Pestilence (`aoa` 45083): gone before anything answers the villain phase beginning (wave 8 §3.13).
    case "nextVillainPhaseBegins":
      return "until the villain phase begins";
    case "endOfTurn":
      return "until the end of the turn";
    case "endOfEvent":
      return "until that finishes";
    case "awaitingAttack":
      return "until that attack resolves";
    case "endOfCardResolution":
      return "while that card resolves";
    case "endOfPaidFor":
      return "while the card or ability it paid for resolves";
    case "untilCardPlayed":
      return "until a matching card is played";
    case "endOfPlayerTurn":
      return "until their next turn ends";
    case "nextBasicPower": {
      const powers = duration.powers.includes("attack") && duration.powers.includes("thwart");
      return powers ? "for the next basic attack or thwart" : `for the next basic ${duration.powers[0] ?? "power"}`;
    }
  }
}

/** The rule kinds with a wording here, by kind, in a few words: what the rule does, not its conditions. */
const RULE_KIND_WORDS: Readonly<Record<string, string>> = {
  cannotBeDefeated: "can't be defeated",
  // Wave 8.
  consideredRemainingHp: "is considered to have hit points",
  consideredResourceIcon: "is considered to have an extra resource icon",
  ignoreAbilities: "ignores some abilities",
  cannotEnterPlay: "can't enter play",
  playDestination: "can be played to another area",
  formChangeCost: "changing form costs extra",
};

/** A rule kind in a few words, or null for a kind with no wording yet. */
export const ruleKindWords = (kind: string): string | null => RULE_KIND_WORDS[kind] ?? null;

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/**
 * One rule, with the numbers and names its data carries: "Considered to have at least 1 hit point". Null for a rule
 * kind with no wording (`ruleKindWords`).
 */
export function ruleWords(rule: RuleSpec): string | null {
  switch (rule.kind) {
    case "cannotBeDefeated":
      return "Can't be defeated";
    case "consideredRemainingHp":
      return `Considered to have at least ${plural(rule.atLeast, "hit point", "hit points")}`;
    case "consideredResourceIcon":
      return `Considered to have an extra ${rule.resource} resource icon`;
    case "ignoreAbilities":
      return `Ignores ${plural(rule.abilities.length, "ability", "abilities")}`;
    case "cannotEnterPlay":
      return "Can't enter play";
    case "playDestination":
      return `Can be played to the ${rule.area} area`;
    case "formChangeCost":
      return rule.to === undefined
        ? "Changing form costs extra"
        : `Changing to ${rule.to === "hero" ? "hero" : "alter-ego"} form costs extra`;
    default:
      return null;
  }
}

/** "+2 damage, +1 threat removed" for the bonus a card-effect lasting effect gives, or null when it gives none. */
function bonusWords(damage: number, threatRemoved: number): string | null {
  const parts = [
    damage > 0 ? `+${damage} damage` : null,
    threatRemoved > 0 ? `+${threatRemoved} threat removed` : null,
  ];
  const words = parts.filter((part) => part !== null).join(", ");
  return words === "" ? null : words;
}

/**
 * A lasting effect and its duration: "Considered to have at least 1 hit point, until the end of the round", "Matching
 * events get +1 damage, until the end of the phase". Null for a lasting effect with no wording here.
 */
export function lastingEffectWords(effect: LastingEffect): string | null {
  let what: string | null = null;
  if (effect.kind === "ruleGrant") what = ruleWords(effect.rule);
  else if (effect.kind === "cardEffectBonusFor") {
    const bonus = bonusWords(effect.damage, effect.threatRemoved);
    what = bonus ? `Matching cards get ${bonus}` : null;
  } else if (effect.kind === "cardEffectBonus") {
    const bonus = bonusWords(effect.damage, effect.threatRemoved);
    what = bonus ? `That card gets ${bonus}` : null;
  }
  return what === null ? null : `${what}, ${lastingDurationWords(effect.duration)}`;
}
