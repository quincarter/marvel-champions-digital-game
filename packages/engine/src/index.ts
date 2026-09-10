export const ENGINE_VERSION = "0.1.0";

export type { PlayerId, InstanceId, ChoiceId, FrameId } from "./ids.js";
export { playerId, instanceId, choiceId, frameId } from "./ids.js";

export type { RngState } from "./rng.js";
export { createRng, nextInt, nextUint32, shuffle } from "./rng.js";

export type {
  CardInstance,
  Form,
  GameOutcome,
  GameState,
  GameStep,
  IdentityState,
  MainSchemeState,
  PlayerState,
  StatusCounts,
  VillainState,
  ZoneId,
} from "./state.js";
export { NO_STATUSES } from "./state.js";

export type { AttackInProgress, ChoiceOption, ChoicePrompt, ChoiceRef, PendingChoice } from "./choices.js";
export type { Command, CommandType, Payment } from "./commands.js";
export type { GameEvent, GameEventType } from "./events.js";
export type { EngineError, EngineErrorCode } from "./errors.js";
export { EngineInvariantError } from "./errors.js";

export type {
  AbilityCost,
  AbilityDefinition,
  AbilityLimit,
  AbilityRegistry,
  AbilitySource,
  AbilityTriggerSpec,
  EngineDeps,
  EventPattern,
  StatModifierSpec,
} from "./abilities.js";
export { abilityUseKey, DEFAULT_DEPS, NO_ABILITIES } from "./abilities.js";

export type {
  EffectSpec,
  PlayerRef,
  Predicate,
  StatName,
  StatusName,
  TargetCategory,
  TargetQuery,
  TargetRef,
  ValueSpec,
} from "./spec.js";

export type { TriggerEvent, TriggerEventKind } from "./trigger-events.js";
export { eventSubjects, isAnnouncement } from "./trigger-events.js";

export type { Bindings, StackFrame, StackFrameKind, StackView, TriggerCandidate, WindowTiming } from "./stack.js";
export { describeFrame, viewStack } from "./stack.js";

export type { ActiveModifier, ModifiedStat } from "./modifiers.js";
export { modifiersFor, statBonus } from "./modifiers.js";

export type { EffectContext } from "./select.js";
export { cardsInPlay, categoriesOf, controllerOf, selectTargets } from "./select.js";

export type { GameSetupConfig, PlayerSetup, SetupResult } from "./setup.js";
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
  cardOf,
  characterProfile,
  countSchemeIcons,
  getCard,
  getInstance,
  getPlayer,
  handSize,
  isTerminal,
  locateCard,
  mainSchemeStage,
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
