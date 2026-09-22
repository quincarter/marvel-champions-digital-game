import type { AnyCard, ResourceIconCounts, ResourceIconType } from "@mc/content";

/**
 * Typed resources (RRG "Resources"). Every resource is physical, mental,
 * energy, or wild. A wild resource is declared as one type of the payer's
 * choice when it is spent (FFG ruling, Jan 2026: "when generating a wild
 * resource, you specify which resource type it's being used as") — so the
 * engine keeps wilds as wild in a pool and lets them fill any typed slot.
 */
export type ResourceType = ResourceIconType;
export type TypedResource = Exclude<ResourceType, "wild">;

export const RESOURCE_TYPES: readonly ResourceType[] = ["physical", "mental", "energy", "wild"];
export const TYPED_RESOURCES: readonly TypedResource[] = ["physical", "mental", "energy"];

/** A multiset of resources, e.g. what a payment generated. Plain JSON. */
export interface ResourcePool {
  readonly physical: number;
  readonly mental: number;
  readonly energy: number;
  readonly wild: number;
}

export const EMPTY_POOL: ResourcePool = { physical: 0, mental: 0, energy: 0, wild: 0 };

/** The resources a card's printed icons give when it is discarded to pay (RRG "Resources"). */
export function printedResources(card: AnyCard): ResourcePool {
  if (card.type === "resource") return poolOf(card.producesIcons);
  return "resourceIcons" in card ? poolOf(card.resourceIcons) : EMPTY_POOL;
}

export const poolOf = (icons: ResourceIconCounts | Partial<ResourcePool>): ResourcePool => ({
  physical: icons.physical ?? 0,
  mental: icons.mental ?? 0,
  energy: icons.energy ?? 0,
  wild: icons.wild ?? 0,
});

export const addPools = (a: ResourcePool, b: ResourcePool): ResourcePool => ({
  physical: a.physical + b.physical,
  mental: a.mental + b.mental,
  energy: a.energy + b.energy,
  wild: a.wild + b.wild,
});

export const scalePool = (pool: ResourcePool, factor: number): ResourcePool => ({
  physical: pool.physical * factor,
  mental: pool.mental * factor,
  energy: pool.energy * factor,
  wild: pool.wild * factor,
});

export const poolTotal = (pool: ResourcePool): number => pool.physical + pool.mental + pool.energy + pool.wild;

/**
 * A resource cost. `generic` is any type (a card's printed cost); the typed
 * fields are "Spend a [energy] resource" / "Spend [E][M][P]". A bare number in
 * `AbilityCost.resources` means `{ generic: n }`.
 *
 * `wild` is the odd one out: "spend a [wild] resource" (Crossfire's Rifle 04029, and later packs' Moon Knight)
 * demands an actual wild resource. RRG 1.8 "Wild Resource" (p. 48): "Some card abilities specifically require wild
 * resources to be spent in order to resolve their effects", and a generated wild "may specify which resource type
 * (energy, mental, physical, or wild) it is being used as" — a wild can be declared wild, but a physical resource
 * can never be declared as wild. So a `wild` slot is filled only from `pool.wild`, unlike every other typed slot,
 * which a wild may backfill.
 */
export interface ResourceRequirement {
  readonly generic?: number;
  readonly physical?: number;
  readonly mental?: number;
  readonly energy?: number;
  readonly wild?: number;
}

/**
 * A requirement with every slot resolved. `wild` is present **only** when a card actually asks for a wild resource,
 * so the object an ordinary cost produces — and the one the `spendResources` prompt and `paymentFor` hand a client —
 * keeps exactly the four keys it always had.
 */
export type ResolvedRequirement = Required<Omit<ResourceRequirement, "wild">> & { readonly wild?: number };

const withWild = (base: Required<Omit<ResourceRequirement, "wild">>, wild: number): ResolvedRequirement =>
  wild > 0 ? { ...base, wild } : base;

export const requirementOf = (value: number | ResourceRequirement | undefined): ResolvedRequirement => {
  if (value === undefined) return { generic: 0, physical: 0, mental: 0, energy: 0 };
  if (typeof value === "number") return { generic: value, physical: 0, mental: 0, energy: 0 };
  return withWild(
    {
      generic: value.generic ?? 0,
      physical: value.physical ?? 0,
      mental: value.mental ?? 0,
      energy: value.energy ?? 0,
    },
    value.wild ?? 0,
  );
};

export const combineRequirements = (
  a: number | ResourceRequirement | undefined,
  b: number | ResourceRequirement | undefined,
): ResolvedRequirement => {
  const x = requirementOf(a);
  const y = requirementOf(b);
  return withWild(
    {
      generic: x.generic + y.generic,
      physical: x.physical + y.physical,
      mental: x.mental + y.mental,
      energy: x.energy + y.energy,
    },
    (x.wild ?? 0) + (y.wild ?? 0),
  );
};

export const requirementTotal = (req: ResolvedRequirement): number =>
  req.generic + req.physical + req.mental + req.energy + (req.wild ?? 0);

/**
 * A requirement in words, for a player-facing refusal: "1 resource", "2 resources", "1 physical", "1 physical and 2
 * of any type", "1 wild and 1 mental". The engine's own messages reach the table unchanged (Inspect's "Right now",
 * the action bar), so they must read as sentences — a refusal used to print the requirement as JSON.
 */
export function describeRequirement(req: ResolvedRequirement): string {
  const typed = (
    [
      ["wild", req.wild ?? 0],
      ["physical", req.physical],
      ["mental", req.mental],
      ["energy", req.energy],
    ] as const
  )
    .filter(([, amount]) => amount > 0)
    .map(([kind, amount]) => `${amount} ${kind}`);
  if (typed.length === 0) return `${req.generic} resource${req.generic === 1 ? "" : "s"}`;
  const any = req.generic > 0 ? [`${req.generic} of any type`] : [];
  const parts = [...typed, ...any];
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * RRG "Cost": a `wild` slot takes an actual wild resource, typed slots are
 * filled by that type first, the wilds left over cover any typed shortfall, and
 * whatever remains pays the generic part. Overpaying is legal.
 */
export function satisfies(pool: ResourcePool, requirement: number | ResourceRequirement | undefined): boolean {
  const req = requirementOf(requirement);
  // Wild slots are paid first and only from wilds; nothing else can be declared a wild resource (RRG 1.8 p. 48).
  const wildSlots = req.wild ?? 0;
  if (pool.wild < wildSlots) return false;
  const wildsLeft = pool.wild - wildSlots;
  let shortfall = 0;
  for (const type of TYPED_RESOURCES) shortfall += Math.max(0, req[type] - pool[type]);
  if (shortfall > wildsLeft) return false;
  return poolTotal(pool) >= requirementTotal(req);
}

/**
 * "If you paid for this card using a [X] resource": true when the payment
 * contained an X, or a wild the payer can declare as X.
 */
export const paidWith = (pool: ResourcePool, type: TypedResource): boolean => pool[type] > 0 || pool.wild > 0;

/** "Spend X [energy] resources": X is every resource in the payment that can be that type. */
export const countUsableAs = (pool: ResourcePool, type: TypedResource): number => pool[type] + pool.wild;

/** Distinct printed resource types on a card (The Vulture's Plans counts these). Wild counts as its own type. */
export const distinctTypes = (pool: ResourcePool): readonly ResourceType[] =>
  RESOURCE_TYPES.filter((type) => pool[type] > 0);
