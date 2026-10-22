export const ENGINE_VERSION = "0.33.0";

export type { PlayerId, InstanceId, ChoiceId, EncounterDeckId, FrameId, GroupId, TeamId } from "./ids.js";
export { playerId, instanceId, choiceId, encounterDeckId, frameId, groupId, teamId } from "./ids.js";

export type {
  GroupRef,
  PodNeutralArea,
  PodNeutralSetup,
  PodSetup,
  PodState,
  SharedEvent,
  SharedPodState,
  SharedResult,
  SharedThreatCause,
} from "./pod.js";
export {
  applySharedEvent,
  groupVar,
  POD_MOMENT,
  podBlocksOf,
  podGroupIds,
  podOf,
  podSetupFault,
  resolveGroup,
  sharedLost,
  SINGLE_GROUP,
} from "./pod.js";

export type { GameMode } from "./game-mode.js";
export { COMPETITIVE_MODE_UNAVAILABLE_MESSAGE, gameModeOf } from "./game-mode.js";

export type { TeamSide, TeamState } from "./team.js";
export { playersOnTeam, SINGLE_TEAM, teamOf, teamSize, teamsOf } from "./team.js";

export type { RngState } from "./rng.js";
export { createRng, nextInt, nextUint32, shuffle } from "./rng.js";

export type {
  Accusation,
  AccusationGuess,
  AttackRecord,
  RevealRecord,
  CardHome,
  CardInstance,
  EncounterDeckState,
  FacedownRole,
  Form,
  GameOutcome,
  GameState,
  StackedDecks,
  GameStep,
  IdentityState,
  MainSchemeAdvancedBy,
  MainSchemeState,
  PlayerState,
  ScenarioPlayAreaState,
  ScenarioSetupInstruction,
  SeparateDeckState,
  SetAsideUntilCalled,
  SetupOption,
  StatusCounts,
  VillainState,
  ZoneId,
  TableRules,
} from "./state.js";
export { NO_STATUSES } from "./state.js";

export { cardTypeName, isRulesCardType, RULES_CARD_TYPES, type RulesCardType } from "./card-types.js";
export {
  ALL_PURPOSE_COUNTER,
  ANY_COUNTER,
  countersOfType,
  definedCounterType,
  definedCounterTypeOrNull,
} from "./counter-types.js";

export type {
  AttackInProgress,
  CardPosition,
  ChoiceBehalf,
  ChoiceList,
  ChoiceOption,
  ChoicePrompt,
  ChoiceRef,
  DecisionAuthority,
  PendingChoice,
} from "./choices.js";
export {
  cardTotalFault,
  cardTotalOf,
  ENEMY_TEAM_CHOICE_INSTRUCTION,
  ENEMY_TEAM_CHOICE_RULE,
  facedownOptionId,
  mostCardsUnderTotal,
  PLAY_TO_OWN_AREA,
  playDestinationOfOption,
  playToAreaOption,
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
  PaymentNotFor,
  PaymentQuery,
  PaymentSource,
  CostHelp,
  CostHelpAnswer,
} from "./legal.js";
export {
  costHelpFor,
  forcedActionOptionId,
  legalActions,
  outstandingForcedActions,
  paymentFor,
  tryPayment,
  type OutstandingForcedAction,
} from "./legal.js";

/** What a card costs right now vs. what is printed on it, and the cards moving the price (Steve Rogers' Living Legend). */
export type { PlayCost, PlayCostContribution } from "./actions.js";
export {
  PAID_FOR_SLOT,
  additionalPlayCostOf,
  basicPowerCost,
  basicPowerDivisionTotal,
  costAsDetermined,
  inPlayCostCandidates,
  minimumChosenX,
  playCostOf,
  playCostWith,
  playableOutsideHand,
} from "./actions.js";
export { encounterSearchCostCandidates } from "./encounter-search-cost.js";
export {
  asIfInHandPermissions,
  asIfInHandPlayOf,
  deckTopPermission,
  deckTopPlayOf,
  type AsIfInHandPermission,
  type DeckTopPermission,
} from "./actions.js";
export type { Command, CommandType, Payment, ResourceAbilityUse, SpentCardAbilityUse } from "./commands.js";
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
  cardLegalForIdentity,
  cardOfferedToDeck,
  CHOOSABLE_ASPECTS,
  copiesUpToLimit,
  DECK_COPY_LIMIT,
  DECK_MAX_CARDS,
  DECK_MIN_CARDS,
  isPermanentCard,
  requiredIdentitySet,
  unscriptedCards,
  validateDeck,
} from "./deck.js";
export { EngineInvariantError } from "./errors.js";

export type {
  AbilityCost,
  DamageSelfChoice,
  DeckDiscardChoice,
  EncounterDeckDiscardCost,
  RemoveThreatCost,
  DiscardCombined,
  InPlayCombined,
  InPlayCostPick,
  TuckedCostPick,
  DamageCostPick,
  AttachCost,
  EncounterSearchIntoPlayCost,
  AbilityDefinition,
  AbilityLabel,
  CardIcon,
  AbilityLimit,
  AbilityRegistry,
  AbilitySource,
  AbilityTriggerSpec,
  PlayableAsIfInHandSpec,
  CardZoneQuery,
  ConsequentialDamageScope,
  CostModifierSpec,
  EngineDeps,
  EventPattern,
  KeywordGrantSpec,
  ResourceGeneration,
  ResourceMultiplierSpec,
  RuleSpec,
  StatModifierSpec,
  TraitGrantSpec,
} from "./abilities.js";

export type {
  PaidTypesRead,
  ResolvedRequirement,
  ResourcePool,
  ResourceRequirement,
  ResourceType,
  TypedResource,
} from "./resources.js";
export {
  addPools,
  combineRequirements,
  countUsableAs,
  declaredPool,
  EMPTY_POOL,
  paidAsDeclared,
  paidSetOptionId,
  paidSetsAsDeclared,
  paidTypesReading,
  paidTypeCountOf,
  paidWith,
  poolOf,
  poolTotal,
  RESOURCE_TYPES,
  satisfies,
  TYPED_RESOURCES,
  wildDeclarationFault,
  wildDeclarations,
} from "./resources.js";

export type {
  AttachmentBound,
  LastingDuration,
  LastingEffect,
  LastingEffectBody,
  LastingReach,
  LastingScope,
} from "./lasting.js";
export {
  allyLimitFor,
  cannotEnterPlay,
  enterPlayBarMessage,
  cannotFlip,
  cannotLeavePlay,
  cardAbilitiesCannotRemove,
  resourceIconsInPlay,
  canDivideBasicPower,
  cannotBeDealtDamage,
  cannotTakeDamage,
  evenlyDividesBasicPower,
  playDestinationsOf,
  countSchemeIcons,
  damageTakenAfterConstants,
  damageTakenAllowance,
  damageTakenBeforeSustainedCap,
  damageTakenBreakdown,
  damageSourceCard,
  phaseDamageAllowance,
  maxSustainedDamageOf,
  sustainedDamageAllowance,
  excessDamageBonus,
  formChangeCostsFor,
  grantedIcons,
  grantedLabeledAbilities,
  iconsBlankedOn,
  iconsInPlay,
  iconsOn,
  losesIcon,
  mustDefendWithAlly,
  nonSchemeIcons,
  notDefeatedWithoutThreat,
  playerSideSchemeLimit,
  restrictedLimitFor,
  restrictedStanding,
  schemeThreatDestination,
  threatCannotBeRemoved,
} from "./rules.js";
export type { ConsequentialDamage, DamageSourceInfo, FormChangeCost, GrantedAbility } from "./rules.js";
export {
  hasKeyword,
  isPermanent,
  keywordsOf,
  keywordTotal,
  printedFormTypes,
  printedKeywordsOf,
  statusActive,
} from "./keywords.js";
export { linkedKeywordNames, linkedKeywordsOf } from "./linked.js";
export { counterRoom } from "./counter-limit.js";
export { tuckLimitOf, tuckRoom } from "./tuck-limit.js";
export { printedResources } from "./resources.js";
export { pairOfOptionId, pairOptionId, pairSelectionFault, resourceIconsMatch } from "./resolve/pair-cards.js";
export { characterTitledAs, identityCardTitledAs } from "./titles.js";
export type { CostChoices, CostPartPayers, CostSelection, DelegableCostPart } from "./commands.js";
export { DELEGABLE_COST_PARTS } from "./commands.js";
export type { DeferredEffects, ReportTarget, Vars } from "./stack.js";
export { attackPreventedVars, currentActivationFrameId, PAID_CARDS_SLOT } from "./stack.js";
export {
  abilityUseKey,
  BORROWED_BOOST_ICONS_SLOT,
  DEFAULT_DEPS,
  fixedResourcesOf,
  GRANTED_BY_SLOT,
  inPlayPicksOf,
  tuckedPickOf,
  labeledResolvedVar,
  isResourcesChoice,
  NO_ABILITIES,
  playableAsIfInHandOf,
  resourcesChoiceOf,
} from "./abilities.js";
export type { InPlayCostMode, ResourcesChoice } from "./abilities.js";

export type {
  AbilityTimingWord,
  BoostCardDestination,
  CardDestination,
  DefeatDestination,
  DefeatPlacement,
  CardSelector,
  CharacterNames,
  EffectSpec,
  LastingUntil,
  LastingGrantUntil,
  NextBasicPowerUntil,
  PairLimit,
  PlayerRef,
  PlayerZone,
  Predicate,
  ScenarioDeckSource,
  SchemeValueName,
  StatName,
  BasicPowerName,
  BasicPowerTerms,
  StatComparison,
  StatusName,
  CollectionSearchFilter,
  TargetCategory,
  TargetQuery,
  TargetRef,
  ValueSpec,
  AttachCategory,
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
  EliminationPolicy,
  GrantDeckSize,
  GrantDeckSizeRule,
  GrantPermanence,
  LogFieldDef,
  LogFieldType,
  LogValue,
  LogValueContent,
  LogValueSeal,
  LogWrite,
  LogWriteMode,
  LogWriteSpec,
  LossPolicy,
  ResolvedInstruction,
} from "./campaign.js";
export {
  CAMPAIGN_LOG_SCHEMA,
  CAMPAIGN_WINDOW_ORDER,
  DEFAULT_CAMPAIGN_WINDOW,
  grantDeckSizesOf,
  includedGrantsOf,
  NO_CAMPAIGN_WRITES,
} from "./campaign.js";
/**
 * The campaign runner (docs/campaign-mode-design.md §7): the four pure functions that compose the next scenario,
 * hand it to `createGame`, read the finished game back, and fold the result into the log — plus the pending-choice
 * re-entry that keeps a whole campaign replayable from its seed and its recorded answers.
 */
export type {
  CampaignChoiceAnswer,
  CampaignChoiceKey,
  CampaignChoiceSourceKind,
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
  campaignModularSetIds,
  campaignGrantInclusionProblems,
  campaignResultOf,
  createCampaignLog,
  grantsOf,
  resolveBetweenGames,
  retryBaselineOf,
  setCampaignGrantLeftOut,
  startGameFromLog,
} from "./campaign/runner.js";
export {
  logValueSize,
  removedCardIdsOf,
  withoutSealedContents,
  withoutSealedFields,
  withRemovedCardsOutOfDecks,
} from "./campaign/log.js";
export { sealCampaignLog } from "./campaign/seal.js";
export type {
  SealedCampaignAttempt,
  SealedCampaignHistoryEntry,
  SealedCampaignLog,
  SealedCampaignLogSnapshot,
} from "./campaign/seal.js";

/** Reading the frozen campaign snapshot a game carries (`GameState.campaign`), for view models and the runner. */
export {
  campaignFaceOf,
  CAMPAIGN_LOG_FRONT_FACE,
  campaignLogCardCounter,
  campaignLogCardIds,
  campaignLogCardRecorded,
  campaignLogCardState,
  campaignLogContains,
  campaignLogField,
  campaignLogIsSet,
  campaignLogNumber,
  campaignSeatNumber,
  sameCampaignFace,
} from "./campaign-state.js";

export type {
  EncounterDealSource,
  LeaveCauseSide,
  OutOfPlayDiscard,
  ImminentAttach,
  TriggerEvent,
  TriggerEventKind,
  TuckedDiscardCause,
  TuckHostKind,
} from "./trigger-events.js";
export {
  ATTACK_DAMAGE_RESULT,
  BASIC_POWER_STAT,
  carriedByEvent,
  damageTakenKey,
  eventSubjects,
  EXCESS_AS_DEALT_RESULT,
  hearsEncounterDeckDiscard,
  isAnnouncement,
  MOMENT_PREFIX,
  TAKEN_AWAY_SUFFIX,
  COUNTED_AWAY_SUFFIX,
  TOTAL_ATK_RESULT,
} from "./trigger-events.js";

export type {
  Bindings,
  BoostInProgress,
  StackFrame,
  StackFrameKind,
  SetupInstructionSource,
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
export { displayNameOf, faceHidden, faceVisible, lookedAtBy, offeredByOpenChoice, zoneHidden } from "./visibility.js";
export {
  hiddenPileViews,
  otherFaceVisible,
  sealHiddenInformation,
  sealHiddenPiles,
  sealHiddenReverses,
  type HiddenPileView,
  type SealedGameState,
} from "./visibility.js";
export { placeHiddenPiles, revealedPileCardsOf } from "./resolve/hidden-piles.js";
export { hiddenPilesSealed, hiddenPileSize, isSealedPileCard } from "./hidden-pile-state.js";
export { evidenceRowId, evidenceRowsLeft, openEvidenceRows, wrongGuessesOf } from "./accusation.js";
export type { TableContext, ViewerContext } from "./visibility.js";

/** "What would this command do?" — a probe of the real engine, truncated wherever the answer needs hidden information. */
export type { CounterSnapshot, OutcomePreview, PreviewCounter, PreviewStop } from "./preview.js";
export { preview } from "./preview.js";

/** The defend prompt's options as damage ranges over the facedown boost cards, plus the attack arithmetic they share. */
export type { BoostBound, BoostScope, DefendBand, DefendOptionPreview, PlannedAttack } from "./defend-preview.js";
export { defendPreview, plannedAttackDamage } from "./defend-preview.js";

export type { ActiveModifier, ModifiedStat } from "./modifiers.js";
export { boostIconsFor, modifiersFor, statBonus } from "./modifiers.js";

export type { EffectContext, PlayerCardClassification, QueryExclusion } from "./select.js";
export {
  abilityIgnored,
  activeAbilityRefs,
  gainedAbilities,
  attackableAsMinion,
  attackForbiddenBy,
  canAttack,
  cardsInPlay,
  facedownAttachments,
  isFacedownAttachment,
  cardTypeOf,
  categoriesOf,
  chosenFromList,
  chosenVar,
  classificationsOf,
  consideredRemainingHitPoints,
  controllerOf,
  deckTopFaceupPlayers,
  enemyTeamDecider,
  encounterTopFaceup,
  hitPointFloor,
  ignoredAbilities,
  explainQuery,
  handCountTowardHandSize,
  isCaptiveAlly,
  isAttackTarget,
  isHeldMinion,
  matchesQuery,
  resolveRef,
  resolveValue,
  selectTargets,
  shownDeckTop,
  shownEncounterTop,
  TOGETHER_TARGETS_SLOT,
  textBoxBlankFor,
  villainAliasOf,
  traitsOf,
} from "./select.js";

export { selfDamageThreshold } from "./damage-threshold.js";

/** "Why not the others?" — the cards an open choice left out, each with the clause that excluded it. */
export type { ChoiceExclusion, ExclusionCode } from "./why-not.js";
export { choiceExclusions } from "./why-not.js";
export type { DefenseBar, DefenseClaim } from "./defense-claim.js";
export { DEFENSE_BAR_MESSAGE, defenseBarFor, defenseClaimOf } from "./defense-claim.js";

/** RRG "Unique Icon": the match predicate and the in-play scan, for a client that wants to gray a card itself. */
export type { UniqueNames } from "./unique.js";
export {
  cardsMatch,
  entersPlayWhenPlayed,
  isUnique,
  matchingCardInPlay,
  uniqueEntryBlocker,
  uniqueLabel,
  uniqueNamesOf,
} from "./unique.js";

export type {
  AutoIncludedSetSetup,
  GameSetupConfig,
  PlayerSetup,
  SetupResult,
  SetupStack,
  VillainChoiceSetup,
  VillainSetup,
} from "./setup.js";
export {
  autoIncludedSetsInGame,
  chosenVillainOf,
  createGame,
  illegalDecksOf,
  mainSchemeStageIndexesProblem,
} from "./setup.js";

export type { CommandResult, GameLog, GameSession, ReplayResult, SessionResult } from "./engine.js";
export { appendCommand, applyCommand, applyCommands, createLog, replay, sessionApply, startSession } from "./engine.js";

export type { CharacterKind, CharacterProfile, HeroFaceWithTraits } from "./query.js";
export {
  activeEncounterDeck,
  activeEncounterDeckId,
  activeVillain,
  cardZoneCandidates,
  currentName,
  encounterFace,
  showingResources,
  separateDeckDefinition,
  separateDeckOf,
  isFixedOrderDeck,
  mayLookThroughSeparateDeck,
  discardZoneFor,
  encounterDeckOf,
  heroFacesOf,
  identityFace,
  isVillain,
  undefeatedVillains,
  villainOf,
  villainStageOf,
  cardOf,
  characterProfile,
  getCard,
  getInstance,
  getPlayer,
  handSize,
  hasStarIcon,
  printsBoostAbility,
  isMinion,
  isLooseVillainCard,
  looseVillainSide,
  looseVillainStage,
  villainSideShowing,
  isTerminal,
  maxHitPoints,
  printedHpNumeral,
  printedMinionHp,
  printedHandSize,
  inClosedScenarioPlayArea,
  isOwnedEncounterCard,
  locateCard,
  playerCardOwnerOf,
  scenarioPlayAreaOf,
  mainSchemeStage,
  mainSchemeStageCount,
  mainSchemeStageOf,
  mainSchemeStagePosition,
  mainSchemeStateOf,
  mainSchemeValue,
  startingThreatOf,
  minionsEngagedWith,
  nextClockwisePlayer,
  playerOrder,
  printedCostOf,
  printedProfile,
  remainingHitPoints,
  scale,
  scaleIn,
  sharedScheme,
  sharedVillain,
  schemesInPlay,
  villainStage,
  zoneContents,
} from "./query.js";
export { legalDefenders } from "./resolve/enemy-activation.js";
export { UNRESOLVED_VAR } from "./resolve/target-validity.js";
export { mainSchemeCompletionLoses } from "./resolve/defeat.js";
export { collectionCandidates } from "./resolve/collection.js";
export { scenarioDeckCards, scenarioDeckWithTop } from "./resolve/scenario-deck-top.js";
export {
  REPORT_NO,
  REPORT_YES,
  REPORTED_FACT_ANSWER,
  reportedNumberOf,
  type OutsideFacts,
  type ReportedFact,
  type ReportedFactAnswer,
  type SetupOutsideFact,
} from "./outside-facts.js";
export { generatedResources, handCardResources, resourcesNotFor } from "./actions.js";
