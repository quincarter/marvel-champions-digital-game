export const ENGINE_VERSION = "0.3.0";

export type { PlayerId, InstanceId, ChoiceId, EncounterDeckId, FrameId } from "./ids.js";
export { playerId, instanceId, choiceId, encounterDeckId, frameId } from "./ids.js";

export type { RngState } from "./rng.js";
export { createRng, nextInt, nextUint32, shuffle } from "./rng.js";

export type {
  AttackRecord,
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

export type {
  AttackInProgress,
  ChoiceOption,
  ChoicePrompt,
  ChoiceRef,
  DecisionAuthority,
  PendingChoice,
} from "./choices.js";

export {
  effectChoiceAuthority,
  encounterTargetSelector,
  isEncounterSide,
  simultaneousOrderer,
} from "./villain/authority.js";
export type {
  AuditViolation,
  VillainActivationRecord,
  VillainAudit,
  VillainDecisionRecord,
  VillainPhaseRecord,
} from "./villain/audit.js";
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
export { playCostOf, playableOutsideHand } from "./actions.js";
export type { Command, CommandType, Payment } from "./commands.js";
export type { GameEvent, GameEventType } from "./events.js";
export type { EngineError, EngineErrorCode, IllegalDeck } from "./errors.js";

/** Deck legality (RRG 1.8 Appendix I) and playability in this build: two separate questions. */
export type {
  CampaignDeckContext,
  CardPool,
  DeckContext,
  DeckProblem,
  DeckProblemCode,
  DeckValidation,
} from "./deck.js";
export {
  abilityRefsOf,
  CAMPAIGN_GRANTS_COUNT_TOWARD_COPY_LIMIT,
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
export { hasKeyword, keywordsOf, printedKeywordsOf, statusActive } from "./keywords.js";
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

/**
 * Campaign mode (RRG 1.8 "Modes of Play", p. 29) as plain data: the vocabulary a box's rulebook is transcribed
 * into, the log it writes, and the two values that cross the game/campaign boundary. Types only; the runner that
 * interprets them is below (docs/campaign-mode-design.md §11).
 */
export type {
  CampaignAttempt,
  CampaignAttemptOutcome,
  CampaignCardFace,
  CampaignChoiceRecord,
  CampaignChoiceSource,
  CampaignDefinition,
  CampaignGameInput,
  CampaignGameQuery,
  CampaignGameResult,
  CampaignGrant,
  CampaignGraph,
  CampaignHistoryEntry,
  CampaignInGameWrites,
  CampaignInstruction,
  CampaignLog,
  CampaignLogValueSpec,
  CampaignLogSnapshot,
  CampaignLogView,
  CampaignNode,
  CampaignOp,
  CampaignPosition,
  CampaignPredicate,
  CampaignScenarioRef,
  CampaignSeat,
  CampaignSeatInput,
  CampaignStatus,
  CampaignStep,
  CampaignStepTrace,
  CampaignValue,
  CampaignWindow,
  CollectionFilter,
  GrantPermanence,
  LogFieldDef,
  LogFieldType,
  LogValue,
  LogWrite,
  LogWriteMode,
  LogWriteSpec,
  LossPolicy,
  ResolvedInstruction,
} from "./campaign.js";
export { CAMPAIGN_LOG_SCHEMA, CAMPAIGN_WINDOW_ORDER, DEFAULT_CAMPAIGN_WINDOW, NO_CAMPAIGN_WRITES } from "./campaign.js";
/**
 * The campaign runner (docs/campaign-mode-design.md §7): the four pure functions that compose the next scenario,
 * hand it to `createGame`, read the finished game back, and fold the result into the log — plus the pending-choice
 * re-entry that keeps a whole campaign replayable from its seed and its recorded answers.
 */
export type {
  CampaignChoiceAnswer,
  CampaignChoiceKey,
  CampaignDeps,
  CampaignGameStart,
  CampaignLogSetup,
  CampaignPendingChoice,
  CampaignResultMeta,
  CampaignRunnerResult,
  CampaignSeatSetup,
} from "./campaign/runner.js";
export {
  applyCampaignResult,
  CAMPAIGN_ACCEPT,
  CAMPAIGN_NEXT_NODE_INSTRUCTION,
  campaignChoiceKey,
  campaignResultOf,
  createCampaignLog,
  grantsOf,
  resolveBetweenGames,
  retryBaselineOf,
  startGameFromLog,
} from "./campaign/runner.js";

/** Reading the frozen campaign snapshot a game carries (`GameState.campaign`), for view models and the runner. */
export {
  campaignFaceOf,
  campaignLogCardIds,
  campaignLogContains,
  campaignLogField,
  campaignLogIsSet,
  campaignLogNumber,
  campaignSeatNumber,
  sameCampaignFace,
} from "./campaign-state.js";

export type { TriggerEvent, TriggerEventKind } from "./trigger-events.js";
export { eventSubjects, isAnnouncement } from "./trigger-events.js";

export type {
  Bindings,
  BoostInProgress,
  StackFrame,
  StackFrameKind,
  StackView,
  TriggerCandidate,
  WindowTiming,
} from "./stack.js";
export { describeFrame, viewStack } from "./stack.js";

/** The resolution stack as rows a client can word (`stack-view.ts`); `frameCardId` is the card a frame resolves. */
export type { StackEntry } from "./stack-view.js";
export { stackEntries } from "./stack-view.js";
export { frameCardId } from "./ctx.js";

/** Who may read a card's face, as a rule over zones — the client's rendering and `preview()` share this one answer. */
export { faceHidden, faceVisible, offeredByOpenChoice, zoneHidden } from "./visibility.js";

/** "What would this command do?" — a probe of the real engine, truncated wherever the answer needs hidden information. */
export type { CounterSnapshot, OutcomePreview, PreviewCounter, PreviewStop } from "./preview.js";
export { preview } from "./preview.js";

/** The defend prompt's options as damage ranges over the facedown boost cards, plus the attack arithmetic they share. */
export type { BoostBound, BoostScope, DefendBand, DefendOptionPreview, PlannedAttack } from "./defend-preview.js";
export { defendPreview, plannedAttackDamage } from "./defend-preview.js";

export type { ActiveModifier, ModifiedStat } from "./modifiers.js";
export { boostIconsFor, modifiersFor, statBonus } from "./modifiers.js";

export type { EffectContext, QueryExclusion } from "./select.js";
export {
  activeAbilityRefs,
  canAttack,
  cardsInPlay,
  categoriesOf,
  controllerOf,
  explainQuery,
  matchesQuery,
  resolveValue,
  selectTargets,
  traitsOf,
} from "./select.js";

/** "Why not the others?" — the cards an open choice left out, each with the clause that excluded it. */
export type { ChoiceExclusion, ExclusionCode } from "./why-not.js";
export { choiceExclusions } from "./why-not.js";

/** RRG "Unique Icon": the match predicate and the in-play scan, for a client that wants to grey a card itself. */
export type { UniqueNames } from "./unique.js";
export { cardsMatch, isUnique, matchingCardInPlay, uniqueLabel, uniqueNamesOf } from "./unique.js";

export type { GameSetupConfig, PlayerSetup, SetupResult, VillainSetup } from "./setup.js";
export { createGame } from "./setup.js";

export type { CommandResult, GameLog, GameSession, ReplayResult, SessionResult } from "./engine.js";
export { appendCommand, applyCommand, applyCommands, createLog, replay, sessionApply, startSession } from "./engine.js";

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
  hasStarIcon,
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
