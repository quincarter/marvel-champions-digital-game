/**
 * Undo (the action bar's own button): takes back the active hero's last move this turn — a card played, an ability
 * used, a basic power, a change of form — with every choice that move's own resolution asked of them, so a fat
 * finger or a move made in the wrong order can be put right.
 *
 * RRG 1.8 has no such rule; this is a digital convenience, offered only where taking a move back changes nothing
 * the player didn't already know. It reuses Back out's rewind (`view/back-out.ts`, `SessionStore.rewindTo`) and draws
 * hard lines on top of it:
 *
 * - **Only the hero's own moves.** Every command in the move must be the active player's own; another seat's Action
 *   or answer in between stops the undo there.
 * - **Only this turn.** Ending the turn ends undo for that hero: a move whose events start or end a turn, change the
 *   game step or start a round can't be taken back, so neither can anything before it.
 * - **Only visible, deterministic moves.** The gate is an ALLOWLIST (`UNDO_EVENT_VERDICTS`, every engine event type
 *   classified, guarded by a test): a move is undoable only if every event it produced is on it. A move that drew,
 *   revealed, looked at, dealt or shuffled anything, or that used the game's random number generator (a card
 *   discarded at random), can't be taken back, and so neither can anything before it: the player keeps what they
 *   learned and can't undo to fish for a better draw or re-roll a random pick by playing in another order.
 *
 * Randomness: the store records the engine's RNG draw count (`GameState.rng.draws`) around every command
 * (`BackOutTrailEntry.rngDraws`); a move whose count moved used the generator, whatever events it produced. The event
 * allowlist is the second gate (it catches reveals that spend no randomness, and trail entries with no count).
 */
import type { Command, GameEvent, GameState, InstanceId, PlayerId, ZoneId } from "@mc/engine";
import type { BackOutTrailEntry } from "./back-out.js";

/** The commands that start a move of the hero's own; `resolveChoice`s after one belong to it. */
const MOVE_COMMAND_TYPES: ReadonlySet<Command["type"]> = new Set([
  "playCard",
  "useAbility",
  "basicAttack",
  "basicThwart",
  "basicRecover",
  "changeForm",
]);

/** Events that mark a turn, step or round boundary: a move that carries one belongs to no single turn. */
const BOUNDARY_EVENT_TYPES: ReadonlySet<GameEvent["type"]> = new Set([
  "turnStarted",
  "turnEnded",
  "stepChanged",
  "roundStarted",
]);

const ALLOWED = "allowed";
const STOPS = "stops";
/** Allowed or stopping by the event's own payload: `eventStopsUndo` reads it. */
const CHECKED = "checked";
type Verdict = typeof ALLOWED | typeof STOPS | typeof CHECKED;

/**
 * Every engine event type, classified. `allowed`: reveals nothing a table didn't already see and spends no
 * randomness. `stops`: draws, reveals, looks at, deals or shuffles, belongs to another seat, the encounter or the
 * villain phase, or is setup/campaign/scenario bookkeeping a hero's move has no business producing. `checked`: see
 * `eventStopsUndo`. Typed over the whole union, so a new event type fails the typecheck here; `undo.events.test.ts`
 * also fails on it, for a run without the typecheck. When unsure, `stops`.
 */
export const UNDO_EVENT_VERDICTS: Readonly<Record<GameEvent["type"], readonly [Verdict, string]>> = {
  abilityIgnored: [ALLOWED, "rules bookkeeping, nothing hidden"],
  abilityResolved: [ALLOWED, "rules bookkeeping, nothing hidden"],
  abilityUseRecorded: [ALLOWED, "rules bookkeeping, nothing hidden"],
  accelerationTokenAdded: [ALLOWED, "counters, face up"],
  accelerationTokenRedirected: [ALLOWED, "counters, face up"],
  accusationMade: [STOPS, "a hidden accusation"],
  activationBlocked: [ALLOWED, "rules bookkeeping, nothing hidden"],
  activationSkipped: [ALLOWED, "rules bookkeeping, nothing hidden"],
  activeVillainChanged: [ALLOWED, "table state, face up"],
  additionalAttackCostNotPaid: [ALLOWED, "cost bookkeeping"],
  additionalAttackCostPaid: [ALLOWED, "cost bookkeeping"],
  additionalFormChanged: [ALLOWED, "cost bookkeeping"],
  additionalMulligansGranted: [STOPS, "setup"],
  additionalPowerCostAsked: [ALLOWED, "cost bookkeeping"],
  additionalPowerCostNotPaid: [ALLOWED, "cost bookkeeping"],
  additionalPowerCostPaid: [ALLOWED, "cost bookkeeping"],
  attackAwaitsAbility: [ALLOWED, "combat, all face up"],
  attackResolved: [ALLOWED, "combat, all face up"],
  attackResumed: [ALLOWED, "combat, all face up"],
  attackRetargeted: [ALLOWED, "combat, all face up"],
  attackTargetSkipped: [ALLOWED, "combat, all face up"],
  basicPowerInstructed: [ALLOWED, "combat, all face up"],
  basicPowerNotMade: [ALLOWED, "combat, all face up"],
  boostCancelled: [STOPS, "boost cards are the encounter's"],
  boostCardDealt: [STOPS, "a boost card dealt"],
  boostCardFlipped: [STOPS, "a boost card turned up"],
  boostCardMoved: [STOPS, "boost cards are the encounter's"],
  boostIgnored: [STOPS, "boost cards are the encounter's"],
  boostWithheld: [STOPS, "boost cards are the encounter's"],
  campaignCardRemoved: [STOPS, "campaign bookkeeping"],
  campaignInstructionResolved: [STOPS, "campaign bookkeeping"],
  campaignLogRead: [STOPS, "campaign bookkeeping"],
  campaignLogWritten: [STOPS, "campaign bookkeeping"],
  cardAddedFromCollection: [STOPS, "a card from outside the game"],
  cardDetached: [ALLOWED, "the hero's own visible play"],
  cardDiscardedFromDeck: [STOPS, "a card off a deck is now known"],
  cardDiscardedFromEncounterDeck: [STOPS, "a card off the encounter deck is now known"],
  cardDiscardedFromHand: [CHECKED, "the mover's own hand only"],
  cardDiscardedFromPlay: [ALLOWED, "the hero's own visible play"],
  cardDrawn: [STOPS, "a draw"],
  cardExhausted: [ALLOWED, "the hero's own visible play"],
  cardFlipped: [STOPS, "turns a hidden face up"],
  cardFlippedToOtherFace: [STOPS, "turns a hidden face up"],
  cardFound: [STOPS, "the result of a search"],
  cardMoved: [CHECKED, "stops when the card came from a hidden zone"],
  cardNotTucked: [ALLOWED, "the hero's own visible play"],
  cardPlayed: [ALLOWED, "the hero's own visible play"],
  cardPutIntoPlayFacedown: [STOPS, "a facedown card"],
  cardReadied: [ALLOWED, "the hero's own visible play"],
  cardTurnedFacedown: [STOPS, "turns a card facedown"],
  cardTurnedFaceup: [STOPS, "a card turned up"],
  cardTypeChosen: [ALLOWED, "the hero's own visible play"],
  cardsLookedAt: [STOPS, "cards were looked at"],
  cardsPaired: [ALLOWED, "table state, face up"],
  cardsRearranged: [STOPS, "a deck was reordered after a look"],
  cardsSetAside: [STOPS, "cards leave for out of play"],
  cardsSwapped: [STOPS, "cards swapped after a look or reveal"],
  characterDefeated: [ALLOWED, "combat, all face up"],
  choiceFoundNothing: [STOPS, "the end of a search or look"],
  choiceRequested: [CHECKED, "stops when the prompt looks through a deck"],
  choiceResolved: [ALLOWED, "a choice among public options"],
  consequentialDamageModified: [ALLOWED, "damage and healing, face up"],
  controlReleased: [ALLOWED, "the hero's own visible play"],
  controllerChanged: [ALLOWED, "the hero's own visible play"],
  costDamageSettled: [ALLOWED, "damage and healing, face up"],
  costPartPaidBy: [STOPS, "another seat pays part of the cost"],
  counterAdded: [ALLOWED, "counters, face up"],
  counterRemoved: [ALLOWED, "counters, face up"],
  countersMoved: [ALLOWED, "counters, face up"],
  countersNotPlaced: [ALLOWED, "counters, face up"],
  damageAboveCapRemoved: [ALLOWED, "damage and healing, face up"],
  damageBeyondZeroLost: [ALLOWED, "damage and healing, face up"],
  damageCapped: [ALLOWED, "damage and healing, face up"],
  damageDealt: [ALLOWED, "damage and healing, face up"],
  damageDoubled: [ALLOWED, "damage and healing, face up"],
  damageHealed: [ALLOWED, "damage and healing, face up"],
  damageIncreased: [ALLOWED, "damage and healing, face up"],
  damagePlaced: [ALLOWED, "damage and healing, face up"],
  damagePoolResolved: [ALLOWED, "damage and healing, face up"],
  damagePrevented: [ALLOWED, "damage and healing, face up"],
  deckDiscardCostSettled: [STOPS, "a deck's top card was discarded"],
  deckDiscardNotCounted: [STOPS, "a deck's top card was discarded"],
  deckDiscardStillCounted: [STOPS, "a deck's top card was discarded"],
  deckShuffled: [STOPS, "a shuffle spends the RNG"],
  deckStacked: [STOPS, "setup stacking"],
  deckTopHidden: [STOPS, "a deck top shown, then hidden"],
  deckTopShown: [STOPS, "a deck top shown"],
  defeatProtectionEnded: [ALLOWED, "rules bookkeeping, nothing hidden"],
  defenderDeclared: [ALLOWED, "combat, all face up"],
  defenderLeftPlay: [ALLOWED, "combat, all face up"],
  defenseDeclined: [ALLOWED, "combat, all face up"],
  discardRefused: [ALLOWED, "rules bookkeeping, nothing hidden"],
  drawnObligationPlaced: [STOPS, "an obligation dealt from the deck"],
  encounterCardPassed: [STOPS, "an encounter card dealt to a player"],
  encounterCardRevealed: [STOPS, "an encounter card revealed"],
  encounterDiscardCostSettled: [STOPS, "encounter deck cards discarded"],
  encounterLookCostSettled: [STOPS, "the encounter deck was looked at"],
  encounterSetAutoIncluded: [STOPS, "setup"],
  encounterTopHidden: [STOPS, "the encounter top shown, then hidden"],
  encounterTopShown: [STOPS, "the encounter top shown"],
  enemyActivated: [STOPS, "the villain side acts"],
  enemyAttackCostSettled: [ALLOWED, "combat, all face up"],
  enemyAttackedEnemy: [ALLOWED, "combat, all face up"],
  engagementRotated: [ALLOWED, "table state, face up"],
  excessDamageAsThreat: [ALLOWED, "damage and healing, face up"],
  factReported: [ALLOWED, "table state, face up"],
  firstPlayerChanged: [ALLOWED, "table state, face up"],
  flipBlocked: [ALLOWED, "rules bookkeeping, nothing hidden"],
  forcedActionsRequired: [ALLOWED, "rules bookkeeping, nothing hidden"],
  formChangeCostAsked: [ALLOWED, "cost bookkeeping"],
  formChangeCostSettled: [ALLOWED, "cost bookkeeping"],
  formChanged: [ALLOWED, "cost bookkeeping"],
  framePopped: [ALLOWED, "rules bookkeeping, nothing hidden"],
  framePushed: [ALLOWED, "rules bookkeeping, nothing hidden"],
  gameAreaCreated: [STOPS, "setup"],
  gameAreaJoined: [STOPS, "setup"],
  gameCreated: [STOPS, "setup"],
  gameEnded: [STOPS, "the game ended"],
  groupChosen: [ALLOWED, "a choice among public options"],
  handRefilled: [ALLOWED, "rules bookkeeping, nothing hidden"],
  healBlocked: [ALLOWED, "damage and healing, face up"],
  hiddenPileCardsGained: [STOPS, "a hidden pile changed"],
  hiddenPileRevealed: [STOPS, "a hidden pile revealed"],
  hiddenPilesDealt: [STOPS, "hidden piles dealt"],
  hitPointsFell: [ALLOWED, "damage and healing, face up"],
  hitPointsSet: [ALLOWED, "damage and healing, face up"],
  identitySwapped: [ALLOWED, "a form change, face up"],
  interruptConditionLapsed: [ALLOWED, "rules bookkeeping, nothing hidden"],
  interruptsPreempted: [ALLOWED, "rules bookkeeping, nothing hidden"],
  keywordResolved: [ALLOWED, "rules bookkeeping, nothing hidden"],
  lastingEffectAdded: [ALLOWED, "rules bookkeeping, nothing hidden"],
  lastingEffectEnded: [ALLOWED, "rules bookkeeping, nothing hidden"],
  lastingEffectRetimed: [ALLOWED, "rules bookkeeping, nothing hidden"],
  leavePlayBlocked: [ALLOWED, "rules bookkeeping, nothing hidden"],
  linkedCardsSetAside: [STOPS, "cards leave for out of play"],
  mainSchemeAdvanced: [STOPS, "the villain phase"],
  mainSchemeCompleted: [STOPS, "the scheme ended the game"],
  mainSchemeFlippedToOtherFace: [STOPS, "turns a hidden face up"],
  mainSchemeStageRemoved: [STOPS, "scheme stages changed"],
  mainSchemeStageRevealed: [STOPS, "a stage revealed"],
  mainSchemeStageToVictoryDisplay: [STOPS, "scheme stages changed"],
  mainSchemeStagesChosen: [STOPS, "scheme stages changed"],
  mainSchemeStagesShuffled: [STOPS, "a shuffle spends the RNG"],
  minionHeld: [ALLOWED, "table state, face up"],
  moleIdentified: [STOPS, "a hidden identity revealed"],
  momentRaised: [ALLOWED, "table state, face up"],
  numberChosen: [ALLOWED, "a choice among public options"],
  optionChosen: [ALLOWED, "a choice among public options"],
  overkillSpilled: [ALLOWED, "combat, all face up"],
  ownershipChanged: [ALLOWED, "the hero's own visible play"],
  paidResourcesChosen: [ALLOWED, "cost bookkeeping"],
  permanentAttachmentRehosted: [ALLOWED, "the hero's own visible play"],
  playCostReduced: [ALLOWED, "cost bookkeeping"],
  playDestinationSet: [ALLOWED, "the hero's own visible play"],
  playNoted: [ALLOWED, "the hero's own visible play"],
  playedEventReturned: [ALLOWED, "the hero's own visible play"],
  playedUpgradeHasNoHost: [ALLOWED, "the hero's own visible play"],
  playerAttackEnded: [ALLOWED, "combat, all face up"],
  playerAttackRetargeted: [ALLOWED, "combat, all face up"],
  playerDeckReset: [STOPS, "a deck reset shuffles"],
  playerEliminated: [STOPS, "a seat is out"],
  playerSatOut: [STOPS, "a seat is out"],
  playerSideSchemeLimitDiscard: [STOPS, "the encounter's rule"],
  podEffectRequested: [ALLOWED, "rules bookkeeping, nothing hidden"],
  preThenUnresolved: [ALLOWED, "rules bookkeeping, nothing hidden"],
  putIntoPlayRefused: [ALLOWED, "the hero's own visible play"],
  readyCardsCostSettled: [ALLOWED, "cost bookkeeping"],
  readyCostAsked: [ALLOWED, "cost bookkeeping"],
  resolveAbilityCostSettled: [ALLOWED, "cost bookkeeping"],
  resourceAbilityEffects: [ALLOWED, "resources, face up"],
  resourcesGenerated: [ALLOWED, "resources, face up"],
  returnedToSeparateDeck: [STOPS, "a deck changed"],
  revealCancelled: [STOPS, "a reveal happened"],
  revealReplaced: [STOPS, "a reveal happened"],
  revealedCardDiscarded: [STOPS, "a revealed card discarded"],
  revealedInPlay: [STOPS, "a revealed card in play"],
  reversesHidden: [STOPS, "hidden reverses shuffled"],
  roundStarted: [STOPS, "a round boundary"],
  scenarioDeckClosed: [STOPS, "a scenario deck changed"],
  scenarioDeckReset: [STOPS, "a scenario deck shuffled"],
  scenarioDeckTopEnteredPlay: [STOPS, "a scenario deck top revealed"],
  scenarioDeckTopLeft: [STOPS, "a scenario deck changed"],
  scenarioPlayAreaCreated: [STOPS, "setup"],
  scenarioPlayAreaEntered: [STOPS, "a scenario area entered"],
  scenarioSetupInstructionResolved: [STOPS, "setup"],
  schemeDefeated: [ALLOWED, "threat changes, face up"],
  schemeResolved: [STOPS, "the villain phase"],
  separateDeckReset: [STOPS, "a deck reset shuffles"],
  separatedCardFlipped: [STOPS, "turns a hidden face up"],
  setAsideModularSetShuffledIn: [STOPS, "a shuffle spends the RNG"],
  setupOptionApplied: [STOPS, "setup"],
  sharedEventEmitted: [STOPS, "another group's table"],
  sharedResultApplied: [STOPS, "another group's table"],
  sharedStateChanged: [STOPS, "another group's table"],
  startingHandCreditApplied: [STOPS, "setup"],
  startingHandCredited: [STOPS, "setup"],
  statusGiven: [ALLOWED, "rules bookkeeping, nothing hidden"],
  statusRemoved: [ALLOWED, "rules bookkeeping, nothing hidden"],
  stepChanged: [STOPS, "a step boundary"],
  surgeGranted: [STOPS, "encounter surge"],
  surgeTriggered: [STOPS, "encounter surge"],
  swapRefused: [ALLOWED, "a form change, face up"],
  targetChosen: [ALLOWED, "a choice among public options"],
  thenSkipped: [ALLOWED, "rules bookkeeping, nothing hidden"],
  threatCostSettled: [ALLOWED, "threat changes, face up"],
  threatPlaced: [ALLOWED, "threat changes, face up"],
  threatPrevented: [ALLOWED, "threat changes, face up"],
  threatRemovalBlocked: [ALLOWED, "threat changes, face up"],
  threatRemoved: [ALLOWED, "threat changes, face up"],
  thwartCostAsked: [ALLOWED, "threat changes, face up"],
  thwartCostSettled: [ALLOWED, "threat changes, face up"],
  thwartModified: [ALLOWED, "threat changes, face up"],
  treatedAsChanged: [ALLOWED, "the hero's own visible play"],
  triggerEvent: [ALLOWED, "rules bookkeeping, nothing hidden"],
  tuckedCardSpent: [ALLOWED, "the hero's own visible play"],
  turnEnded: [STOPS, "a turn boundary"],
  turnStarted: [STOPS, "a turn boundary"],
  uniqueEntryBlocked: [ALLOWED, "the hero's own visible play"],
  villainAdded: [STOPS, "the villain changed"],
  villainFlipped: [STOPS, "the villain flipped"],
  villainRemoved: [STOPS, "the villain changed"],
  villainReplaced: [STOPS, "the villain changed"],
  villainRowSet: [STOPS, "the villain changed"],
  villainSetAside: [STOPS, "the villain changed"],
  villainStageAdvanced: [STOPS, "the villain changed"],
  villainStageRevealed: [STOPS, "a stage revealed"],
  vulnerableDiscarded: [ALLOWED, "visible, deterministic bookkeeping"],
  wildTypesDeclared: [ALLOWED, "a choice among public options"],
  windowOpened: [ALLOWED, "rules bookkeeping, nothing hidden"],
};

/** Where a card can come from without anyone learning something by seeing it move (its own hand aside). */
const OPEN_ZONE_KINDS: ReadonlySet<ZoneId["kind"]> = new Set([
  "playArea",
  "discard",
  "resolving",
  "identity",
  "tucked",
  "encounterDiscard",
  "separateDiscard",
  "scenarioDiscard",
  "scenarioPlayArea",
  "villainArea",
  "attachment",
  "victoryDisplay",
]);

/** `PendingChoice.prompt.kind`s that exist to look at or search through a deck's hidden order. */
const DECK_LOOKING_PROMPT_KINDS: ReadonlySet<string> = new Set([
  "chooseCards",
  "lookAt",
  "chooseBottomCards",
  "orderCards",
]);

/** Whether `event`, in a move made by `mover`, stops Undo. */
export function eventStopsUndo(event: GameEvent, mover: PlayerId): boolean {
  // An unclassified type (a build whose table is behind the engine) is not on the allowlist, so it stops.
  const verdict = (UNDO_EVENT_VERDICTS[event.type] as readonly [Verdict, string] | undefined)?.[0];
  if (verdict === ALLOWED) return false;
  if (verdict !== CHECKED) return true;
  switch (event.type) {
    case "cardMoved":
      // A card leaving anywhere but a zone everyone can see (a deck, the dealt encounter queue, a set-aside pile,
      // a boost, another seat's hand) taught someone something.
      return !(OPEN_ZONE_KINDS.has(event.from.kind) || (event.from.kind === "hand" && event.from.playerId === mover));
    case "choiceRequested":
      return event.choice.playerId !== mover || DECK_LOOKING_PROMPT_KINDS.has(event.choice.prompt.kind);
    case "cardDiscardedFromHand":
      // Another seat's hand is theirs; the mover's own is gated by the RNG count (a random pick spends it).
      return event.playerId !== mover;
    default:
      return true;
  }
}

/** Whether the engine's random number generator was used by this command. Unknown (no count recorded) is not. */
export function usedRandomness(entry: BackOutTrailEntry): boolean {
  return entry.rngDraws !== undefined && entry.rngDraws.after !== entry.rngDraws.before;
}

/**
 * The one gate for rewinding a span of trail entries, shared by Undo (`undoOf`) and Back out (`backOutTargetOf`):
 * safe only if the generator was not used by any entry and every event of every entry passes `eventStopsUndo` for
 * `mover`. Keeping one rule means a reveal or random pick can't be escaped through whichever button is looser.
 */
export function isSafeToRewind(span: readonly BackOutTrailEntry[], mover: PlayerId): boolean {
  return !span.some((entry) => usedRandomness(entry) || entry.events.some((event) => eventStopsUndo(event, mover)));
}

export type UndoOffer =
  /** `target` is the command count to rewind to (`SessionStore.rewindTo`), `command` the move it takes back. */
  | { readonly kind: "available"; readonly target: number; readonly command: Command }
  | { readonly kind: "unavailable"; readonly reason: string };

/** Says why nothing earlier can be undone, the reason the disabled Undo button shows. */
export const UNDO_REASONS = {
  nothing: "Nothing to undo this turn",
  revealed: "Can't undo: something was drawn, revealed or random",
  otherPlayer: "Can't undo another player's move",
  boundary: "Can't undo past the start of the turn",
  /** A payment, a choice of cost or target, a sheet: Escape / Cancel closes it, Undo waits. */
  selecting: "Finish or cancel what you're doing first",
} as const;

/**
 * Whether Undo applies right now for `perspectiveId`, and what it would rewind to. Null when the button has no
 * business being offered at all: it isn't that player's turn, a choice is open (the choice sheet's own Back out
 * covers that), or the game is over.
 */
export function undoOf(
  trail: readonly BackOutTrailEntry[],
  game: Pick<GameState, "outcome" | "pendingChoice" | "step">,
  perspectiveId: PlayerId,
): UndoOffer | null {
  if (game.outcome || game.pendingChoice) return null;
  const { step } = game;
  if (step.phase !== "player" || step.kind !== "turn" || step.ended || step.activePlayerId !== perspectiveId) {
    return null;
  }
  let cursor = trail.length;
  if (cursor === 0) return { kind: "unavailable", reason: UNDO_REASONS.nothing };
  // The move's own answers, back to the command that started it.
  while (cursor > 0 && trail[cursor - 1]!.command.type === "resolveChoice") cursor -= 1;
  const start = cursor - 1;
  const opening = trail[start];
  if (!opening || !MOVE_COMMAND_TYPES.has(opening.command.type)) {
    // The trail reaches back to whatever began this turn (the last turn's End turn, the villain phase), or to a
    // resume with nothing played since.
    return { kind: "unavailable", reason: UNDO_REASONS.nothing };
  }
  const move = trail.slice(start);
  if (move.some((entry) => entry.playerId !== perspectiveId)) {
    return { kind: "unavailable", reason: UNDO_REASONS.otherPlayer };
  }
  if (move.some((entry) => entry.events.some((event) => BOUNDARY_EVENT_TYPES.has(event.type)))) {
    return { kind: "unavailable", reason: UNDO_REASONS.boundary };
  }
  if (!isSafeToRewind(move, perspectiveId)) {
    return { kind: "unavailable", reason: UNDO_REASONS.revealed };
  }
  return { kind: "available", target: start, command: opening.command };
}

/** What an undo took back, for the notice that follows it: "played Backflip", "attack", "change of form". */
export function undoneSummary(command: Command, cardName: (id: InstanceId) => string): string {
  switch (command.type) {
    case "playCard":
    case "useAbility":
      return `${command.type === "playCard" ? "played" : "used"} ${cardName(command.cardInstanceId)}`;
    case "basicAttack":
      return "attack";
    case "basicThwart":
      return "thwart";
    case "basicRecover":
      return "recover";
    case "changeForm":
      return "change of form";
    default:
      return "last move";
  }
}

/**
 * Every point Undo could rewind to by pressing it again and again, newest first: the command count before each move
 * `undoOf` would take back in turn, stopping where it would stop. The Pause log's "Jump to a moment" offers exactly
 * these, so jumping back is pressing Undo several times at once and reaches nothing Undo couldn't.
 */
export function undoTargetsOf(
  trail: readonly BackOutTrailEntry[],
  game: Pick<GameState, "outcome" | "pendingChoice" | "step">,
  perspectiveId: PlayerId,
): readonly number[] {
  const targets: number[] = [];
  let rest = trail;
  for (;;) {
    const offer = undoOf(rest, game, perspectiveId);
    if (offer?.kind !== "available") return targets;
    targets.push(offer.target);
    rest = rest.slice(0, offer.target);
  }
}
