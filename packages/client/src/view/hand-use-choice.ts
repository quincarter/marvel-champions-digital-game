/**
 * "Which one?" for a hand card with an Action that works from the hand (`activeIn: "hand"`): Slingshot (50013),
 * "Spend a [energy] resource → put Slingshot into play from your hand", is also an ally to play for 3 (issue #634).
 * A tap on the card used to play it, so the action was only ever reachable through Inspect, and a Slingshot the
 * player could not afford to play read as dimmed and did nothing at all. This words each way to use the card: playing
 * it when the engine lists the play, then each usable ability in the engine's order.
 */
import type { AbilityId } from "@mc/content";
import { cardOf, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";
import { abilityShortLabelOf } from "./ability-label.js";
import type { UsableAbilityAction } from "./highlights.js";

export type HandUseOption =
  | { readonly kind: "play"; readonly label: string }
  | { readonly kind: "ability"; readonly abilityId: AbilityId; readonly label: string };

/** "Play it · costs 3", then "Action · spend 1 energy" for each usable ability; the play only when it is listed. */
export function handUseOptions(
  state: GameState,
  instanceId: InstanceId,
  playable: boolean,
  abilities: readonly UsableAbilityAction[],
  deps: EngineDeps,
): readonly HandUseOption[] {
  const card = cardOf(state, instanceId);
  const cost = card && "cost" in card && typeof card.cost === "number" ? ` · costs ${card.cost}` : "";
  const play: readonly HandUseOption[] = playable ? [{ kind: "play", label: `Play it${cost}` }] : [];
  return [
    ...play,
    ...abilities.map((entry): HandUseOption => {
      const { abilityId } = entry.action;
      const short = abilityShortLabelOf(state, instanceId, abilityId, deps);
      return { kind: "ability", abilityId, label: short ? `Action · ${short}` : "Action" };
    }),
  ];
}
