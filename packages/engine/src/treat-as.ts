/**
 * Keeps `CardInstance.treatedAs` in step with the attachments on a card (docs/phase7-wave4.md §3.9): an ally with a
 * `treatHostAsMinion` attachment on it is a minion until that attachment goes. Called by `relocateCard` whenever a card
 * moves onto or off a host, which is every attach, detach and discard of an attachment, so the flag never lags a frame
 * behind the attachment ("Attach to the ally with the highest cost … Attached ally engages its controller" engages a
 * minion in the same ability). Ruling, Dec 17, 2025 (1) #3: nothing enters or leaves play; it is "essentially a status
 * change", so tokens and attachments stay.
 */

import { type Ctx, emit, moveCard, updateInstance } from "./ctx.js";
import type { InstanceId } from "./ids.js";
import { cardOf, getInstance, locateCard } from "./query.js";
import { activeAbilityRefs } from "./select.js";
import type { TreatedAs } from "./state.js";

export function syncTreatedAs(ctx: Ctx, hostId: InstanceId): void {
  const host = getInstance(ctx.state, hostId);
  if (!host) return;
  const current = host.treatedAs ?? null;
  let next: TreatedAs | null = null;
  if (cardOf(ctx.state, hostId)?.type === "ally") {
    for (const attachment of host.attachments) {
      for (const ref of activeAbilityRefs(ctx.state, attachment, ctx.deps)) {
        const definition = ctx.deps.abilities[ref.id];
        if (definition?.trigger.kind !== "constant") continue;
        const rule = (definition.trigger.rules ?? []).find((r) => r.kind === "treatHostAsMinion");
        if (rule?.kind !== "treatHostAsMinion" || next) continue;
        next = {
          kind: "minion",
          traits: rule.traits,
          keepPrintedTraits: rule.keepPrintedTraits === true,
          schFromThw: rule.schFromThw === true,
          source: attachment,
          controllerBefore: current?.controllerBefore ?? host.controllerId,
        };
      }
    }
  }
  if (current === null && next === null) return;
  if (current !== null && next !== null && current.source === next.source) return;
  if (next) {
    updateInstance(ctx, hostId, (i) => ({ ...i, treatedAs: next }));
  } else {
    // The attachment went: an ally again, controlled by whoever controlled it before, in their play area.
    const controller = current?.controllerBefore ?? host.ownerId;
    const where = locateCard(ctx.state, hostId);
    if (controller && where?.kind === "playArea" && where.playerId !== controller) {
      moveCard(ctx, hostId, { kind: "playArea", playerId: controller });
    }
    updateInstance(ctx, hostId, (i) => ({ ...i, treatedAs: null, controllerId: controller, engagedWith: null }));
  }
  emit(ctx, { type: "treatedAsChanged", instanceId: hostId, as: next?.kind ?? null });
}
