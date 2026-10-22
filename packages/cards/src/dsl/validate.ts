import {
  GRANTED_BY_SLOT,
  inPlayPicksOf,
  tuckedPickOf,
  isResourcesChoice,
  playableAsIfInHandOf,
  hearsEncounterDeckDiscard,
  MOMENT_PREFIX,
  PAID_FOR_SLOT,
  TOGETHER_TARGETS_SLOT,
  UNRESOLVED_VAR,
  type AbilityCost,
  type AbilityDefinition,
  type AbilityRegistry,
  type CardSelector,
  type EffectSpec,
  type EventPattern,
} from "@mc/engine";

/**
 * A private marker for `allowUnlabeledAttack`'s opt-out (below). A symbol key never appears in `Object.entries`/
 * `Object.keys`, so it is invisible to `checkPlain`'s "is this JSON?" walk and to `bindsOf`'s field scan, and it is
 * dropped by `structuredClone` if a definition object is ever cloned — it never reaches the engine as data.
 */
const UNLABELED_ATTACK = Symbol("ability-scripting-engineer: unlabeled attack, see allowUnlabeledAttack");

/**
 * Opts one ability out of `checkLabels`'s "an attack effect belongs to an (attack)-labeled ability" rule.
 *
 * The rule holds for almost every Core and wave 1 card: a stunned identity cancels a labeled ability's attack
 * outright, so the engine needs the label to know what a stun touches. **Dance of Death** is the documented
 * exception: it prints no "(attack)" label at all, and FAQ "Dance of Death (#4)" (RRG 1.8 p. 59) rules that its
 * first sentence "defines each damage-dealing effect ... as an individual attack" anyway, with a stun cancelling
 * only the first of the three. `dsl/validate.ts` cannot tell that apart from a card that simply forgot its label,
 * so the opt-out must be requested by name, with a citation, right where the ability is defined — never a blanket
 * relaxation of the check.
 *
 * Use only when a card's own text (or an FAQ ruling on it) makes an unlabeled attack effect correct; every other
 * ability with an `attack` effect must still carry `{ label: "attack" }`.
 */
export function allowUnlabeledAttack<T extends AbilityDefinition>(
  definition: T,
  reason: { readonly citation: string },
): T {
  if (!reason.citation.trim()) throw new Error("allowUnlabeledAttack needs a citation");
  Object.defineProperty(definition, UNLABELED_ATTACK, { value: true, enumerable: false, configurable: false });
  return definition;
}

const hasUnlabeledAttackOptOut = (definition: AbilityDefinition): boolean =>
  (definition as unknown as Record<symbol, unknown>)[UNLABELED_ATTACK] === true;

/**
 * Shape validation for compiled abilities. The engine trusts its registry, so
 * authoring mistakes that TypeScript can't see are caught here, when a card
 * module is defined:
 * - the definition is plain JSON (no `undefined`, functions, NaN);
 * - triggers are well formed (interrupts/responses have a pattern, constants have no effects);
 * - "(attack)"/"(thwart)" labels have a matching attack/thwart effect;
 * - every slot or var an effect reads was bound earlier (by a cost, a choice, or a `bind`).
 */
export function validateDefinition(definition: AbilityDefinition): readonly string[] {
  const problems: string[] = [];
  checkPlain(definition, "definition", problems);
  checkTrigger(definition, problems);
  checkLabels(definition, problems);
  checkBoostCards(definition, problems);
  checkMoments(definition, problems);
  checkEncounterDeckDiscard(definition, problems);
  checkSchemeDivert(definition, problems);
  checkCardTotals(definition, problems);
  checkFinds(definition, problems);
  checkPreparations(definition, problems);
  checkBorrowedBoosts(definition, problems);
  checkAttackPrevention(definition, problems);
  checkRearranges(definition, problems);
  checkRandomPicks(definition, "definition", problems);
  checkEncounterTopIcons(definition, "definition", problems);
  checkHiddenPiles(definition, problems);
  checkCampaignLogReads(definition, "definition", problems);
  checkPlays(definition, problems);
  checkNextCardCost(definition, problems);
  checkOwnerZones(definition, "definition", problems);
  checkCollectionSearches(definition, "definition", problems);
  checkTuckReplacement(definition, problems);
  checkAttachReplacement(definition, problems);
  checkLeaveReplacement(definition, problems);
  checkBoostCardDestination(definition, problems);
  checkTraitReveal(definition, problems);
  checkAttackUsedAtk(definition, problems);
  checkAttackKeywordLoss(definition, "definition", problems);
  checkCounterDivision(definition, problems);
  checkSpendX(definition, problems);
  checkPod(definition, problems);
  checkCompetitiveOnly(definition.effects, false, problems);
  checkCost(definition, problems);
  checkAttackCostRules(definition, problems);
  checkSharedCostRules(definition, problems);
  checkScaled(definition, "definition", problems);
  checkBindings(definition, problems);
  return problems;
}

/**
 * `RuleSpec costsPayableByAnyPlayer` (docs/phase7-wave10-hero-packs.md H3.19): the rule names the cards whose
 * abilities' costs any player may help pay. A query with no clause matches every card in play, which would open every cost on
 * the table to every player; no card prints that, so the slip (`costsPayableByAnyPlayer({})`) is rejected.
 */
function checkSharedCostRules(definition: AbilityDefinition, problems: string[]): void {
  const trigger = definition.trigger;
  if (trigger.kind !== "constant") return;
  for (const rule of trigger.rules ?? []) {
    if (rule.kind !== "costsPayableByAnyPlayer") continue;
    if (Object.keys(rule.card).length === 0)
      problems.push(
        "costsPayableByAnyPlayer: the rule names the card whose costs are shared (default: the attached card); an empty query names every card in play",
      );
  }
}

/**
 * `RuleSpec additionalAttackCost` (docs/phase7-wave10-hero-packs.md H3.16): the cost is paid in a step of its own as
 * the attack is made (engine `attack-cost.ts`), where only a discard of a fixed number of cards from hand is asked
 * and paid. Resources, a pick among cards in play and every other cost part have no way to be asked there.
 */
function checkAttackCostRules(definition: AbilityDefinition, problems: string[]): void {
  const trigger = definition.trigger;
  if (trigger.kind !== "constant") return;
  for (const rule of trigger.rules ?? []) {
    if (rule.kind !== "additionalAttackCost") continue;
    const parts = Object.keys(rule.cost);
    const discard = rule.cost.discardFromHand;
    if (parts.length !== 1 || !discard) {
      problems.push(
        "additionalAttackCost: the cost is a discard from hand (discardFromHandCost(n, n)); nothing else is paid as an attack is made",
      );
      continue;
    }
    if (!Number.isInteger(discard.min) || discard.min < 1 || discard.max !== discard.min)
      problems.push("additionalAttackCost: the discard is of a fixed number of cards, at least 1 (min equal to max)");
    if (discard.bind !== undefined || discard.combined !== undefined)
      problems.push("additionalAttackCost: the discard has no bind and no combined threshold (nothing reads them)");
  }
}

/**
 * `giveBoostCard` is a boost card dealt *outside* an activation, waiting facedown for the enemy's next one (RRG 1.8
 * "Boost, Boost Icon", p. 11). Inside a Boost ability the printed shape is always "1 additional boost card for this
 * activation", which is `modifyAttack({ extraBoostCards })`; the two would resolve differently when the Boost ability
 * belongs to a minion's activation, so the likely slip is rejected. The exception is a Boost that names the enemy
 * receiving the card (anything but the bare default `theVillain`, which `giveBoostCard()` also produces): "Give Magneto a
 * tough status card and a facedown boost card" (M-Type Sentinel, `mut_gen` 32146) gives it to Magneto whichever enemy is
 * activating. A constant count below 1 gives nothing.
 */
function checkBoostCards(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind !== "giveBoostCard") continue;
    if (definition.trigger.kind === "boost" && effect.enemy.kind === "villain") {
      problems.push(
        'giveBoostCard deals a facedown boost card outside an activation; inside a Boost ability use modifyAttack({ extraBoostCards }) for "for this activation"',
      );
    }
    if (effect.count?.kind === "const" && (!Number.isInteger(effect.count.value) || effect.count.value < 1)) {
      problems.push("giveBoostCard: a constant count must be a whole number of at least 1");
    }
    if (effect.card && effect.count) problems.push("giveBoostCard: a chosen card is given once; drop count");
  }
}

/**
 * A named moment (docs/phase7-wave8.md §3.39): the name is all that ties `raiseMoment` to the abilities answering it,
 * so a raise with no name, or a pattern hearing `momentRaised` without naming one (it would answer every moment any
 * card raises), is an authoring slip. So is an interrupt on one: the engine gives a moment a response window only.
 */
function checkMoments(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind === "raiseMoment" && effect.name.trim() === "") problems.push("raiseMoment: a moment needs a name");
  }
  const trigger = definition.trigger;
  if ((trigger.kind !== "interrupt" && trigger.kind !== "response") || !trigger.on) return;
  if (!namesItsMoment(trigger.on)) problems.push("a pattern on momentRaised must name its moment: use on.moment(name)");
  // The moment is announced once what it names is done: it has a response window and nothing left to interrupt.
  if (trigger.kind === "interrupt" && kindsOfPattern(trigger.on).includes("momentRaised"))
    problems.push("an interrupt cannot answer momentRaised: a raised moment has already happened; use a response");
}

/**
 * The pod's shared villain and scheme (docs/phase7-wave9.md §3.66): threat on the shared scheme names which of the two
 * ways of MC55 p. 21 placed it, damage to the shared villain names none, and a constant amount is a whole number of at
 * least 1 (an amount of 0 is never sent).
 */
function checkPod(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind !== "sharedEvent") continue;
    if (effect.event === "schemeThreatPlaced" && effect.cause === undefined)
      problems.push("sharedEvent: threat on the shared scheme names its cause; use placeThreatOnSharedScheme");
    if (effect.event === "villainDamaged" && effect.cause !== undefined)
      problems.push("sharedEvent: damage to the shared villain has no cause");
    if (effect.amount.kind === "const" && (!Number.isInteger(effect.amount.value) || effect.amount.value < 1))
      problems.push("sharedEvent: a constant amount must be a whole number of at least 1");
  }
}

/**
 * `competitiveOnly` stands for printed text a cooperative game never resolves (docs/phase7-wave10.md §3.4), so it sits
 * only where the game mode has already been asked: in the `then` of an `if` on `inCompetitiveMode()` (or the
 * `otherwise` of one on the cooperative mode), at any depth. Anywhere else a cooperative game would reach it and
 * silently do nothing. It carries the printed sentence, which is what lists it.
 */
function checkCompetitiveOnly(effects: readonly EffectSpec[], competitive: boolean, problems: string[]): void {
  for (const effect of effects) {
    if (effect.kind === "competitiveOnly") {
      if (effect.text.trim() === "") problems.push("competitiveOnly: give the printed text it stands for");
      if (!competitive)
        problems.push("competitiveOnly: only in the competitive branch of an if on inCompetitiveMode()");
    }
    if (effect.kind === "if" && effect.condition.kind === "gameMode") {
      const whenTrue = effect.condition.is === "competitive";
      checkCompetitiveOnly(effect.then, competitive || whenTrue, problems);
      checkCompetitiveOnly(effect.otherwise ?? [], competitive || !whenTrue, problems);
      continue;
    }
    for (const list of nestedLists(effect)) checkCompetitiveOnly(list, competitive, problems);
  }
}

/**
 * The printed text of every `competitiveOnly` marker in an ability, in script order: the competitive clauses the
 * script names and does not resolve (docs/phase7-wave10.md §3.4).
 */
export function competitiveOnlyTexts(definition: AbilityDefinition): readonly string[] {
  return allEffects(definition.effects).flatMap((effect) => (effect.kind === "competitiveOnly" ? [effect.text] : []));
}

/**
 * "After a card is discarded from the top of the encounter deck" (docs/phase7-wave9.md §3.43 (b)): the engine gives it
 * a response window only, the deck is no player's (so `playerIs` never matches), and no card answers its own discard
 * from an encounter deck (`inDiscard` is a player deck's).
 */
function checkEncounterDeckDiscard(definition: AbilityDefinition, problems: string[]): void {
  const trigger = definition.trigger;
  if ((trigger.kind !== "interrupt" && trigger.kind !== "response") || !trigger.on) return;
  if (!hearsEncounterDeckDiscard(trigger.on)) return;
  const told = "a pattern on a discard from the encounter deck";
  if (trigger.kind === "interrupt") problems.push(`${told} is a response: the card has already been discarded`);
  if (trigger.on.playerIs !== undefined) problems.push(`${told} cannot ask playerIs: the deck is no player's`);
  if (definition.activeIn === "discard")
    problems.push(`${told} is heard by a card in play: inDiscard answers a player deck's discard only`);
}

const kindsOfPattern = (pattern: EventPattern): readonly string[] =>
  typeof pattern.on === "string" ? [pattern.on] : pattern.on;

/** Whether a pattern that hears `momentRaised` names the moment, itself or in each alternative that hears it. */
function namesItsMoment(pattern: EventPattern): boolean {
  if (!kindsOfPattern(pattern).includes("momentRaised")) return true;
  const name = pattern.eventIs?.name;
  if (typeof name === "string" ? name !== "" : name !== undefined && name.length > 0) return true;
  return pattern.anyOf !== undefined && pattern.anyOf.length > 0 && pattern.anyOf.every(namesItsMoment);
}

/** Cost shapes TypeScript can't see. */
function checkCost(definition: AbilityDefinition, problems: string[]): void {
  const cost = definition.cost;
  if (!cost) return;
  // docs/phase7-wave3.md §3.49: each branch the board may pick is checked as the whole cost it makes.
  for (const variant of costVariants(cost)) checkCostShape(variant, problems);
  // docs/phase7-wave6.md §3.54: the look is a step above the frame being paid for, which a resource ability (paid in the
  // middle of another payment) does not have.
  const looks = [
    cost,
    ...(cost.either ?? []),
    ...(cost.conditional ? [cost.conditional.then, cost.conditional.else] : []),
  ];
  if (definition.trigger.kind === "resource" && looks.some((part) => part.encounterLookDiscard))
    problems.push("cost encounterLookDiscard: not on a resource ability");
  // docs/phase7-wave9.md §3.43 (a): so are the choice of a number and the discard from the encounter deck.
  if (definition.trigger.kind === "resource" && looks.some((part) => part.discardFromEncounterDeck))
    problems.push("cost discardFromEncounterDeck: not on a resource ability");
  // docs/phase7-wave7.md §3.19 (b): the attack is such a step too.
  if (definition.trigger.kind === "resource" && looks.some((part) => part.enemyAttack))
    problems.push("cost enemyAttack: not on a resource ability");
  if (definition.trigger.kind === "resource" && looks.some((part) => part.resolveAbility))
    problems.push("cost resolveAbility: not on a resource ability");
  // `changeFormCost`: the change and its event need the frame being paid for (engine `AbilityCost.changeForm`).
  if (definition.trigger.kind === "resource" && looks.some((part) => part.changeForm !== undefined))
    problems.push("cost changeForm: not on a resource ability");
  if (looks.some((part) => part.changeFormFolded !== undefined))
    problems.push("cost changeFormFolded: the engine's own marker, never scripted");
  // The engine asks for the player a cost deals to only as an action is initiated (`AbilityCost.dealEncounterCardsTo`).
  if (definition.trigger.kind !== "action" && looks.some((part) => part.dealEncounterCardsTo))
    problems.push("cost dealEncounterCardsTo: only on an action (a window cannot ask which player is dealt the card)");
  // The engine asks which character a cost heals only as an action is initiated (`AbilityCost.healCharacter`).
  if (definition.trigger.kind !== "action" && looks.some((part) => part.healCharacter))
    problems.push("cost healCharacter: only on an action (a window cannot ask which character is healed)");
  // The engine asks for a cost's chosen card only as an action is initiated (`AbilityCost.chooseTarget`, H3.5).
  if (definition.trigger.kind !== "action" && looks.some((part) => part.chooseTarget))
    problems.push("cost chooseTarget: only on an action (a window cannot ask which card is chosen)");
  // "Each player exhausts their identity and takes 1 damage →" (`AbilityCost.eachPlayer`, docs/phase7-wave9.md §3.58).
  for (const part of looks) {
    const each = part.eachPlayer;
    if (!each) continue;
    if (!each.exhaustIdentity && each.damageSelf === undefined)
      problems.push("cost eachPlayer: needs exhaustIdentity or damageSelf");
    if (each.damageSelf !== undefined && (!Number.isInteger(each.damageSelf) || each.damageSelf < 1))
      problems.push("cost eachPlayer: damageSelf must be a whole number of at least 1");
    if (each.exhaustIdentity && part.exhaustIdentity)
      problems.push("cost eachPlayer: exhaustIdentity already exhausts the payer's identity; drop the cost's own");
    if (definition.trigger.kind === "resource") problems.push("cost eachPlayer: not on a resource ability");
  }
  for (const part of looks) {
    const floor = part.resolveAbility?.asIf?.remainingHpAtLeast;
    if (floor !== undefined && (!Number.isInteger(floor) || floor < 1))
      problems.push("cost resolveAbility: asIf.remainingHpAtLeast must be a whole number of at least 1");
  }
  if (!cost.conditional) return;
  const { conditional, ...common } = cost;
  for (const branch of [conditional.then, conditional.else]) {
    if (branch.conditional) problems.push("cost conditional: a branch cannot itself be conditional");
    const shared = Object.keys(branch).filter((key) => key in common);
    if (shared.length > 0) problems.push(`cost conditional: a branch repeats the cost's own ${shared.join(", ")}`);
  }
}

/** The concrete costs a written cost can become: one per `conditional` branch (§3.49), else the cost itself. */
function costVariants(cost: AbilityCost): readonly AbilityCost[] {
  if (!cost.conditional) return [cost];
  const { conditional, ...common } = cost;
  return [
    { ...common, ...conditional.then },
    { ...common, ...conditional.else },
  ];
}

function checkCostShape(cost: AbilityCost, problems: string[]): void {
  for (const { mode, pick } of inPlayPicksOf(cost)) {
    const names = {
      exhaust: "exhaustCards",
      ready: "readyCards",
      discard: "discardCards",
      return: "returnToHand",
      damage: "damageCards",
    };
    const tucked = tuckedPickOf(pick);
    const name = tucked ? "discardTucked" : names[mode];
    // "Discard a card tucked here →" (`TuckedCostPick`): a pick among out-of-play cards, so nothing that reads a card
    // in play applies to it.
    if (pick.combined && (tucked || pick.each))
      problems.push(`cost ${name}: combined sums the powers of picked cards in play; not for each or tucked cards`);
    if (tucked && (pick.each || pick.includesSelf || pick.superlative || pick.bindHosts || pick.snapshotStats))
      problems.push(
        `cost ${name}: each, includesSelf, superlative, bindHosts and snapshotStats read cards in play, not tucked cards`,
      );
    // RRG 1.8 "Cost" (p. 14): "A cost requiring 'any number' or 'up to' some number of game elements requires a minimum of one".
    // "This card and up to N others" (`InPlayCostPick.includesSelf`): one pick the card itself is part of.
    if (pick.includesSelf && pick.each)
      problems.push(`cost ${name}: includesSelf is a pick the card is part of, not an each cost`);
    if (pick.includesSelf && mode === "exhaust" && cost.exhaustSelf)
      problems.push(
        `cost ${name}: includesSelf already exhausts this card; with exhaustSelf it would pay twice (RRG 1.8 "Cost", p. 13)`,
      );
    if (pick.each) {
      // "Each support you control" (`InPlayCostPick.each`) takes all that match, none included: no count to bound.
      if (!Number.isInteger(pick.min) || pick.min < 0)
        problems.push(`cost ${name}: an each cost's min must be a whole number of at least 0`);
      if (pick.max !== undefined) problems.push(`cost ${name}: an each cost takes every matching card and has no max`);
      continue;
    }
    if (!Number.isInteger(pick.min) || pick.min < 1)
      problems.push(`cost ${name}: min must be a whole number of at least 1 (RRG 1.8 "Cost", p. 14)`);
    if (pick.max !== undefined && (!Number.isInteger(pick.max) || pick.max < pick.min))
      problems.push(`cost ${name}: max must be a whole number no smaller than min`);
  }
  // `discardFromHand` keeps min 0 legal: "Discard X cards" lets the player choose X (RRG 1.8 "'X' (Value)", p. 29).
  const discard = cost.discardFromHand;
  if (discard && discard.max !== undefined && discard.max < discard.min)
    problems.push("cost discardFromHand: max must be no smaller than min");
  if (discard?.combined) {
    const { atLeast } = discard.combined;
    if (!Number.isInteger(atLeast) || atLeast < 1)
      problems.push("cost discardFromHand combined: atLeast must be a whole number of at least 1");
    // "Any number of … cards with a combined …" still discards at least one (RRG 1.8 "Cost", p. 14).
    if (discard.min < 1) problems.push('cost discardFromHand combined: min must be at least 1 (RRG 1.8 "Cost", p. 14)');
  }
  const random = cost.discardRandomFromHand;
  if (random !== undefined && (!Number.isInteger(random) || random < 1))
    problems.push("cost discardRandomFromHand: must be a whole number of at least 1");
  if (cost.discardRandomFromHandFilter !== undefined && random === undefined)
    problems.push("cost discardRandomFromHandFilter: only narrows a discardRandomFromHand cost");
  // docs/phase7-wave3.md §3.32, §3.33, §3.36.
  const counters = [cost.spendCounters, ...(cost.either ?? []).map((branch) => branch.spendCounters)];
  for (const component of counters) {
    if (
      component?.upTo &&
      typeof component.amount === "number" &&
      (!Number.isInteger(component.amount) || component.amount < 1)
    )
      problems.push(
        'cost spendCounters: an "up to" amount must be a whole number of at least 1 (RRG 1.8 "Cost", p. 14)',
      );
    if (component?.upTo && component.all)
      problems.push('cost spendCounters: a counter cost is either "up to" or "each", not both');
    if (component && typeof component.amount !== "number" && (component.upTo || component.all))
      problems.push('cost spendCounters: an amount read from the board is a fixed X, not "up to" or "each"');
  }
  // docs/phase7-wave6.md §3.53: "place N counters →" places at least one.
  const placed = cost.placeCounters;
  if (placed && (!Number.isInteger(placed.amount) || placed.amount < 1 || placed.counterType === ""))
    problems.push("cost placeCounters: needs a counter type and a whole number of at least 1");
  // docs/phase7-wave6.md §3.54: "look at the top N cards of the encounter deck, discard M of those cards →".
  const look = cost.encounterLookDiscard;
  if (
    look &&
    (!Number.isInteger(look.look) ||
      !Number.isInteger(look.discard) ||
      look.discard < 1 ||
      look.discard > look.look ||
      look.slot === "")
  )
    problems.push("cost encounterLookDiscard: needs a slot and whole numbers with 1 <= discard <= look");
  // docs/phase7-wave9.md §3.43 (a): "discard [a chosen number of] cards from the top of the encounter deck →".
  const fromEncounter = cost.discardFromEncounterDeck;
  if (fromEncounter) {
    if (fromEncounter.slot === "") problems.push("cost discardFromEncounterDeck: needs a slot for the discarded cards");
    if (typeof fromEncounter.amount === "number") {
      if (!Number.isInteger(fromEncounter.amount) || fromEncounter.amount < 1)
        problems.push("cost discardFromEncounterDeck: must be a whole number of at least 1");
    } else {
      const { min, max } = fromEncounter.amount.choose;
      if (!Number.isInteger(min) || min < 1)
        problems.push('cost discardFromEncounterDeck: a chosen number has a min of at least 1 (RRG 1.8 "Cost", p. 14)');
      if (!Number.isInteger(max) || max < min)
        problems.push(
          "cost discardFromEncounterDeck: a chosen number's max must be a whole number no smaller than min",
        );
    }
  }
  // docs/phase7-wave8.md §3.62: "spend up to N resources →" is a size the payer chooses, with nothing overpaid.
  if (isResourcesChoice(cost.resources)) {
    const { min, max } = cost.resources.choose;
    // RRG 1.8 "Cost" (p. 14): "up to" some number "requires a minimum of one".
    if (!Number.isInteger(min) || min < 1)
      problems.push('cost resources choose: min must be a whole number of at least 1 (RRG 1.8 "Cost", p. 14)');
    if (!Number.isInteger(max) || max < min)
      problems.push("cost resources choose: max must be a whole number no smaller than min");
    if (cost.resourcesX) problems.push("cost resources choose: not with resourcesX (two sizes of one payment)");
    if (cost.resourcesEqualTo !== undefined)
      problems.push("cost resources choose: not with resourcesEqualTo (two sizes of one payment)");
  }
  // docs/phase7-wave3.md §3.43: "N resources of the same type" is a generic count.
  if (cost.sameResourceType && (typeof cost.resources !== "number" || cost.resources < 1))
    problems.push("cost sameResourceType: needs `resources` as a whole number of at least 1");
  if (typeof cost.discardFromDeck === "number" && (!Number.isInteger(cost.discardFromDeck) || cost.discardFromDeck < 1))
    problems.push("cost discardFromDeck: must be a whole number of at least 1");
  // "Discard up to N cards from the top of your deck →" (docs/phase7-wave8.md §3.55): at least one, at most `max`.
  if (typeof cost.discardFromDeck === "object" && "choose" in cost.discardFromDeck) {
    const { min, max } = cost.discardFromDeck.choose;
    if (!Number.isInteger(min) || min < 1)
      problems.push('cost discardFromDeck: a chosen size has a min of at least 1 (RRG 1.8 "Cost", p. 14)');
    if (!Number.isInteger(max) || max < min)
      problems.push("cost discardFromDeck: a chosen size's max must be a whole number no smaller than min");
  }
  // "Remove [up to] N threat from [a card] →" (docs/phase7-wave9.md §3.7 (b)): at least one, at most `max`.
  if (cost.removeThreat) {
    const { amount } = cost.removeThreat;
    if (typeof amount === "number") {
      if (!Number.isInteger(amount) || amount < 1)
        problems.push("cost removeThreat: must be a whole number of at least 1");
    } else {
      const { min, max } = amount.choose;
      if (!Number.isInteger(min) || min < 1)
        problems.push('cost removeThreat: a chosen amount has a min of at least 1 (RRG 1.8 "Cost", p. 14)');
      if (!Number.isInteger(max) || max < min)
        problems.push("cost removeThreat: a chosen amount's max must be a whole number no smaller than min");
    }
  }
  if (cost.discardFromDeckSlot !== undefined && cost.discardFromDeck === undefined)
    problems.push("cost discardFromDeckSlot: only binds the cards a discardFromDeck cost discarded");
  if (cost.indirectDamage !== undefined && (!Number.isInteger(cost.indirectDamage) || cost.indirectDamage < 1))
    problems.push("cost indirectDamage: must be a whole number of at least 1");
  const damage = cost.damageCards?.amount;
  if (damage !== undefined && (!Number.isInteger(damage) || damage < 1))
    problems.push("cost damageCards: amount must be a whole number of at least 1");
  // docs/phase7-wave6.md §3.49: "attach it to a character other than Rogue and deal 2 damage to that character →".
  if (cost.attach && cost.attach.to.slot === "") problems.push("cost attach: needs a slot for the host");
  // docs/phase7-wave10-box-heroes.md B3.1: "search the encounter deck and discard pile for a minion and put it into play".
  if (cost.searchEncounterIntoPlay) {
    if (cost.searchEncounterIntoPlay.slot === "")
      problems.push("cost searchEncounterIntoPlay: needs a slot for the card found");
    if (cost.searchEncounterIntoPlay.zones.length === 0)
      problems.push("cost searchEncounterIntoPlay: names the encounter deck, its discard pile or both");
  }
  if (cost.attach?.bind === "") problems.push("cost attach: bind needs a slot name");
  const dealt = cost.dealDamage?.amount;
  if (dealt !== undefined && (!Number.isInteger(dealt) || dealt < 1))
    problems.push("cost dealDamage: amount must be a whole number of at least 1");
  // docs/phase7-wave10-hero-packs.md H3.17: "heal 2 damage from an enemy →".
  const healed = cost.healCharacter;
  if (healed && (!Number.isInteger(healed.amount) || healed.amount < 1))
    problems.push("cost healCharacter: amount must be a whole number of at least 1");
  if (healed && healed.slot === "") problems.push("cost healCharacter: needs a slot for the character healed");
  if (cost.chooseTarget?.slot === "") problems.push("cost chooseTarget: needs a slot for the card chosen");
  const dealtTo = cost.dealEncounterCardsTo;
  if (dealtTo && (!Number.isInteger(dealtTo.count) || dealtTo.count < 1))
    problems.push("cost dealEncounterCardsTo: count must be a whole number of at least 1");
  if (dealtTo && dealtTo.slot === "")
    problems.push("cost dealEncounterCardsTo: needs a slot for the player's identity");
  const boosts = cost.giveBoostCards?.count;
  if (boosts !== undefined && (!Number.isInteger(boosts) || boosts < 1))
    problems.push("cost giveBoostCards: count must be a whole number of at least 1");
  if (cost.either) {
    if (cost.either.length < 2) problems.push("cost either: needs at least two branches");
    for (const branch of cost.either) {
      if (branch.either) problems.push("cost either: a branch cannot itself be an either/or cost");
      const shared = Object.keys(branch).filter((key) => key !== "either" && key in cost);
      if (shared.length > 0) problems.push(`cost either: a branch repeats the cost's own ${shared.join(", ")}`);
    }
  }
  const slots = [
    ...(cost.discardFromHand ? ["discard"] : []),
    ...(cost.payPrintedCostOf ? [cost.payPrintedCostOf.slot] : []),
    ...(cost.chooseCard ? [cost.chooseCard.slot] : []),
    ...(cost.discardFromDeckSlot !== undefined ? [cost.discardFromDeckSlot] : []),
    ...(cost.encounterLookDiscard ? [cost.encounterLookDiscard.slot] : []),
    ...(cost.discardFromEncounterDeck ? [cost.discardFromEncounterDeck.slot] : []),
    ...(cost.attach ? [cost.attach.to.slot, ...(cost.attach.bind ? [cost.attach.bind] : [])] : []),
    ...(cost.searchEncounterIntoPlay ? [cost.searchEncounterIntoPlay.slot] : []),
    ...(cost.dealDamage?.choose ? [cost.dealDamage.choose.slot] : []),
    ...(cost.removeThreat?.choose ? [cost.removeThreat.choose.slot] : []),
    ...(cost.dealEncounterCardsTo ? [cost.dealEncounterCardsTo.slot] : []),
    ...(cost.healCharacter ? [cost.healCharacter.slot] : []),
    ...(cost.chooseTarget ? [cost.chooseTarget.slot] : []),
    ...inPlayPicksOf(cost).flatMap(({ pick }) => [pick.slot, ...(pick.bindHosts ? [pick.bindHosts] : [])]),
  ];
  if (new Set(slots).size !== slots.length)
    problems.push(`cost components pick into the same slot (${slots.join(", ")}); give each its own slot`);
}

/** `scaled.divide` needs a positive whole divisor; the engine would otherwise read the value as 0. */
function checkScaled(value: unknown, path: string, problems: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => checkScaled(item, `${path}[${i}]`, problems));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.kind === "scaled" && record.divide !== undefined) {
    const divide = record.divide as { by?: unknown; round?: unknown };
    if (typeof divide.by !== "number" || !Number.isInteger(divide.by) || divide.by < 1)
      problems.push(`${path}: scaled divide.by must be a whole number of at least 1`);
    if (divide.round !== "down" && divide.round !== "up")
      problems.push(`${path}: scaled divide.round must be "down" or "up"`);
  }
  // An empty list is almost certainly an authoring slip: `sum` of nothing is 0, and `anyTrait`/`anyPrintedResource`/`anyOf` of nothing matches no card.
  // `reduceCostToPlay` (a `playCostModifier` rule): a reduction, so a negative one (a fixed delta above 0) is a slip.
  // No card in the pool raises a play cost by a lasting rule; one that does would need its own builder and reading.
  if (record.kind === "playCostModifier" && typeof record.delta === "number" && record.delta > 0)
    problems.push(`${path}: reduceCostToPlay needs a reduction of 0 or more, not ${-record.delta}`);
  if (record.kind === "sum" && (!Array.isArray(record.values) || record.values.length === 0))
    problems.push(`${path}: sum needs at least one value`);
  if (Array.isArray(record.anyTrait) && record.anyTrait.length === 0)
    problems.push(`${path}: anyTrait needs at least one trait`);
  if (Array.isArray(record.anyPrintedResource) && record.anyPrintedResource.length === 0)
    problems.push(`${path}: anyPrintedResource needs at least one resource type`);
  if (Array.isArray(record.anyOf) && record.anyOf.length === 0)
    problems.push(`${path}: anyOf needs at least one query`);
  const printsAbility = record.printsAbility as { kinds?: unknown } | undefined;
  if (printsAbility !== undefined && (!Array.isArray(printsAbility.kinds) || printsAbility.kinds.length === 0))
    problems.push(`${path}: printsAbility needs at least one ability kind`);
  for (const [key, item] of Object.entries(record)) checkScaled(item, `${path}.${key}`, problems);
}

function checkPlain(value: unknown, path: string, problems: string[]): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) problems.push(`${path} is not a finite number`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkPlain(item, `${path}[${index}]`, problems));
    return;
  }
  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) problems.push(`${path} is not a plain object`);
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) problems.push(`${path}.${key} is undefined (omit the key instead)`);
      else checkPlain(item, `${path}.${key}`, problems);
    }
    return;
  }
  problems.push(`${path} is a ${typeof value}, not JSON`);
}

/**
 * Rule kinds the engine collects by its own scan of the cards in play or in hand rather than through `activeRules`, so
 * one on a victory display constant would silently do nothing (docs/phase7-wave7.md §3.50).
 */
const VICTORY_DISPLAY_UNREAD_RULES: readonly string[] = [
  "blankTextBox",
  "countsAs",
  "textBoxCannotBeBlanked",
  "cannotChooseToDiscard",
  "staysInHand",
  "cannotBeCanceled",
  "treatHostAsMinion",
  "treatHostAsAlly",
];

const patternKinds = (pattern: EventPattern): readonly string[] =>
  typeof pattern.on === "string" ? [pattern.on] : pattern.on;

/**
 * A response to damage says which of the two amounts its card's text reads: damage **dealt** ("after X deals / is dealt
 * damage": `eventAtLeast.dealt`, `on.damage`'s `dealt`) or damage **taken** ("after X takes damage": the `amount`
 * result or `eventAtLeast.taken`, `on.damage`'s `taken`). RRG 1.8 "Prevent" (p. 35) tells them apart, so a pattern that
 * names neither would silently pick one (docs/dealt-vs-taken-audit.md).
 */
function unreadDamage(pattern: EventPattern): readonly string[] {
  const reads = (part: EventPattern): boolean =>
    part.eventAtLeast?.dealt !== undefined ||
    part.eventAtLeast?.taken !== undefined ||
    part.requireResults?.amount !== undefined;
  if (!patternKinds(pattern).includes("dealDamage") || reads(pattern)) return [];
  const alternatives = (pattern.anyOf ?? []).filter((alternative) => patternKinds(alternative).includes("dealDamage"));
  if (alternatives.length > 0 && alternatives.every(reads)) return [];
  return ['a response to damage says whether it reads damage dealt or damage taken (on.damage\'s "dealt" or "taken")'];
}

function unlistedAlternativeKinds(pattern: EventPattern): readonly string[] {
  const listed = patternKinds(pattern);
  return (pattern.anyOf ?? []).flatMap((alternative) => [
    ...patternKinds(alternative)
      .filter((kind) => !listed.includes(kind))
      .map((kind) => `an event pattern alternative hears ${kind}, which the pattern's own "on" does not list`),
    ...unlistedAlternativeKinds(alternative),
  ]);
}

function checkTrigger(definition: AbilityDefinition, problems: string[]): void {
  const trigger = definition.trigger;
  if ((trigger.kind === "interrupt" || trigger.kind === "response") && !trigger.on)
    problems.push(`${trigger.kind} needs an event pattern`);
  // `EventPattern.anyOf`: the engine files an ability under its outer `on` kinds, so an alternative that hears a kind
  // the outer pattern does not list would never be reached (`on.either` builds the list).
  if ((trigger.kind === "interrupt" || trigger.kind === "response") && trigger.on)
    problems.push(...unlistedAlternativeKinds(trigger.on));
  if (trigger.kind === "response" && trigger.on) problems.push(...unreadDamage(trigger.on));
  // "Would deal / be dealt damage" (RRG v1.8 "Damage", p. 14, step 1) is a stage of a damage interrupt only.
  if (trigger.kind === "interrupt" && trigger.wouldBeDealt && !patternKinds(trigger.on).includes("dealDamage"))
    problems.push("wouldBeDealt marks a damage interrupt: its pattern must hear dealDamage");
  if (trigger.kind === "interrupt" && trigger.wouldBeDealt && trigger.would)
    problems.push(
      'wouldBeDealt and would: a damage interrupt is staged by wouldBeDealt alone ("would take" is unmarked)',
    );
  // An additional cost to play (box-heroes B3.1) is the one constant with a cost, and with effects: they resolve as its
  // card enters play.
  const additionalPlayCost = trigger.kind === "constant" ? trigger.additionalCostToPlay : undefined;
  if (trigger.kind === "constant" && definition.effects.length > 0 && !additionalPlayCost)
    problems.push("a constant ability has no effects");
  if (additionalPlayCost) {
    if (!definition.cost) problems.push("an additional cost to play needs the cost");
    const slot = additionalPlayCost.attachToSlot;
    if (slot !== undefined && definition.cost?.searchEncounterIntoPlay?.slot !== slot)
      problems.push(`an additional cost to play attaches to a slot its cost puts into play (${slot})`);
    // A conditional part is the board's pick, made for the player playing the card (engine `playCostWith`). Resources
    // and an either/or choice would need the play's payment and its command to carry them, in a branch as outside one.
    const parts = definition.cost ? costVariants(definition.cost) : [];
    if (parts.some((part) => part.resources !== undefined || part.either))
      problems.push("an additional cost to play has no resources or either/or part");
  }
  // docs/phase7-wave10.md §3.12: a keyword grant names one keyword, or the cards whose printed keywords are gained.
  if (trigger.kind === "constant") {
    for (const grant of trigger.keywordGrants ?? []) {
      if ((grant.keyword === undefined) === (grant.keywordsOf === undefined))
        problems.push("a keyword grant needs exactly one of keyword and keywordsOf");
      else if (grant.keywordsOf !== undefined && (grant.value !== undefined || grant.loses))
        problems.push("a keywordsOf grant gains keywords as printed: no value, no loses");
    }
  }
  if (definition.generates !== undefined && trigger.kind !== "resource")
    problems.push("only resource abilities generate resources");
  // The one limit a constant carries is its `playableTopOfDeck` / `playableAsIfInHand` permission's "once per phase"
  // (docs/phase7-wave8.md §3.49, docs/phase7-wave11.md §3.8), counted when a card is played under it.
  const permissionLimit = playableAsIfInHandOf(trigger) !== undefined;
  if (trigger.kind === "constant" && trigger.playableTopOfDeck && trigger.playableAsIfInHand)
    problems.push("a constant ability has at most one of playableTopOfDeck and playableAsIfInHand");
  // "Discard [this card] from your hand to play …" (docs/phase7-wave11.md §3.9): only a card in the hand can pay it.
  if (trigger.kind === "constant" && trigger.playableAsIfInHand?.discardSelfFromHand && definition.activeIn !== "hand")
    problems.push("a playableAsIfInHand that discards its own card from hand works from the hand (activeIn: hand)");
  if (
    trigger.kind === "constant" &&
    ((definition.cost && !additionalPlayCost) || (definition.limit && !permissionLimit) || definition.label)
  )
    problems.push("a constant ability has no cost, limit or label");
  if (permissionLimit && definition.limit?.per === "triggeringEvent")
    problems.push("a playableTopOfDeck limit is per turn, phase or round, not per triggering event");
  // docs/phase7-wave5.md §3.25: a use per counter, so the cost is one fixed counter cost and nothing else.
  if (trigger.kind === "resource" && trigger.repeatable) {
    const cost = definition.cost ?? {};
    const others = Object.keys(cost).filter((key) => key !== "spendCounters");
    if (
      !cost.spendCounters ||
      cost.spendCounters.upTo ||
      cost.spendCounters.all ||
      // A board-given amount (hero-pack spec H3.5) cannot be multiplied by the uses before it is read.
      typeof cost.spendCounters.amount !== "number" ||
      others.length > 0 ||
      // The one limit it may carry counts its uses toward one card paid for (docs/phase7-wave9.md §3.46 (a)).
      (definition.limit && definition.limit.per !== "paidCard")
    )
      problems.push(
        "a repeatable resource ability needs a fixed spendCounters cost only, and no limit but one per card paid for",
      );
  }
  // docs/phase7-wave10.md §3.14: the count is kept for the triggering event's player, so there must be an event.
  if (definition.limit?.per === "eventPlayer" && trigger.kind !== "interrupt" && trigger.kind !== "response")
    problems.push("a limit per event player is a triggered ability's: an interrupt or a response");
  // docs/phase7-wave9.md §3.46 (a): "(Limit once per card.)" counts a resource ability's uses in one payment.
  if (definition.limit?.per === "paidCard") {
    if (trigger.kind !== "resource") problems.push("a limit per card paid for is a resource ability's");
    else if (trigger.whenSpent) problems.push("a when-spent ability is used once with its card: no limit per card");
    else if (definition.limit.count > 1 && !trigger.repeatable)
      problems.push("a resource ability used more than once per card paid for must be repeatable");
  }
  // docs/phase7-wave10-hero-packs.md H3.14: "generate a resource to overpay for a card" is read in a payment, from a
  // resource ability on a card in play that generates (a card spent from hand, or a counter spent "as if it were a
  // resource", goes toward the cost by its own rule).
  if (definition.overpayOnly) {
    if (trigger.kind !== "resource") problems.push("overpayOnly is a resource ability's");
    else if (trigger.whenSpent) problems.push("a when-spent ability generates with its card: it cannot be overpayOnly");
    else if (trigger.spentAsIfResource)
      problems.push("a counter spent as if it were a resource is not generated: it cannot be overpayOnly");
  }
  // The least X of a printed X cost (the owner's answer 52B, 2026-10-13): read from the ability a play triggers.
  if (definition.minX !== undefined) {
    if (!Number.isInteger(definition.minX) || definition.minX < 1)
      problems.push("minX is a whole number of at least 1 (leave it out for an X that may be 0)");
    if (trigger.kind !== "action" && trigger.kind !== "interrupt" && trigger.kind !== "response")
      problems.push("minX is read from the ability a played card triggers: an action, interrupt or response");
  }
  // docs/phase7-wave7.md §3.50: the engine reads a constant's stat modifiers, trait grants, keyword grants and
  // `activeRules` rules from the victory display, and nothing else from there.
  if (definition.activeIn === "victoryDisplay") {
    if (trigger.kind !== "constant") {
      const article = /^[aeiou]/.test(trigger.kind) ? "an" : "a";
      problems.push(
        `only a constant ability works from the victory display (inVictoryDisplay on ${article} ${trigger.kind} ability)`,
      );
    } else {
      const read = ["kind", "modifiers", "traitGrants", "keywordGrants", "rules"];
      const unread = Object.keys(trigger).filter((key) => !read.includes(key));
      if (unread.length > 0)
        problems.push(`a victory display constant cannot carry ${unread.join(", ")}: not read from out of play`);
      const unreadRules = (trigger.rules ?? [])
        .map((rule) => rule.kind)
        .filter((kind) => VICTORY_DISPLAY_UNREAD_RULES.includes(kind));
      if (unreadRules.length > 0)
        problems.push(`a victory display constant cannot carry a ${unreadRules.join(", ")} rule: read from play only`);
    }
  }
  // docs/phase7-wave7.md §3.55: the engine offers a card in a discard pile only its response to its own discard from
  // the deck, and nothing out of play pays a cost.
  if (definition.activeIn === "discard") {
    const kinds =
      trigger.kind === "response" ? (typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on) : [];
    if (
      trigger.kind !== "response" ||
      kinds.length !== 1 ||
      kinds[0] !== "cardDiscardedFromDeck" ||
      trigger.on.selfIs !== "target"
    )
      problems.push(
        "only a response to the card's own discard from its deck works from the discard pile (inDiscard needs response(on.thisDiscardedFromYourDeck(), …))",
      );
    if (definition.cost) problems.push("an ability used from the discard pile has no cost");
  }
  // docs/phase7-wave10-box-heroes.md B3.3: the mark is read only when a response to a deck discard finishes.
  if (definition.discardsStayCounted) {
    const kinds =
      trigger.kind === "response" ? (typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on) : [];
    if (!kinds.includes("cardDiscardedFromDeck"))
      problems.push(
        "stillCountedByDiscarder needs a response to cards discarded from a deck (on.aPlayerDiscardsFromTheirDeck(), …)",
      );
  }
  // docs/phase7-wave9.md §3.40 (b): the engine offers a card that was tucked only its response to its own discard
  // from under a card, and nothing out of play pays a cost.
  if (definition.activeIn === "tucked") {
    const kinds =
      trigger.kind === "response" ? (typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on) : [];
    if (
      trigger.kind !== "response" ||
      kinds.length !== 1 ||
      kinds[0] !== "tuckedCardDiscarded" ||
      trigger.on.selfIs !== "target"
    )
      problems.push(
        "only a response to the card's own discard from under a card works for a tucked card (whileTucked needs response(on.thisDiscardedFromUnder(), …))",
      );
    if (definition.cost) problems.push("an ability of a tucked card has no cost");
  }
  // A tuck about to happen has no response window (docs/phase7-wave9.md §3.40 (a)): "after" has nothing to answer.
  if (trigger.kind === "response") {
    const kinds = typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on;
    if (kinds.includes("cardBeingTucked"))
      problems.push("cardBeingTucked is interrupt-only: a tuck about to happen has no response window");
    // Nor has a discard from a hand or a deck about to happen (docs/phase7-wave9.md §4.1 Q20).
    if (kinds.includes("cardBeingDiscarded"))
      problems.push("cardBeingDiscarded is interrupt-only: a discard about to happen has no response window");
    // Nor has a status card about to be given (docs/phase7-wave9.md §3.33): "after" answers `statusPlaced`.
    if (kinds.includes("statusBeingGiven"))
      problems.push("statusBeingGiven is interrupt-only: after a status card is placed is on.statusPlaced");
    // Nor has an encounter card about to be dealt (docs/phase7-wave9.md §3.45): "after" answers `encounterCardDealt`.
    if (kinds.includes("encounterCardBeingDealt"))
      problems.push("encounterCardBeingDealt is interrupt-only: after a player is dealt a card is encounterCardDealt");
    if (kinds.includes("boostCardBeingGiven"))
      problems.push("boostCardBeingGiven is interrupt-only: after a boost card is given is boostCardGiven");
    if (kinds.includes("encounterCardBeingRevealed"))
      problems.push("encounterCardBeingRevealed is interrupt-only: after a card is revealed is cardRevealed");
    if (kinds.includes("boostCardTurningFaceup"))
      problems.push(
        "boostCardTurningFaceup is interrupt-only: after a boost card is turned faceup is boostCardTurnedFaceup",
      );
  }
  // docs/phase7-wave7.md §3.35: the card's "attach to" text as an ability. It is forced and free, and attaches itself.
  if (definition.attachInstruction) {
    if (trigger.kind !== "whenRevealed")
      problems.push("an attachInstruction ability is built on a whenRevealed trigger");
    if (definition.cost || definition.limit || definition.label || definition.uncancellable)
      problems.push("an attachInstruction ability has no cost, limit, label or uncancellable flag");
    const attachesSelf = allEffects(definition.effects).some(
      (effect) => effect.kind === "attach" && effect.card.kind === "self",
    );
    if (!attachesSelf) problems.push("an attachInstruction ability must attach its own card (attachCard(self, …))");
  }
}

/**
 * `enemyScheme.divert` (docs/phase7-wave9.md §3.9): a constant amount below 1 diverts nothing, and the bare villain or
 * main scheme as the card to divert to is a slip (the threat is diverted *from* the main scheme).
 */
function checkSchemeDivert(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind !== "enemyScheme" || !effect.divert) continue;
    const { amount, to } = effect.divert;
    const constant = typeof amount === "number" ? amount : amount.kind === "const" ? amount.value : null;
    if (constant !== null && (!Number.isInteger(constant) || constant < 1))
      problems.push("enemyScheme divert: a constant amount must be a whole number of at least 1");
    if (to.kind === "mainScheme")
      problems.push("enemyScheme divert: the threat is diverted from the main scheme, so `to` names another card");
  }
}

/** `chooseCards.maxTotal` (docs/phase7-wave9.md §3.11): the limit is a whole number of at least 0. */
function checkCardTotals(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind !== "chooseCards" || !effect.maxTotal) continue;
    if (!Number.isInteger(effect.maxTotal.atMost) || effect.maxTotal.atMost < 0)
      problems.push("chooseCards maxTotal: atMost must be a whole number of at least 0");
  }
}

/**
 * `perPlayerAs` on `revealCard` and `findCard` (docs/phase7-wave10-hero-packs.md H3.5): what each per player icon on
 * the card is treated as while it is revealed. A whole number of at least 0, and on a find only with `to: "reveal"`.
 */
function checkFinds(definition: AbilityDefinition, problems: string[]): void {
  const whole = (n: number): boolean => Number.isInteger(n) && n >= 0;
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind === "revealCard" && effect.perPlayerAs !== undefined && !whole(effect.perPlayerAs))
      problems.push("revealCard perPlayerAs: a whole number of at least 0");
    if (effect.kind !== "findCard") continue;
    if (effect.perPlayerAs !== undefined) {
      if (effect.to !== "reveal") problems.push('findCard perPlayerAs: only a find with `to: "reveal"` reveals a card');
      if (!whole(effect.perPlayerAs)) problems.push("findCard perPlayerAs: a whole number of at least 0");
    }
  }
}

/**
 * `resolveSpecials` with `trigger: "preparation"` (docs/phase7-wave9.md §3.2): the card is out of play, in the
 * encounter discard pile, so it is named with `of` (`cards` reads cards in play only and would find nothing). The "as
 * if" floor and the When Revealed keywords belong to other kinds.
 */
function checkPreparations(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind !== "resolveSpecials" || effect.trigger !== "preparation") continue;
    if (!effect.of)
      problems.push("resolveSpecials preparation: name the card with `of` (it is in the encounter discard pile)");
    if (effect.asIf) problems.push("resolveSpecials preparation: `asIf` is not read for a Preparation ability");
    if (effect.excludeKeywords)
      problems.push("resolveSpecials preparation: `excludeKeywords` is for When Revealed abilities");
  }
}

/**
 * `resolveSpecials` with `trigger: "boost"` (docs/phase7-wave10.md §3.11): `borrowedBoostIcons` is that kind's own
 * option and takes one of its two names (question 10: `"nothing"`, the default, or `"joinActivation"`). The "as if"
 * floor and the When Revealed keywords belong to other kinds.
 */
function checkBorrowedBoosts(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind !== "resolveSpecials") continue;
    const option: unknown = effect.borrowedBoostIcons;
    if (effect.trigger !== "boost") {
      if (option !== undefined) problems.push('resolveSpecials: `borrowedBoostIcons` is for `trigger: "boost"`');
      continue;
    }
    if (option !== undefined && option !== "nothing" && option !== "joinActivation")
      problems.push('resolveSpecials boost: `borrowedBoostIcons` is "nothing" or "joinActivation"');
    if (effect.asIf) problems.push("resolveSpecials boost: `asIf` is not read for a Boost ability");
    if (effect.excludeKeywords)
      problems.push("resolveSpecials boost: `excludeKeywords` is for When Revealed abilities");
  }
}

/**
 * `modifyAttack`'s `bind` (docs/phase7-wave9.md §3.4) names where a "prevent all damage from this attack" reports what
 * it stopped, so it needs `preventAllDamage` and a name. The numbers are the attack's results, known once it has dealt
 * its damage: a var read under that name in the same ability (`varOf("<bind>.amount")`) is the likely slip, and is
 * already rejected as a var nothing bound.
 */
function checkAttackPrevention(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind !== "modifyAttack" || effect.bind === undefined) continue;
    if (effect.bind === "") problems.push("modifyAttack: bind needs a name");
    if (!effect.preventAllDamage)
      problems.push("modifyAttack: bind reports what preventAllDamage stops; it needs preventAllDamage");
  }
}

/**
 * `replaceTuckHost` changes the tuck its ability interrupts (docs/phase7-wave9.md §3.40 (a)), so it is read only in an
 * interrupt whose one triggering condition is `cardBeingTucked`; anywhere else it would find no pending tuck.
 */
function checkTuckReplacement(definition: AbilityDefinition, problems: string[]): void {
  if (!allEffects(definition.effects).some((effect) => effect.kind === "replaceTuckHost")) return;
  const trigger = definition.trigger;
  const kinds =
    trigger.kind === "interrupt" ? (typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on) : [];
  if (kinds.length !== 1 || kinds[0] !== "cardBeingTucked")
    problems.push(
      "replaceTuckHost needs an interrupt on a tuck about to happen (interrupt(on.cardWouldBeTucked(…), …))",
    );
}

/**
 * `replaceAttachHost` changes the attach its ability interrupts (docs/phase7-wave9.md §3.49), so it is read only in an
 * interrupt whose one triggering condition is `cardAttached` (`on.cardWouldBeAttached`); anywhere else it would find no
 * pending attach.
 */
function checkAttachReplacement(definition: AbilityDefinition, problems: string[]): void {
  if (!allEffects(definition.effects).some((effect) => effect.kind === "replaceAttachHost")) return;
  const trigger = definition.trigger;
  const kinds =
    trigger.kind === "interrupt" ? (typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on) : [];
  if (kinds.length !== 1 || kinds[0] !== "cardAttached")
    problems.push(
      "replaceAttachHost needs an interrupt on an attach about to happen (forcedInterrupt(on.cardWouldBeAttached(…), …))",
    );
}

/**
 * A `divide` of counters (docs/phase7-wave9.md §3.27) says what happens to each point (`mode`; only `"remove"` exists),
 * names a counter type, and no other division takes a `mode`. `"allPurpose"` is the word for a counter placed; one
 * taken is `"any"` (`counter-types.ts`).
 */
function checkCounterDivision(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind !== "divide") continue;
    if (typeof effect.what !== "object") {
      if (effect.mode !== undefined) problems.push("divide: mode is for a division of counters ({ counters: type })");
      continue;
    }
    if (effect.mode !== "remove") problems.push('divide: a division of counters needs mode "remove"');
    if (effect.what.counters === "") problems.push("divide: a division of counters names a counter type");
    if (effect.what.counters === "allPurpose")
      problems.push('divide: counters of any type are removed as "any", not "allPurpose"');
  }
}

/**
 * `replaceLeaveDestination` changes where the leaving its ability interrupts ends (docs/phase7-wave9.md §3.20), so it
 * is read only in an interrupt whose one triggering condition is `cardLeavesPlay`: a response finds the card gone, and
 * any other event has no leaving to send elsewhere.
 */
/**
 * "Spend X [type] resources" (`EffectSpec spendResources.x`): `resources` is the price of one, so it must ask for at
 * least 1 resource, and X is the player's to set, so the spend is neither `required` nor of `distinctTypes`.
 */
function checkSpendX(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind !== "spendResources" || !effect.x) continue;
    const each = Object.values(effect.resources).reduce((sum, count) => sum + (count ?? 0), 0);
    if (each < 1) problems.push("spendResources x: resources is the price of one and must ask for at least 1 resource");
    if (effect.required) problems.push("spendResources x: not with required (X of 0 is the player's to choose)");
    if (effect.distinctTypes !== undefined) problems.push("spendResources x: not with distinctTypes");
  }
}

/**
 * A defeat destination that is an enemy's boost cards (`setDefeatDestination(boostCardOf(…))`, docs/phase7-wave10.md
 * §3.10) is read in the two places a defeat's destination can still change: the defeated card's own When Defeated
 * ability, and an interrupt whose one triggering condition is a character's defeat. Anywhere else the effect does
 * nothing, which for "give this card … as a facedown boost card" is a card silently discarded.
 */
function checkBoostCardDestination(definition: AbilityDefinition, problems: string[]): void {
  const gives = allEffects(definition.effects).some(
    (effect) => effect.kind === "setDefeatDestination" && typeof effect.to === "object" && "kind" in effect.to,
  );
  if (!gives) return;
  const trigger = definition.trigger;
  if (trigger.kind === "whenDefeated") return;
  const kinds =
    trigger.kind === "interrupt" ? (typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on) : [];
  if (kinds.length !== 1 || kinds[0] !== "characterDefeated")
    problems.push(
      "setDefeatDestination boostCardOf needs a When Defeated ability or an interrupt on a character's defeat (interrupt(on.defeated(…), …))",
    );
}

/**
 * "A card is revealed that gives … the [trait] trait" (`EventPattern.grantsTrait`, docs/phase7-wave10.md §3.16): what
 * a revealed card gives is read once its reveal has completed, so the pattern is a response's and hears `cardRevealed`
 * alone; `grantedToIs` narrows that read and means nothing without it. "Those heroes" (`TargetRef grantedTo`) are read
 * off that event, so the ref belongs to an ability whose pattern asks for the same trait: anywhere else it names no card.
 */
function checkTraitReveal(definition: AbilityDefinition, problems: string[]): void {
  const trigger = definition.trigger;
  const asked = new Set<string>();
  const visit = (pattern: EventPattern): void => {
    if (pattern.grantedToIs !== undefined && pattern.grantsTrait === undefined)
      problems.push(
        "a pattern's grantedToIs narrows grantsTrait: name the trait (on.cardRevealedGranting(trait, { to }))",
      );
    if (pattern.grantsTrait !== undefined) {
      asked.add(pattern.grantsTrait);
      const kinds = kindsOfPattern(pattern);
      if (trigger.kind !== "response" || kinds.length !== 1 || kinds[0] !== "cardRevealed")
        problems.push(
          "a pattern's grantsTrait is read after a card is revealed: a response on cardRevealed alone (response(on.cardRevealedGranting(…), …))",
        );
    }
    for (const alternative of pattern.anyOf ?? []) visit(alternative);
  };
  if ((trigger.kind === "interrupt" || trigger.kind === "response") && trigger.on !== undefined) visit(trigger.on);
  const seen = new Set<string>();
  const refs = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) refs(item);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const record = value as Readonly<Record<string, unknown>>;
    if (record.kind === "grantedTo" && typeof record.trait === "string") seen.add(record.trait);
    for (const item of Object.values(record)) refs(item);
  };
  refs(definition.effects);
  for (const named of seen) {
    if (!asked.has(named))
      problems.push(
        `grantedTo("${named}") reads the revealed card of on.cardRevealedGranting("${named}", …): this ability's trigger does not ask for that trait`,
      );
  }
}

/** The events `Predicate attackUsedAtk` can read (docs/phase7-wave10.md §3.17). */
const ATTACK_USED_ATK_EVENTS: readonly string[] = ["dealDamage", "attack", "enemyAttack", "enemyAttacksEnemy"];

/**
 * "Uses their ATK to attack and damage" (`attackUsedAtk()`, docs/phase7-wave10.md §3.17) is read from the damage or
 * attack an ability answers, so it is false anywhere else: only an interrupt or response whose pattern hears nothing
 * but damage and attacks may ask it. `usesAtk` on a `dealDamage` that is never an attack's (`fromAttack: false`) says
 * nothing and is a slip.
 */
function checkAttackUsedAtk(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind === "dealDamage" && effect.usesAtk && effect.fromAttack === false)
      problems.push("dealDamage: usesAtk marks an attack's damage; this instruction is fromAttack: false");
  }
  if (!readsKind(definition, (kind) => kind === "attackUsedAtk")) return;
  const trigger = definition.trigger;
  const heard =
    (trigger.kind === "interrupt" || trigger.kind === "response") && trigger.on !== undefined
      ? [trigger.on, ...(trigger.on.anyOf ?? [])].flatMap(kindsOfPattern)
      : [];
  if (heard.length === 0 || heard.some((kind) => !ATTACK_USED_ATK_EVENTS.includes(kind)))
    problems.push(
      "attackUsedAtk reads the damage or attack an ability answers: only in an interrupt or response on dealDamage, attack, enemyAttack or enemyAttacksEnemy",
    );
}

const ATTACK_KEYWORD_NAMES: readonly string[] = ["piercing", "ranged", "overkill"];

/**
 * "Attacks against them lose piercing" (`attacksLoseKeywords`, docs/phase7-wave10.md §3.18), wherever the rule is
 * written (a constant, or a rule an effect applies for a time): it names at least one attack keyword, each once, and
 * only the three an attack can have (RRG 1.8 "Piercing", p. 32; "Ranged", p. 35; "Overkill", p. 31). A character's own
 * keyword is lost with `losesKeyword`.
 */
function checkAttackKeywordLoss(value: unknown, path: string, problems: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkAttackKeywordLoss(item, `${path}[${index}]`, problems));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const record = value as Readonly<Record<string, unknown>>;
  if (record.kind === "attacksLoseKeywords") {
    const keywords = Array.isArray(record.keywords) ? (record.keywords as readonly unknown[]) : [];
    if (keywords.length === 0) problems.push(`${path}: attacksLoseKeywords names at least one attack keyword`);
    if (new Set(keywords).size !== keywords.length)
      problems.push(`${path}: attacksLoseKeywords names each keyword once`);
    for (const keyword of keywords) {
      if (typeof keyword !== "string" || !ATTACK_KEYWORD_NAMES.includes(keyword))
        problems.push(
          `${path}: attacksLoseKeywords takes piercing, ranged or overkill, not ${JSON.stringify(keyword)} (a character's own keyword is lost with losesKeyword)`,
        );
    }
    // "Attacks against them" (`target`) or "his attacks" (`attacker`, docs/phase7-wave11-scenarios.md §S7 E19).
    const names = (end: unknown) => typeof end === "object" && end !== null && Object.keys(end).length > 0;
    if (!names(record.target) && !names(record.attacker))
      problems.push(`${path}: attacksLoseKeywords names the attacked character (target) or the attacker (attacker)`);
  }
  for (const [key, item] of Object.entries(record)) checkAttackKeywordLoss(item, `${path}.${key}`, problems);
}

function checkLeaveReplacement(definition: AbilityDefinition, problems: string[]): void {
  if (!allEffects(definition.effects).some((effect) => effect.kind === "replaceLeaveDestination")) return;
  const trigger = definition.trigger;
  const kinds =
    trigger.kind === "interrupt" ? (typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on) : [];
  if (kinds.length !== 1 || kinds[0] !== "cardLeavesPlay")
    problems.push("replaceLeaveDestination needs an interrupt on a card leaving play (interrupt(on.leavesPlay(…), …))");
}

/**
 * `playFromHand`'s cost modes (docs/phase7-wave9.md §3.37): the cost is ignored or reduced, never both, and a constant
 * reduction is a whole number of at least 0. A play from a searched deck picks its card from what the search finds, so
 * it does not name one already picked.
 */
function checkPlays(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind !== "playFromHand") continue;
    if (effect.ignoreCost && effect.costReduction !== undefined)
      problems.push("playFromHand: the cost is ignored or reduced, not both");
    const reduction = effect.costReduction;
    if (reduction?.kind === "const" && (!Number.isInteger(reduction.value) || reduction.value < 0))
      problems.push("playFromHand costReduction: a constant reduction must be a whole number of at least 0");
    if ((effect.from === "deck" || (typeof effect.from === "object" && "deck" in effect.from)) && effect.card)
      problems.push("playFromHand from deck: the card is picked from the searched deck, so `card` is not read");
    if (typeof effect.from === "object" && "separateDeck" in effect.from && effect.card)
      problems.push("playFromHand from a separate deck: the card is picked from that deck, so `card` is not read");
  }
}

/**
 * `reduceNextCardCost` (docs/phase7-wave10-hero-packs.md H3.10, H3.11). "To 0" is for a play to the player's own area:
 * a reduction by destination is an amount (`into`, docs/phase7-wave8.md §3.35). A reduction bound to the cards a ref
 * names (`cards`) is used by each card's own next play, so it has no filter, destination or "any player" of its own,
 * and it ends at a phase, turn or round: "the next card that player plays" (`untilPlayed`) is a player's timing point.
 */
function checkNextCardCost(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind !== "reduceNextCardCost") continue;
    if (effect.toZero && effect.into)
      problems.push("reduceNextCardCost: a cost is reduced to 0 for a play to the player's own area, not with `into`");
    if (!effect.cards) continue;
    if (effect.duration === "untilPlayed")
      problems.push("reduceNextCardCost cards: a reduction bound to cards ends at a phase, turn or round");
    if (effect.cardFilter || effect.into || effect.anyPlayer)
      problems.push(
        "reduceNextCardCost cards: the ref names the cards, so cardFilter, into and anyPlayer are not read",
      );
  }
}

/**
 * `searchCollection` with `identitySpecificToUnseated` (docs/phase7-wave10-hero-packs.md H3.18): the field reads a
 * card's identity set icon, which the card data carries in the field `aspects` reads, and it never matches an identity
 * card, the one card `heroTitleNotInPlay` matches. Beside either the search would find no card, silently. It names no
 * card type either, so the printed type ("ally") is `categories`; without it every card of the identity's set matches.
 */
function checkCollectionSearches(value: unknown, path: string, problems: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkCollectionSearches(item, `${path}[${index}]`, problems));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Readonly<Record<string, unknown>>;
  const filter = record.kind === "searchCollection" ? (record.filter as Readonly<Record<string, unknown>>) : undefined;
  if (filter?.identitySpecificToUnseated !== undefined) {
    if (filter.aspects !== undefined)
      problems.push(
        `${path}: identitySpecificToUnseated with aspects matches no card (an identity-specific card's aspect is its identity's set)`,
      );
    if (filter.heroTitleNotInPlay !== undefined)
      problems.push(
        `${path}: identitySpecificToUnseated with heroTitleNotInPlay matches no card (an identity card is not a card of its own set)`,
      );
    if (!Array.isArray(filter.categories) || filter.categories.length === 0)
      problems.push(
        `${path}: identitySpecificToUnseated names no card type: give the printed one as categories ("ally")`,
      );
  }
  for (const [key, item] of Object.entries(record)) checkCollectionSearches(item, `${path}.${key}`, problems);
}

const OWNER_ZONES: readonly string[] = ["hand", "deck", "discard"];

/**
 * `cardsFrom(zone, ref)` (`CardSelector ref.ownerZone`, docs/phase7-wave10-hero-packs.md H3.12): the zone is one of a
 * player's own out-of-play zones. Any other word would match no card, and the ability would silently never resolve.
 */
function checkOwnerZones(value: unknown, path: string, problems: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkOwnerZones(item, `${path}[${index}]`, problems));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Readonly<Record<string, unknown>>;
  if (record.kind === "ref" && record.ownerZone !== undefined && !OWNER_ZONES.includes(record.ownerZone as string))
    problems.push(`${path}: ownerZone is hand, deck or discard, not ${JSON.stringify(record.ownerZone)}`);
  for (const [key, item] of Object.entries(record)) checkOwnerZones(item, `${path}.${key}`, problems);
}

/**
 * `lookAt` with `rearrange` (docs/phase7-wave9.md §3.12): the cards are assigned back over the positions they hold, so
 * the selector names positions that hold a facedown card out of play: dealt encounter cards and decks. The engine
 * leaves any other card out of the look, which would silently drop what the text names. In an answer to a boost card
 * being given, "that card" (`eventTarget`) is a position too: the facedown boost card (docs/phase7-wave9.md §3.44).
 *
 * `bindAt` names the looked-at positions, so it belongs to a look that rearranges them.
 */
function checkRearranges(definition: AbilityDefinition, problems: string[]): void {
  const trigger = definition.trigger;
  const answersBoostGiven =
    (trigger.kind === "interrupt" || trigger.kind === "response") &&
    trigger.on !== undefined &&
    kindsOfPattern(trigger.on).includes("boostCardGiven");
  const positional = (selector: CardSelector): boolean => {
    switch (selector.kind) {
      case "ref":
        return answersBoostGiven && selector.ref.kind === "eventTarget" && selector.filter === undefined;
      case "anyOf":
        return selector.of.every(positional);
      case "atMost":
        return positional(selector.of);
      case "dealtEncounter":
        return true;
      case "encounter":
        return selector.zones.every((zone) => zone === "deck");
      case "scenarioDeck":
      case "separateDeck":
        return (selector.zones ?? ["deck"]).every((zone) => zone === "deck");
      case "zone":
        return [selector.zone].flat().every((zone) => zone === "deck");
      default:
        return false;
    }
  };
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind !== "lookAt") continue;
    if (effect.bindAt && !effect.rearrange)
      problems.push("lookAt bindAt: names the positions of a look that rearranges them (lookAtAndRearrange)");
    if (!effect.rearrange) continue;
    if (!positional(effect.cards))
      problems.push(
        "lookAt rearrange: the cards are dealt encounter cards (dealtEncounterCards), deck cards and, answering on.boostCardGiven, the boost card given (eventTarget) only",
      );
  }
  // "After an enemy is given a facedown boost card" (docs/phase7-wave9.md §3.44): already given, and facedown.
  if ((trigger.kind === "interrupt" || trigger.kind === "response") && answersBoostGiven) {
    if (trigger.kind === "interrupt")
      problems.push("a pattern on boostCardGiven is a response: the boost card has already been given");
    if (trigger.on?.targetIs !== undefined)
      problems.push(
        "a pattern on boostCardGiven cannot ask targetIs: the boost card is facedown, its face nobody's to read",
      );
  }
}

/**
 * Hidden piles (docs/phase7-wave9.md §3.29 (a)) are tied to the effects that read them by name alone, so a pile with
 * no name is an authoring slip, as is a deal whose two piles are one pile (the card set apart from each group would be
 * shuffled back in with the rest) or that names no encounter set. A constant gain of less than one card gains nothing.
 */
function checkHiddenPiles(definition: AbilityDefinition, problems: string[]): void {
  for (const effect of allEffects(definition.effects)) {
    if (effect.kind === "dealHiddenPiles") {
      if (effect.from === "") problems.push("dealHiddenPiles: names no encounter set to deal from");
      if (effect.onePerGroupTo === "" || effect.restTo === "") problems.push("dealHiddenPiles: a pile has no name");
      else if (effect.onePerGroupTo === effect.restTo)
        problems.push("dealHiddenPiles: onePerGroupTo and restTo must be two different piles");
    }
    // §3.75: piles seeded from the campaign log. A pile named twice (as a seeded pile and as the rest) would be
    // written twice, the second over the first.
    if (effect.kind === "seedHiddenPiles") {
      const names = Object.keys(effect.piles);
      if (names.length === 0) problems.push("seedHiddenPiles: names no pile to fill from the campaign log");
      if (names.includes("") || effect.rest.to === "") problems.push("seedHiddenPiles: a pile has no name");
      if (names.includes(effect.rest.to))
        problems.push("seedHiddenPiles: rest.to must not be one of the piles filled from the campaign log");
      if (effect.rest.set === "") problems.push("seedHiddenPiles: names no encounter set for the rest of the cards");
      if (
        Object.values(effect.piles).some((source) => source.campaignLogField === "") ||
        effect.revealed.campaignLogField === ""
      )
        problems.push("seedHiddenPiles: a campaign log field has no name");
    }
    if (effect.kind === "gainFromHiddenPile" || effect.kind === "revealHiddenPile") {
      if (effect.pile === "") problems.push(`${effect.kind}: the pile has no name`);
    }
    // §3.29 (b): a grid is read by its three evidence cards, so two rows with the same three would be one answer.
    if (effect.kind === "accuse" || effect.kind === "identifyMole") {
      if (effect.grid.length === 0) problems.push(`${effect.kind}: the grid has no rows`);
      const triples = new Set(effect.grid.map((row) => `${row.means}+${row.motive}+${row.opportunity}`));
      if (triples.size !== effect.grid.length)
        problems.push(`${effect.kind}: two rows of the grid have the same means, motive and opportunity`);
    }
    if (effect.kind === "identifyMole" && effect.hidden === "") problems.push("identifyMole: the pile has no name");
    if (
      effect.kind === "gainFromHiddenPile" &&
      effect.count.kind === "const" &&
      (!Number.isInteger(effect.count.value) || effect.count.value < 1)
    )
      problems.push("gainFromHiddenPile: a constant count must be a whole number of at least 1");
  }
}

/** The card selectors that take `random`: that many of their cards, by the game's seeded RNG. */
const RANDOM_SELECTORS: readonly string[] = [
  "zone",
  "encounter",
  "encounterSetAside",
  "setAside",
  "victoryDisplay",
  "tucked",
];

/**
 * A selector's `random` is a number of cards to pick ("1 of those cards at random", docs/phase7-wave9.md §3.40): a
 * constant must be a whole number of at least 1, since the engine reads anything less as picking nothing, which would
 * silently drop what the text names. A computed count is read when the effect resolves.
 */
function checkRandomPicks(value: unknown, path: string, problems: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => checkRandomPicks(item, `${path}[${i}]`, problems));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const random = record.random as { kind?: unknown; value?: unknown } | boolean | undefined;
  if (
    typeof record.kind === "string" &&
    RANDOM_SELECTORS.includes(record.kind) &&
    typeof random === "object" &&
    random.kind === "const" &&
    (typeof random.value !== "number" || !Number.isInteger(random.value) || random.value < 1)
  )
    problems.push(`${path}: a ${record.kind} selector's random count must be a whole number of at least 1`);
  for (const [key, item] of Object.entries(record)) checkRandomPicks(item, `${path}.${key}`, problems);
}

/**
 * `Predicate topOfDeckFaceup { deck: "encounter", boostAreaIcons }` (docs/phase7-wave9.md §3.42): a bound on the icons
 * the showing card prints. An empty bound asks nothing, and one no count can meet is always false; both are slips.
 */
function checkEncounterTopIcons(value: unknown, path: string, problems: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => checkEncounterTopIcons(item, `${path}[${i}]`, problems));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.kind === "topOfDeckFaceup" && record.boostAreaIcons !== undefined) {
    const bound = record.boostAreaIcons as { atLeast?: unknown; atMost?: unknown };
    const whole = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
    if (record.deck !== "encounter") problems.push(`${path}: boostAreaIcons reads the encounter deck's top card`);
    if (bound.atLeast === undefined && bound.atMost === undefined)
      problems.push(`${path}: boostAreaIcons needs atLeast or atMost`);
    else if (
      (bound.atLeast !== undefined && !whole(bound.atLeast)) ||
      (bound.atMost !== undefined && !whole(bound.atMost))
    )
      problems.push(`${path}: boostAreaIcons bounds must be whole numbers of at least 0`);
    else if (whole(bound.atLeast) && whole(bound.atMost) && bound.atLeast > bound.atMost)
      problems.push(`${path}: boostAreaIcons atLeast is above atMost`);
  }
  for (const [key, item] of Object.entries(record)) checkEncounterTopIcons(item, `${path}.${key}`, problems);
}

/**
 * A `campaignLog` read of a `cardState` field (docs/phase7-wave9.md §3.74): `counter` (a value) and `face` (a
 * predicate) each say something about one recorded card, so either without `card` reads nothing, and the two together
 * are a value and a predicate in one spec.
 */
function checkCampaignLogReads(value: unknown, path: string, problems: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => checkCampaignLogReads(item, `${path}[${i}]`, problems));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.kind === "campaignLog" && typeof record.field === "string") {
    if (record.counter !== undefined && record.card === undefined)
      problems.push(`${path}: a campaignLog counter read names no card`);
    if (record.face !== undefined && record.card === undefined)
      problems.push(`${path}: a campaignLog face read names no card`);
    if (record.counter !== undefined && record.face !== undefined)
      problems.push(`${path}: a campaignLog read takes counter (a value) or face (a predicate), not both`);
    if (record.counter === "") problems.push(`${path}: a campaignLog counter read names no counter`);
  }
  for (const [key, item] of Object.entries(record)) checkCampaignLogReads(item, `${path}.${key}`, problems);
}

/** Whether anything inside `value` is a spec whose `kind` passes `test`. */
function readsKind(value: unknown, test: (kind: string) => boolean): boolean {
  if (Array.isArray(value)) return value.some((item) => readsKind(item, test));
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.kind === "string" && test(record.kind)) return true;
  return Object.values(record).some((item) => readsKind(item, test));
}

/** Every effect in the tree, including nested branches and deferred effects. */
function allEffects(effects: readonly EffectSpec[]): EffectSpec[] {
  return effects.flatMap((effect) => [effect, ...allEffects(nestedLists(effect).flat())]);
}

function nestedLists(effect: EffectSpec): (readonly EffectSpec[])[] {
  switch (effect.kind) {
    case "if":
      return [effect.then, effect.otherwise ?? []];
    case "chooseOne":
      return effect.options.map((o) => o.effects);
    case "forEachPlayer":
    case "inGroup":
    case "atEndOfAttack":
    case "atEndOfActivation":
    case "atEndOfThwart":
    case "atEndOfRound":
    case "afterNextCardPlayed":
      return [effect.effects];
    case "replaceTriggeringEvent":
      return [effect.with];
    case "repeatWhile":
    case "repeatTimes":
    case "forEachCard":
      return [effect.effects];
    case "enemyScheme":
      return effect.wouldPlaceThreat ? [effect.wouldPlaceThreat] : [];
    default:
      return [];
  }
}

/**
 * An attack/thwart effect is what the engine resolves as the labeled action, so
 * it must sit on an ability with that label (stunned/confused cancel it). The
 * converse isn't required: a label can decorate other effects (Emergency is a
 * "(thwart)" that reduces the threat a scheme activation places).
 */
function checkLabels(definition: AbilityDefinition, problems: string[]): void {
  const kinds = new Set(allEffects(definition.effects).map((e) => e.kind));
  if (kinds.has("attack") && !(definition.label ?? []).includes("attack") && !hasUnlabeledAttackOptOut(definition)) {
    problems.push(
      'an attack effect belongs to an (attack)-labeled ability (opt out with allowUnlabeledAttack for a documented exception like Dance of Death, FAQ "Dance of Death (#4)", RRG 1.8 p. 59)',
    );
  }
  if (kinds.has("thwart") && !(definition.label ?? []).includes("thwart"))
    problems.push("a thwart effect belongs to a (thwart)-labeled ability");
}

interface Scope {
  readonly slots: Set<string>;
  readonly vars: Set<string>;
  /** `bind` prefixes: `<bind>.anything` is readable once the binding effect has run. */
  readonly prefixes: Set<string>;
}

const known = (scope: Scope, set: Set<string>, name: string): boolean =>
  set.has(name) || [...scope.prefixes].some((prefix) => name.startsWith(prefix));

/** Scans an effect's own fields (not its nested effect lists) for slot and var references. */
function checkRefs(value: unknown, scope: Scope, where: string, problems: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) checkRefs(item, scope, where, problems);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const record = value as Record<string, unknown>;
  // `TargetRef.superlative` ("the X with the highest/lowest Y", docs/phase7-wave1.md §3.12) measures each candidate
  // with that candidate bound to its own slot, "candidate" unless `slot` names another. The engine binds it, never
  // the ability, and only while `measure` is evaluated, so it is readable there and nowhere else.
  if (record.kind === "superlative") {
    checkRefs(record.among, scope, where, problems);
    const candidate = typeof record.slot === "string" ? record.slot : "candidate";
    checkRefs(record.measure, { ...scope, slots: new Set([...scope.slots, candidate]) }, where, problems);
    return;
  }
  // A lasting stat change's amount is read with the card whose stat it is bound to "affected" (engine `AFFECTED_SLOT`,
  // docs/phase7-wave6.md §3.43), so it is readable there and nowhere else.
  if (record.kind === "modifyStatUntil") {
    const { amount, kind: _kind, ...rest } = record;
    checkRefs(amount, { ...scope, slots: new Set([...scope.slots, "affected"]) }, where, problems);
    checkRefs(rest, scope, where, problems);
    return;
  }
  // A per-target damage amount is read with that target bound to "affected" too (`EffectSpec dealDamage.perTarget`).
  if (record.kind === "dealDamage" && record.perTarget === true) {
    const { amount, kind: _kind, ...rest } = record;
    checkRefs(amount, { ...scope, slots: new Set([...scope.slots, "affected"]) }, where, problems);
    checkRefs(rest, scope, where, problems);
    return;
  }
  if (record.kind === "slot" && typeof record.slot === "string" && !known(scope, scope.slots, record.slot)) {
    problems.push(`${where}: slot "${record.slot}" is read before it is bound`);
  }
  if (
    (record.kind === "var" || record.kind === "varAtLeast") &&
    typeof record.name === "string" &&
    !known(scope, scope.vars, record.name)
  ) {
    problems.push(`${where}: var "${record.name}" is read before it is bound`);
  }
  // "The number of players in their group" (docs/phase7-wave9.md §3.67) of a group `chooseGroup` bound.
  const counted = record.kind === "groupPlayerCount" ? (record.group as { var?: unknown } | string) : undefined;
  if (
    typeof counted === "object" &&
    typeof counted.var === "string" &&
    !known(scope, scope.vars, `${counted.var}.group`)
  )
    problems.push(`${where}: group "${counted.var}" is read before chooseGroup binds it`);
  // `TargetQuery cardTypeIs` (docs/phase7-wave7.md §3.33): an unbound name matches no card, so `not` of it would
  // match every card. Only `chooseCardType` binds one.
  const cardTypeIs = record.cardTypeIs as { chosen?: unknown } | undefined;
  if (typeof cardTypeIs?.chosen === "string" && !known(scope, scope.vars, `${cardTypeIs.chosen}.made`)) {
    problems.push(`${where}: card type "${cardTypeIs.chosen}" is read before it is chosen`);
  }
  if (Array.isArray(record.excludeSlots)) {
    for (const slot of record.excludeSlots)
      if (typeof slot === "string" && !known(scope, scope.slots, slot))
        problems.push(`${where}: excluded slot "${slot}" is never bound`);
  }
  if (typeof record.inSlot === "string" && !known(scope, scope.slots, record.inSlot)) {
    problems.push(`${where}: slot "${record.inSlot}" is read before it is bound`);
  }
  // A damage-taken rule scoped to consequential damage (`ConsequentialDamageScope`, docs/phase7-wave6.md §3.31): its
  // `if` is read with the consequential damage frame, into which the ally's attack/thwart reported `attack.*` /
  // `thwart.*` (`attack.defeated`, slot `attack.damaged`). The engine binds those, never the ability.
  const consequential = record.consequential;
  if (typeof consequential === "object" && consequential !== null && "if" in consequential) {
    const reported = { ...scope, prefixes: new Set([...scope.prefixes, "attack.", "thwart."]) };
    checkRefs((consequential as { if: unknown }).if, reported, where, problems);
  }
  // The team words (docs/competitive-mode-plan.md §4 task 5): a leader is a card and a team is players.
  if ((record.kind === "leader" || record.kind === "team") && record.of !== "yours" && record.of !== "enemy")
    problems.push(`${where}: ${record.kind} is of "yours" or "enemy"`);
  const playerOfKind = record.kind === "others" || record.kind === "nextAfter";
  for (const [key, item] of Object.entries(record)) {
    const kind = typeof item === "object" && item !== null ? (item as { kind?: unknown }).kind : undefined;
    if (kind === "leader" && (PLAYER_FIELDS.has(key) || (key === "of" && playerOfKind)))
      problems.push(`${where}: ${key} needs a player, and a leader is a card (yourTeam / enemyTeam name players)`);
    if (kind === "team" && TARGET_FIELDS.has(key))
      problems.push(`${where}: ${key} needs a card, and a team is players (identityOf(team) names their identities)`);
    if (kind === "enemyTeamDecider" && TARGET_FIELDS.has(key))
      problems.push(`${where}: ${key} needs a card, and enemyTeamChooses is the player who chooses for the enemy team`);
    if (key === "effects" || key === "then" || key === "otherwise" || key === "with" || key === "options") continue;
    if (key === "consequential") continue;
    checkRefs(item, scope, where, problems);
  }
}

/** Spec fields that only ever hold a `PlayerRef`, and ones that only ever hold a `TargetRef` (engine `spec.ts`). */
const PLAYER_FIELDS: ReadonlySet<string> = new Set([
  "player",
  "players",
  "chooser",
  "controller",
  "seat",
  "against",
  "owner",
  "deckOwner",
  "viewer",
  "controlledBy",
  "engagedWithPlayer",
  "inPlayAreaOf",
]);
const TARGET_FIELDS: ReadonlySet<string> = new Set([
  "target",
  "targets",
  "card",
  "cards",
  "character",
  "enemy",
  "enemies",
  "villain",
  "scheme",
  "attacker",
  "minion",
  "attachTo",
]);

function bindsOf(effect: EffectSpec, scope: Scope): void {
  switch (effect.kind) {
    // A required target choice that finds nothing sets `UNRESOLVED_VAR` (`choiceFoundNothing`, RRG 1.8 "Target").
    case "chooseTarget":
    case "chooseCards":
      scope.slots.add(effect.slot);
      scope.vars.add(UNRESOLVED_VAR);
      return;
    case "choosePlayer":
    case "bindTargets":
      scope.slots.add(effect.slot);
      return;
    case "selectCards":
      scope.slots.add(effect.slot);
      scope.vars.add(`${effect.slot}.count`);
      return;
    // A sequential pool's `<bind>.amount` / `.dealt` / `.lost` (docs/phase7-wave8.md §3.37).
    case "assignDamage":
      if (effect.bind) scope.prefixes.add(`${effect.bind}.`);
      return;
    // The characters whose assigned card matches, every character given one, and the two counts
    // (docs/phase7-wave8.md §3.36).
    case "pairCards":
      scope.slots.add(`${effect.bind}.matched`);
      scope.slots.add(`${effect.bind}.paired`);
      scope.vars.add(`${effect.bind}.pairs`);
      scope.vars.add(`${effect.bind}.count`);
      return;
    // The one card a "find" found (docs/phase7-wave6.md §3.48).
    case "findCard":
      if (effect.bind) scope.slots.add(effect.bind);
      return;
    // How many cards came out of a hidden pile (docs/phase7-wave9.md §3.29 (a)); the cards are not instances.
    case "gainFromHiddenPile":
    case "revealHiddenPile":
      if (effect.bind) scope.vars.add(`${effect.bind}.count`);
      return;
    // `draw` with a bind: the cards drawn and `<bind>.count` (docs/phase7-wave8.md §3.70).
    case "draw":
    case "lookAt":
      if (effect.bind) {
        scope.slots.add(effect.bind);
        scope.vars.add(`${effect.bind}.count`);
      }
      // The card at each looked-at position once the look is over (docs/phase7-wave9.md §3.44).
      if (effect.kind === "lookAt") for (const name of effect.bindAt ?? []) scope.slots.add(name);
      return;
    // The cards that entered play and `<bind>.count` (docs/phase7-wave4.md §3.59).
    // `addVillain` binds the same shape (the villains now in play, and how many): "If no villain was put into play
    // this way" (docs/phase7-wave5.md §3.1) — the Sinister Six's "Ambush!" reads its own bind right back with
    // `setActiveVillain(chosen(bind))`, which needs the slot registered here.
    case "putIntoPlay":
    case "putIntoPlayAsHost":
    case "addVillain":
      if (effect.bind) {
        scope.slots.add(effect.bind);
        scope.vars.add(`${effect.bind}.count`);
      }
      return;
    // `<bind>.count`: how many abilities were resolved (docs/phase7-wave4.md §3.56); `<bind>.<slot>` / `<bind>.<var>`:
    // what the resolved abilities' own effects bound (docs/phase7-wave5.md §3.7).
    case "resolveSpecials":
      if (effect.bind) {
        scope.vars.add(`${effect.bind}.count`);
        scope.prefixes.add(`${effect.bind}.`);
      }
      return;
    case "discardEncounterUntil":
    case "discardDeckUntil":
    // The card found in the collection and `<bind>.count` (docs/phase7-wave7.md §3.81).
    case "searchCollection":
      scope.slots.add(effect.bind);
      scope.vars.add(`${effect.bind}.count`);
      // Every card a player-deck "discard until" discarded, with a bound set's totals (docs/phase7-wave8.md §3.71).
      if (effect.kind === "discardDeckUntil" && effect.bindAll !== undefined) {
        scope.slots.add(effect.bindAll);
        scope.prefixes.add(`${effect.bindAll}.`);
      }
      return;
    case "moveCards":
    case "enemyAttack":
    case "enemyScheme":
    case "enemyActivation":
    case "attack":
    case "thwart":
    case "dealDamage":
    case "heal":
    case "placeThreat":
    case "removeThreat":
    // "Discard cards from the encounter deck until N are discarded" binds the discarded cards themselves to `bind`
    // (docs/phase7-wave1.md §3.12), so it belongs with the card-selecting effects above, not the vars-only ones below.
    case "discardEncounterCards":
      if (effect.bind) {
        scope.slots.add(effect.bind);
        scope.prefixes.add(`${effect.bind}.`);
      }
      return;
    case "spendResources":
    // `<bind>.amount` / `<bind>.made` (docs/phase7-wave6.md §3.69).
    case "chooseNumber":
    // `<bind>.group` / `<bind>.made` (docs/phase7-wave9.md §3.67).
    case "chooseGroup":
    // `<bind>.boostIcons` (docs/phase7-wave2.md §3.6).
    case "countBoostIcons":
    // `<bind>.chosen.<type>` / `<bind>.made` (docs/phase7-wave7.md §3.33).
    case "chooseCardType":
    // `<bind>.amount` / `<bind>.made` (docs/phase7-wave7.md §3.83).
    case "reportFact":
      scope.prefixes.add(`${effect.bind}.`);
      return;
    // A snapshot var (docs/phase7-wave4.md §3.46).
    case "setVar":
      scope.vars.add(effect.name);
      return;
    // Vars only (`<bind>.made`, `.amount`, `.forcedResponses`, ...): no cards are bound to the slot itself.
    // docs/phase7-wave1.md §3.6 (cancelBoostIcons/cancelBoostAbility), §3.7 (dealIndirectDamage) and §3.8 (moveThreat)
    // each flagged this as a gap for `ability-scripting-engineer` before their cards could be scripted.
    case "cancelBoostIcons":
    case "discardBoostCard":
    case "cancelBoostAbility":
    case "enemyAttacksEnemy":
    case "friendlyCharacterAttacks":
    case "dealIndirectDamage":
    case "moveThreat":
    case "divide":
    // `<bind>.amount` prevented, `<bind>.made` set shuffled in (docs/phase7-wave4.md §3.20, §3.18).
    case "preventDamage":
    case "reduceDamageTo":
    case "shuffleInSetAsideModularSet":
      if (effect.bind) scope.prefixes.add(`${effect.bind}.`);
      return;
    // `<bind>.amount`: how many counters were actually placed (docs/phase7-wave3.md §3.10) — "If you cannot, draw
    // 1 card." (Drax, `wave3/drax/drax-kit.ts` 19001a) needed this case; it was documented on `EffectSpec
    // addCounters` itself but never wired into the validator's own bind tracking.
    case "addCounters":
    // `<bind>.amount`: how many status cards were actually given (docs/phase7-wave4.md §3.60).
    case "giveStatus":
    // `<bind>.amount`: how many status cards were actually discarded (docs/phase7-wave6.md §3.6).
    case "removeStatus":
    // `<bind>.amount` and, per card, `<bind>.amount.<instanceId>` (`ValueSpec var.of`): the counters removed.
    case "removeCounters":
      if (effect.bind) scope.prefixes.add(`${effect.bind}.`);
      return;
    default:
      return;
  }
}

/**
 * `loops`: the `bind` names of the bound `forEachPlayer` / `forEachCard` loops `walk` is inside, outermost first (a
 * nested loop must not reuse one).
 */
function walk(
  effects: readonly EffectSpec[],
  scope: Scope,
  path: string,
  problems: string[],
  loops: readonly string[] = [],
): void {
  effects.forEach((effect, index) => {
    const where = `${path}[${index}] ${effect.kind}`;
    if (effect.kind === "chooseOne") {
      effect.options.forEach((option, i) => {
        if (option.condition) checkRefs(option.condition, scope, `${where} option ${i}`, problems);
        walk(option.effects, scope, `${where}.options[${i}]`, problems, loops);
      });
      return;
    }
    // "Repeat this effect" (docs/phase7-wave4.md §3.54): the condition is read after the repeated effects, so it may
    // read what they bind.
    if (effect.kind === "repeatWhile") {
      walk(effect.effects, scope, `${where}/0`, problems, loops);
      checkRefs(effect.while, scope, `${where} while`, problems);
      return;
    }
    // "For each …, choose" (RRG 1.8 "'For Each'", p. 20): each pass is its own instance, so what the repeated effects
    // bind is read inside them only. The engine hands nothing a pass bound to the effects after the repetition.
    if (effect.kind === "repeatTimes") {
      if (effect.times.kind === "const" && !(Number.isInteger(effect.times.value) && effect.times.value >= 1))
        problems.push(`${where}: times must be a whole number of at least 1`);
      if (effect.effects.length === 0) problems.push(`${where}: repeats no effects`);
      checkRefs(effect.times, scope, `${where} times`, problems);
      const pass: Scope = {
        slots: new Set(scope.slots),
        vars: new Set(scope.vars),
        prefixes: new Set(scope.prefixes),
      };
      walk(effect.effects, pass, `${where}/0`, problems, loops);
      return;
    }
    // "Each player …" with a `bind`: each pass is its own frame, so what it binds is read inside it, and comes back to
    // the effects after the loop under `<bind>.` only (vars summed over the players). Without one, walked as before.
    // The name must be new: a pass drops the `<bind>.` names it inherits and the loop sums onto any already there, so
    // one already known (an earlier `bind`, or an enclosing loop's) would mix the two. A pass must not bind a var or
    // slot the ability already holds either: a pass hands back only what differs from what it inherited
    // (`Frame<"effects">.returnChangedFrom`), so binding the same value again would be lost.
    if (effect.kind === "forEachPlayer" && effect.bind !== undefined) {
      const prefix = `${effect.bind}.`;
      if (effect.bind.length === 0) problems.push(`${where}: forEachPlayer bind needs a name`);
      else if (
        scope.prefixes.has(prefix) ||
        [...scope.vars, ...scope.slots].some((name) => name.startsWith(prefix)) ||
        loops.includes(effect.bind)
      )
        problems.push(`${where}: forEachPlayer bind "${effect.bind}" is already bound earlier in the ability`);
      checkRefs(effect.players, scope, `${where} players`, problems);
      const bound: Scope = { slots: new Set(), vars: new Set(), prefixes: new Set() };
      for (const inner of allEffects(effect.effects)) bindsOf(inner, bound);
      for (const name of [...bound.vars, ...bound.slots])
        if (scope.vars.has(name) || scope.slots.has(name))
          problems.push(
            `${where}: a forEachPlayer bind pass binds "${name}", which the ability already holds; use a new name`,
          );
      const pass: Scope = {
        slots: new Set(scope.slots),
        vars: new Set(scope.vars),
        prefixes: new Set(scope.prefixes),
      };
      walk(effect.effects, pass, `${where}/0`, problems, [...loops, effect.bind]);
      scope.prefixes.add(prefix);
      return;
    }
    // "For each character you control, … that character" (RRG 1.8 "'For Each'", p. 20): the pass's card is read under
    // `slot` inside the repeated effects only, and nothing a pass binds is handed to the effects after the loop,
    // unless the loop has a `bind`: then the passes' binds come back under `<bind>.` (`<bind>.count` among them).
    if (effect.kind === "forEachCard") {
      if (effect.slot.length === 0) problems.push(`${where}: forEachCard needs a slot name for the pass's card`);
      if (scope.slots.has(effect.slot))
        problems.push(`${where}: forEachCard slot "${effect.slot}" is already bound earlier in the ability`);
      if (effect.effects.length === 0) problems.push(`${where}: forEachCard repeats no effects`);
      checkRefs(effect.cards, scope, `${where} cards`, problems);
      const pass: Scope = {
        slots: new Set([...scope.slots, effect.slot]),
        vars: new Set(scope.vars),
        prefixes: new Set(scope.prefixes),
      };
      if (effect.bind !== undefined && loops.includes(effect.bind))
        problems.push(`${where}: forEachCard bind "${effect.bind}" is already an enclosing loop's bind`);
      walk(effect.effects, pass, `${where}/0`, problems, effect.bind === undefined ? loops : [...loops, effect.bind]);
      if (effect.bind !== undefined) {
        if (effect.bind.length === 0) problems.push(`${where}: forEachCard bind needs a name`);
        scope.prefixes.add(`${effect.bind}.`);
      }
      return;
    }
    // A block resolved in a group's game area (docs/phase7-wave9.md §3.67) may be sent to another group, which has
    // none of this ability's slots, vars or triggering event: it starts from nothing, and hands nothing back.
    if (effect.kind === "inGroup") {
      if (effect.effects.length === 0) problems.push(`${where}: inGroup resolves no effects`);
      if (typeof effect.group === "object" && !known(scope, scope.vars, `${effect.group.var}.group`))
        problems.push(`${where}: group "${effect.group.var}" is read before chooseGroup binds it`);
      if (readsKind(effect.effects, (kind) => kind === "inGroup" || kind === "chooseGroup"))
        problems.push(`${where}: a block resolved in a group's area cannot name another group`);
      if (readsKind(effect.effects, (kind) => kind.startsWith("event")))
        problems.push(`${where}: a block resolved in a group's area cannot read the triggering event`);
      walk(effect.effects, { slots: new Set(), vars: new Set(), prefixes: new Set() }, `${where}/0`, problems, loops);
      return;
    }
    // `enemyScheme.wouldPlaceThreat`: resolved later, at the activation's place-threat step, with this ability's slots
    // and vars as they are here; what those effects bind is read inside them only, and this effect's own `bind` is not
    // theirs to read (the activation has not finished).
    if (effect.kind === "enemyScheme" && effect.wouldPlaceThreat) {
      const { wouldPlaceThreat, ...scheme } = effect;
      if (wouldPlaceThreat.length === 0) problems.push(`${where}: wouldPlaceThreat resolves no effects`);
      checkRefs(scheme, scope, where, problems);
      const placing: Scope = {
        slots: new Set(scope.slots),
        vars: new Set(scope.vars),
        prefixes: new Set(scope.prefixes),
      };
      walk(wouldPlaceThreat, placing, `${where}/0`, problems, loops);
      bindsOf(effect, scope);
      return;
    }
    if (effect.kind === "giveStatus" && effect.replacing === effect.status)
      problems.push(`${where}: a status card is replaced with a different status card (replacing equals status)`);
    if (
      effect.kind === "removeStatus" &&
      effect.count !== undefined &&
      !(Number.isInteger(effect.count) && effect.count >= 1)
    )
      problems.push(`${where}: count must be a whole number of at least 1`);
    // A held minion is in play (docs/phase7-wave9.md §3.21); a facedown attachment is out of play (RRG 1.8 p. 23).
    if (effect.kind === "attach" && effect.as === "heldMinion" && effect.facedown === true)
      problems.push(`${where}: a held minion is attached faceup (as: "heldMinion" with facedown)`);
    if (effect.kind === "attach" && effect.as === "captive" && effect.facedown === true)
      problems.push(`${where}: a captive ally is attached faceup (as: "captive" with facedown)`);
    // The flag is the literal `true` or absent, so a serialized definition has one form (the engine reads `=== true`).
    if (effect.kind === "defeat" && effect.ignoreWhenDefeated !== undefined && effect.ignoreWhenDefeated !== true)
      problems.push(`${where}: ignoreWhenDefeated is true or absent`);
    // One trait, or the traits of a character (docs/phase7-wave6.md §3.50), never both or neither.
    if (effect.kind === "grantTraitUntil" && (effect.trait === undefined) === (effect.traitsOf === undefined))
      problems.push(`${where}: needs exactly one of trait and traitsOf`);
    // A moment carries what the ability has bound by then (docs/phase7-wave8.md §3.71): a slot bound later, or never,
    // would reach the answers empty.
    if (effect.kind === "raiseMoment") {
      for (const slot of effect.carry ?? [])
        if (!scope.slots.has(slot)) problems.push(`${where}: carried slot "${slot}" is not bound before the moment`);
    }
    checkRefs(effect, scope, where, problems);
    nestedLists(effect).forEach((list, i) => walk(list, scope, `${where}/${i}`, problems, loops));
    bindsOf(effect, scope);
  });
}

function checkBindings(definition: AbilityDefinition, problems: string[]): void {
  // `"x"`: the play's own var for a cost printed "X" (`specialCost: "X"`; Speed Cyclone 14006, docs/phase7-wave2.md
  // §3.8) — bound by `playCard.x` before any of the card's own abilities run, the same class of externally-supplied
  // var `"paid."`/`"overpaid."` already are (never bound *by* the ability itself, so nothing here could bind it).
  const scope: Scope = {
    slots: new Set(),
    vars: new Set(["x"]),
    prefixes: new Set(["paid.", "overpaid.", "sequence.", "self.counters."]),
  };
  // What an answered moment carries (`raiseMoment.carry`, docs/phase7-wave8.md §3.71) is the answering ability's to
  // read as `moment.<slot>`, slot and vars: bound by the engine from the event, never by the ability.
  const trigger = definition.trigger;
  if (trigger.kind === "response" && trigger.on && kindsOfPattern(trigger.on).includes("momentRaised"))
    scope.prefixes.add(MOMENT_PREFIX);
  // So are the slots of the ability whose resolution it answers (`abilityResolved.carried`, wave 9 §3.43 (c)).
  if (trigger.kind === "response" && trigger.on && kindsOfPattern(trigger.on).includes("abilityResolved"))
    scope.prefixes.add(MOMENT_PREFIX);
  // An ability that answers an occurrence once (`EventPattern.together`) reads every condition's target from a slot
  // the engine binds as it is initiated.
  if ((trigger.kind === "response" || trigger.kind === "interrupt") && trigger.on?.together === true)
    scope.slots.add(TOGETHER_TARGETS_SLOT);
  // A Preparation another card's rule gives (`RuleSpec grantsLabeledAbility`, docs/phase7-wave9.md §3.3) names its
  // granting card from a slot the engine binds as it resolves (`grantingCard`).
  if (trigger.kind === "preparation") scope.slots.add(GRANTED_BY_SLOT);
  // A `conditional` cost (docs/phase7-wave3.md §3.49) binds what either branch binds, and `cost.condition`.
  // Not on an additional cost to play: its pick is made as the play is priced and is not recorded (`playCostWith`).
  const additionalPlayCost = trigger.kind === "constant" && trigger.additionalCostToPlay !== undefined;
  if (definition.cost?.conditional && !additionalPlayCost) scope.vars.add("cost.condition");
  // A resource ability's effects resolve with the payment, the card paid for bound to `paidFor` (engine
  // `announceResourcesSpent`; docs/phase7-wave4.md §3.30, wave 6 §3.30).
  if (definition.trigger.kind === "resource") scope.slots.add(PAID_FOR_SLOT);
  for (const cost of definition.cost ? costVariants(definition.cost) : []) {
    if (cost.discardFromHand) {
      scope.slots.add("discard");
      if (cost.discardFromHand.bind) scope.vars.add(cost.discardFromHand.bind);
    }
    // "For each threat here" after a discard-self cost (Beat Cop): snapshotted with the counters (`AbilityCost.discardSelf`).
    if (cost.discardSelf) {
      scope.vars.add("self.threat");
      scope.vars.add("self.damage");
    }
    if (cost.payPrintedCostOf) scope.slots.add(cost.payPrintedCostOf.slot);
    if (cost.chooseCard) scope.slots.add(cost.chooseCard.slot);
    if (cost.discardFromDeckSlot !== undefined) scope.slots.add(cost.discardFromDeckSlot);
    // docs/phase7-wave6.md §3.49: the host an attach cost picked, and the attached card when bound.
    if (cost.attach) {
      scope.slots.add(cost.attach.to.slot);
      if (cost.attach.bind) scope.slots.add(cost.attach.bind);
    }
    // docs/phase7-wave10-box-heroes.md B3.1: the card a search cost put into play.
    if (cost.searchEncounterIntoPlay) scope.slots.add(cost.searchEncounterIntoPlay.slot);
    // docs/phase7-wave6.md §3.54: the cards discarded, their number and their boost icons.
    for (const component of [cost, ...(cost.either ?? [])]) {
      const look = component.encounterLookDiscard;
      if (!look) continue;
      scope.slots.add(look.slot);
      scope.vars.add(`${look.slot}.count`);
      scope.vars.add(`${look.slot}.boostIcons`);
    }
    // docs/phase7-wave9.md §3.43 (a): the cards discarded from the encounter deck, their number, the number chosen
    // and their icon totals.
    for (const component of [cost, ...(cost.either ?? [])]) {
      const fromEncounter = component.discardFromEncounterDeck;
      if (!fromEncounter) continue;
      scope.slots.add(fromEncounter.slot);
      for (const total of ["count", "chosen", "boostIcons", "starIcons", "physical", "mental", "energy", "wild"])
        scope.vars.add(`${fromEncounter.slot}.${total}`);
    }
    if (cost.resourcesX) scope.vars.add(cost.resourcesX.bind);
    if (cost.resourcesEqualTo !== undefined) scope.vars.add("cost.resources");
    // "Spend up to 3 resources →" records the size chosen (docs/phase7-wave8.md §3.62).
    if (isResourcesChoice(cost.resources)) scope.vars.add("cost.resources");
    // A computed or chosen "take N damage →" records its amount (`AbilityCost.damageSelf`, docs/phase7-wave7.md §3.79).
    if (cost.damageSelf !== undefined && typeof cost.damageSelf !== "number") scope.vars.add("cost.damageSelf");
    // "Remove [up to] N threat from [a card] →" records how much it removed (docs/phase7-wave9.md §3.7 (b)).
    if (cost.removeThreat) scope.vars.add("cost.removeThreat");
    // A chosen "discard up to N cards from the top of your deck →" records how many it discarded (wave 8 §3.55).
    if (typeof cost.discardFromDeck === "object" && "choose" in cost.discardFromDeck)
      scope.vars.add("cost.discardFromDeck");
    // "Remove up to 4 growth counters → choose that many" (docs/phase7-wave3.md §3.32), in the cost or any branch;
    // `cost.branch`, the either/or branch paid (§3.36).
    for (const component of [cost, ...(cost.either ?? [])]) {
      if (component.spendCounters?.bind) scope.vars.add(component.spendCounters.bind);
    }
    if (cost.either) scope.vars.add("cost.branch");
    // Slots chosen by a cost component, in the cost or any either/or branch. A slot only a branch picks is in scope
    // for the effects but reads empty when the other branch was the one paid (`cost.branch` says which).
    for (const component of [cost, ...(cost.either ?? [])]) {
      if (component.removeThreat?.choose) scope.slots.add(component.removeThreat.choose.slot);
      if (component.dealDamage?.choose) scope.slots.add(component.dealDamage.choose.slot);
      if (component.dealEncounterCardsTo) scope.slots.add(component.dealEncounterCardsTo.slot);
      if (component.healCharacter) scope.slots.add(component.healCharacter.slot);
      if (component.chooseTarget) scope.slots.add(component.chooseTarget.slot);
    }
    for (const { pick } of [cost, ...(cost.either ?? [])].flatMap((component) => inPlayPicksOf(component))) {
      scope.slots.add(pick.slot);
      if (pick.bindHosts) scope.slots.add(pick.bindHosts);
      if (pick.snapshotStats) for (const stat of ["thw", "atk", "def"]) scope.vars.add(`${pick.slot}.${stat}`);
      if (pick.bind) scope.vars.add(pick.bind);
    }
  }
  if (definition.trigger.kind === "constant") {
    // A constant modifier's `while` and amount are read with the card whose stat it is bound to "affected" (engine
    // `AFFECTED_SLOT`): "each X-MEN character gets +1 THW while making a basic thwart against this scheme".
    const { modifiers, ...rest } = definition.trigger;
    checkRefs(rest, scope, "constant", problems);
    if (modifiers !== undefined) {
      const reading = { ...scope, slots: new Set([...scope.slots, "affected"]) };
      modifiers.forEach((modifier, index) => {
        const { while: condition, amount, ...other } = modifier;
        checkRefs(other, scope, "constant", problems);
        if (condition !== undefined) checkRefs(condition, reading, `constant modifiers[${index}] while`, problems);
        if (typeof amount !== "number") checkRefs(amount, reading, `constant modifiers[${index}] amount`, problems);
      });
    }
    // The effects of an additional cost to play resolve with its cost's slots bound (box-heroes B3.1).
    if (definition.trigger.additionalCostToPlay) walk(definition.effects, scope, "effects", problems);
    return;
  }
  walk(definition.effects, scope, "effects", problems);
}

const ABILITY_ID = /^\d{5}[a-z]?\.[a-z0-9-]+$/;

/**
 * True in a production bundle: Vite replaces `import.meta.env` there, Vitest and the dev server say false, and plain
 * Node has no `env`. Checking every ability as its module loads was the largest single cost of the app's first load,
 * about 4 s of a 9 s main-thread freeze at Chrome's 6x CPU slowdown (#223, `scripts/profile-first-load.mjs`). Every
 * card module is loaded, and so checked, by the unit tests and the dev server before a build ships.
 */
const SKIP_CHECKS = (import.meta as ImportMeta & { readonly env?: { readonly PROD?: boolean } }).env?.PROD === true;

/**
 * Defines a module of card abilities keyed by their `AbilityReference` ids
 * (`<cardCode>.<slug>`). Throws on the first import if any definition is
 * malformed, so a broken card fails loudly in every test that loads it.
 */
export function defineAbilities<const T extends Readonly<Record<string, AbilityDefinition>>>(definitions: T): T {
  if (SKIP_CHECKS) return definitions;
  const problems: string[] = [];
  for (const [id, definition] of Object.entries(definitions)) {
    if (!ABILITY_ID.test(id)) problems.push(`${id}: not a <cardCode>.<slug> ability id`);
    for (const problem of validateDefinition(definition)) problems.push(`${id}: ${problem}`);
  }
  if (problems.length > 0) throw new Error(`invalid ability definitions:\n  ${problems.join("\n  ")}`);
  return definitions;
}

/** Merges ability modules into one registry; an id defined twice is an error. */
export function mergeRegistries(...modules: readonly Readonly<Record<string, AbilityDefinition>>[]): AbilityRegistry {
  const merged: Record<string, AbilityDefinition> = {};
  for (const module of modules) {
    for (const [id, definition] of Object.entries(module)) {
      if (id in merged) throw new Error(`ability ${id} is defined twice`);
      merged[id] = definition;
    }
  }
  return merged;
}
