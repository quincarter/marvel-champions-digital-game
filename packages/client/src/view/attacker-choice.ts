/**
 * "Who attacks?" — every character that could make a basic attack (or thwart) right now, and what doing so costs.
 *
 * `legalActions` already lists one `basicAttack` per character (the hero and each ally), but the action bar's
 * Attack button used to take whichever came first — the hero — so an ally only ever attacked once the hero
 * couldn't, and a stunned hero's Attack spent the stun without the player ever seeing the allies were an option.
 * This reads every legal entry of one kind and says, per character, what the player needs to pick an order:
 * its stat, whether a status cancels the power (RRG "Stun"/"Confuse": the character still exhausts and the status
 * is discarded), and an ally's consequential damage.
 */

import type { EngineDeps, GameState, InstanceId, LegalAction, LegalActions } from "@mc/engine";
import { cardOf, characterProfile, hasKeyword, statBonus, statusActive } from "@mc/engine";
import { cardName } from "./names.js";

export type PowerKind = "attack" | "thwart";

export interface PowerSource {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** "ATK 2" / "THW 1". */
  readonly stat: string;
  /** Set when a status cancels this power: the character exhausts and the status is discarded, nothing else. */
  readonly cancelledBy: "stunned" | "confused" | null;
  /** Set when this thwart reads ATK instead of THW and why ("ATK · assault"); null otherwise. */
  readonly why: string | null;
  /** An ally's consequential damage for this power, 0 for the hero. */
  readonly consequential: number;
  /** One line under the name: what happens if this character goes. */
  readonly note: string;
  /** `note` for a phone-width bar, where a button is a third of 375px. */
  readonly shortNote: string;
  readonly entry: LegalAction;
}

const KIND: Record<PowerKind, "basicAttack" | "basicThwart"> = { attack: "basicAttack", thwart: "basicThwart" };

/**
 * RRG 1.8 "Assault" (p. 8): a character thwarting a scheme with the assault keyword uses its ATK, and an ally takes
 * the consequential damage under its ATK. The keyword is read through the engine's `hasKeyword` (a granted assault
 * counts). True only when there is at least one scheme and every one of them has assault.
 */
export function thwartUsesAtk(state: GameState, deps: EngineDeps, schemeIds: readonly InstanceId[]): boolean {
  return schemeIds.length > 0 && schemeIds.every((id) => hasKeyword(state, id, "assault", deps));
}

/** Every legal basic attack (or thwart) entry, in `legalActions`' order: the hero, then each ally. */
export function powerEntries(actions: LegalActions | null | undefined, power: PowerKind): readonly LegalAction[] {
  if (actions?.kind !== "turn") return [];
  return actions.legal.filter((entry) => entry.action.kind === KIND[power]);
}

export function powerSources(
  state: GameState,
  entries: readonly LegalAction[],
  power: PowerKind,
  deps: EngineDeps,
  /** The scheme being thwarted, when the player has chosen one; otherwise every target the entry lists. */
  targetId?: InstanceId,
): readonly PowerSource[] {
  return entries.flatMap((entry): PowerSource[] => {
    const ref = entry.action;
    if (ref.kind !== "basicAttack" && ref.kind !== "basicThwart") return [];
    const id = ref.instanceId;
    const profile = characterProfile(state, id, deps);
    const assault = power === "thwart" && thwartUsesAtk(state, deps, targetId ? [targetId] : entry.targets);
    const value = power === "attack" || assault ? profile?.atk : profile?.thw;
    const status = power === "attack" ? "stunned" : "confused";
    const cancelledBy = statusActive(state, id, status, deps) ? status : null;
    const card = cardOf(state, id);
    const consequential =
      card?.type === "ally"
        ? Math.max(
            0,
            (power === "attack" || assault ? card.consequentialDamage.attack : card.consequentialDamage.thwart) +
              statBonus(state, deps, id, power === "attack" ? "consequentialAttack" : "consequentialThwart"),
          )
        : 0;
    const note = cancelledBy
      ? `${cancelledBy === "stunned" ? "Stunned" : "Confused"}: exhausts, removes the ${cancelledBy === "stunned" ? "stun" : "confusion"}, no ${power}`
      : consequential > 0
        ? `Takes ${consequential} consequential damage`
        : "No consequential damage";
    const shortNote = cancelledBy
      ? `${cancelledBy === "stunned" ? "Stunned" : "Confused"}: no ${power}`
      : consequential > 0
        ? `Takes ${consequential} damage`
        : "No damage";
    return [
      {
        instanceId: id,
        name: cardName(state, id),
        stat: `${power === "attack" || assault ? "ATK" : "THW"} ${value ?? "—"}`,
        why: assault ? "ATK · assault" : null,
        cancelledBy,
        consequential,
        note,
        shortNote,
        entry,
      },
    ];
  });
}
