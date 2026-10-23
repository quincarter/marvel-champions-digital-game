/**
 * What an interrupt on offer would prevent of the damage about to be dealt (#394): Backflip's "prevent all of that
 * damage" against Rhino's 3 is stamped "PREVENTS 3 DAMAGE" on the window. Read off the ability's own `preventDamage` effect and the window's `dealDamage` event, never
 * guessed: an amount that is not a constant (or a prevention behind a choice) shows nothing.
 */
import type { AbilityId } from "@mc/content";
import { activeAbilityRefs } from "@mc/engine";
import type { EngineDeps, GameState, InstanceId } from "@mc/engine";

export interface PreventionPreview {
  /** The damage about to be dealt. */
  readonly incoming: number;
  /** How much of it the interrupt prevents. */
  readonly prevented: number;
}

/** `prevent` of the ability on offer, or of the card's own preventing ability when the option is the card. */
function preventAmountOf(
  state: GameState,
  deps: EngineDeps,
  instanceId: InstanceId,
  abilityId: AbilityId | null,
): number | "all" | null {
  const ids = abilityId ? [abilityId] : activeAbilityRefs(state, instanceId, deps).map((ref) => ref.id);
  for (const id of ids) {
    const effect = deps.abilities[id]?.effects.find((e) => e.kind === "preventDamage");
    if (effect?.kind !== "preventDamage") continue;
    if (effect.amount === undefined) return "all";
    if (effect.amount.kind === "const") return effect.amount.value;
    return null;
  }
  return null;
}

export function preventionPreviewOf(
  state: GameState,
  deps: EngineDeps,
  option: { readonly instanceId: InstanceId; readonly abilityId: AbilityId | null },
): PreventionPreview | null {
  const prompt = state.pendingChoice?.prompt;
  if (prompt?.kind !== "chooseTriggers" || prompt.event.kind !== "dealDamage") return null;
  // Unpreventable damage (§H3.3) takes no prevention, though an interrupt with another effect is still offered on it.
  if (prompt.event.unpreventable === true) return null;
  const incoming = prompt.event.amount;
  if (incoming <= 0) return null;
  const amount = preventAmountOf(state, deps, option.instanceId, option.abilityId);
  if (amount === null) return null;
  const prevented = amount === "all" ? incoming : Math.min(incoming, Math.max(0, amount));
  if (prevented <= 0) return null;
  return { incoming, prevented };
}

/** The stamp's big line: "2 damage", or "1 of 3 damage" when the interrupt prevents only part of it. */
export function preventedAmountLine(preview: PreventionPreview): string {
  return preview.prevented >= preview.incoming
    ? `${preview.prevented} damage`
    : `${preview.prevented} of ${preview.incoming} damage`;
}
