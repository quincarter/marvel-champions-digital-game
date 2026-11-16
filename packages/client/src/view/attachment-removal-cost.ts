/**
 * What removing an encounter attachment costs (issue #767): the printed "Hero Action: [Exhaust your hero and] spend
 * [physical][physical] resources → discard this card" ability on the attachment (Solid-Sound Body, Vibranium Armor),
 * read from its scripted ability's `AbilityCost` rather than its text. Null for an attachment players cannot remove that
 * way. The chip shows it as words ("remove: 2 physical, exhaust hero"), so the cost never rests on color alone.
 */

import {
  activeAbilityRefs,
  cardOf,
  getInstance,
  type AbilityCost,
  type EngineDeps,
  type GameState,
  type InstanceId,
} from "@mc/engine";

export interface RemovalCost {
  /** Typed resources in printed order ("physical", "physical"), then "any" for each generic one. */
  readonly resources: readonly ("physical" | "mental" | "energy" | "wild" | "any")[];
  /** "Exhaust your hero" is part of the cost. */
  readonly exhaustHero: boolean;
  /** Whether the ability can only be used in hero form ("Hero Action"). */
  readonly heroOnly: boolean;
}

const TYPED = ["physical", "mental", "energy", "wild"] as const;

function resourcesOf(cost: AbilityCost): RemovalCost["resources"] | null {
  const spend = cost.resources;
  if (spend === undefined) return [];
  if (typeof spend === "number") return Array.from({ length: spend }, () => "any" as const);
  if ("choose" in spend) return null;
  return [
    ...TYPED.flatMap((type) => Array.from({ length: spend[type] ?? 0 }, () => type)),
    ...Array.from({ length: spend.generic ?? 0 }, () => "any" as const),
  ];
}

const discardsItself = (effects: readonly unknown[]): boolean =>
  effects.some((effect) => {
    const spec = effect as { readonly kind?: string; readonly target?: { readonly kind?: string } };
    return spec.kind === "discardFromPlay" && spec.target?.kind === "self";
  });

export function removalCostOf(state: GameState, deps: EngineDeps, id: InstanceId): RemovalCost | null {
  const instance = getInstance(state, id);
  if (!instance || instance.faceup === false || instance.facedownAs || cardOf(state, id)?.type !== "attachment") {
    return null;
  }
  for (const ref of activeAbilityRefs(state, id)) {
    const definition = deps.abilities[ref.id];
    if (!definition || definition.trigger.kind !== "action" || definition.trigger.forced) continue;
    if (!discardsItself(definition.effects)) continue;
    const cost = definition.cost ?? {};
    const resources = resourcesOf(cost);
    if (resources === null) continue;
    return {
      resources,
      exhaustHero: cost.exhaustIdentity === true,
      heroOnly: definition.trigger.form === "hero",
    };
  }
  return null;
}

/** "remove: 2 physical, exhaust hero", "remove: energy, mental, physical", or "remove: free". */
export function removalCostText(cost: RemovalCost): string {
  const counts = new Map<string, number>();
  for (const resource of cost.resources) counts.set(resource, (counts.get(resource) ?? 0) + 1);
  const parts = [...counts].map(([type, count]) => {
    const word = type === "any" ? (count === 1 ? "resource" : "resources") : type;
    return count === 1 && type !== "any" ? word : `${count} ${word}`;
  });
  if (cost.exhaustHero) parts.push("exhaust hero");
  return `remove: ${parts.length > 0 ? parts.join(", ") : "free"}`;
}
