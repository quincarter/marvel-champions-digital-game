export const ENGINE_VERSION = "0.1.0";

export type { PlayerId, InstanceId, ChoiceId, EncounterDeckId, FrameId } from "./ids.js";
export { playerId, instanceId, choiceId, encounterDeckId, frameId } from "./ids.js";

export type { RngState } from "./rng.js";
export { createRng, nextInt, nextUint32, shuffle } from "./rng.js";

export type {
  CardHome,
  CardInstance,
  EncounterDeckState,
  FacedownRole,
  Form,
  GameOutcome,
  GameState,
  GameStep,
  IdentityState,
  MainSchemeState,
  PlayerState,
  SeparateDeckState,
  StatusCounts,
  VillainState,
  ZoneId,
} from "./state.js";
export { NO_STATUSES } from "./state.js";

export type { AttackInProgress, ChoiceOption, ChoicePrompt, ChoiceRef, DecisionAuthority, PendingChoice } from "./choices.js";

export { effectChoiceAuthority, encounterTargetSelector, isEncounterSide, simultaneousOrderer } from "./villain/authority.js";
export type { AuditViolation, VillainActivationRecord, VillainAudit, VillainDecisionRecord, VillainPhaseRecord } from "./villain/audit.js";
export { auditVillainPhases } from "./villain/audit.js";

export type {
  ActionRef,
  BlockedTarget,
  IllegalAction,
  LegalAction,
  LegalActions,
  PaymentAttempt,
  PaymentContext,
  PaymentQuery,
  PaymentSource,
} from "./legal.js";
export { legalActions, paymentFor, tryPayment } from "./legal.js";

/** What a card costs right now vs. what is printed on it, and the cards moving the price (Steve Rogers' Living Legend). */
export type { PlayCost, PlayCostContribution } from "./actions.js";
export { playCostOf } from "./actions.js";
export type { Command, CommandType, Payment } from "./commands.js";
export type { GameEvent, GameEventType } from "./events.js";
export type { EngineError, EngineErrorCode, IllegalDeck } from "./errors.js";

/** Deck legality (RRG 1.8 Appendix I) and playability in this build: two separate questions. */
export type { CardPool, DeckProblem, DeckProblemCode, DeckValidation } from "./deck.js";
export {
  abilityRefsOf,
  CHOOSABLE_ASPECTS,
  DECK_COPY_LIMIT,
  DECK_MAX_CARDS,
  DECK_MIN_CARDS,
  requiredIdentitySet,
  unscriptedCards,
  validateDeck,
} from "./deck.js";
export { EngineInvariantError } from "./errors.js";

export type {
  AbilityCost,
  InPlayCostPick,
  AbilityDefinition,
  AbilityLabel,
  AbilityLimit,
  AbilityRegistry,
  AbilitySource,
  AbilityTriggerSpec,
  CardZoneQuery,
  CostModifierSpec,
  EngineDeps,
  EventPattern,
  KeywordGrantSpec,
  ResourceGeneration,
  RuleSpec,
  StatModifierSpec,
  TraitGrantSpec,
} from "./abilities.js";

export type { ResourcePool, ResourceRequirement, ResourceType, TypedResource } from "./resources.js";
export {
  addPools,
  combineRequirements,
  countUsableAs,
  EMPTY_POOL,
  paidWith,
  poolOf,
  poolTotal,
  RESOURCE_TYPES,
  satisfies,
  TYPED_RESOURCES,
} from "./resources.js";

export type { LastingDuration, LastingEffect, LastingEffectBody, LastingReach, LastingScope } from "./lasting.js";
export {
  allyLimitFor,
  cannotLeavePlay,
  cannotTakeDamage,
  mustDefendWithAlly,
  notDefeatedWithoutThreat,
  schemeThreatDestination,
  threatCannotBeRemoved,
} from "./rules.js";
export { hasKeyword, keywordsOf, printedKeywordsOf } from "./keywords.js";
export { printedResources } from "./resources.js";
export type { CostChoices } from "./commands.js";
export type { DeferredEffects, ReportTarget, Vars } from "./stack.js";
export { currentActivationFrameId } from "./stack.js";
export { abilityUseKey, DEFAULT_DEPS, NO_ABILITIES } from "./abilities.js";

export type {
  CardDestination,
  CardSelector,
  EffectSpec,
  LastingUntil,
  PlayerRef,
  PlayerZone,
  Predicate,
  SchemeValueName,
  StatName,
  StatusName,
  TargetCategory,
  TargetQuery,
  TargetRef,
  ValueSpec,
} from "./spec.js";

export type { TriggerEvent, TriggerEventKind } from "./trigger-events.js";
export { eventSubjects, isAnnouncement } from "./trigger-events.js";

export type { Bindings, BoostInProgress, StackFrame, StackFrameKind, StackView, TriggerCandidate, WindowTiming } from "./stack.js";
export { describeFrame, viewStack } from "./stack.js";

export type { ActiveModifier, ModifiedStat } from "./modifiers.js";
export { boostIconsFor, modifiersFor, statBonus } from "./modifiers.js";

export type { EffectContext } from "./select.js";
export {
  activeAbilityRefs,
  canAttack,
  cardsInPlay,
  categoriesOf,
  controllerOf,
  matchesQuery,
  resolveValue,
  selectTargets,
  traitsOf,
} from "./select.js";

/** RRG "Unique Icon": the match predicate and the in-play scan, for a client that wants to grey a card itself. */
export type { UniqueNames } from "./unique.js";
export { cardsMatch, isUnique, matchingCardInPlay, uniqueLabel, uniqueNamesOf } from "./unique.js";

export type { GameSetupConfig, PlayerSetup, SetupResult, VillainSetup } from "./setup.js";
export { createGame } from "./setup.js";

export type { CommandResult, GameLog, GameSession, ReplayResult, SessionResult } from "./engine.js";
export {
  appendCommand,
  applyCommand,
  applyCommands,
  createLog,
  replay,
  sessionApply,
  startSession,
} from "./engine.js";

export type { CharacterKind, CharacterProfile } from "./query.js";
export {
  activeEncounterDeck,
  activeEncounterDeckId,
  activeVillain,
  cardZoneCandidates,
  currentName,
  encounterFace,
  separateDeckDefinition,
  separateDeckOf,
  discardZoneFor,
  encounterDeckOf,
  isVillain,
  undefeatedVillains,
  villainOf,
  villainStageOf,
  cardOf,
  characterProfile,
  countSchemeIcons,
  getCard,
  getInstance,
  getPlayer,
  handSize,
  isMinion,
  isTerminal,
  maxHitPoints,
  printedHandSize,
  locateCard,
  mainSchemeStage,
  mainSchemeValue,
  startingThreatOf,
  minionsEngagedWith,
  nextClockwisePlayer,
  playerOrder,
  printedProfile,
  remainingHitPoints,
  scale,
  schemesInPlay,
  villainStage,
  zoneContents,
} from "./query.js";
