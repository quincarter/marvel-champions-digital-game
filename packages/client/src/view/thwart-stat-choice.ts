/**
 * "Thwart with?" — THW or ATK, for a basic thwart against a scheme that lets the player choose (issue #365).
 *
 * The Red House (`trors` 04139): "When a character thwarts this side scheme, they may use their ATK instead of their
 * THW." The engine has always taken the choice as `basicThwart.useAtk` (`RuleSpec thwartWithAtk`), but the board sent
 * the engine's example command, which never sets it, so a player could only ever thwart it with THW. This offers both
 * once that scheme is the target. Assault needs no question (RRG 1.8 "Assault", p. 8: the thwart always uses ATK), nor
 * does a character with a printed '—' ATK. A '—' THW cannot initiate the thwart at all (ruling June 17, 2025), so
 * the engine never lists it.
 */
import type { EngineDeps, GameState, InstanceId, LegalAction } from "@mc/engine";
import { cardOf, characterProfile, hasKeyword, mayThwartWithAtk, statBonus } from "@mc/engine";

export interface ThwartStatOption {
  /** True for the ATK option: the command carries `useAtk: true`. */
  readonly useAtk: boolean;
  /** "THW 1" / "ATK 3". */
  readonly label: string;
  /** An ally's consequential damage for this option, 0 for a hero (RRG 1.8 "Ally", p. 7: the column of the stat used). */
  readonly consequential: number;
}

/**
 * The two ways `entry`'s character may thwart `schemeId`, THW first, or an empty list when there is nothing to ask:
 * not a basic thwart, the scheme gives no choice, the scheme has assault, or the character has no ATK to use.
 */
export function thwartStatOptions(
  state: GameState,
  deps: EngineDeps,
  entry: LegalAction,
  schemeId: InstanceId,
): readonly ThwartStatOption[] {
  const ref = entry.action;
  if (ref.kind !== "basicThwart" || entry.example.type !== "basicThwart") return [];
  if (entry.example.divide) return [];
  if (!mayThwartWithAtk(state, deps, schemeId) || hasKeyword(state, schemeId, "assault", deps)) return [];
  const profile = characterProfile(state, ref.instanceId, deps);
  if (!profile || profile.missing.includes("atk") || profile.missing.includes("thw")) return [];
  const card = cardOf(state, ref.instanceId);
  const consequential = (atk: boolean): number =>
    card?.type === "ally"
      ? Math.max(
          0,
          (atk ? card.consequentialDamage.attack : card.consequentialDamage.thwart) +
            statBonus(state, deps, ref.instanceId, atk ? "consequentialAttack" : "consequentialThwart"),
        )
      : 0;
  return [
    { useAtk: false, label: `THW ${profile.thw}`, consequential: consequential(false) },
    { useAtk: true, label: `ATK ${profile.atk}`, consequential: consequential(true) },
  ];
}
