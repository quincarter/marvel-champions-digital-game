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
  PlayerRef,
  TraitGrantSpec,
  TriggerEventKind,
  TypedResource,
} from "@mc/engine";
import { flatten, ifThen, type EffectArg } from "./effects.js";
import { isAlterEgo, isHero, type Amount, type AttackKeyword } from "./values.js";

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
  /** Actions only: a condition printed before the cost ("If you are in Tiny hero form, exhaust … →"). */
  readonly while?: Predicate;
  /**
   * "First Player Action:" / "First Player Interrupt:" (docs/phase7-wave3.md §3.13, the Milano/Kree Command Ship):
   * only the first player may use it, and an optional first-player interrupt/response on an encounter card is
   * offered to the first player rather than to the player the event names.
   */
  readonly firstPlayerOnly?: boolean;
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
    },
    options,
    effects,
  );
};
/** "Hero Action:" */
export const heroAction = (...args: Args): AbilityDefinition => {
  const { options, effects } = split(args);
  return build({ kind: "action", form: "hero", ...(options.while ? { while: options.while } : {}) }, options, effects);
};
/** "Alter-Ego Action:" */
export const alterEgoAction = (...args: Args): AbilityDefinition => {
  const { options, effects } = split(args);
  return build(
    { kind: "action", form: "alterEgo", ...(options.while ? { while: options.while } : {}) },
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
export const resource = (
  generates: ResourceGeneration,
  options: AbilityOptions & {
    readonly form?: Form;
    readonly generatesFor?: TargetQuery;
    readonly forAnyPlayer?: boolean;
  } = {},
): AbilityDefinition => {
  const { form, generatesFor, forAnyPlayer, ...rest } = options;
  const definition = build(
    { kind: "resource", ...(form ? { form } : {}), ...(forAnyPlayer ? { forAnyPlayer: true } : {}) },
    rest,
    [],
    generates,
  );
  return generatesFor ? { ...definition, generatesFor } : definition;
};
/** "Hero Resource:" */
export const heroResource = (
  generates: ResourceGeneration,
  options: AbilityOptions & { readonly generatesFor?: TargetQuery } = {},
): AbilityDefinition => resource(generates, { ...options, form: "hero" });

const triggered =
  (kind: "interrupt" | "response", forced: boolean, form?: Form) =>
  (on: EventPattern, ...args: Args): AbilityDefinition => {
    const { options, effects } = split(args);
    return build(
      { kind, forced, on, ...(form ? { form } : {}), ...(options.firstPlayerOnly ? { firstPlayerOnly: true } : {}) },
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
}

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
      ...(costModifiers.length ? { costModifiers } : {}),
      ...(paymentOnly.length ? { paymentOnly } : {}),
      ...(spendableInList[0] ? { spendableIn: spendableInList[0] } : {}),
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
 * "Heroes and allies cannot be readied by player card effects" (Unnatural Storm, `mts` 21159;
 * docs/phase7-wave4.md §3.19): the end-of-phase ready and encounter card effects still ready them.
 */
export const cannotBeReadiedByPlayerCards = (target: TargetQuery): ConstantPart =>
  rule({ kind: "cannotReady", target, bySource: "playerCard" });
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
/** "You cannot choose to discard this card from your hand." (System Shock): `inHand(constant(cannotChooseToDiscard))`. */
export const cannotChooseToDiscard: ConstantPart = { rules: [{ kind: "cannotChooseToDiscard" }] };
export const focusedMainScheme = (): ConstantPart => rule({ kind: "focusedMainScheme", scheme: { kind: "host" } });
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
export const blanksTextBox = (target: TargetQuery, opts: { readonly while?: Predicate } = {}): ConstantPart => ({
  rules: [{ kind: "blankTextBox", target, ...(opts.while ? { while: opts.while } : {}) }],
});
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
export const discardTopOfDeckCost = (n = 1): AbilityCost => ({ discardFromDeck: n });
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
 * "Discard N card(s) at random from your hand →" (Magic Crowbar: `[exhaustYourHero, discardRandomFromHandCost(1)]`).
 * The engine picks with the game's seeded RNG when the cost is paid; nothing is chosen by the player or bound.
 */
export const discardRandomFromHandCost = (n = 1): AbilityCost => ({ discardRandomFromHand: n });
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
  return {
    slot: opts.slot ?? defaultSlot,
    query: q,
    min,
    ...(max !== "any" ? { max } : {}),
    ...(opts.bind ? { bind: opts.bind } : {}),
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
       * 16029a): the attack's own `excessDealt` result (RRG 1.8 "Excess Damage", p. 19), set whenever an attack
       * deals more damage than its target's remaining hit points (`resolve/event.ts`).
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
  /** "When X would take damage" / "after X takes damage" (`taken`: some damage was actually dealt). */
  damage: (to: Who, opts: { readonly fromAttack?: boolean; readonly taken?: boolean } = {}): EventPattern =>
    pattern(
      "dealDamage",
      asTarget(to),
      opts.fromAttack !== undefined ? { fromAttack: opts.fromAttack } : {},
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
  /** "When/After X is defeated"; `byYou`: "after *you* defeat a minion". */
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
   * "After the last invocation counter is removed from Fireball" (`mts` 21076–21079) / "When the last lock counter is
   * removed from here" (Holding Cell, `aos` 50105a) / "After the last power counter is removed from here" (Phoenix Force):
   * counters of `counterType` removed from this card by an effect, leaving none (docs/phase7-wave4.md §3.15).
   */
  lastCounterRemoved: (counterType: string): EventPattern =>
    pattern("countersRemoved", { selfIs: "target", eventIs: { counterType }, eventAtMost: { remaining: 0 } }),
  /** "After your deck runs out of cards" (Soul World, `mts` 21033; docs/phase7-wave4.md §3.11): your deck reset. */
  yourDeckRunsOut: (): EventPattern => pattern("deckRanOut", { playerIs: "controller", eventIs: { deck: "player" } }),
  /** "After a player resets their deck" (Universal Church of Truth, 21068): any player's; name them with `eventPlayer`. */
  aPlayerResetsTheirDeck: (): EventPattern => pattern("deckRanOut", { eventIs: { deck: "player" } }),
  /** "After the infinity stone deck runs out" (Thanos I–III, 21111–21113): a scenario deck by name. */
  scenarioDeckRunsOut: (name: string): EventPattern => pattern("deckRanOut", { eventIs: { deck: "scenario", name } }),
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
    opts: { readonly power?: "attack" | "thwart" | "defense" | "recover" } = {},
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
} as const;

/** Interrupt wording: `heroInterrupt(when.villainAttacks({ againstYou: true }), …)`. */
export const when = on;
/** Response wording: `forcedResponse(after.entersPlay("self"), …)`. */
export const after = on;
