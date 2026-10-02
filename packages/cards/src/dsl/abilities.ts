import type { KeywordInstance, KeywordName, SchemeIcon, Trait } from "@mc/content";
import type {
  AbilityCost,
  DiscardCombined,
  AbilityDefinition,
  AbilityLabel,
  AbilityLimit,
  AbilityTimingWord,
  AbilityTriggerSpec,
  CardZoneQuery,
  CostModifierSpec,
  EventPattern,
  Form,
  KeywordGrantSpec,
  Predicate,
  ResourceGeneration,
  ResourceMultiplierSpec,
  ResourceRequirement,
  ResourceType,
  RuleSpec,
  SchemeValueName,
  StatModifierSpec,
  StatName,
  StatusName,
  TargetCategory,
  TargetQuery,
  TargetRef,
  ValueSpec,
  InPlayCostPick,
  PlayerRef,
  TraitGrantSpec,
  TriggerEventKind,
  TypedResource,
} from "@mc/engine";
import { flatten, ifThen, type EffectArg } from "./effects.js";
import { amount, isAlterEgo, isHero, type Amount, type AttackKeyword } from "./values.js";

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
  /**
   * Actions: a condition printed before the cost ("If you are in Tiny hero form, exhaust … →"). Resource abilities: the
   * condition under which the card has the ability at all ("While Brawn is exhausted, he gains: 'Resource: …'").
   */
  readonly while?: Predicate;
  /**
   * "First Player Action:" / "First Player Interrupt:" (docs/phase7-wave3.md §3.13, the Milano/Kree Command Ship):
   * only the first player may use it, and an optional first-player interrupt/response on an encounter card is
   * offered to the first player rather than to the player the event names.
   */
  readonly firstPlayerOnly?: boolean;
  /**
   * "Any player whose alter-ego has the [MUTANT] trait may trigger this ability" (X-Mansion), "Only the player who
   * controls Robert Kelly can trigger this ability" (Protect the Senator): on an action, or an optional interrupt or
   * response, the players who may trigger it, in place of its controller (docs/phase7-wave6.md §3.11). Each is offered
   * it and is "you" while it resolves: `{ triggerableBy: playersWhere(hasTrait(identityOf(thatPlayer), MUTANT)) }`,
   * `{ triggerableBy: controllerOf(named("Robert Kelly")) }`. Not on a forced ability, which nobody chooses to trigger.
   */
  readonly triggerableBy?: PlayerRef;
  /**
   * Star-Lord's "What could go wrong?" (`stld` 17001a; docs/phase7-wave3.md §3.20): on an `interrupt` trigger, makes
   * it a cost modifier the player opts into while playing a matching card (`playCard.costReductionAbilities`)
   * rather than an ability offered in that window — see `AbilityDefinition.playCostReduction`'s own docblock.
   */
  readonly playCostReduction?: { readonly amount: number; readonly cards?: TargetQuery; readonly fromHand?: boolean };
}
type Args = readonly (AbilityOptions | EffectArg)[];

const isEffectArg = (x: unknown): x is EffectArg =>
  Array.isArray(x) || (typeof x === "object" && x !== null && "kind" in x);

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

function build(
  trigger: AbilityTriggerSpec,
  options: AbilityOptions,
  effects: readonly EffectArg[],
  generates?: ResourceGeneration,
): AbilityDefinition {
  const cost =
    options.cost === undefined ? undefined : isCostList(options.cost) ? mergeCosts(options.cost) : options.cost;
  const label =
    options.label === undefined
      ? undefined
      : typeof options.label === "string"
        ? [options.label as AbilityLabel]
        : options.label;
  return {
    trigger,
    ...(cost && Object.keys(cost).length > 0 ? { cost } : {}),
    ...(options.limit ? { limit: options.limit } : {}),
    ...(label && label.length > 0 ? { label } : {}),
    effects: flatten(effects),
    ...(generates !== undefined ? { generates } : {}),
    ...(options.playCostReduction ? { playCostReduction: options.playCostReduction } : {}),
  };
}

// ---------------------------------------------------------------------------
// Player-card abilities
// ---------------------------------------------------------------------------

/** "Action:" */
export const action = (...args: Args): AbilityDefinition => {
  const { options, effects } = split(args);
  return build(
    {
      kind: "action",
      ...(options.while ? { while: options.while } : {}),
      ...(options.firstPlayerOnly ? { firstPlayerOnly: true } : {}),
      ...(options.triggerableBy ? { triggerableBy: options.triggerableBy } : {}),
    },
    options,
    effects,
  );
};
/** "Hero Action:" */
export const heroAction = (...args: Args): AbilityDefinition => {
  const { options, effects } = split(args);
  return build(
    {
      kind: "action",
      form: "hero",
      ...(options.while ? { while: options.while } : {}),
      ...(options.triggerableBy ? { triggerableBy: options.triggerableBy } : {}),
    },
    options,
    effects,
  );
};
/** "Alter-Ego Action:" */
export const alterEgoAction = (...args: Args): AbilityDefinition => {
  const { options, effects } = split(args);
  return build(
    {
      kind: "action",
      form: "alterEgo",
      ...(options.while ? { while: options.while } : {}),
      ...(options.triggerableBy ? { triggerableBy: options.triggerableBy } : {}),
    },
    options,
    effects,
  );
};
/** "First Player Action:" (docs/phase7-wave3.md §3.13, the Milano). */
export const firstPlayerAction = (...args: Args): AbilityDefinition => {
  const [first, ...rest] = args;
  const options: AbilityOptions = !first || isEffectArg(first) ? {} : first;
  const effects = !first || isEffectArg(first) ? args : rest;
  return action({ ...options, firstPlayerOnly: true }, ...(effects as readonly EffectArg[]));
};

/**
 * "Resource: … generate …" (a bare number is that many wild resources). `generatesFor`: "generate a [wild]
 * resource for an X card" (Expert Marksman, Finesse, `trors` pack) — usable only while paying for a card matching
 * the query (FAQ "Finesse (#33)", RRG 1.8 p. 60: "its resource cost or a cost within that aspect card's ability").
 * `forAnyPlayer`: "Piloting — Resource: Exhaust the Milano → generate a [wild] resource for any player" (the
 * Milano, docs/phase7-wave3.md §3.13) — any player paying a cost may use it, not only its controller.
 */
/**
 * "Resource:" — generates `generates`. Any `effects` resolve when the ability is used in a payment, with the payment:
 * "… generate a [wild] resource for a War Machine event and place 1 ammo counter on War Machine" (Gauntlet Gun, `warm`
 * 23005); "Generate [wild][wild] resources for an [Attack] or [Defense] event. Gain a tough status card. Remove this
 * card from the game and the campaign pool." (War Cry, `mut_gen` 32180); "… You may flip this card." (Psi-Knife,
 * `psylocke` 41002a). The card paid for is slot `paidFor` ("That event deals 1 additional damage", Cybernetic Arm).
 * docs/phase7-wave4.md §3.30.
 */
export const resource = (
  generates: ResourceGeneration,
  options: AbilityOptions & {
    readonly form?: Form;
    readonly generatesFor?: TargetQuery;
    readonly forAnyPlayer?: boolean;
    /** Usable more than once in one payment, each use paying its fixed counter cost (docs/phase7-wave5.md §3.25). */
    readonly repeatable?: boolean;
    /** Spent, not generated: "after … generates resources" does not see it (docs/phase7-wave5.md §4.1 Q5). */
    readonly spentAsIfResource?: boolean;
  } = {},
  ...effects: readonly EffectArg[]
): AbilityDefinition => {
  const { form, generatesFor, forAnyPlayer, repeatable, spentAsIfResource, ...rest } = options;
  const definition = build(
    {
      kind: "resource",
      ...(form ? { form } : {}),
      ...(rest.while ? { while: rest.while } : {}),
      ...(forAnyPlayer ? { forAnyPlayer: true } : {}),
      ...(repeatable ? { repeatable: true } : {}),
      ...(spentAsIfResource ? { spentAsIfResource: true } : {}),
    },
    rest,
    effects,
    generates,
  );
  return generatesFor ? { ...definition, generatesFor } : definition;
};
/**
 * "Each toon counter on Spider-Ham can be spent as if it were a [wild] resource." (`spiderham` 30001a;
 * docs/phase7-wave5.md §3.25): a `repeatable` resource ability whose cost removes one counter from this card, used
 * once per counter spent, as many times in one payment as there are counters. `generates` defaults to 1 wild. Spending
 * one is not generating a resource (§4.1 Q5, `spentAsIfResource`; RRG 1.8 p. 13 names only hand cards and "Resource"
 * abilities), so "after the engaged player generates" (M.O.R.B.I.U.S.) does not see it.
 */
export const countersAsResource = (counterType: string, generates: ResourceGeneration = 1): AbilityDefinition =>
  resource(generates, { cost: removeCounter(counterType, 1), repeatable: true, spentAsIfResource: true });
/** "Hero Resource:" */
export const heroResource = (
  generates: ResourceGeneration,
  options: AbilityOptions & { readonly generatesFor?: TargetQuery } = {},
  ...effects: readonly EffectArg[]
): AbilityDefinition => resource(generates, { ...options, form: "hero" }, ...effects);

const triggered =
  (kind: "interrupt" | "response", forced: boolean, form?: Form) =>
  (on: EventPattern, ...args: Args): AbilityDefinition => {
    const { options, effects } = split(args);
    if (forced && options.triggerableBy) throw new Error("a forced ability has no triggerableBy: nobody triggers it");
    return build(
      {
        kind,
        forced,
        on,
        ...(form ? { form } : {}),
        ...(options.firstPlayerOnly ? { firstPlayerOnly: true } : {}),
        ...(options.triggerableBy ? { triggerableBy: options.triggerableBy } : {}),
      },
      options,
      effects,
    );
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

export const whenRevealed = (...effects: readonly EffectArg[]): AbilityDefinition =>
  build({ kind: "whenRevealed" }, {}, effects);
/** "When Revealed (Hero):" — resolves only if the revealing player is in hero form. */
export const whenRevealedHero = (...effects: readonly EffectArg[]): AbilityDefinition =>
  whenRevealed(ifThen(isHero(), effects));
/** "When Revealed (Alter-Ego):" */
export const whenRevealedAlterEgo = (...effects: readonly EffectArg[]): AbilityDefinition =>
  whenRevealed(ifThen(isAlterEgo(), effects));
export const whenDefeated = (...effects: readonly EffectArg[]): AbilityDefinition =>
  build({ kind: "whenDefeated" }, {}, effects);
/** "[star] Boost:" — "you" is the player the activation is against. */
export const boost = (...effects: readonly EffectArg[]): AbilityDefinition => build({ kind: "boost" }, {}, effects);
/**
 * "Attach to [host]. If you cannot, [effects], then attach this card to [other host]." — the "If you cannot" half,
 * resolved instead of the discard when a revealed attachment has no legal `attachesTo` host (the first half is data).
 * The effects must attach the card themselves (`attachCard(self, …)`); a card they leave unattached is discarded.
 */
export const cannotAttach = (...effects: readonly EffectArg[]): AbilityDefinition =>
  build({ kind: "cannotAttach" }, {}, effects);
/** "Setup:" (main scheme 1A, identity). An empty setup is "Advance to stage 1B", which the engine always does. */
export const setup = (...effects: readonly EffectArg[]): AbilityDefinition => build({ kind: "setup" }, {}, effects);
/**
 * "If <condition>, …" — a forced ability with no triggering event, checked between every two frames (Kang's stage
 * 3 "If all the players at this stage are defeated, this stage is complete"; The Master of Time 2B's own "When all
 * the players have joined this game area, advance to stage 4A" — docs/phase7-wave2.md §3.1). Edge-triggered: fires
 * when the condition goes false → true, not continuously while true (RRG 1.8 "Uses", p. 46's own discard check).
 */
export const stateCheck = (when: Predicate, ...effects: readonly EffectArg[]): AbilityDefinition =>
  build({ kind: "stateCheck", when }, {}, effects);
/**
 * RRG 1.8 "When Completed Abilities" (p. 48): "equivalent to … 'Forced Interrupt: When this scheme is
 * completed…'" — resolves on a main scheme stage reaching its target threat, before it advances (never on the
 * final stage, whose completion loses the game).
 */
export const whenCompleted = (...effects: readonly EffectArg[]): AbilityDefinition =>
  build({ kind: "whenCompleted" }, {}, effects);

// ---------------------------------------------------------------------------
// Constant abilities
// ---------------------------------------------------------------------------

export interface ConstantPart {
  readonly modifiers?: readonly StatModifierSpec[];
  readonly keywordGrants?: readonly KeywordGrantSpec[];
  readonly traitGrants?: readonly TraitGrantSpec[];
  readonly rules?: readonly RuleSpec[];
  readonly resourceMultiplier?: ResourceMultiplierSpec;
  /** Changes to the cost of playing cards (docs/phase7-wave1.md §3.10): "Reduce the cost to play Hercules by 1 for each minion engaged with you". */
  readonly costModifiers?: readonly CostModifierSpec[];
  /** "You can only spend [physical] resources to pay for this card." (Crushing Blow). */
  readonly paymentOnly?: readonly TypedResource[];
  /** "Spend this card only in hero form." (Limitless Strength). */
  readonly spendableIn?: Form;
  /** "This card can be spent for any player" (Everyday Hero, `nova` 28019; docs/phase7-wave5.md §3.17). */
  readonly spendableForAnyPlayer?: { readonly while?: Predicate };
  /** "[This card] does not count toward your hand size." (Connection to the Worldmind; docs/phase7-wave5.md §3.18). */
  readonly notCountedTowardHandSize?: true;
  /** "You may play Lockjaw from your discard pile during your turn." */
  readonly playableFrom?: readonly "discard"[];
  /** "As an additional cost for Wonder Man to attack, you must discard 1 card from your hand." (Wonder Man, `cap` pack). */
  readonly basicPowerCosts?: readonly { readonly power: "attack" | "thwart"; readonly cost: AbilityCost }[];
  /**
   * "You may play [Arrow] events attached to this card as if they were in your hand." (Hawkeye's Quiver, `trors`
   * pack; docs/phase7-wave2.md §3.10): cards attached to this card that match may be played by its controller as if
   * from hand.
   */
  readonly playableAttachments?: TargetQuery;
  /**
   * "Play only if you control an Element Gun." (Sliding Shot, `stld` 17005; docs/phase7-wave3.md §3.42): a play
   * restriction read from the card itself while it is being played. Several are ANDed.
   */
  readonly playOnlyIf?: Predicate;
  /**
   * "This card generates [wild] for each ally you control (to a maximum of 3)" (Band Together, `mts` 21018): what the
   * card generates when spent from hand. docs/phase7-wave4.md §3.38.
   */
  readonly handGenerates?: ResourceGeneration;
}

/** `handGenerates` "[resource] for each [card] … (to a maximum of N)" (Band Together). */
export const generatesPerCard = (
  resource: "energy" | "mental" | "physical" | "wild",
  per: TargetQuery,
  max?: number,
): ResourceGeneration => ({ kind: "perCard", resource, per, ...(max !== undefined ? { max } : {}) });
/** "Generate the printed resource on [a card in play]" (Energy Duplication, `mts` 21006). */
export const printedResourcesOf = (cards: TargetQuery): ResourceGeneration => ({ kind: "printedResourcesOf", cards });

export function constant(...parts: readonly ConstantPart[]): AbilityDefinition {
  const all = <
    K extends
      | "modifiers"
      | "keywordGrants"
      | "traitGrants"
      | "rules"
      | "costModifiers"
      | "paymentOnly"
      | "playableFrom"
      | "basicPowerCosts",
  >(
    key: K,
  ) => parts.flatMap((p) => (p[key] ?? []) as NonNullable<ConstantPart[K]>[number][]);
  const multipliers = parts.flatMap((p) => (p.resourceMultiplier ? [p.resourceMultiplier] : []));
  if (multipliers.length > 1) throw new Error("a constant ability has at most one resource multiplier");
  const spendableInList = parts.flatMap((p) => (p.spendableIn ? [p.spendableIn] : []));
  if (spendableInList.length > 1) throw new Error("a constant ability has at most one spendableIn form");
  const anyPlayerList = parts.flatMap((p) => (p.spendableForAnyPlayer ? [p.spendableForAnyPlayer] : []));
  if (anyPlayerList.length > 1) throw new Error("a constant ability has at most one spendableForAnyPlayer");
  const handGeneratesList = parts.flatMap((p) => (p.handGenerates !== undefined ? [p.handGenerates] : []));
  if (handGeneratesList.length > 1) throw new Error("a constant ability has at most one handGenerates");
  const playableAttachmentsList = parts.flatMap((p) => (p.playableAttachments ? [p.playableAttachments] : []));
  if (playableAttachmentsList.length > 1)
    throw new Error("a constant ability has at most one playableAttachments query");
  const modifiers = all("modifiers");
  const keywordGrants = all("keywordGrants");
  const traitGrants = all("traitGrants");
  const rules = all("rules");
  const costModifiers = all("costModifiers");
  const paymentOnly = all("paymentOnly");
  const playableFrom = all("playableFrom");
  const basicPowerCosts = all("basicPowerCosts");
  const playConditions = parts.flatMap((p) => (p.playOnlyIf ? [p.playOnlyIf] : []));
  const playOnlyIfCondition: Predicate | undefined =
    playConditions.length > 1 ? { kind: "and", of: playConditions } : playConditions[0];
  return {
    trigger: {
      kind: "constant",
      ...(modifiers.length ? { modifiers } : {}),
      ...(keywordGrants.length ? { keywordGrants } : {}),
      ...(traitGrants.length ? { traitGrants } : {}),
      ...(rules.length ? { rules } : {}),
      ...(multipliers[0] ? { resourceMultiplier: multipliers[0] } : {}),
      ...(handGeneratesList[0] !== undefined ? { handGenerates: handGeneratesList[0] } : {}),
      ...(costModifiers.length ? { costModifiers } : {}),
      ...(paymentOnly.length ? { paymentOnly } : {}),
      ...(spendableInList[0] ? { spendableIn: spendableInList[0] } : {}),
      ...(anyPlayerList[0] ? { spendableForAnyPlayer: anyPlayerList[0] } : {}),
      ...(parts.some((p) => p.notCountedTowardHandSize) ? { notCountedTowardHandSize: true as const } : {}),
      ...(playableFrom.length ? { playableFrom } : {}),
      ...(basicPowerCosts.length ? { basicPowerCosts } : {}),
      ...(playableAttachmentsList[0] ? { playableAttachments: playableAttachmentsList[0] } : {}),
      ...(playOnlyIfCondition ? { playOnlyIf: playOnlyIfCondition } : {}),
    },
    effects: [],
  };
}
/**
 * "Play only if you control an Element Gun." (Sliding Shot, `stld` 17005; docs/phase7-wave3.md §3.42): a play
 * restriction on any `Predicate`, checked on the card being played (RRG 1.8 "Initiating Abilities", p. 24, step 2), with
 * `you` the player playing it. `constant(playOnlyIf(exists(query("upgrade", { name: "Element Gun", controller: "you" }))))`.
 */
export const playOnlyIf = (condition: Predicate): ConstantPart => ({ playOnlyIf: condition });
/**
 * "While your identity has the [Civilian] trait, this card can be spent for any player" (Everyday Hero, `nova` 28019;
 * docs/phase7-wave5.md §3.17): `constant(spendableForAnyPlayer(identityHasTrait(CIVILIAN)))`, "you" its owner. The
 * gained "After you spend this card for a player" is a response on `resourcesSpent` with `selfIs: "source"`; "that
 * player" is `eventPlayer`.
 */
export const spendableForAnyPlayer = (when?: Predicate): ConstantPart => ({
  spendableForAnyPlayer: when ? { while: when } : {},
});
/**
 * "Connection to the Worldmind does not count toward your hand size." (`nova` 28007; docs/phase7-wave5.md §3.18):
 * `constant(notCountedTowardHandSize)`. Read from the card in hand by the end-of-phase discard and draw, the mulligan's
 * draw back up, and "draw up to your hand size"; every other hand count still counts it.
 */
export const notCountedTowardHandSize: ConstantPart = { notCountedTowardHandSize: true };
/** "You may play [X] events attached to this card as if they were in your hand." (Hawkeye's Quiver, `trors` pack). */
export const playableAttachments = (query: TargetQuery): ConstantPart => ({ playableAttachments: query });
/** "Reduce the cost to play X by N [while …]" / "… costs N additional resources" (a signed `delta`). */
export const costModifier = (spec: CostModifierSpec): ConstantPart => ({ costModifiers: [spec] });
/** "As an additional cost for [this character] to attack/thwart, you must …" (Wonder Man). */
export const basicPowerCost = (power: "attack" | "thwart", cost: AbilityCost): ConstantPart => ({
  basicPowerCosts: [{ power, cost }],
});

/** "X gets +N [stat]" (a negative N for "-N"); `setBase` for "has a base [stat] of N". */
export const gets = (
  stat: StatName | "hp" | "handSize" | SchemeValueName | "boostIcons" | "consequentialAttack" | "consequentialThwart",
  n: Amount,
  target: TargetQuery,
  opts: { readonly while?: Predicate; readonly setBase?: boolean } = {},
): ConstantPart => ({
  modifiers: [
    {
      stat,
      amount: n,
      target,
      ...(opts.while ? { while: opts.while } : {}),
      ...(opts.setBase ? { setBase: true } : {}),
    },
  ],
});
/** "X gains [keyword]". */
export const gainsKeyword = (
  keyword: KeywordInstance,
  target: TargetQuery,
  opts: { readonly while?: Predicate } = {},
): ConstantPart => ({
  keywordGrants: [{ keyword, target, ...(opts.while ? { while: opts.while } : {}) }],
});
/**
 * "Magneto loses steady." (Physical Strain, `mut_gen` 32145b; docs/phase7-wave6.md §3.13): every matching card loses
 * every instance of the named keyword, printed or granted, while this applies (RRG 1.8 "'Loses'", p. 27: losing beats
 * gaining). Only the name is read, so a numbered keyword needs no value.
 */
export const losesKeyword = (
  keyword: { readonly name: KeywordName },
  target: TargetQuery,
  opts: { readonly while?: Predicate } = {},
): ConstantPart => ({
  keywordGrants: [
    {
      keyword: { name: keyword.name } as KeywordInstance,
      target,
      loses: true,
      ...(opts.while ? { while: opts.while } : {}),
    },
  ],
});
/**
 * "Mandrill gains retaliate X, where X is equal to the number of confused characters in play" (`hood` 24016): a numbered
 * keyword whose number is `value`, read live (docs/phase7-wave4.md §3.53). 0 or less grants nothing.
 */
export const gainsKeywordX = (
  name: "retaliate" | "incite" | "hinder" | "victory",
  value: Amount,
  target: TargetQuery,
  opts: { readonly while?: Predicate } = {},
): ConstantPart => ({
  keywordGrants: [
    {
      keyword: { name, value: 0 } as KeywordInstance,
      target,
      value: amount(value),
      ...(opts.while ? { while: opts.while } : {}),
    },
  ],
});
/**
 * "Each enemy in play gains 1 acceleration icon" (Secret Lair, `hood` 24061): each card in play `target` matches counts
 * as `count` more `icon`s (docs/phase7-wave4.md §3.57). `while`: "While Lucia von Bardas is in play, this card gains a
 * hazard icon. While Lucia von Bardas is not in play, this card gains an acceleration icon" (Rule by Force, `ironheart`
 * 29029) needs two of these active on complementary conditions at once, the same `while` every other conditional
 * constant part (`gainsKeyword`/`gainsTrait`) already exposes — `RuleSpec.gainsIcon`'s own `while` field
 * (`packages/engine/src/abilities.ts`) predates this wrapper exposing it.
 */
export const gainsIcon = (
  icon: SchemeIcon,
  target: TargetQuery,
  opts: { readonly count?: number; readonly while?: Predicate } = {},
): ConstantPart =>
  rule({
    kind: "gainsIcon",
    icon,
    target,
    ...(opts.count !== undefined && opts.count !== 1 ? { count: opts.count } : {}),
    ...(opts.while ? { while: opts.while } : {}),
  });
/** "X gains the [trait] trait". */
export const gainsTrait = (t: Trait, target: TargetQuery, opts: { readonly while?: Predicate } = {}): ConstantPart => ({
  traitGrants: [{ trait: t, target, ...(opts.while ? { while: opts.while } : {}) }],
});
/**
 * "X gains the trait of each environment in play" (Absorbing Man, `trors` pack; docs/phase7-wave2.md §3.11): the
 * printed traits of every card `traitsOf` matches (from the granting card's point of view) are granted.
 */
export const gainsTraitsOf = (
  traitsOf: TargetQuery,
  target: TargetQuery,
  opts: { readonly while?: Predicate } = {},
): ConstantPart => ({
  traitGrants: [{ traitsOf, target, ...(opts.while ? { while: opts.while } : {}) }],
});
export const rule = (r: RuleSpec): ConstantPart => ({ rules: [r] });
/**
 * "While Baron Zemo is engaged with you, you cannot thwart" → `constant(cannotThwart(you))`; "The engaged player cannot
 * thwart side schemes" (Life-Size Decoy, `sm` 27142) → `constant(cannotThwart(engagedPlayerOf(self), { schemes:
 * query("sideScheme") }))`. Without `schemes`, every scheme. A scheme the player cannot thwart is not a legal target of
 * their basic thwart or of a thwart effect they resolve (`RuleSpec cannotThwart`).
 */
export const cannotThwart = (
  player: PlayerRef,
  opts: { readonly schemes?: TargetQuery; readonly while?: Predicate } = {},
): ConstantPart =>
  rule({
    kind: "cannotThwart",
    player,
    ...(opts.schemes ? { schemes: opts.schemes } : {}),
    ...(opts.while ? { while: opts.while } : {}),
  });
/**
 * "Attached identity cannot thwart, attack, defend, or recover" (Wrapped in Metal, `mut_gen` 32150;
 * docs/phase7-wave6.md §3.14): the recover clause is `constant(cannotRecover(controllerOf(host)))`. That player's basic
 * recovery is refused and not offered; other heals are untouched (only `cannotBeHealed` stops those).
 */
export const cannotRecover = (player: PlayerRef, opts: { readonly while?: Predicate } = {}): ConstantPart =>
  rule({ kind: "cannotRecover", player, ...(opts.while ? { while: opts.while } : {}) });
/**
 * "As an additional cost for the engaged player to ready a hero or ally they control, the player must spend a [mental]
 * resource" (Mister Fear, `hood` 24027) → `constant(additionalCostToReady(query(["hero", "ally"], { controlledBy:
 * engagedPlayerOf(self) }), { mental: 1 }, { player: engagedPlayerOf(self) }))`; "… for a player to ready a support, that
 * player must spend 1 resource of any type" (Undermine Support, `aos` 50174) → `additionalCostToReady(query("support"),
 * 1)`. The readier may decline, and then the card does not ready (RRG 1.8 "Ready", p. 36). docs/phase7-wave4.md §3.19.
 */
export const additionalCostToReady = (
  target: TargetQuery,
  resources: number | ResourceRequirement,
  opts: { readonly player?: PlayerRef; readonly while?: Predicate } = {},
): ConstantPart =>
  rule({
    kind: "readyCost",
    target,
    resources,
    ...(opts.player ? { player: opts.player } : {}),
    ...(opts.while ? { while: opts.while } : {}),
  });
/**
 * "While there are no other [Symbiote] environments in play, this card is considered a [Symbiote] environment"
 * (Festering Mass, `sm` 27124; docs/phase7-wave5.md §3.9): `constant(countsAs({ self: true }, ["environment"], {
 * traits: [SYMBIOTE], while: not(exists(query("environment", { trait: SYMBIOTE, self: false }))) }))`. Read by query
 * category and trait matching only; `while` sees printed characteristics only.
 */
export const countsAs = (
  target: TargetQuery,
  categories: readonly TargetCategory[],
  opts: { readonly traits?: readonly Trait[]; readonly while?: Predicate } = {},
): ConstantPart =>
  rule({
    kind: "countsAs",
    target,
    categories,
    ...(opts.traits ? { traits: opts.traits } : {}),
    ...(opts.while ? { while: opts.while } : {}),
  });
/**
 * "As an additional cost to thwart this scheme, you must spend a [energy] resource" (Giant Monster Attack) is
 * `constant(additionalThwartCost({ self: true }, { resources: { energy: 1 } }))`; "…, take 2 indirect damage" (Cat in a
 * Tree) is `{ indirectDamage: 2 }` (docs/phase7-wave5.md §3.21). Asked of the thwarting player before each thwart of
 * the scheme; a declined payment cancels the thwart.
 */
export const additionalThwartCost = (
  scheme: TargetQuery,
  cost: { readonly resources?: ResourceRequirement; readonly indirectDamage?: number },
): ConstantPart =>
  rule({
    kind: "additionalThwartCost",
    scheme,
    ...(cost.resources ? { resources: cost.resources } : {}),
    ...(cost.indirectDamage ? { indirectDamage: cost.indirectDamage } : {}),
  });
/**
 * "Treat the printed resource of each card in your hand as if it were [energy]." (Haywire, `ironheart` 29038;
 * docs/phase7-wave5.md §3.20): `constant(printedResourcesInHandAs(you, "energy"))` on the attachment ("you" is the
 * identity it is attached to). Read by payment and by every printed-resource query and count.
 */
export const printedResourcesInHandAs = (player: PlayerRef, as: TypedResource): ConstantPart =>
  rule({ kind: "printedResourceAs", player, as });
/**
 * "Armadillo can have any number of tough status cards." (`nova` 28029; docs/phase7-wave5.md §3.19):
 * `constant(anyNumberOfToughStatusCards({ self: true }))`. Each still prevents one damage event; piercing discards all.
 */
export const anyNumberOfToughStatusCards = (target: TargetQuery): ConstantPart =>
  rule({ kind: "statusLimit", target, status: "tough", max: "unlimited" });
/**
 * "Colossus can have 1 additional tough status card." (`mut_gen` 32001a; docs/phase7-wave6.md §3.7):
 * `constant(statusLimit("tough", 2, { self: true }))`. `max` is the total held (RRG 1.8 "Status Cards", p. 41: one is
 * the base); with several rules the largest wins. Each still prevents one damage event; piercing discards all.
 */
export const statusLimit = (status: "tough", max: number | "unlimited", target: TargetQuery): ConstantPart =>
  rule({ kind: "statusLimit", target, status, max });
/**
 * "Increase all damage Venom takes by 1" (Bell Tower's Ringing side, `sm` 27076b; docs/phase7-wave5.md §3.8):
 * `constant(increaseDamageTaken(query("villain", { name: "Venom" }), 1))`. Once per damage event (§4 Q7), summed with
 * any `reduceDamageTaken`; `fromAttack` narrows it to an attack's damage.
 */
export const increaseDamageTaken = (
  target: TargetQuery,
  amount: number,
  opts: { readonly fromAttack?: boolean; readonly while?: Predicate } = {},
): ConstantPart =>
  rule({
    kind: "increaseDamageTaken",
    target,
    amount,
    ...(opts.fromAttack ? { fromAttack: true } : {}),
    ...(opts.while ? { while: opts.while } : {}),
  });
/**
 * "Nebula cannot take more than 5 damage from a single attack." (Cutthroat Ambition, docs/phase7-wave3.md §3.15):
 * `constant(maxDamageTaken({ hostOfSelf: true }, 5))`. "Nimrod cannot take more than 3 damage each
 * phase." (`mut_gen` 32166, docs/phase7-wave6.md §3.4): `constant(maxDamageTaken({ self: true }, 3, { per: "phase" }))`,
 * which counts every damage event the character takes this phase and holds back the rest (neither taken nor
 * prevented, §4.1 Q9).
 */
export const maxDamageTaken = (
  target: TargetQuery,
  cap: number,
  opts: { readonly per?: "attack" | "phase"; readonly while?: Predicate } = {},
): ConstantPart =>
  rule({
    kind: "maxDamageTakenPerAttack",
    target,
    amount: cap,
    ...(opts.per === "phase" ? { per: "phase" as const } : {}),
    ...(opts.while ? { while: opts.while } : {}),
  });
/**
 * "Magneto cannot have more than 6[per_hero] sustained damage." (Boarding Party, Sabotage Master Mold, Orbital Decay;
 * docs/phase7-wave6.md §3.3): `constant(maxSustainedDamage(query("villain", { name: "Magneto" }), perHero(6)))`. The
 * damage taken (or placed) is lowered to what keeps sustained damage at the cap; the rest is neither taken nor prevented
 * (§4.1 Q9). With several, the lowest wins; it ends when the card with the rule leaves play.
 */
export const maxSustainedDamage = (
  target: TargetQuery,
  cap: Amount,
  opts: { readonly while?: Predicate } = {},
): ConstantPart =>
  rule({ kind: "maxSustainedDamage", target, amount: amount(cap), ...(opts.while ? { while: opts.while } : {}) });
/**
 * "You cannot resolve triggered abilities in your hero's printed text box." (Induced Panic, `sm` 27153;
 * docs/phase7-wave5.md §4.1 Q70): `constant(cannotResolveTriggeredAbilities(query("identity", { hostOfSelf: true }),
 * { identityFace: "hero" }))`. Every bold-timing ability on a matching card (actions and resources included) is neither
 * offered nor resolved; `timings` narrows it to those timing words.
 */
export const cannotResolveTriggeredAbilities = (
  on: TargetQuery,
  opts: {
    readonly identityFace?: Form;
    readonly timings?: readonly AbilityTimingWord[];
    readonly while?: Predicate;
  } = {},
): ConstantPart =>
  rule({
    kind: "cannotResolveTriggeredAbilities",
    on,
    ...(opts.identityFace ? { identityFace: opts.identityFace } : {}),
    ...(opts.timings ? { timings: opts.timings } : {}),
    ...(opts.while ? { while: opts.while } : {}),
  });
/**
 * "Heroes and allies cannot be readied by player card effects" (Unnatural Storm, `mts` 21159;
 * docs/phase7-wave4.md §3.19): the end-of-phase ready and encounter card effects still ready them.
 */
export const cannotBeReadiedByPlayerCards = (target: TargetQuery): ConstantPart =>
  rule({ kind: "cannotReady", target, bySource: "playerCard" });
/**
 * "Robert Kelly cannot be healed by player card effects" (Find the Senator / Protect the Senator, `mut_gen` 32065a/b;
 * docs/phase7-wave6.md §3.12): `constant(cannotBeHealed(query("ally", { name: "Robert Kelly" }), { bySource:
 * "playerCard" }))`. A matching heal heals nothing (logged `healBlocked`); an encounter card's heal (Medical Emergency)
 * still heals. Without `bySource`, "cannot be healed": nothing heals it.
 */
export const cannotBeHealed = (
  target: TargetQuery,
  opts: { readonly bySource?: "playerCard"; readonly while?: Predicate } = {},
): ConstantPart =>
  rule({
    kind: "cannotBeHealed",
    target,
    ...(opts.bySource ? { bySource: opts.bySource } : {}),
    ...(opts.while ? { while: opts.while } : {}),
  });
/**
 * "Prevent all damage to Ebony Maw" (Abjuration, `mts` 21082; docs/phase7-wave4.md §3.20): the damage is dealt and this
 * card prevents it, so `on.thisPreventsDamage` hears it. `constant(preventAllDamageTo(query("villain", { name: "Ebony
 * Maw" })))`, or `{ hostOfSelf: true }` for "attached villain".
 */
export const preventAllDamageTo = (target: TargetQuery, opts: { readonly while?: Predicate } = {}): ConstantPart =>
  rule({ kind: "preventAllDamage", target, ...(opts.while ? { while: opts.while } : {}) });
/**
 * Focused Defense (Tower Defense, `mts` 21101): "The villain who matches the attached scheme is the active villain." Its
 * host is also the scheme minions scheme onto and player constants mean by "the main scheme" (MC21 p. 10; errata RRG 1.8
 * p. 67). `constant(focusedMainScheme())`. docs/phase7-wave4.md §3.2.
 */
/**
 * "While Pip the Troll is in your hand, he gains '…'" / "While this card is in your hand, it gains: '…'" (Pip the Troll,
 * System Shock, `mts` 21032, 21185): the ability works only while its card is in its owner's hand
 * (`AbilityDefinition.activeIn`, docs/phase7-wave4.md §3.13). `inHand(interrupt(…))`.
 */
export const inHand = (definition: AbilityDefinition): AbilityDefinition => ({ ...definition, activeIn: "hand" });
/**
 * "… This effect cannot be canceled." (the Cosmic Entities, `mts` 21042/21048/21054/21060; Longshot, `mojo` 39071):
 * `uncancellable(whenRevealed(…))`. "This card cannot be canceled" read from the card itself or from play is the
 * constant `cannotBeCanceled(query)`. docs/phase7-wave4.md §3.14.
 */
export const uncancellable = (definition: AbilityDefinition): AbilityDefinition => ({
  ...definition,
  uncancellable: true,
});
/** "Treacheries cannot be canceled." (Dark Scepter, `tt` 55036); "this card … cannot be canceled" (`sm` 27108). */
export const cannotBeCanceled = (cards: TargetQuery, when?: Predicate): ConstantPart => ({
  rules: [{ kind: "cannotBeCanceled", cards, ...(when ? { while: when } : {}) }],
});
/**
 * "Treat attached ally as an [Undead] minion with a blank text box. Attached minion's SCH is equal to its printed THW
 * and it does not take consequential damage." (Fallen Warrior, Beguiled, `mts` 21153, 21178; the same family in
 * `deadpool`, `jubilee`, `storm`): `constant(treatAttachedAllyAsMinion([UNDEAD]))`. "(except for traits)" (Manipulated
 * Mind, `sm` 27171; Malice, `next_evol` 40199): `{ keepPrintedTraits: true }`. docs/phase7-wave4.md §3.9.
 */
export const treatAttachedAllyAsMinion = (
  traits: readonly Trait[],
  opts: { readonly keepPrintedTraits?: boolean } = {},
): ConstantPart => ({
  rules: [
    {
      kind: "treatHostAsMinion",
      traits,
      schFromThw: true,
      ...(opts.keepPrintedTraits ? { keepPrintedTraits: true } : {}),
    },
  ],
});
/**
 * "Nebula ignores the guard keyword, the patrol keyword, and the crisis icon" (Evasive Maneuvering, `nebu` 22005; Wasp,
 * `ironheart` 29034; Shadowcat, `mut_gen` 32002/32030a; Psionic Training, `psylocke` 41010, guard and patrol only):
 * `constant(ignores(YOUR_IDENTITY, ["guard", "patrol", "crisis"], isHero()))`. docs/phase7-wave4.md §3.24.
 */
export const ignores = (
  target: TargetQuery,
  what: readonly ("guard" | "patrol" | "crisis")[],
  when?: Predicate,
): ConstantPart => ({
  rules: [{ kind: "characterIgnores", target, ignores: what, ...(when ? { while: when } : {}) }],
});
/**
 * "Your hero's basic thwarts ignore the crisis icon (and the patrol keyword)" (Retinal Display, `sm` 27186a/b;
 * docs/phase7-wave5.md §3.22): `ignores` for basic thwarts only.
 */
export const basicThwartsIgnore = (
  target: TargetQuery,
  what: readonly ("patrol" | "crisis")[],
  when?: Predicate,
): ConstantPart => ({
  rules: [{ kind: "characterIgnores", target, ignores: what, basicOnly: true, ...(when ? { while: when } : {}) }],
});
/**
 * "Your hero's basic thwart power (THW) can only remove threat from the scheme with the most threat." (Retinal
 * Display; docs/phase7-wave5.md §3.22): `constant(basicThwartOnlyAgainst(query("hero", { controller: "you" }),
 * superlative("highest", each(query("scheme")), threatOn(chosen("candidate")))))`.
 */
export const basicThwartOnlyAgainst = (character: TargetQuery, among: TargetRef): ConstantPart => ({
  rules: [{ kind: "basicThwartTargets", character, among }],
});
/**
 * "Take control of attached minion and treat it as a [Controlled] ally with a blank text box. Its THW is equal to its
 * printed SCH and it takes 1 consequential damage after it thwarts or attacks." (Mind Control, `phoenix` 34009;
 * Redemption, `bp` 51036): `constant(treatAttachedMinionAsAlly([CONTROLLED], 1))`. docs/phase7-wave4.md §3.29.
 */
export const treatAttachedMinionAsAlly = (traits: readonly Trait[], consequential: number): ConstantPart => ({
  rules: [{ kind: "treatHostAsAlly", traits, thwFromSch: true, consequential }],
});
/**
 * "Players cannot discard attachments that are attached to friendly characters." (Powerful Enchantments, `valk`
 * 25030): `constant(playersCannotDiscard(query))`. A player's ability does not discard a matching card; its host's
 * defeat and encounter effects still do. docs/phase7-wave4.md §3.44.
 */
export const playersCannotDiscard = (target: TargetQuery): ConstantPart => ({
  rules: [{ kind: "playersCannotDiscard", target }],
});
/**
 * An encounter card drawn from a player's deck stays in that hand instead of being dealt facedown with a replacement
 * draw (MC32 p. 7, Mystique's treacheries; docs/phase7-wave6.md §3.10, §4.1 Q7). On the card itself:
 * `inHand(constant(staysInHand()))`; as a scenario rule naming the cards: `constant(staysInHand(query))`.
 */
export const staysInHand = (cards: TargetQuery = {}): ConstantPart => ({ rules: [{ kind: "staysInHand", cards }] });
/** "You cannot choose to discard this card from your hand." (System Shock): `inHand(constant(cannotChooseToDiscard))`. */
export const cannotChooseToDiscard: ConstantPart = { rules: [{ kind: "cannotChooseToDiscard" }] };
export const focusedMainScheme = (): ConstantPart => rule({ kind: "focusedMainScheme", scheme: { kind: "host" } });
/**
 * Venom Goblin's glider counter as a scenario rule (MC27 p. 17; docs/phase7-wave5.md §3.3): the main scheme with the
 * counter is the one encounter cards, enemy threat, acceleration tokens, patrol and crisis mean. Put it in the
 * scenario's rule specs (`GameSetupConfig.scenarioRuleSpecs`, wave 4 §3.40), not on a card.
 */
export const mainSchemeMarkedBy = (counterType: string): RuleSpec => ({
  kind: "focusedMainScheme",
  scheme: { kind: "each", query: { categories: ["mainScheme"], hasCounter: counterType } },
  encounterCards: "focused",
});
/**
 * "The first [X] the engaged player reveals each villain phase gains surge." (Mister Knife, `stld` 17026); "The
 * first [Technique] attachment revealed each round gains surge." (Nebula I–III, `gmw`; docs/phase7-wave3.md §3.8).
 * `revealer` narrows *who* has to reveal it ("the engaged player" is `engagedPlayerOf(self)`); absent matches
 * anyone's reveal.
 */
export const firstRevealGainsSurge = (
  cards: TargetQuery,
  each: "round" | "phase",
  opts: { readonly revealer?: PlayerRef; readonly while?: Predicate } = {},
): ConstantPart => ({
  rules: [
    {
      kind: "firstRevealGainsSurge",
      cards,
      each,
      ...(opts.revealer ? { revealer: opts.revealer } : {}),
      ...(opts.while ? { while: opts.while } : {}),
    },
  ],
});
/** "X does not count against your ally limit." (Stinger, `ant`; RRG 1.8 "Ally Limit", p. 7). */
export const excludedFromAllyLimit = (
  target: TargetQuery,
  opts: { readonly while?: Predicate } = {},
): ConstantPart => ({
  rules: [{ kind: "excludedFromAllyLimit", target, ...(opts.while ? { while: opts.while } : {}) }],
});
/**
 * "You can control 1 additional [X] upgrade that has the restricted keyword." (Venom / Flash Thompson, `vnm`
 * 20001a/b; Side Holster, 20021; docs/phase7-wave3.md §3.22). RRG 1.8 "Restricted" (p. 38) fixes the base limit at
 * two; each rule raises it by `amount` for `player` (absent: the rule's own speaker, the card's controller —
 * "you can control", not "any player can"). `cards` scopes the extra room to matching held cards only ("1
 * additional **[Weapon]** upgrade"); omit it for an unscoped raise.
 */
export const restrictedLimit = (
  amount: number,
  opts: { readonly cards?: TargetQuery; readonly player?: PlayerRef; readonly while?: Predicate } = {},
): ConstantPart => ({
  rules: [
    {
      kind: "restrictedLimit",
      amount,
      ...(opts.cards ? { cards: opts.cards } : {}),
      ...(opts.player ? { player: opts.player } : {}),
      ...(opts.while ? { while: opts.while } : {}),
    },
  ],
});
/**
 * "Treat the printed text box of each [trait] player card as if it were blank" (Tech Theft 12026, `ant`;
 * docs/phase7-wave2.md §8): the matching cards' abilities and printed keywords stop working while this card is in
 * play. `target` is a category list, not `controller: "you"` — the rule sits on an encounter card, which has no
 * controller for "you" to resolve to, and the printed text says "each", not "your".
 */
export const blanksTextBox = (
  target: TargetQuery,
  opts: { readonly while?: Predicate; readonly exceptKeywords?: boolean } = {},
): ConstantPart => ({
  rules: [
    {
      kind: "blankTextBox",
      target,
      ...(opts.while ? { while: opts.while } : {}),
      // "…, except for keywords" (Corrupted Programming, `vision` 26028; docs/phase7-wave4.md §3.28).
      ...(opts.exceptKeywords ? { exceptKeywords: true as const } : {}),
    },
  ],
});
/**
 * "This card's printed text box cannot be treated as if it were blank." (SP//dr Suit 1B and SP//dr, `spdr` 31001b /
 * 31002b; docs/phase7-wave5.md §3.31): `constant(textBoxCannotBeBlanked())`. Its own card only, unconditional; neither
 * a lasting blank (Panic in the Streets, Vivian) nor a constant `blanksTextBox` rule reaches the face that prints it.
 */
export const textBoxCannotBeBlanked = (): ConstantPart => rule({ kind: "textBoxCannotBeBlanked" });
/**
 * "Each of your [trait] attacks gain [keyword]" (Hawkeye's Bow, `trors`): an `AttackKeyword` granted to attacks
 * matching `attacker` and/or `via`, not to a character (RRG 1.8 "Piercing"/"Ranged"/"Overkill"; `RuleSpec
 * attackKeywords`, docs/phase7-wave2.md §3). `via` matches the card whose ability makes the attack (the event for a
 * "Hero Action (attack)"); a persistent character/attachment granting itself the keyword should use `gainsKeyword`
 * instead — this builder is for a grant that outlives the one card making the attack.
 *
 * `basicOnly`: "your **basic** attacks gain [keyword]" (Red Room Training 13008, Brute Force `qsv`, Psi-Katana
 * `psylocke`, Wolverine's own upgrade; docs/phase7-wave2.md §17.3) — matches only how the attack was made (a basic
 * attack, whoever makes it), not who made it, so `basicOnly: true` with no `attacker` reaches every basic attack in
 * the game and no villain attack; pair it with `attacker` to scope to "your" basic attacks specifically. `via`
 * already excludes a basic attack (a basic attack's own `viaId` is null); `basicOnly` is the opposite requirement —
 * excluding an event-sourced attack — which `via` alone cannot say.
 */
export const attacksGainKeywords = (
  keywords: readonly AttackKeyword[],
  opts: {
    readonly attacker?: TargetQuery;
    readonly via?: TargetQuery;
    readonly while?: Predicate;
    readonly basicOnly?: boolean;
  } = {},
): ConstantPart => ({
  rules: [
    {
      kind: "attackKeywords",
      keywords,
      ...(opts.attacker ? { attacker: opts.attacker } : {}),
      ...(opts.via ? { via: opts.via } : {}),
      ...(opts.while ? { while: opts.while } : {}),
      ...(opts.basicOnly ? { basicOnly: true } : {}),
    },
  ],
});
/** "Double the number of resources this card generates while paying for an [aspect] card." */
export const doublesResourcesWhilePayingFor = (whilePayingFor: TargetQuery): ConstantPart => ({
  resourceMultiplier: { factor: 2, whilePayingFor },
});
/**
 * "Double the number of [wild] resources generated while paying for this card." (Lightspeed Flight, `nova` 28004):
 * on the card being paid for, doubling that type from every source of the payment (`ResourceMultiplierSpec`).
 * Without a type, every resource is doubled.
 */
export const doublesResourcesGeneratedForThisCard = (resource?: ResourceType): ConstantPart => ({
  resourceMultiplier: { factor: 2, forThisCard: true, ...(resource ? { resource } : {}) },
});

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
/**
 * "Spend 3 resources of the same type →" (Kree Combat Armor, `gmw` 16131; docs/phase7-wave3.md §3.43): `n` resources,
 * all of one type the payer chooses. A wild counts as any type; a two-type card may give one icon and overpay the other.
 */
export const spendSameType = (n: number): AbilityCost => ({ resources: n, sameResourceType: true });
/** "Spend X [type] resources →": X is bound to var `bind`. */
export const spendX = (resourceType: TypedResource, bind = "x", min = 1): AbilityCost => ({
  resourcesX: { resource: resourceType, bind, min },
});
/**
 * "Spend up to N resources of any type →" (Nebula's Ship, `gmw` 16093; docs/phase7-wave3.md §3.25): unlike `spendX`
 * (a named type, at least `min`), this is any type, capped at `max`, with none required — RRG 1.8 "Cost" (p. 13):
 * overpaying is legal, so X is capped rather than the payment refused. `bind` is 0 if nothing is spent this way.
 */
export const spendUpTo = (max: number, bind = "x"): AbilityCost => ({ resourcesX: { resource: "any", bind, max } });
/**
 * "Remove N [type] counter(s) from it →" (the ability's own card). `fromIdentity`: "Remove N growth counters from
 * Groot →" (`gmw` 16008, 16010, 16011) — the paying player's own identity, a different card than the one carrying
 * the ability (`AbilityCost.spendCounters.target`).
 */
export const removeCounter = (
  counterType: string,
  n = 1,
  opts: { readonly fromIdentity?: boolean } = {},
): AbilityCost => ({
  spendCounters: { counterType, amount: n, ...(opts.fromIdentity ? { target: "identity" } : {}) },
});
/** "Take N damage →" (your identity). */
/**
 * "Deal yourself N facedown encounter card(s) →" (Star-Lord's "What could go wrong?"; Daring Escape; Library
 * Labyrinth; Universal Weapon; docs/phase7-wave3.md §3.20, §3.26): the paying player is dealt that many facedown
 * encounter cards as the cost.
 */
export const dealEncounterCardsCost = (n: number): AbilityCost => ({ dealEncounterCards: n });
/**
 * "Remove **up to** N [type] counters from [Groot] →" ("We Are Groot", `gmw` 16006; docs/phase7-wave3.md §3.32): the
 * player picks how many, 1 to N (RRG 1.8 "Cost", p. 14: "up to" still needs at least one), in the command's
 * `costSelection.counters`; the number removed is bound to var `bind` for the effects ("choose that many …").
 * `fromIdentity` as `removeCounter`'s.
 */
export const removeUpToCounters = (
  counterType: string,
  n: number,
  opts: { readonly bind: string; readonly fromIdentity?: boolean },
): AbilityCost => ({
  spendCounters: {
    counterType,
    amount: n,
    upTo: true,
    bind: opts.bind,
    ...(opts.fromIdentity ? { target: "identity" } : {}),
  },
});
/**
 * "Discard the top card of your deck →" (Booster Boots, `gmw` 16052; docs/phase7-wave3.md §3.33). Payable only if the
 * deck can supply every card; an empty deck with a discard pile is reset first, and a deck the cost empties is reset
 * at once (RRG 1.8 "Player Deck", p. 33; ruling, Apr 30, 2026 (3) answer 7).
 */
/**
 * "Discard the top N cards of your deck →"; a value for "discard that many cards" (Shield Spell, §3.42 of wave 4).
 * `slot` binds the discarded cards for the effects: "… → add each SP//dr card discarded this way to your hand" (Aunt May
 * & Uncle Ben, `spdr` 31007) is `moveCards(cards(chosen(slot), filter), "hand")` (`AbilityCost.discardFromDeckSlot`).
 */
export const discardTopOfDeckCost = (n: number | ValueSpec = 1, slot?: string): AbilityCost => ({
  discardFromDeck: n,
  ...(slot !== undefined ? { discardFromDeckSlot: slot } : {}),
});
/**
 * "Choose to either exhaust your hero or spend 2 resources of any type →" (The Grand Collection 1B, `gmw` 16073b;
 * docs/phase7-wave3.md §3.36): exactly one branch is paid, the player's choice (`costSelection.branch`, the branch's
 * index here). Each branch is one cost or a list merged like `cost: [...]`. Other components of the ability's cost
 * go beside it: `cost: [exhaustThis, eitherCost(...)]`.
 */
export const eitherCost = (...branches: readonly (AbilityCost | readonly AbilityCost[])[]): AbilityCost => ({
  either: branches.map((branch) => (isCostList(branch) ? mergeCosts(branch) : branch)),
});
/**
 * "Discard the top 2 cards of your deck (the top card instead if you control the Milano) →" (Reactor Core, `gmw`
 * 16165; docs/phase7-wave3.md §3.49): a cost component the board picks, not the player. `then` is paid while
 * `condition` holds when the cost is determined, `otherwise` if not; only that branch is checked, so an unpayable one
 * makes the ability unusable even if the other could be paid ("instead" replaces the printed cost). Each branch is one
 * cost or a list merged like `cost: [...]`; other components go beside it: `cost: [exhaustThis, costIf(...)]`.
 */
export const costIf = (
  condition: Predicate,
  then: AbilityCost | readonly AbilityCost[],
  otherwise: AbilityCost | readonly AbilityCost[],
): AbilityCost => ({
  conditional: {
    condition,
    then: isCostList(then) ? mergeCosts(then) : then,
    else: isCostList(otherwise) ? mergeCosts(otherwise) : otherwise,
  },
});
export const takeDamageCost = (n: number): AbilityCost => ({ damageSelf: n });
/** "Deal N damage to [this character] →" */
export const damageThisCardCost = (n: number): AbilityCost => ({ damageThisCard: n });
/** "Heal N damage from [your identity] →" */
export const healYourIdentityCost = (n: number): AbilityCost => ({ healIdentity: n });
/**
 * "Take N indirect damage →" (Kinetic Armor, `sm` 27149): divided among the characters you control, before the
 * effects. Offered only while your characters can take all of it (none with a tough status card counts), and if any
 * of it is prevented the cost was not paid and the effects don't resolve (RRG 1.8 "Cost", p. 14;
 * `AbilityCost.indirectDamage`).
 */
export const takeIndirectDamageCost = (n: number): AbilityCost => ({ indirectDamage: n });
/**
 * "Give [the villain] a tough status card →" (Neocarbon Scales, `sm` 27150): payable only if every card `to` names in
 * play can hold another status card of that type (`AbilityCost.giveStatus`).
 */
export const giveStatusCost = (to: TargetRef, status: StatusName): AbilityCost => ({ giveStatus: { status, to } });
/**
 * "Discard a tough status card from your hero →" (Made of Rage, `mut_gen` 32007; Bulletproof Protector, 32009): one
 * from each card `from` names in play, offered only while every one of them holds one; announced as `statusDiscarded`
 * with cause `cost`, answered before the effects (`AbilityCost.discardStatus`, docs/phase7-wave6.md §3.6).
 */
export const discardStatusCost = (status: StatusName, from: TargetRef): AbilityCost => ({
  discardStatus: { status, from },
});
/**
 * "… and 1 facedown boost card →" (Neocarbon Scales): each card `to` names in play is dealt `n` facedown boost cards
 * from the encounter deck (`AbilityCost.giveBoostCards`).
 */
export const giveBoostCardsCost = (to: TargetRef, n = 1): AbilityCost => ({ giveBoostCards: { count: n, to } });
/** "Exhaust your hero →" */
export const exhaustYourHero: AbilityCost = { exhaustIdentity: true };
/**
 * "Choose and discard N (up to M) cards from your hand →" — the cards are bound to slot `discard`, their count to
 * `bind`. Omit `max` for "Discard X cards from your hand" with no printed cap (Shield Toss, `cap` pack): bounded
 * only by hand size, since a payment can never repeat a card or pick one not in hand.
 *
 * `filter` narrows *which* hand cards may pay it: "Discard a [physical] resource from your hand →" (Weakened,
 * `toafk` 11018) is `discardFromHandCost(1, 1, undefined, { printedResource: "physical" })`. docs/phase7-wave2.md
 * §19 — the cost-side twin of the effect's own `discardFromHand`'s `filter`.
 */
export const discardFromHandCost = (min: number, max?: number, bind?: string, filter?: TargetQuery): AbilityCost => ({
  discardFromHand: {
    min,
    ...(max !== undefined ? { max } : {}),
    ...(bind ? { bind } : {}),
    ...(filter ? { filter } : {}),
  },
});
/**
 * "Discard any number of [matching] cards from your hand with a combined [measure] of N or more →": the player picks
 * any number (at least one, RRG 1.8 "Cost", p. 14) of hand cards matching `filter`, and the cost is paid only if the
 * picks' summed `measure` reaches `atLeast` (`DiscardCombined`, `packages/engine/src/abilities.ts`). Advanced Glider
 * (`sm` 27136): `discardFromHandCombinedCost({ trait: ATTACK }, { measure: "printedCost", atLeast: 3 })`. The cards
 * are bound to slot `discard` and their count to `bind`, as with `discardFromHandCost`.
 */
export const discardFromHandCombinedCost = (
  filter: TargetQuery | undefined,
  combined: DiscardCombined,
  bind?: string,
): AbilityCost => ({
  discardFromHand: { min: 1, ...(bind ? { bind } : {}), ...(filter ? { filter } : {}), combined },
});
/**
 * "Discard N card(s) at random from your hand →" (Magic Crowbar: `[exhaustYourHero, discardRandomFromHandCost(1)]`).
 * The engine picks with the game's seeded RNG when the cost is paid; nothing is chosen by the player or bound.
 * `filter` narrows the pick to matching cards, read as the paying player: "Discard 1 identity-specific card at random
 * from your hand →" (Induced Panic, `sm` 27153) is `discardRandomFromHandCost(1, { identitySetOf: you })`.
 */
export const discardRandomFromHandCost = (n = 1, filter?: TargetQuery): AbilityCost => ({
  discardRandomFromHand: n,
  ...(filter ? { discardRandomFromHandFilter: filter } : {}),
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
  /**
   * "Discard the **highest-cost** upgrade you control →" (Arm Cannon, `sm` 27147): only the matching cards tied for the
   * highest (or lowest) printed cost can pay; a tie is the payer's pick (`InPlayCostPick.superlative`).
   */
  readonly superlative?: "highest" | "lowest";
}

const inPlayPick = (q: TargetQuery, opts: InPlayCostOptions, defaultSlot: string): InPlayCostPick => {
  const min = opts.min ?? 1;
  const max = opts.max === undefined ? min : opts.max;
  return {
    slot: opts.slot ?? defaultSlot,
    query: q,
    min,
    ...(max !== "any" ? { max } : {}),
    ...(opts.bind ? { bind: opts.bind } : {}),
    ...(opts.superlative ? { superlative: { order: opts.superlative, measure: "printedCost" as const } } : {}),
  };
};

/**
 * "Exhaust [cards you control in play] →", other than this card (`exhaustThis`) or your hero (`exhaustYourHero`):
 * `exhaustCardsCost(query("upgrade", { name: SHIELD }))` (Shield Block) or `exhaustCardsCost(query("ally"),
 * { max: "any", bind: "n" })` (Strength in Numbers). The engine limits candidates to cards the payer controls.
 */
export const exhaustCardsCost = (q: TargetQuery, opts: InPlayCostOptions = {}): AbilityCost => ({
  exhaustCards: inPlayPick(q, opts, "exhausted"),
});
/**
 * "Exhaust an [Avenger] character and a [Guardian] character →" (As One!, Stand Together, Problem Solvers; Combine
 * Forces' X-Force and X-Men; docs/phase7-wave4.md §3.17): one card per slot, each slot its own query, and one card
 * cannot pay two slots. `exhaustEachCost({ avenger: query(["identity", "ally"], { trait: AVENGER }), guardian: … })` binds each card to its slot, so "the combined ATK of those characters" is `sum(statOf(chosen("avenger"),
 * "atk"), statOf(chosen("guardian"), "atk"))`. On an alliance card the picks may be any player's characters; otherwise
 * the payer's own, as for `exhaustCardsCost`.
 */
export const exhaustEachCost = (picks: Readonly<Record<string, TargetQuery>>): AbilityCost => {
  const entries = Object.entries(picks);
  if (entries.length < 2) throw new Error("exhaustEachCost: name at least two slots (one pick is exhaustCardsCost)");
  return { exhaustCards: entries.map(([slot, q]) => inPlayPick(q, { slot }, slot)) };
};
/** "… return [cards you control] from play to your hand →" (Shield Toss). Same picking rules as `exhaustCardsCost`. */
export const returnToHandCost = (q: TargetQuery, opts: InPlayCostOptions = {}): AbilityCost => ({
  returnToHand: inPlayPick(q, opts, "returned"),
});
/**
 * "Discard an upgrade you control →" (Lethal Weapon, `nebu` 22030); "Discard an ally you control →" (Noble Sacrifice);
 * "Discard a [Tech] upgrade you control →" (Repurpose): cards in play discarded to pay. Same picking rules as
 * `exhaustCardsCost`; the cards are bound to `"discarded"` ("that ally's printed hit points"). docs/phase7-wave4.md §3.25.
 */
export const discardCardsCost = (q: TargetQuery, opts: InPlayCostOptions = {}): AbilityCost => ({
  discardCards: inPlayPick(q, opts, "discarded"),
});
/**
 * "Deal 1 damage to a [Web-Warrior] character you control →" (Thwip Thwip!, `spdr` 31017; Quick Quip, `silk` 52034):
 * the picked character takes `amount` damage from this card, and the cost is payable only while a candidate could take
 * all of it (`AbilityCost.damageCards`). Same picking rules as `exhaustCardsCost`; the cards are bound to `"damaged"`.
 */
export const damageCardsCost = (q: TargetQuery, amount: number, opts: InPlayCostOptions = {}): AbilityCost => ({
  damageCards: { ...inPlayPick(q, opts, "damaged"), amount },
});
/** "Pay the printed cost of [a card] →" */
/**
 * "Pay the printed cost of an ally in any player's discard pile →" (Make the Call).
 *
 * Pass `{ entersPlay: true }` when the ability's effects then bring the chosen card into
 * play: the engine uses it to refuse a pick that could not enter play (RRG "Unique Icon"),
 * so the cost is never paid for an ability that cannot do anything.
 */
export const payPrintedCostOf = (
  slot: string,
  from: CardZoneQuery,
  options: { entersPlay?: boolean } = {},
): AbilityCost => ({
  payPrintedCostOf: { slot, from, ...(options.entersPlay ? { entersPlay: true } : {}) },
});

/** "(Limit once per round.)" */
export const oncePerRound: AbilityLimit = { count: 1, period: "round" };
/**
 * "(Limit once per round per player.)" (The Grand Collection 1B, Library Labyrinth 16085a, `gmw`; docs/phase7-wave3.md
 * §3.36): a shared card's ability counted separately for each player who uses it.
 */
export const oncePerRoundPerPlayer: AbilityLimit = { count: 1, period: "round", per: "player" };
/** "(Limit once per phase.)" (Super Speed, Quicksilver 14001a). */
export const oncePerPhase: AbilityLimit = { count: 1, period: "phase" };
/**
 * "(Max 1 per event.)", "(Max 1 per attack.)", "(Max 1 per basic power use.)" (Web-Bracelet, Ghost Kick, Phantom Flip,
 * `sm`; docs/phase7-wave5.md §3.14): one use per triggering event instance, shared by every copy of the card's title
 * (RRG 1.8 "Max 1 per [instance]", p. 28). The instance is whatever event the ability triggers on.
 */
export const maxOnePerTriggeringInstance: AbilityLimit = { count: 1, period: "phase", per: "triggeringEvent" };

// ---------------------------------------------------------------------------
// Event patterns: `when.*` for interrupts, `after.*` for responses
// ---------------------------------------------------------------------------

/** Who an event is about, from this card's point of view. */
export type Who = "self" | "host" | TargetQuery;

const asSource = (who: Who): Partial<EventPattern> =>
  who === "self" ? { selfIs: "source" } : who === "host" ? { sourceIs: { hostOfSelf: true } } : { sourceIs: who };
const asTarget = (who: Who): Partial<EventPattern> =>
  who === "self" ? { selfIs: "target" } : who === "host" ? { targetIs: { hostOfSelf: true } } : { targetIs: who };
const pattern = (
  on: TriggerEventKind | readonly TriggerEventKind[],
  ...parts: readonly Partial<EventPattern>[]
): EventPattern => Object.assign({ on }, ...parts) as EventPattern;
const againstYou: Partial<EventPattern> = { playerIs: "controller", usesAttackedPlayer: true };

const enemyAttacks = (
  by: Who,
  opts: { readonly againstYou?: boolean; readonly damages?: boolean } = {},
): EventPattern =>
  pattern(
    "enemyAttack",
    asSource(by),
    opts.againstYou ? againstYou : {},
    opts.damages ? { requireResults: { damage: 1 } } : {},
  );

/** A basic power, as `basicPowerUsing`/`basicPowerUsed` name it. */
type BasicPowerName = "attack" | "thwart" | "defense" | "recover";

export const on = {
  /** "When/After [enemy] attacks (you)" — `by: "self"` for the card's own attacks, `"host"` for the attached enemy. */
  enemyAttacks,
  /** "When the villain (initiates an) attack(s) (against you)". */
  villainAttacks: (opts: { readonly againstYou?: boolean; readonly damages?: boolean } = {}): EventPattern =>
    enemyAttacks({ categories: ["villain"] }, opts),
  /** "When/After [enemy] schemes". */
  enemySchemes: (by: Who): EventPattern => pattern("enemyScheme", asSource(by)),
  /** "After [enemy] schemes or attacks". */
  enemySchemesOrAttacks: (by: Who): EventPattern => pattern(["enemyScheme", "enemyAttack"], asSource(by)),
  /**
   * "When/After [enemy] activates (against you)": its attacks and its schemes, from the villain phase or from a card
   * (RRG 1.8 "Activation", p. 6: "Some card abilities can also cause enemies to attack or scheme. These are also
   * considered activations"; docs/phase7-wave5.md §4.1 Q67). `againstYou`: an attack initiated against you (not the
   * defender's player, as `enemyAttacks`) or a scheme against you. Not "when X would activate" (`enemyActivating`).
   */
  enemyActivates: (by: Who, opts: { readonly againstYou?: boolean } = {}): EventPattern =>
    pattern(["enemyAttack", "enemyScheme"], asSource(by), opts.againstYou ? againstYou : {}),
  /** A player-side attack (basic or ability): "after X attacks", "after your hero attacks and defeats an enemy". */
  attacks: (
    by: Who,
    opts: {
      readonly target?: TargetQuery;
      readonly basic?: boolean;
      readonly defeats?: boolean;
      readonly damages?: boolean;
      /**
       * "After you deal excess damage to an enemy" ("Murdered You!", Rocket Raccoon's hero identity, `gmw`
       * 16029a): the attack's own `excessDealt` result, set whenever an attack's target takes more damage than its
       * remaining hit points: the value overkill would spill (RRG 1.8 "Overkill", p. 31, superseding ruling
       * Jan 26, 2026 (3); `resolve/event.ts` `excessDamageOf`).
       */
      readonly excessDamage?: boolean;
    } = {},
  ): EventPattern => {
    const results: Record<string, number> = {};
    if (opts.defeats) results.defeated = 1;
    if (opts.damages) results.damage = 1;
    if (opts.excessDamage) results.excessDealt = 1;
    return pattern(
      "attack",
      asSource(by),
      opts.target ? { targetIs: opts.target } : {},
      opts.basic ? { attackKind: "basic" } : {},
      Object.keys(results).length ? { requireResults: results } : {},
    );
  },
  /** "After X thwarts"; `basic`: "X makes a **basic** thwart" (Entangling Vines, `gmw` 16008). */
  thwarts: (by: Who, opts: { readonly basic?: boolean } = {}): EventPattern =>
    pattern("thwart", asSource(by), opts.basic ? { attackKind: "basic" } : {}),
  /** "When/After X attacks or thwarts" (Cosmo, Adam Warlock, `stld`): either player-side power, by source. */
  attacksOrThwarts: (by: Who): EventPattern => pattern(["attack", "thwart"], asSource(by)),
  /**
   * "When/After the player/villain phase begins" (Museum Ship, Nebula's Ship, Blazing Inferno, Sibling Rivalry,
   * the Kree Fanatic's Ronan; docs/phase7-wave3.md §3.2). Interrupt and response windows both read this pattern;
   * which one the ability resolves as is the builder (`interrupt`/`response`/`forcedResponse`) it's passed to.
   */
  phaseBeginning: (phase: "player" | "villain"): EventPattern => pattern("phaseBeginning", { eventIs: { phase } }),
  /**
   * "When/After the [player/villain] phase ends" / "When/After the round ends" (the villain phase's end *is* the
   * round's end, RRG 1.8 "Villain Phase" p. 47 step 6b; docs/phase7-wave3.md §3.2): Rogue Vessel, the Collector's
   * ∞ face, Regroup.
   */
  phaseEnding: (phase: "player" | "villain"): EventPattern => pattern("phaseEnding", { eventIs: { phase } }),
  /**
   * "After resolving step one of the villain phase" (docs/phase7-wave3.md §3.2): a response-only window, once per
   * villain phase, regardless of how much threat step one placed or whether it placed any. Fixes the wave 2 bug
   * the same doc section names — None Shall Pass 1B, Hunting Down Heroes, The Mad Doctor 2B previously matched
   * every `threatPlaced` on the main scheme instead.
   */
  villainStepResolved: (step: "placeThreat" = "placeThreat"): EventPattern =>
    pattern("villainStepResolved", { eventIs: { step } }),
  /**
   * "After [defender] defends (against an enemy attack)". `takingNoDamage`: "…and take no damage" — the attack must
   * have dealt the defender no damage, checked as part of the trigger condition, so the ability is never offered
   * and its cost is never paid when it did (FAQ "Unflappable (#20)", RRG 1.8 p. 60). The `defended` response window
   * is deferred to the end of the attack and carries that attack's own results, so damage from a Boost ability
   * during the same attack does not count against it.
   */
  defends: (defender: TargetQuery, opts: { readonly takingNoDamage?: boolean } = {}): EventPattern =>
    pattern("defended", { targetIs: defender }, opts.takingNoDamage ? { resultsAtMost: { damage: 0 } } : {}),
  /** "After X enters play". */
  entersPlay: (what: Who): EventPattern => pattern("cardEntersPlay", asTarget(what)),
  /** "After you play [this card]" — playing, not merely putting into play. */
  youPlayThis: (): EventPattern => pattern("cardPlayed", { selfIs: "target" }),
  /**
   * "Interrupt: When you play [an X card]" (Superhuman Agility, 04031a) — the point of playing, before it resolves
   * (`cardBeingPlayed`, interruptible unlike `cardPlayed`/`cardEntersPlay`). `what` filters which played card.
   */
  youPlay: (what: TargetQuery): EventPattern => pattern("cardBeingPlayed", { targetIs: what, playerIs: "controller" }),
  /**
   * "After you play an [X] card" (Morphogenetics, `msm` 05001a; Finesse/Precision, Gamora's own identity, `gam`
   * 18001a) — the response twin of `youPlay`: `cardPlayed`, announced once the play has resolved, rather than
   * `cardBeingPlayed`'s interrupt-time point. `what` filters which played card ("an attack event" is `query("event",
   * { trait: ATTACK })`). Promoted from the local `afterYouPlay`/`whenYouPlay` pattern `msm/kit.ts` composed by hand
   * before this builder existed.
   */
  youPlayedCard: (what: TargetQuery): EventPattern => pattern("cardPlayed", { targetIs: what, playerIs: "controller" }),
  /**
   * "After **a player** plays [X]" (Knowhere, `stld` 17022: "after a player plays a guardian ally") — no `playerIs`
   * scope, unlike `youPlayThis`'s hardcoded "you"; the player who played it is named with `eventPlayer`.
   */
  cardPlayed: (what: TargetQuery): EventPattern => pattern("cardPlayed", { targetIs: what }),
  /**
   * "When X would take damage" / "after X takes damage" (`taken`: some damage was actually dealt). `consequential`:
   * "When X would take any amount of consequential damage" (Field Agent, `sm` 27044) — an ally's consequential damage
   * from an attack or a thwart alike (`EventPattern.consequential`, docs/phase7-wave5.md §4.1 Q62); `false` excludes it.
   */
  damage: (
    to: Who,
    opts: { readonly fromAttack?: boolean; readonly taken?: boolean; readonly consequential?: boolean } = {},
  ): EventPattern =>
    pattern(
      "dealDamage",
      asTarget(to),
      opts.fromAttack !== undefined ? { fromAttack: opts.fromAttack } : {},
      opts.consequential !== undefined ? { consequential: opts.consequential } : {},
      opts.taken ? { requireResults: { amount: 1 } } : {},
    ),
  /**
   * "After [ally] takes consequential damage from performing an attack[, if that attack defeated an enemy]" (Martyr,
   * `drax` 19012; docs/phase7-wave3.md §3.44). An ally's consequential damage carries the results of the basic power it
   * follows as `attack.*` / `thwart.*` (`made`, `damage`, `defeated`, …), and only that damage does, so `from` alone
   * says "consequential damage from an attack/thwart". "Takes" is damage taken (a tough status card that absorbs it
   * means none was taken). `defeated`: the attack defeated its target.
   */
  consequentialDamage: (
    to: Who,
    opts: { readonly from: "attack" | "thwart"; readonly defeated?: boolean },
  ): EventPattern =>
    pattern("dealDamage", asTarget(to), {
      requireResults: {
        amount: 1,
        [`${opts.from}.made`]: 1,
        ...(opts.defeated ? { [`${opts.from}.defeated`]: 1 } : {}),
      },
    }),
  /**
   * "Each time / After **you** deal any amount of damage to [an enemy]" (Schadenfreude, `gmw` 16032; docs/phase7-
   * wave3.md §3.30). "You" is your identity where able (RRG 1.8 "You, Your", p. 49; ruling, Dec 17, 2025 (3)): your
   * identity's attacks and effects, and the cards p. 49 calls "an extension of a player's identity" — events you
   * play, resources you spend, upgrades you control. **Not** allies or supports ("not considered to be performed by
   * that player's identity"). Known gap: an upgrade attached to a *different* friendly character is not an
   * extension either, and this query still counts it (no printed card needs the case yet). "Deal" is damage
   * **dealt**, not taken: prevention reduces what the target takes, "but the amount of damage 'dealt' is not
   * reduced" (RRG 1.8 "Prevent", p. 35), so the event's own amount is read (`eventAtLeast`), not its `amount` result.
   */
  youDealDamage: (to: Who): EventPattern =>
    pattern(
      "dealDamage",
      { sourceIs: { controller: "you", categories: ["identity", "event", "resource", "upgrade"] } },
      asTarget(to),
      { eventAtLeast: { amount: 1 } },
    ),
  /** "When threat would be placed on a scheme" / "after placing threat here". */
  threatPlaced: (where?: Who): EventPattern => pattern("placeThreat", where ? asTarget(where) : {}),
  /** "When a [treachery] card is revealed from the encounter deck". */
  encounterCardRevealed: (what?: TargetQuery): EventPattern =>
    pattern("encounterCardRevealing", what ? { targetIs: what } : {}),
  /**
   * "After you reveal an encounter card" (Venom, `sm` 27190): heard once every step of the reveal has completed, the
   * card's When Revealed abilities and a treachery's discard included (RRG 1.8 "Reveal", p. 38: "Responses … to any
   * step of the revealing of an encounter card are not resolved until after all steps of the reveal process have been
   * completed"). "That card" is `eventTarget`, wherever step 2 or 4 left it.
   */
  youRevealEncounterCard: (what?: TargetQuery): EventPattern =>
    pattern("cardRevealed", { playerIs: "controller" }, what ? { targetIs: what } : {}),
  /**
   * "After you resolve a treachery" (Spider-Man Noir, `spdr` 31015): a treachery you revealed has resolved — one or
   * more of its abilities, surge and incite included, resolved (RRG 1.8 "Resolve", p. 37); a cancelled one has not
   * (FAQ "Spider-Man Noir (#15)", p. 63). Heard after reveal step 4 and before any surge card is revealed; "that
   * treachery" is `eventTarget`. `inDiscard`: only while step 4 left it in the encounter discard pile, not where its own
   * When Revealed moved it ("attach that treachery" takes it from there). `what` narrows the card (default: a
   * treachery).
   */
  youResolveTreachery: (opts: { readonly what?: TargetQuery; readonly inDiscard?: boolean } = {}): EventPattern =>
    pattern(
      "encounterCardResolved",
      { playerIs: "controller", targetIs: opts.what ?? { categories: ["treachery"] } },
      opts.inDiscard ? { eventIs: { to: "encounterDiscard" } } : {},
    ),
  /** "When/After X is defeated"; `byYou`: "after *you* defeat a minion". */
  /**
   * "After Abjuration prevents 2 or more damage from a single attack" (docs/phase7-wave4.md §3.20): this card prevented
   * damage — by its `preventAllDamageTo` constant or a `preventDamage` effect of its own. `fromAttack`: the damage was an
   * attack's; `atLeast`: at least that much was prevented at once.
   */
  thisPreventsDamage: (opts: { readonly fromAttack?: boolean; readonly atLeast?: number } = {}): EventPattern =>
    pattern(
      "damagePrevented",
      { selfIs: "source" },
      opts.fromAttack !== undefined ? { fromAttack: opts.fromAttack } : {},
      opts.atLeast !== undefined ? { eventAtLeast: { amount: opts.atLeast } } : {},
    ),
  defeated: (
    what: Who,
    opts: {
      readonly byYou?: boolean;
      /**
       * "When an ally is defeated **by an enemy attack**" (Regroup, `drax` 19032; docs/phase7-wave3.md §3.45): the
       * defeating damage was attack damage from a card matching this query — `{ categories: ["enemy"] }`.
       */
      readonly byAttackFrom?: TargetQuery;
      /**
       * "After the enemy **with Death-Glow** is defeated" (Flight of the Valkyrior, Valhalla; docs/phase7-wave4.md
       * §3.22): a card matching this was attached when the defeat was initiated, read after the character left play.
       */
      readonly withAttachment?: TargetQuery;
    } = {},
  ): EventPattern =>
    pattern(
      "characterDefeated",
      asTarget(what),
      opts.byYou ? { playerIs: "controller" } : {},
      opts.byAttackFrom ? { fromAttack: true, sourceIs: opts.byAttackFrom } : {},
      opts.withAttachment ? { targetHadAttachment: opts.withAttachment } : {},
    ),
  /**
   * "After [X] (or an event you play) defeats a minion or side scheme" (Small but Mighty, 13001a; docs/phase7-
   * wave2.md §17.2): matches both `characterDefeated` and `schemeDefeated` by *source* — which card dealt the
   * defeating damage or removed the last threat — not by player. `on.defeated({ byYou: true })`'s `playerIs` also
   * accepts an ally's own attack, which a card naming a specific card ("Wasp, or an event") needs to exclude;
   * `source` should therefore name the card(s), not just `controller: "you"` alone.
   */
  defeats: (source: TargetQuery): EventPattern =>
    pattern(["characterDefeated", "schemeDefeated"], { sourceIs: source }),
  /**
   * "When/After [a scheme] is defeated" (a side scheme reaching 0 threat, or a scenario rule's own defeat) —
   * distinct trigger event from `defeated`, which is characters only. "When attached scheme is defeated"
   * (Followed, `cap` pack): `on.schemeDefeated("host")`.
   */
  schemeDefeated: (what: Who): EventPattern => pattern("schemeDefeated", asTarget(what)),
  /**
   * "After this stage is complete/completed" (Kang's stage 3 cards, docs/phase7-wave2.md §3.1) — a *different*
   * stage reacting to another stage's own completion (as opposed to `whenCompleted`, printed on the completing
   * stage itself).
   */
  mainSchemeCompleted: (what: Who): EventPattern => pattern("mainSchemeCompleted", asTarget(what)),
  /**
   * "When this stage would be completed, remove all the threat from this stage instead" (Under Siege / The Armies of
   * Thanos, `mts` 21098b/21099b; Upgrading Adaptoids 1B, `aos` 50104b; docs/phase7-wave4.md §3.4): pair with `instead`
   * on a forced interrupt, `forcedInterrupt(on.mainSchemeCompleting("self"), instead(…))`.
   */
  mainSchemeCompleting: (what: Who): EventPattern => pattern("mainSchemeCompleting", asTarget(what)),
  /**
   * "When an enemy would activate" (Web Binding, `sm` 27006) / "When a villain would activate" (Sinister
   * Synchronization 1B, 27100b), before the activation's attack or scheme (docs/phase7-wave5.md §3.2). `who` narrows the
   * enemy; with no villain in play the villain's step-2 activation names none, so "if no villain is in play" is
   * `on.enemyActivating()` with that condition. Cancel it with `cancelIt()`; "that minion" is `eventTarget`.
   */
  /**
   * "After an acceleration token is placed on this scheme" (Hapless Pedestrians 1B, `sm` 27064b): `"self"` on the scheme
   * (docs/phase7-wave5.md §3.4).
   */
  accelerationTokenPlaced: (on_: Who): EventPattern => pattern("accelerationTokenPlaced", asTarget(on_)),
  enemyActivating: (who?: Who): EventPattern =>
    pattern("enemyActivating", ...(who === undefined ? [] : [asTarget(who)])),
  /**
   * "After the last invocation counter is removed from Fireball" (`mts` 21076–21079) / "When the last lock counter is
   * removed from here" (Holding Cell, `aos` 50105a) / "After the last power counter is removed from here" (Phoenix Force):
   * counters of `counterType` removed from this card by an effect, leaving none (docs/phase7-wave4.md §3.15).
   */
  lastCounterRemoved: (counterType: string): EventPattern =>
    pattern("countersRemoved", { selfIs: "target", eventIs: { counterType }, eventAtMost: { remaining: 0 } }),
  /**
   * "After you place a magnet counter on this scheme" (Asteroid M, `mut_gen` 32141b, errata RRG 1.8 p. 68) / "After a
   * power counter is placed here" (Phoenix Force, `phoenix` 34002b): counters of `counterType` placed on `where` (absent:
   * any card) by an effect, or moved onto it (docs/phase7-wave6.md §3.2). Once per placement, the number placed is
   * `eventAmount` (§4.1 Q8), and the placing player `eventPlayer`. `by: "you"`: only this card's controller's
   * placements; on an encounter card "you" is whoever placed them, so leave it off there.
   */
  countersPlaced: (counterType: string, where?: Who, opts: { readonly by?: "you" } = {}): EventPattern =>
    pattern(
      "countersPlaced",
      { eventIs: { counterType } },
      where === undefined ? {} : asTarget(where),
      opts.by === "you" ? { playerIs: "controller" } : {},
    ),
  /**
   * "After a tough status card is discarded from Colossus" (Iron Will, Organic Steel, `mut_gen` 32004, 32006): a
   * `status` card discarded from `from` (absent: any card), by any route: a tough card used up, piercing, a stun or
   * confuse spent, an effect, a status the card can no longer have (docs/phase7-wave6.md §3.5). Once per card; several
   * discarded at once share one response window (§4.1 Q5), so an ability with no limit answers each and one that
   * exhausts its card answers once. The cause is `eventIs: { cause }` when a card cares.
   */
  statusDiscarded: (status: StatusName, from?: Who): EventPattern =>
    pattern("statusDiscarded", { eventIs: { status } }, from === undefined ? {} : asTarget(from)),
  /**
   * "After you ignore the guard or patrol keyword on a minion" (Acute Control, `mut_gen` 32034) with `["guard",
   * "patrol"]`; "After you ignore the crisis icon on a scheme" (Intangible Interference, 32035) with `["crisis"]`
   * (docs/phase7-wave6.md §3.8). Heard once per card whose keyword or icon would otherwise have stopped an attack or
   * thwart a character of yours made, after that attack or thwart (§4.1 Q6); `eventTarget` is that minion or the card
   * showing the crisis icon ("that minion", "that scheme").
   */
  youIgnore: (ignored: readonly ("guard" | "patrol" | "crisis")[]): EventPattern =>
    pattern("keywordIgnored", { eventIs: { ignored } }, { playerIs: "controller" }),
  /**
   * "When [this ally] leaves play" (Spider-Man (Hobie Brown), Ghost-Spider, `sm` 27017, 27048) with `"self"`, or "After
   * a [Web-Warrior] ally leaves play" (Web of Life and Destiny 27023) with a query; the ability's trigger kind picks
   * the window (docs/phase7-wave5.md §3.13). Leaving is any departure (defeat, discard, hand, deck, victory display,
   * removal). An interrupt sees the card still in play, with its attachments and counters, and a response sees it gone
   * (§4.1 Q17); a query's traits are the card's as it left.
   */
  leavesPlay: (who: Who): EventPattern => pattern("cardLeavesPlay", asTarget(who)),
  /**
   * "When a player card would be placed into a discard pile from play" (Pinpoint, `ironheart` 29035): a card leaving
   * play for a player's discard pile, by any route (a defeat, a discard effect or cost, a move to the discard pile, an
   * attachment going with its host). Only player cards go there (RRG 1.8 "Discard", p. 16: a player card to its
   * owner's discard pile, an encounter card to the encounter discard pile). Event cards never match: they resolve from
   * out of play and are never in play (RRG 1.8 "In Play and Out of Play", p. 23). With `instead(...)` it is a
   * replacement (RRG 1.8 "Replacement Effect", p. 37): the leaving is cancelled and the card moves where the effects say.
   */
  playerCardDiscardedFromPlay: (): EventPattern => pattern("cardLeavesPlay", { eventIs: { to: "discard" } }),
  /**
   * "When the attached card is defeated" on a card that attaches to a minion or a side scheme (Wrist Navigator, `sm`
   * 27189a; docs/phase7-wave5.md §3.30): a character's defeat or a scheme's, the host still attached as it opens. A
   * permanent attachment then stays in play, unattached, in its controller's play area.
   */
  attachedCardDefeated: (): EventPattern => pattern(["characterDefeated", "schemeDefeated"], asTarget("host")),
  /**
   * "When you would draw or discard an encounter card from your deck" (Maze of Mirrors / Edge of Reality 1B/2B, `sm`
   * 27087b/27088b; docs/phase7-wave5.md §3.5): any player's, named with `eventPlayer`; "it" is `eventTarget`. Heard
   * after the whole draw (MC27 p. 21 FAQ). `how` narrows it to a draw or a discard.
   */
  encounterCardFromPlayerDeck: (how?: "draw" | "discard"): EventPattern =>
    pattern("encounterCardFromPlayerDeck", ...(how ? [{ eventIs: { how } }] : [])),
  /**
   * "After this card enters your hand" (Infiltration, Shapeshifter Surprise, `mut_gen` 32082-32083;
   * docs/phase7-wave6.md §3.10): however it enters a hand (drawn, searched for, returned, moved there). Pair with
   * `inHand(...)`; "you" is the player whose hand it entered.
   */
  thisEntersYourHand: (): EventPattern => pattern("cardEntersHand", { selfIs: "target" }),
  /**
   * "After you resolve a boost card during [enemy]'s activation" (Mysterio I–III, `sm` 27084–27086; docs/phase7-wave5.md
   * §3.5): after its Boost ability and its icon count, before it is discarded. "That card" is `eventTarget`, "you"
   * `eventPlayer`.
   */
  boostCardResolved: (during: Who): EventPattern => pattern("boostCardResolved", asSource(during)),
  /** "After your deck runs out of cards" (Soul World, `mts` 21033; docs/phase7-wave4.md §3.11): your deck reset. */
  yourDeckRunsOut: (): EventPattern => pattern("deckRanOut", { playerIs: "controller", eventIs: { deck: "player" } }),
  /** "After a player resets their deck" (Universal Church of Truth, 21068): any player's; name them with `eventPlayer`. */
  aPlayerResetsTheirDeck: (): EventPattern => pattern("deckRanOut", { eventIs: { deck: "player" } }),
  /** "After the infinity stone deck runs out" (Thanos I–III, 21111–21113): a scenario deck by name. */
  scenarioDeckRunsOut: (name: string): EventPattern => pattern("deckRanOut", { eventIs: { deck: "scenario", name } }),
  /**
   * "After Loki is swapped with a set-aside Loki villain" (Loki's Cape, `mts` 21172): the `villainSwapped` event
   * `EffectSpec swapVillain` announces (docs/phase7-wave4.md §3.7; `packages/engine/src/villain-swap.test.ts`'s own
   * `villainSwapped` trigger). There is only ever one villain in play whenever this fires, so no `Who` scope is
   * needed to say which one — the same reading `on.mainSchemeCompleted` gives a scenario with one main scheme.
   */
  villainSwapped: (): EventPattern => pattern("villainSwapped"),
  /** "After you change to this form". */
  youChangeForm: (): EventPattern => pattern("formChanged", { playerIs: "controller" }),
  /**
   * "After **a player** changes to [hero/alter-ego] form" (Taskmaster I–III, 04093–04095) — no `playerIs` scope, so
   * this is "a player", not "you" (`on.youChangeForm`'s own hardcoded scope). Name them with `eventPlayer`.
   */
  playerChangesForm: (to: "hero" | "alterEgo"): EventPattern =>
    pattern("formChanged", { eventIs: { to, change: "identity" } }),
  /**
   * "After you change to this form" printed on an **identity face** whose player also has additional forms (Spectrum,
   * Vision): the hero/alter-ego change only, never an energy or mass form change (docs/phase7-wave4.md §3.1). Plain
   * `youChangeForm` hears both, which is what "After you change form" (Moxie) means (RRG 1.8 "Form, Change Form", p. 21).
   */
  youChangeIdentityForm: (): EventPattern =>
    pattern("formChanged", { playerIs: "controller", eventIs: { change: "identity" } }),
  /**
   * "After you change to this energy form" / "After you change to this mass form" printed on the form card itself (Gamma,
   * Dense): an additional form change that turned this card's face up (docs/phase7-wave4.md §3.1).
   */
  youChangeToThisForm: (): EventPattern =>
    pattern("formChanged", { playerIs: "controller", selfIs: "target", eventIs: { change: "additional" } }),
  /** "After you change energy forms" / "After you change mass form" (Density Control, `vision` 26007): any change of that type. */
  youChangeAdditionalForm: (formType: string): EventPattern =>
    pattern("formChanged", { playerIs: "controller", eventIs: { change: "additional", formType } }),
  /** "After your turn begins" (Quinjet, `cap` pack). */
  yourTurnBegins: (): EventPattern => pattern("turnStarted", { playerIs: "controller" }),
  /**
   * "After you use a basic power" (Quicksilver's Super Speed, Captain Marvel ally 04032, Rapid Growth; docs/phase7-
   * wave2.md §3.11). The engine's `EventPattern` has no field to narrow by *which* power (attack/thwart/defense/
   * recover) — every wave 2 card needing this reacts to any basic power, so no filter is needed today; a future
   * card that needs one is a `game-rules-architect` follow-up (`TriggerEventBody.basicPowerUsed`'s `power` field
   * would need to be exposed on `EventPattern`).
   */
  basicPowerUsed: (who: Who): EventPattern => pattern("basicPowerUsed", asTarget(who)),
  /**
   * "When you use one of your hero's basic powers (THW, ATK, or DEF)" (Rapid Growth 13005, Venom's Pistol;
   * docs/phase7-wave2.md §17.4) — the *interrupt* twin of `basicPowerUsed`, pushed before the power's own value is
   * read, which is what "get +N to that power for this use" (`modifyBasicPower`) needs to precede. `power` narrows
   * to one named power ("your basic ATK") via `eventIs`; omit it for "one of … (THW, ATK, or DEF)", which reacts to
   * any of the three (recovery has no event frame of its own — see the engine docblock on `basicPowerUsing`).
   */
  basicPowerUsing: (
    who: Who,
    opts: {
      /** One power, or several: `["attack", "thwart"]` is "When X attacks or thwarts" (Machine Man, §3.36 of wave 4). */
      readonly power?: BasicPowerName | readonly BasicPowerName[];
    } = {},
  ): EventPattern => pattern("basicPowerUsing", asTarget(who), opts.power ? { eventIs: { power: opts.power } } : {}),
  /** "When attached character would ready" (Frozen in Time; docs/phase7-wave2.md §3.11). */
  cardReadying: (what: Who): EventPattern => pattern("cardReadying", asTarget(what)),
  /**
   * "Hero Response: After you ready Quicksilver, ready this card." (Friction Resistance, `qsv` 14009): the "-ed"
   * twin of `cardReadying`, an announcement pushed only once a ready actually happens (a "cannot ready" rule in
   * play, or a card already ready, announces nothing — docs/phase7-wave2.md §21). The readied card is the event's
   * own target, matching `cardReadying`; "after **you** ready X" is said by the query's own `controller: "you"`.
   */
  cardReadied: (what: Who): EventPattern => pattern("cardReadied", asTarget(what)),
  /** "When boost icons on an encounter card would be counted" (Chaos Control, Crest; docs/phase7-wave2.md §3.6). */
  boostIconsCounted: (): EventPattern => pattern("boostIconsCounting", {}),
  /**
   * "When/After you spend this card [to play X]" (docs/phase7-wave2.md §12) — a card spent from hand as a resource.
   * `toPlay` narrows it to paying for a card being played that matches ("to play an Attack event", "to play an
   * ally"); an ability's cost or an effect's "spend X resources" never matches it. Works from the discard pile: the
   * engine keeps the spent card's own ability on this event live while it resolves (RRG 1.8 "Resource Card", p. 37).
   * "For a player" / "that player" is `PlayerRef { kind: "eventPlayer" }`.
   */
  youSpendThis: (opts: { readonly toPlay?: TargetQuery } = {}): EventPattern =>
    pattern(
      "resourcesSpent",
      { selfIs: "source", playerIs: "controller" },
      opts.toPlay ? { targetIs: opts.toPlay, eventIs: { purpose: "playCard" } } : {},
    ),
  /**
   * "After [a player] generates any number of resources" (docs/phase7-wave5.md §3.25), once per payment per player who
   * generated at least 1; the number generated is `eventAmount`, the player `eventPlayer`. `by: "engaged"`: "the
   * engaged player" (M.O.R.B.I.U.S., `spdr` 31027 errata, RRG 1.8 p. 68), the player this card is engaged with;
   * `by: "you"`: this card's controller (or, on an encounter card, its "you"); absent: any player.
   */
  resourcesGenerated: (opts: { readonly by?: "you" | "engaged" } = {}): EventPattern =>
    pattern(
      "resourcesGenerated",
      opts.by === "you" ? { playerIs: "controller" } : {},
      opts.by === "engaged" ? { playerIn: { kind: "engagedWith", of: { kind: "self" } } } : {},
    ),
} as const;

/** Interrupt wording: `heroInterrupt(when.villainAttacks({ againstYou: true }), …)`. */
export const when = on;
/** Response wording: `forcedResponse(after.entersPlay("self"), …)`. */
export const after = on;
