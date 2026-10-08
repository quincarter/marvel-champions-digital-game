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

/**
 * The resources a card's printed icons give when it is discarded to pay (RRG "Resources").
 *
 * `flipped`: read the icons of the card's other face (`CardFlipSide.resourceIcons`) for a double-sided card showing
 * it, since each face prints its own (RRG 1.8 "Flip", p. 20). A face whose data names no icons of its own reads the
 * front's, the data's "the card does not differ". A caller holding an instance uses `query.ts` `showingResources`.
 */
export function printedResources(card: AnyCard, flipped = false): ResourcePool {
  if (card.type === "resource") return poolOf(card.producesIcons);
  if (flipped && "flipSide" in card && card.flipSide?.resourceIcons) return poolOf(card.flipSide.resourceIcons);
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
 * "Spend 3 resources of the same type" (Kree Combat Armor, `gmw` 16131; docs/phase7-wave3.md §3.43): can `pool` pay
 * `requirement` with `count` of its generic resources all of one type? Each type is tried: that many of the type are set
 * aside (its own resources first, then wilds declared as it), and the rest of the pool must still pay the rest of the
 * requirement.
 *
 * - A wild counts as any type: RRG 1.8 "Wild Resource" (p. 48), "When a player generates a wild resource, they may
 *   specify which resource type (energy, mental, physical, or wild) it is being used as". Three wilds pay, declared as
 *   one type (or as "wild", which comes to the same thing).
 * - A card with icons of two types generates both; the one that is not the chosen type pays the rest of the cost or is
 *   overpaid. RRG 1.8 "Cost" (p. 13): "While paying a cost, a player is permitted to generate resources beyond the
 *   specified cost", and those "are considered to have been overpaid for that cost and were not paid for that cost".
 *
 * Using the type's own resources before wilds is optimal: a wild left over can pay anything a typed one can.
 */
export function payableWithOneType(pool: ResourcePool, count: number, requirement: ResolvedRequirement): boolean {
  if (count <= 0) return satisfies(pool, requirement);
  const rest: ResolvedRequirement = { ...requirement, generic: Math.max(0, requirement.generic - count) };
  return TYPED_RESOURCES.some((type) => {
    const own = Math.min(pool[type], count);
    const wilds = count - own;
    if (wilds > pool.wild) return false;
    return satisfies({ ...pool, [type]: pool[type] - own, wild: pool.wild - wilds }, rest);
  });
}

/**
 * "Spend 2 resources of different types" / "spend 2 different resources": the most resource types `pool` can be
 * counted as. Each typed resource present is one type; each wild is one more type not otherwise present. RRG 1.8 "Wild
 * Resource" (p. 48): a generated wild is used as "energy, mental, physical, or wild", so two wilds are two types (one
 * declared a type, one left wild) and four types is the most there are.
 */
export function distinctTypeCount(pool: ResourcePool): number {
  const typed = TYPED_RESOURCES.filter((type) => pool[type] > 0).length;
  return typed + Math.min(pool.wild, RESOURCE_TYPES.length - typed);
}

/**
 * Whether one of the resources `source` generated can be among the resources **paid** for `requirement` out of `pool`
 * (`source` is part of `pool`). RRG 1.8 "Cost" (p. 13): "Resources generated beyond the specified cost are considered
 * to have been overpaid for that cost and were not paid for that cost", so the paid resources are a part of the pool
 * exactly as large as the requirement that meets it, and the rules do not say which part when more was generated. A
 * source counts when some such part holds one of its resources (docs/phase7-wave8.md §3.51, §4.1 Q28 = A):
 *
 * - never at a requirement of 0 (FAQ "Unstoppable Force (#6)", p. 60: at a cost of 0 nothing was paid);
 * - a source that generated nothing paid nothing;
 * - one of the source's resources is put in a slot it can fill (its own type's, a generic one, or for a wild any slot),
 *   and the rest of the pool must still pay the rest of the requirement. A source of only [energy] toward a cost of
 *   1 [physical] that another card pays is overpaid whichever way the payment is read.
 */
export function canBePaidFor(pool: ResourcePool, source: ResourcePool, requirement: ResolvedRequirement): boolean {
  if (requirementTotal(requirement) <= 0) return false;
  return RESOURCE_TYPES.some((type) => {
    if (source[type] <= 0 || pool[type] <= 0) return false;
    const rest: ResourcePool = { ...pool, [type]: pool[type] - 1 };
    const slots: (keyof ResolvedRequirement)[] =
      type === "wild" ? ["wild", ...TYPED_RESOURCES, "generic"] : [type, "generic"];
    return slots.some((slot) => {
      const needed = requirement[slot] ?? 0;
      return needed > 0 && satisfies(rest, { ...requirement, [slot]: needed - 1 });
    });
  });
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

/**
 * What a card reads of the resource types that paid for it (docs/phase7-wave8.md §3.62; `AbilityDefinition
 * readsPaidTypes`, `RuleSpec readsPaymentTypesOf`): how many different types (`count`: "for each different resource
 * type used to pay"), whether at least that many ("using 2 different resource types"), or which of the named types
 * ("using at least 1 [physical] … [mental] … [energy]"). It says nothing about what the card then does: it is what the
 * engine compares to decide whether the player's declaration of a wild can matter (`readOfPaidTypes`).
 */
export type PaidTypesRead =
  | { readonly count: true }
  | { readonly atLeast: number }
  | { readonly types: readonly TypedResource[] };

/**
 * A payment's pool with each wild counted as the type its player declared (RRG 1.8 "Wild Resource", p. 48: "When a
 * player generates a wild resource, they may specify which resource type (energy, mental, physical, or wild) it is
 * being used as"). `wildAs` has one entry per wild generated; `"wild"` leaves it a wild. Wilds are interchangeable, so
 * only how many were declared each type matters.
 */
export function declaredPool(pool: ResourcePool, wildAs: readonly ResourceType[]): ResourcePool {
  const declared = { ...pool, wild: 0 };
  for (const type of wildAs) declared[type] += 1;
  return declared;
}

/**
 * Why `wildAs` is not a legal declaration of the wilds in `pool` toward `requirement`, or null (docs/phase7-wave8.md
 * §3.62, §4.1 Q33 = B):
 *
 * - one entry per wild generated, each one of the four types;
 * - the payment must still pay the cost with every wild used as declared: a typed slot ("spend a [mental] resource", a
 *   Requirement icon) takes a resource of that type or a wild declared as it, and a `wild` slot a wild left wild. A wild
 *   declared [energy] is being used as [energy] and cannot also be the [physical] the cost asked for;
 * - `only` ("you can only spend [physical] resources to pay for this card"): a wild is declared one of those types or
 *   left wild.
 */
export function wildDeclarationFault(
  pool: ResourcePool,
  wildAs: readonly ResourceType[],
  requirement: ResolvedRequirement,
  only: readonly TypedResource[] = [],
): string | null {
  if (wildAs.length !== pool.wild) {
    return `declare a type for each wild resource: ${pool.wild} generated, ${wildAs.length} declared`;
  }
  const unknown = wildAs.find((type) => !RESOURCE_TYPES.includes(type));
  if (unknown !== undefined) return `${String(unknown)} is not a resource type`;
  const barred = wildAs.find((type) => type !== "wild" && only.length > 0 && !only.includes(type));
  if (barred !== undefined) return `only ${only.join(" / ")} resources can pay for this card`;
  const declared = declaredPool(pool, wildAs);
  const short = RESOURCE_TYPES.find((type) => declared[type] < (requirement[type] ?? 0));
  if (short !== undefined)
    return `the cost needs ${requirement[short] ?? 0} ${short}, and the wilds were declared otherwise`;
  return null;
}

/**
 * Every way to declare `wilds` interchangeable wild resources, as how many are declared each type, the declaration
 * that leaves every wild a wild first. There are (wilds + 3 choose 3) of them, not four to the power of the wilds,
 * because two wilds declared [energy] and [mental] read the same in either order.
 */
export function wildDeclarations(wilds: number): readonly (readonly ResourceType[])[] {
  const order: readonly ResourceType[] = ["wild", ...TYPED_RESOURCES];
  const fill = (from: number, left: number): ResourceType[][] => {
    const type = order[from]!;
    if (from === order.length - 1) return [Array<ResourceType>(left).fill(type)];
    const found: ResourceType[][] = [];
    for (let n = left; n >= 0; n--) {
      for (const rest of fill(from + 1, left - n)) found.push([...Array<ResourceType>(n).fill(type), ...rest]);
    }
    return found;
  };
  return fill(0, Math.max(0, wilds));
}

/**
 * The resources **paid** for `requirement` out of a declared pool (`declaredPool`), by type. RRG 1.8 "Cost" (p. 13):
 * "Resources generated beyond the specified cost are considered to have been overpaid for that cost and were not paid
 * for that cost", so the paid resources are exactly as many as the requirement, and the rules do not say which when
 * more was generated. docs/phase7-wave8.md §4.1 Q34 = A with its follow-up: they are the set that gives the most
 * declared types, with no further prompt.
 *
 * - The cost's typed and wild slots take their own type. Each generic slot then takes a type not yet among the paid
 *   resources while there is one, and after that anything left.
 * - **Where several sets give as many types** (three paid out of [physical], [mental], [energy] and a wild left wild)
 *   the owner's answer does not say which is taken. The generic slots are filled in the fixed order physical, mental,
 *   energy, wild, so the answer is the same on every machine and in every replay. Only a reader of named types
 *   (`Predicate paidType`) can tell the sets apart; a count cannot.
 *
 * This is independent of `canBePaidFor` (§3.51, Q28 = A), which asks whether any reading of the payment has one card's
 * resource paid; the two can name different paid sets, and no card reads both.
 *
 * Null when the declared pool does not pay the requirement (`wildDeclarationFault`).
 */
export function paidAsDeclared(declared: ResourcePool, requirement: ResolvedRequirement): ResourcePool | null {
  const paid = { ...EMPTY_POOL };
  const left = { ...declared };
  for (const type of RESOURCE_TYPES) {
    const needed = requirement[type] ?? 0;
    if (left[type] < needed) return null;
    paid[type] = needed;
    left[type] -= needed;
  }
  let generic = requirement.generic;
  if (poolTotal(left) < generic) return null;
  for (const type of RESOURCE_TYPES) {
    if (generic > 0 && paid[type] === 0 && left[type] > 0) {
      paid[type] += 1;
      left[type] -= 1;
      generic -= 1;
    }
  }
  for (const type of RESOURCE_TYPES) {
    const taken = Math.min(generic, left[type]);
    paid[type] += taken;
    generic -= taken;
  }
  return paid;
}

/** The number of different resource types among paid resources (`paidAsDeclared`), a wild left wild being its own. */
export const paidTypeCountOf = (paid: ResourcePool): number => RESOURCE_TYPES.filter((type) => paid[type] > 0).length;

/**
 * What one reader (`PaidTypesRead`) reads of the paid resources, as a comparable string: two declarations are
 * equivalent for that reader exactly when these are equal.
 */
export function readOfPaidTypes(paid: ResourcePool, read: PaidTypesRead): string {
  if ("count" in read) return String(paidTypeCountOf(paid));
  if ("atLeast" in read) return String(paidTypeCountOf(paid) >= read.atLeast);
  return read.types.map((type) => (paid[type] > 0 ? "1" : "0")).join("");
}

/** The option id of "wild number `index` (from 0) is used as `type`" in a `declareWildTypes` choice. */
export const wildTypeOptionId = (index: number, type: ResourceType): string => `${index}:${type}`;

/**
 * The declaration a `declareWildTypes` answer makes: the type chosen for each of `wilds` wilds, in their order. Null
 * unless the selection names every wild exactly once with one of the four types.
 */
export function wildTypesFromOptionIds(optionIds: readonly string[], wilds: number): readonly ResourceType[] | null {
  const declared: (ResourceType | undefined)[] = Array<ResourceType | undefined>(wilds).fill(undefined);
  for (const optionId of optionIds) {
    const [index, type] = optionId.split(":");
    const n = Number(index);
    const known = RESOURCE_TYPES.find((candidate) => candidate === type);
    if (!Number.isInteger(n) || n < 0 || n >= wilds || known === undefined || declared[n] !== undefined) return null;
    declared[n] = known;
  }
  return declared.every((type): type is ResourceType => type !== undefined) ? declared : null;
}
