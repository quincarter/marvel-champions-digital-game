/**
 * "Resolve its 'Forced Response' as if it just attacked you →" as an ability cost (`AbilityCost.resolveAbility`;
 * docs/phase7-wave8.md §3.11): whether it can be paid, and the steps that pay it.
 *
 * The cost is paid by resolving another card's printed abilities of one kind, the same `resolveSpecials` effect a
 * card's "resolve the 'Forced Response' on the active villain" uses, pushed by `payCost` above the frame it pays for
 * (`enemy-attack-cost.ts`'s pattern), so those abilities resolve in full before that frame's effects: "Nonbolded text
 * before the cost arrow icon must be paid and/or resolved in full before the text after the cost arrow icon can be
 * resolved" (RRG 1.8 "Cost Arrow Icon", p. 14).
 *
 * **Not payable when resolving them would change nothing** (owner decision §4.1 Q7 = A, "the normal valid-target and
 * initiation rule"): RRG 1.8 "Initiating Abilities" (p. 24) refuses an ability whose cost cannot be paid, and "Cost"
 * (p. 13) has a cost paid in full or not at all. Whether resolving would change anything is not guessed from the
 * abilities' shape: `resolvingWouldChange` resolves them on a copy of the state and looks.
 */

import { type AbilityCost, type EngineDeps, resolvableAs } from "./abilities.js";
import { COST_NOT_PAID_VAR } from "./cost-damage.js";
import { createCtx, type Ctx, emit, setFrame } from "./ctx.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { getInstance } from "./query.js";
import { addFrameVars, pushEffects, type Frame } from "./resolve/frames.js";
import { executeFrame } from "./resolve/index.js";
import { activeAbilityRefs, type EffectContext, resolveRef } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { Bindings } from "./stack.js";
import type { GameState } from "./state.js";

type ResolveAbilityCost = NonNullable<AbilityCost["resolveAbility"]>;

/** The slot the card whose abilities resolve is bound to on the steps `payCost` pushes, and the prefix they report under. */
const OF_SLOT = "_costResolveOf";
const BIND = "costResolve";

/** Every card the cost's ref names, read with the cost's own picks bound. */
export function resolveAbilityCostCandidates(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: ResolveAbilityCost,
  bindings: Bindings,
): readonly InstanceId[] {
  const context: EffectContext = { selfInstanceId: sourceId, controllerId: playerId, event: null, bindings, deps };
  return resolveRef(state, cost.of, context);
}

/**
 * The card the cost names: the payer's pick once it is bound to the cost's `choose` slot (`planResolveAbilityCost`),
 * else the first card its ref resolves to.
 */
export function resolveAbilityCostCard(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: ResolveAbilityCost,
  bindings: Bindings,
): InstanceId | null {
  const picked = cost.choose ? bindings[cost.choose]?.[0] : undefined;
  if (picked !== undefined) return picked;
  return resolveAbilityCostCandidates(state, deps, sourceId, playerId, cost, bindings)[0] ?? null;
}

/**
 * Plans the cost for `planCost`: the card whose abilities will resolve, or why the cost cannot be paid. With `choose`
 * (§4.1 Q15 = A) the card is the payer's pick in `choices[choose]`, which must be one of the cards the ref names and
 * one whose abilities would change something; with no pick given the cost pays itself only when the choice is forced
 * (exactly one card named), as an in-play cost pick does. The caller binds the card to the slot.
 */
export function planResolveAbilityCost(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: ResolveAbilityCost,
  choices: Readonly<Record<string, readonly InstanceId[]>>,
  bindings: Bindings,
): { readonly ofId: InstanceId } | { readonly fault: string; readonly choice?: true } {
  const candidates = resolveAbilityCostCandidates(state, deps, sourceId, playerId, cost, bindings);
  let ofId: InstanceId | null = candidates[0] ?? null;
  if (cost.choose) {
    const given = choices[cost.choose];
    if (given) {
      const [pick, ...extra] = given;
      if (pick === undefined || extra.length > 0 || !candidates.includes(pick))
        return { fault: `choose exactly one card for ${cost.choose}`, choice: true };
      ofId = pick;
    } else if (candidates.length > 1) {
      return { fault: `choose which card's ability to resolve for ${cost.choose}`, choice: true };
    }
  }
  const fault = resolveAbilityCostFault(state, deps, sourceId, playerId, ofId, cost);
  return fault || ofId === null ? { fault: fault ?? "no card whose ability this cost resolves" } : { ofId };
}

/** The effect that pays the cost: the named card's abilities of the cost's kind, with the payer as "you". */
const resolving = (cost: ResolveAbilityCost): EffectSpec => ({
  kind: "resolveSpecials",
  of: { kind: "slot", slot: OF_SLOT },
  player: { kind: "controller" },
  trigger: cost.trigger,
  ...(cost.abilities ? { abilities: cost.abilities } : {}),
  ...(cost.asIf ? { asIf: cost.asIf } : {}),
  bind: BIND,
});

/**
 * Every field of the state, as a probe reads it: `game` is the game itself, compared before and after; `bookkeeping`
 * is what resolving anything leaves different without the game having changed, and is not compared.
 *
 * The map is exhaustive over `GameState` by its type, so a field added to the state does not compile until it is
 * placed here: a bookkeeping field cannot be forgotten and so read as a change (a cost judged payable that is not).
 *
 * Bookkeeping: the stack and the open choice; the counters that name frames, choices and lasting effects; the
 * per-ability use counts ("Limit once per round" counts a resolution that did nothing); and the memory of what the
 * between-frames checks and the log last saw (`stateChecks`, `hitPointsSeen`, `deckTopsAnnounced`, `encounterTopAnnounced`), none of which the
 * game is ever read from. The queues those checks drain (`pending…`) are game: a card left play or entered a hand.
 */
export const PROBE_FIELDS: { readonly [K in keyof Required<GameState>]: "game" | "bookkeeping" } = {
  stack: "bookkeeping",
  pendingChoice: "bookkeeping",
  nextFrameSeq: "bookkeeping",
  nextChoiceSeq: "bookkeeping",
  nextLastingSeq: "bookkeeping",
  abilityUses: "bookkeeping",
  stateChecks: "bookkeeping",
  hitPointsSeen: "bookkeeping",
  deckTopsAnnounced: "bookkeeping",
  encounterTopAnnounced: "bookkeeping",
  round: "game",
  step: "game",
  firstPlayerId: "game",
  startingPlayerCount: "game",
  players: "game",
  villains: "game",
  activeVillainId: "game",
  villainRow: "game",
  mainScheme: "game",
  extraMainSchemes: "game",
  gameAreas: "game",
  nextGameAreaSeq: "game",
  spentMainSchemeStages: "game",
  revealedMainSchemes: "game",
  scenarioRules: "game",
  tableRules: "game",
  encounterDecks: "game",
  encounterDeckOrder: "game",
  encounterSetAside: "game",
  setAsideModularSets: "game",
  scenarioDecks: "game",
  pendingDeckRunOuts: "game",
  pendingEncounterFromDeck: "game",
  pendingEnteredHand: "game",
  pendingEncounterDealt: "game",
  pendingEncounterDeals: "game",
  pendingLeftPlay: "game",
  pendingStatusPlaced: "game",
  pendingDeckDiscards: "game",
  pendingTuckedDiscards: "game",
  pendingBoostGiven: "game",
  deckDiscardWindows: "game",
  villainArea: "game",
  victoryDisplay: "game",
  removedFromGame: "game",
  instances: "game",
  cardPool: "game",
  lastingEffects: "game",
  heldAtZero: "game",
  heldAtNoThreat: "game",
  playedThisRound: "game",
  playedThisPhase: "game",
  playedByPlayerThisRound: "game",
  attackedThisTurn: "game",
  attacksThisTurn: "game",
  characterActsThisPhase: "game",
  revealedThisRound: "game",
  playedThisTurn: "game",
  playedByPlayerThisPhase: "game",
  scenarioAreas: "game",
  scenarioPlayAreas: "game",
  hiddenPiles: "game",
  revealedPileCards: "game",
  accusation: "game",
  campaign: "game",
  campaignWrites: "game",
  setupStack: "game",
  villainsEnteringAtSetup: "game",
  setupCardsAwaitingHost: "game",
  outcome: "game",
  rng: "game",
  nextInstanceSeq: "game",
};

const GAME_FIELDS = (Object.keys(PROBE_FIELDS) as (keyof GameState)[]).filter((key) => PROBE_FIELDS[key] === "game");

/** Whether two states hold the same game: every `game` field of `PROBE_FIELDS`, by identity or else by content. */
export function sameGame(a: GameState, b: GameState): boolean {
  for (const key of GAME_FIELDS) {
    if (a[key] !== b[key] && JSON.stringify(a[key]) !== JSON.stringify(b[key])) return false;
  }
  return true;
}

/** Frames a probe runs before it stops looking and answers yes: far more than any printed ability resolves in. */
const PROBE_FRAMES = 400;
/**
 * How deep probes nest. A cost judged while a probe resolves (an interrupt offered in one of its windows, a predicate
 * that asks whether a power could be paid for) is probed in turn, on the outer probe's state; a cost asked about any
 * deeper than this is not payable, which ends a cost whose abilities lead back to itself. Refusing is the side RRG 1.8
 * "Initiating Abilities" (p. 24) errs on: an ability whose cost cannot be shown payable is not initiated.
 */
const PROBE_DEPTH_LIMIT = 2;
/**
 * How many probes deep a resolution is, carried on the deps a probe resolves with: a probe hands its frames a copy of
 * the deps marked one deeper, and everything those frames call receives that copy. No state outside the call: a
 * probe that throws leaves nothing set, and two games probing at once do not see each other.
 */
const PROBE_DEPTH = Symbol("probeDepth");
type ProbeDeps = EngineDeps & { readonly [PROBE_DEPTH]?: number };
const probeDepthOf = (deps: EngineDeps): number => (deps as ProbeDeps)[PROBE_DEPTH] ?? 0;

/**
 * Whether resolving `ofId`'s abilities as this cost asks would change the game right now, found by resolving them on
 * a copy of the state (the state is immutable data, so the copy is the state itself and nothing here reaches the real
 * game or its log). The answer is yes as soon as the game would be over, a player would be asked a choice with
 * something to choose, or a `game` field of the state (`PROBE_FIELDS`) differs after a frame; no when no such ability
 * is live on the card (a blank text box, the wrong face) or everything they did left the game as it was (a discard
 * with nothing to discard, damage to nobody). The frames beneath stay on the copy's stack untouched, so the abilities
 * read the same surroundings they will read when the cost is paid.
 *
 * **Between frames.** The game's own loop (`runFlow`) looks at the state between frames: it drains the `pending…`
 * queues and fires condition-triggered abilities. The probe does not, and does not need to: each of those reacts to a
 * game field that has already changed (a card that left play, damage that brought a character to zero), and the probe
 * has answered yes at the frame that changed it, before any of them would have run. It is looked at after every frame
 * for that reason, not once at the end: a change undone by a later frame (damage, then healing) is still a change.
 * The one thing this cannot see is a condition that reads the stack alone, which no game field records.
 */
export function resolvingWouldChange(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  ofId: InstanceId,
  cost: ResolveAbilityCost,
): boolean {
  const depth = probeDepthOf(deps);
  if (depth >= PROBE_DEPTH_LIMIT) return false;
  const probeDeps: ProbeDeps = { ...deps, [PROBE_DEPTH]: depth + 1 };
  const before: GameState = { ...state, pendingChoice: null };
  const ctx = createCtx(before, probeDeps);
  const floor = before.stack.length;
  pushEffects(ctx, {
    effects: [resolving(cost)],
    selfInstanceId: sourceId,
    controllerId: playerId,
    bindings: { [OF_SLOT]: [ofId] },
  });
  for (let frames = 0; ctx.state.stack.length > floor; frames++) {
    if (frames >= PROBE_FRAMES) return true;
    executeFrame(ctx);
    if (ctx.state.outcome !== before.outcome) return true;
    if (!sameGame(before, ctx.state)) return true;
    if (ctx.state.pendingChoice) return ctx.state.pendingChoice.options.length > 0;
  }
  return false;
}

/**
 * Why the cost could not be paid right now, or null if it could: the card it names is not there, it has no live
 * printed ability of the kind (RRG 1.8 "Text Box", p. 44: a blank text box has none), or resolving what it has would
 * change nothing (§4.1 Q7 = A).
 */
export function resolveAbilityCostFault(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  ofId: InstanceId | null,
  cost: ResolveAbilityCost,
): string | null {
  if (ofId === null || !getInstance(state, ofId)) return "no card whose ability this cost resolves";
  const only = cost.abilities ? new Set<string>(cost.abilities) : null;
  const live = activeAbilityRefs(state, ofId, deps).some(
    (ref) => resolvableAs(deps.abilities[ref.id], cost.trigger) && (!only || only.has(ref.id)),
  );
  if (!live) return "that card has no such ability to resolve";
  if (!resolvingWouldChange(state, deps, sourceId, playerId, ofId, cost))
    return "resolving that ability would change nothing";
  return null;
}

/**
 * The steps `payCost` pushes for the cost, above `paidFor`: `ofId`'s abilities resolve, then the cost is settled.
 * `wouldChange` is read as the steps are pushed, the moment the cost is paid; when it is false nothing resolves and the
 * settling step alone reports the cost unpaid.
 */
export function resolveAbilityCostEffects(
  ofId: InstanceId,
  cost: ResolveAbilityCost,
  wouldChange: boolean,
  paidFor: Frame<"ability"> | Frame<"playCard"> | null,
): { readonly effects: EffectSpec[]; readonly bindings: Bindings } {
  const settle: EffectSpec = {
    kind: "settleResolveAbilityCost",
    of: ofId,
    trigger: cost.trigger,
    bind: BIND,
    wouldChange,
    paidFor: paidFor?.frameId ?? null,
  };
  return { effects: wouldChange ? [resolving(cost), settle] : [settle], bindings: { [OF_SLOT]: [ofId] } };
}

/**
 * The `settleResolveAbilityCost` step: at least one ability resolved (`<bind>.count`) and resolving could change the
 * game when the cost was paid, so the cost is paid; otherwise the frame it paid for is marked (`COST_NOT_PAID_VAR`) and
 * the ability's effects do not resolve ("discard this card" stays undone). Whatever else of the cost was paid stays
 * paid.
 *
 * The abilities themselves are not second-guessed once they have resolved: one whose effects were then prevented or
 * replaced as they applied still resolved, as an attack another player defends is still the attack
 * (`settleEnemyAttackCost`).
 */
export function executeSettleResolveAbilityCost(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "settleResolveAbilityCost" }>,
): void {
  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  const resolved = frame.vars[`${effect.bind}.count`] ?? 0;
  const paid = effect.wouldChange && resolved > 0;
  emit(ctx, {
    type: "resolveAbilityCostSettled",
    instanceId: frame.selfInstanceId,
    playerId: frame.controllerId,
    ofInstanceId: effect.of,
    trigger: effect.trigger,
    resolved,
    paid,
  });
  if (!paid) addFrameVars(ctx, effect.paidFor, { [COST_NOT_PAID_VAR]: 1 });
}
