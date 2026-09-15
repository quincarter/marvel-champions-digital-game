import type { KeywordInstance, Trait } from "@mc/content";
import type {
  AbilityCost,
  AbilityDefinition,
  AbilityLabel,
  AbilityLimit,
  AbilityTriggerSpec,
  CardZoneQuery,
  CostModifierSpec,
  EventPattern,
  Form,
  KeywordGrantSpec,
  Predicate,
  ResourceGeneration,
  ResourceRequirement,
  RuleSpec,
  SchemeValueName,
  StatModifierSpec,
  StatName,
  TargetQuery,
  InPlayCostPick,
  TraitGrantSpec,
  TriggerEventKind,
  TypedResource,
} from "@mc/engine";
import { flatten, ifThen, type EffectArg } from "./effects.js";
import { isAlterEgo, isHero, type Amount } from "./values.js";

/**
 * Abilities — the sentence structure of the DSL. `heroInterrupt(when.x, …)`
 * maps the printed timing word to the engine trigger; options carry the cost
 * (the part before "→"), the limit, and the ability's label.
 */

export interface AbilityOptions {
  /** The printed cost, before "→". Several components are merged: `[exhaustThis, spend({ mental: 1 })]`. */
  readonly cost?: AbilityCost | readonly AbilityCost[];
  readonly limit?: AbilityLimit;
  /** "(attack)", "(thwart)", "(defense)". */
  readonly label?: AbilityLabel | readonly AbilityLabel[];
}
type Args = readonly (AbilityOptions | EffectArg)[];

const isEffectArg = (x: unknown): x is EffectArg => Array.isArray(x) || (typeof x === "object" && x !== null && "kind" in x);

function split(args: Args): { readonly options: AbilityOptions; readonly effects: readonly EffectArg[] } {
  const [first, ...rest] = args;
  if (first !== undefined && !isEffectArg(first)) {
    if (rest.some((r) => !isEffectArg(r))) throw new Error("ability options must come first and only once");
    return { options: first, effects: rest as EffectArg[] };
  }
  if (args.some((a) => !isEffectArg(a))) throw new Error("ability options must come first");
  return { options: {}, effects: args as EffectArg[] };
}

/** Merges cost components; a component given twice is an authoring error. */
export function mergeCosts(parts: readonly AbilityCost[]): AbilityCost {
  const merged: Record<string, unknown> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (key in merged) throw new Error(`cost component "${key}" given twice`);
      merged[key] = value;
    }
  }
  return merged as AbilityCost;
}

const isCostList = (cost: AbilityCost | readonly AbilityCost[]): cost is readonly AbilityCost[] => Array.isArray(cost);

function build(trigger: AbilityTriggerSpec, options: AbilityOptions, effects: readonly EffectArg[], generates?: ResourceGeneration): AbilityDefinition {
  const cost = options.cost === undefined ? undefined : isCostList(options.cost) ? mergeCosts(options.cost) : options.cost;
  const label = options.label === undefined ? undefined : typeof options.label === "string" ? [options.label as AbilityLabel] : options.label;
  return {
    trigger,
    ...(cost && Object.keys(cost).length > 0 ? { cost } : {}),
    ...(options.limit ? { limit: options.limit } : {}),
    ...(label && label.length > 0 ? { label } : {}),
    effects: flatten(effects),
    ...(generates !== undefined ? { generates } : {}),
  };
}

// ---------------------------------------------------------------------------
// Player-card abilities
// ---------------------------------------------------------------------------

/** "Action:" */
export const action = (...args: Args): AbilityDefinition => {
  const { options, effects } = split(args);
  return build({ kind: "action" }, options, effects);
};
/** "Hero Action:" */
export const heroAction = (...args: Args): AbilityDefinition => {
  const { options, effects } = split(args);
  return build({ kind: "action", form: "hero" }, options, effects);
};
/** "Alter-Ego Action:" */
export const alterEgoAction = (...args: Args): AbilityDefinition => {
  const { options, effects } = split(args);
  return build({ kind: "action", form: "alterEgo" }, options, effects);
};

/** "Resource: … generate …" (a bare number is that many wild resources). */
export const resource = (generates: ResourceGeneration, options: AbilityOptions & { readonly form?: Form } = {}): AbilityDefinition => {
  const { form, ...rest } = options;
  return build({ kind: "resource", ...(form ? { form } : {}) }, rest, [], generates);
};
/** "Hero Resource:" */
export const heroResource = (generates: ResourceGeneration, options: AbilityOptions = {}): AbilityDefinition => resource(generates, { ...options, form: "hero" });

const triggered =
  (kind: "interrupt" | "response", forced: boolean, form?: Form) =>
  (on: EventPattern, ...args: Args): AbilityDefinition => {
    const { options, effects } = split(args);
    return build({ kind, forced, on, ...(form ? { form } : {}) }, options, effects);
  };

/** "Interrupt:" — optional; "When …". */
export const interrupt = triggered("interrupt", false);
export const heroInterrupt = triggered("interrupt", false, "hero");
export const alterEgoInterrupt = triggered("interrupt", false, "alterEgo");
/** "Forced Interrupt:" */
export const forcedInterrupt = triggered("interrupt", true);
/** "Response:" — optional; "After …". */
export const response = triggered("response", false);
export const heroResponse = triggered("response", false, "hero");
export const alterEgoResponse = triggered("response", false, "alterEgo");
/** "Forced Response:" */
export const forcedResponse = triggered("response", true);

/** "Special:" — resolves only when another ability instructs it (Wakanda Forever!). */
export const special = (...args: Args): AbilityDefinition => {
  const { options, effects } = split(args);
  return build({ kind: "special" }, options, effects);
};

// ---------------------------------------------------------------------------
// Encounter / scenario abilities
// ---------------------------------------------------------------------------

export const whenRevealed = (...effects: readonly EffectArg[]): AbilityDefinition => build({ kind: "whenRevealed" }, {}, effects);
/** "When Revealed (Hero):" — resolves only if the revealing player is in hero form. */
export const whenRevealedHero = (...effects: readonly EffectArg[]): AbilityDefinition => whenRevealed(ifThen(isHero(), effects));
/** "When Revealed (Alter-Ego):" */
export const whenRevealedAlterEgo = (...effects: readonly EffectArg[]): AbilityDefinition => whenRevealed(ifThen(isAlterEgo(), effects));
export const whenDefeated = (...effects: readonly EffectArg[]): AbilityDefinition => build({ kind: "whenDefeated" }, {}, effects);
/** "[star] Boost:" — "you" is the player the activation is against. */
export const boost = (...effects: readonly EffectArg[]): AbilityDefinition => build({ kind: "boost" }, {}, effects);
/** "Setup:" (main scheme 1A, identity). An empty setup is "Advance to stage 1B", which the engine always does. */
export const setup = (...effects: readonly EffectArg[]): AbilityDefinition => build({ kind: "setup" }, {}, effects);

// ---------------------------------------------------------------------------
// Constant abilities
// ---------------------------------------------------------------------------

export interface ConstantPart {
  readonly modifiers?: readonly StatModifierSpec[];
  readonly keywordGrants?: readonly KeywordGrantSpec[];
  readonly traitGrants?: readonly TraitGrantSpec[];
  readonly rules?: readonly RuleSpec[];
  readonly resourceMultiplier?: { readonly factor: number; readonly whilePayingFor: TargetQuery };
  /** Changes to the cost of playing cards (docs/phase7-wave1.md §3.10): "Reduce the cost to play Hercules by 1 for each minion engaged with you". */
  readonly costModifiers?: readonly CostModifierSpec[];
  /** "You can only spend [physical] resources to pay for this card." (Crushing Blow). */
  readonly paymentOnly?: readonly TypedResource[];
  /** "Spend this card only in hero form." (Limitless Strength). */
  readonly spendableIn?: Form;
  /** "You may play Lockjaw from your discard pile during your turn." */
  readonly playableFrom?: readonly "discard"[];
  /** "As an additional cost for Wonder Man to attack, you must discard 1 card from your hand." (Wonder Man, `cap` pack). */
  readonly basicPowerCosts?: readonly { readonly power: "attack" | "thwart"; readonly cost: AbilityCost }[];
}

export function constant(...parts: readonly ConstantPart[]): AbilityDefinition {
  const all = <K extends "modifiers" | "keywordGrants" | "traitGrants" | "rules" | "costModifiers" | "paymentOnly" | "playableFrom" | "basicPowerCosts">(
    key: K,
  ) => parts.flatMap((p) => (p[key] ?? []) as NonNullable<ConstantPart[K]>[number][]);
  const multipliers = parts.flatMap((p) => (p.resourceMultiplier ? [p.resourceMultiplier] : []));
  if (multipliers.length > 1) throw new Error("a constant ability has at most one resource multiplier");
  const spendableInList = parts.flatMap((p) => (p.spendableIn ? [p.spendableIn] : []));
  if (spendableInList.length > 1) throw new Error("a constant ability has at most one spendableIn form");
  const modifiers = all("modifiers");
  const keywordGrants = all("keywordGrants");
  const traitGrants = all("traitGrants");
  const rules = all("rules");
  const costModifiers = all("costModifiers");
  const paymentOnly = all("paymentOnly");
  const playableFrom = all("playableFrom");
  const basicPowerCosts = all("basicPowerCosts");
  return {
    trigger: {
      kind: "constant",
      ...(modifiers.length ? { modifiers } : {}),
      ...(keywordGrants.length ? { keywordGrants } : {}),
      ...(traitGrants.length ? { traitGrants } : {}),
      ...(rules.length ? { rules } : {}),
      ...(multipliers[0] ? { resourceMultiplier: multipliers[0] } : {}),
      ...(costModifiers.length ? { costModifiers } : {}),
      ...(paymentOnly.length ? { paymentOnly } : {}),
      ...(spendableInList[0] ? { spendableIn: spendableInList[0] } : {}),
      ...(playableFrom.length ? { playableFrom } : {}),
      ...(basicPowerCosts.length ? { basicPowerCosts } : {}),
    },
    effects: [],
  };
}
/** "Reduce the cost to play X by N [while …]" / "… costs N additional resources" (a signed `delta`). */
export const costModifier = (spec: CostModifierSpec): ConstantPart => ({ costModifiers: [spec] });
/** "As an additional cost for [this character] to attack/thwart, you must …" (Wonder Man). */
export const basicPowerCost = (power: "attack" | "thwart", cost: AbilityCost): ConstantPart => ({ basicPowerCosts: [{ power, cost }] });

/** "X gets +N [stat]" (a negative N for "-N"); `setBase` for "has a base [stat] of N". */
export const gets = (
  stat: StatName | "hp" | "handSize" | SchemeValueName | "boostIcons" | "consequentialAttack" | "consequentialThwart",
  n: Amount,
  target: TargetQuery,
  opts: { readonly while?: Predicate; readonly setBase?: boolean } = {},
): ConstantPart => ({
  modifiers: [{ stat, amount: n, target, ...(opts.while ? { while: opts.while } : {}), ...(opts.setBase ? { setBase: true } : {}) }],
});
/** "X gains [keyword]". */
export const gainsKeyword = (keyword: KeywordInstance, target: TargetQuery, opts: { readonly while?: Predicate } = {}): ConstantPart => ({
  keywordGrants: [{ keyword, target, ...(opts.while ? { while: opts.while } : {}) }],
});
/** "X gains the [trait] trait". */
export const gainsTrait = (t: Trait, target: TargetQuery, opts: { readonly while?: Predicate } = {}): ConstantPart => ({
  traitGrants: [{ trait: t, target, ...(opts.while ? { while: opts.while } : {}) }],
});
export const rule = (r: RuleSpec): ConstantPart => ({ rules: [r] });
/** "Double the number of resources this card generates while paying for an [aspect] card." */
export const doublesResourcesWhilePayingFor = (whilePayingFor: TargetQuery): ConstantPart => ({ resourceMultiplier: { factor: 2, whilePayingFor } });

/**
 * A printed ability whose behavior is already a general engine rule (e.g. a
 * facedown card leaving play goes to its owner's discard pile). It has no
 * effects of its own; the registry entry exists so coverage stays exact.
 */
export const coveredByEngineRule = (): AbilityDefinition => ({ trigger: { kind: "constant" }, effects: [] });
/**
 * An ability reference that is a continuation of another ref's printed text
 * (an ingestion artifact: e.g. the bullet lines under Hulk's Forced Response).
 * The behavior lives entirely in `of`'s definition.
 */
export const partOf = (of: `${string}.${string}`): AbilityDefinition => {
  void of;
  return { trigger: { kind: "constant" }, effects: [] };
};

// ---------------------------------------------------------------------------
// Costs and limits
// ---------------------------------------------------------------------------

/** "Exhaust [this card] →" */
export const exhaustThis: AbilityCost = { exhaustSelf: true };
/** "Discard [this card] →" */
export const discardThis: AbilityCost = { discardSelf: true };
/** "Spend a [energy] resource" → `spend({ energy: 1 })`; "Spend [E][M][P]" → one of each. */
export const spend = (resources: ResourceRequirement | number): AbilityCost => ({ resources });
/** "Spend X [type] resources →": X is bound to var `bind`. */
export const spendX = (resourceType: TypedResource, bind = "x", min = 1): AbilityCost => ({ resourcesX: { resource: resourceType, bind, min } });
/** "Remove N [type] counter(s) from it →" */
export const removeCounter = (counterType: string, n = 1): AbilityCost => ({ spendCounters: { counterType, amount: n } });
/** "Take N damage →" (your identity). */
export const takeDamageCost = (n: number): AbilityCost => ({ damageSelf: n });
/** "Deal N damage to [this character] →" */
export const damageThisCardCost = (n: number): AbilityCost => ({ damageThisCard: n });
/** "Heal N damage from [your identity] →" */
export const healYourIdentityCost = (n: number): AbilityCost => ({ healIdentity: n });
/** "Exhaust your hero →" */
export const exhaustYourHero: AbilityCost = { exhaustIdentity: true };
/**
 * "Choose and discard N (up to M) cards from your hand →" — the cards are bound to slot `discard`, their count to
 * `bind`. Omit `max` for "Discard X cards from your hand" with no printed cap (Shield Toss, `cap` pack): bounded
 * only by hand size, since a payment can never repeat a card or pick one not in hand.
 */
export const discardFromHandCost = (min: number, max?: number, bind?: string): AbilityCost => ({
  discardFromHand: { min, ...(max !== undefined ? { max } : {}), ...(bind ? { bind } : {}) },
});
/**
 * How many cards an in-play cost takes. `min` defaults to 1. `max` defaults to `min`, a fixed count ("exhaust
 * Captain America's Shield"). Pass `"any"` for no cap ("exhaust any number of allies"). "Any number" and "up to N"
 * still need at least one card (RRG 1.8 "Cost", p. 14), so `min` below 1 fails validation.
 */
export interface InPlayCostOptions {
  readonly min?: number;
  readonly max?: number | "any";
  /** The slot the cards are bound to. Defaults to `"exhausted"` / `"returned"`. */
  readonly slot?: string;
  /** The var that receives how many cards paid: "draw 1 card for each ally exhausted this way". */
  readonly bind?: string;
}

const inPlayPick = (q: TargetQuery, opts: InPlayCostOptions, defaultSlot: string): InPlayCostPick => {
  const min = opts.min ?? 1;
  const max = opts.max === undefined ? min : opts.max;
  return { slot: opts.slot ?? defaultSlot, query: q, min, ...(max !== "any" ? { max } : {}), ...(opts.bind ? { bind: opts.bind } : {}) };
};

/**
 * "Exhaust [cards you control in play] →", other than this card (`exhaustThis`) or your hero (`exhaustYourHero`):
 * `exhaustCardsCost(query("upgrade", { name: SHIELD }))` (Shield Block) or `exhaustCardsCost(query("ally"),
 * { max: "any", bind: "n" })` (Strength in Numbers). The engine limits candidates to cards the payer controls.
 */
export const exhaustCardsCost = (q: TargetQuery, opts: InPlayCostOptions = {}): AbilityCost => ({ exhaustCards: inPlayPick(q, opts, "exhausted") });
/** "… return [cards you control] from play to your hand →" (Shield Toss). Same picking rules as `exhaustCardsCost`. */
export const returnToHandCost = (q: TargetQuery, opts: InPlayCostOptions = {}): AbilityCost => ({ returnToHand: inPlayPick(q, opts, "returned") });
/** "Pay the printed cost of [a card] →" */
/**
 * "Pay the printed cost of an ally in any player's discard pile →" (Make the Call).
 *
 * Pass `{ entersPlay: true }` when the ability's effects then bring the chosen card into
 * play: the engine uses it to refuse a pick that could not enter play (RRG "Unique Icon"),
 * so the cost is never paid for an ability that cannot do anything.
 */
export const payPrintedCostOf = (slot: string, from: CardZoneQuery, options: { entersPlay?: boolean } = {}): AbilityCost => ({
  payPrintedCostOf: { slot, from, ...(options.entersPlay ? { entersPlay: true } : {}) },
});

/** "(Limit once per round.)" */
export const oncePerRound: AbilityLimit = { count: 1, period: "round" };

// ---------------------------------------------------------------------------
// Event patterns: `when.*` for interrupts, `after.*` for responses
// ---------------------------------------------------------------------------

/** Who an event is about, from this card's point of view. */
export type Who = "self" | "host" | TargetQuery;

const asSource = (who: Who): Partial<EventPattern> =>
  who === "self" ? { selfIs: "source" } : who === "host" ? { sourceIs: { hostOfSelf: true } } : { sourceIs: who };
const asTarget = (who: Who): Partial<EventPattern> =>
  who === "self" ? { selfIs: "target" } : who === "host" ? { targetIs: { hostOfSelf: true } } : { targetIs: who };
const pattern = (on: TriggerEventKind | readonly TriggerEventKind[], ...parts: readonly Partial<EventPattern>[]): EventPattern =>
  Object.assign({ on }, ...parts) as EventPattern;
const againstYou: Partial<EventPattern> = { playerIs: "controller", usesAttackedPlayer: true };

const enemyAttacks = (by: Who, opts: { readonly againstYou?: boolean; readonly damages?: boolean } = {}): EventPattern =>
  pattern("enemyAttack", asSource(by), opts.againstYou ? againstYou : {}, opts.damages ? { requireResults: { damage: 1 } } : {});

export const on = {
  /** "When/After [enemy] attacks (you)" — `by: "self"` for the card's own attacks, `"host"` for the attached enemy. */
  enemyAttacks,
  /** "When the villain (initiates an) attack(s) (against you)". */
  villainAttacks: (opts: { readonly againstYou?: boolean; readonly damages?: boolean } = {}): EventPattern => enemyAttacks({ categories: ["villain"] }, opts),
  /** "When/After [enemy] schemes". */
  enemySchemes: (by: Who): EventPattern => pattern("enemyScheme", asSource(by)),
  /** "After [enemy] schemes or attacks". */
  enemySchemesOrAttacks: (by: Who): EventPattern => pattern(["enemyScheme", "enemyAttack"], asSource(by)),
  /** A player-side attack (basic or ability): "after X attacks", "after your hero attacks and defeats an enemy". */
  attacks: (
    by: Who,
    opts: { readonly target?: TargetQuery; readonly basic?: boolean; readonly defeats?: boolean; readonly damages?: boolean } = {},
  ): EventPattern => {
    const results: Record<string, number> = {};
    if (opts.defeats) results.defeated = 1;
    if (opts.damages) results.damage = 1;
    return pattern(
      "attack",
      asSource(by),
      opts.target ? { targetIs: opts.target } : {},
      opts.basic ? { attackKind: "basic" } : {},
      Object.keys(results).length ? { requireResults: results } : {},
    );
  },
  /** "After X thwarts". */
  thwarts: (by: Who): EventPattern => pattern("thwart", asSource(by)),
  /** "After [defender] defends (against an enemy attack)". */
  defends: (defender: TargetQuery): EventPattern => pattern("defended", { targetIs: defender }),
  /** "After X enters play". */
  entersPlay: (what: Who): EventPattern => pattern("cardEntersPlay", asTarget(what)),
  /** "After you play [this card]" — playing, not merely putting into play. */
  youPlayThis: (): EventPattern => pattern("cardPlayed", { selfIs: "target" }),
  /** "When X would take damage" / "after X takes damage" (`taken`: some damage was actually dealt). */
  damage: (to: Who, opts: { readonly fromAttack?: boolean; readonly taken?: boolean } = {}): EventPattern =>
    pattern(
      "dealDamage",
      asTarget(to),
      opts.fromAttack !== undefined ? { fromAttack: opts.fromAttack } : {},
      opts.taken ? { requireResults: { amount: 1 } } : {},
    ),
  /** "When threat would be placed on a scheme" / "after placing threat here". */
  threatPlaced: (where?: Who): EventPattern => pattern("placeThreat", where ? asTarget(where) : {}),
  /** "When a [treachery] card is revealed from the encounter deck". */
  encounterCardRevealed: (what?: TargetQuery): EventPattern => pattern("encounterCardRevealing", what ? { targetIs: what } : {}),
  /** "When/After X is defeated"; `byYou`: "after *you* defeat a minion". */
  defeated: (what: Who, opts: { readonly byYou?: boolean } = {}): EventPattern =>
    pattern("characterDefeated", asTarget(what), opts.byYou ? { playerIs: "controller" } : {}),
  /**
   * "When/After [a scheme] is defeated" (a side scheme reaching 0 threat, or a scenario rule's own defeat) —
   * distinct trigger event from `defeated`, which is characters only. "When attached scheme is defeated"
   * (Followed, `cap` pack): `on.schemeDefeated("host")`.
   */
  schemeDefeated: (what: Who): EventPattern => pattern("schemeDefeated", asTarget(what)),
  /** "After you change to this form". */
  youChangeForm: (): EventPattern => pattern("formChanged", { playerIs: "controller" }),
  /** "After your turn begins" (Quinjet, `cap` pack). */
  yourTurnBegins: (): EventPattern => pattern("turnStarted", { playerIs: "controller" }),
} as const;

/** Interrupt wording: `heroInterrupt(when.villainAttacks({ againstYou: true }), …)`. */
export const when = on;
/** Response wording: `forcedResponse(after.entersPlay("self"), …)`. */
export const after = on;
