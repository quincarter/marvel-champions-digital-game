import type { GameState } from "./state.js";
import type { StackFrame } from "./stack.js";

/**
 * Every field of the state, as a probe reads it: `game` is the game itself, compared before and after; `bookkeeping`
 * is what resolving anything leaves different without the game having changed, and is not compared.
 *
 * The map is exhaustive over `GameState` by its type, so a field added to the state does not compile until it is
 * placed here: a bookkeeping field cannot be forgotten and so read as a change (a cost judged payable that is not).
 *
 * Bookkeeping: the stack and the open choice; the counters that name frames, choices and lasting effects; the
 * per-ability use counts ("Limit once per round" counts a resolution that did nothing); and the memory of what the
 * between-frames checks and the log last saw (`stateChecks`, `hitPointsSeen`, `schemeTargetsSeen`,
 * `deckTopsAnnounced`, `encounterTopAnnounced`), none of which the game is ever read from. The queues those checks
 * drain (`pending…`) are game: a card left play or entered a hand.
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
  schemeTargetsSeen: "bookkeeping",
  deckTopsAnnounced: "bookkeeping",
  encounterTopAnnounced: "bookkeeping",
  round: "game",
  step: "game",
  firstPlayerId: "game",
  villainPhasesToSkip: "game",
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
  hiddenPileSizes: "game",
  revealedPileCards: "game",
  accusation: "game",
  pod: "game",
  gameMode: "game",
  teams: "game",
  campaign: "game",
  campaignWrites: "game",
  setupStack: "game",
  villainsEnteringAtSetup: "game",
  setupCardsAwaitingHost: "game",
  outcome: "game",
  rng: "game",
  nextInstanceSeq: "game",
};

export const GAME_FIELDS = (Object.keys(PROBE_FIELDS) as (keyof GameState)[]).filter(
  (key) => PROBE_FIELDS[key] === "game",
);

/** Whether two states hold the same game: every `game` field of `PROBE_FIELDS`, by identity or else by content. */
export function sameGame(a: GameState, b: GameState): boolean {
  for (const key of GAME_FIELDS) {
    if (a[key] !== b[key] && JSON.stringify(a[key]) !== JSON.stringify(b[key])) return false;
  }
  return true;
}

/**
 * A short digest of the game a state holds, so whether an ability's effects changed the game can be read as they
 * finish (`Frame<"effects">.resolvedCount`, kept on a frame where a whole state cannot be): every `game` field of
 * `PROBE_FIELDS` but the card pool (it only grows alongside `instances`), and the stack frames beneath the ability's
 * own effects frame (`beneath`). Those frames hold game changes of their own that no state field shows: an attack's
 * modifiers while it is in progress, a boost card's `countAdjust`, the reveal in progress gaining surge. Taken as the
 * effects are pushed and again once they are popped, the same frames are beneath both times; anything an ability
 * pushed has resolved and gone by then. Frame and choice counters are bookkeeping and so not read.
 *
 * The random number generator's state is left out: shuffling an empty or one-card deck, or a random pick from
 * nothing, advances it and changes nothing a player can see. A shuffle that moves cards, or a random pick that does,
 * changes the deck's or the zones' order, which is read.
 *
 * Also counted as a change: anything another card did while the ability resolved (an interrupt or response to one of
 * its effects; there is none to an effect that changed nothing). JSON follows each object's key order, so the same game
 * built in another key order would read as changed; state updates spread the old object, which keeps its order, so
 * this does not arise from a no-op. FNV-1a over the JSON in two independent 32-bit lanes plus its length: a collision
 * is not a practical concern.
 */
export function gameFingerprint(state: GameState, beneath: readonly StackFrame[] = state.stack): string {
  const fields = GAME_FIELDS.filter((key) => key !== "cardPool" && key !== "rng").map((key) => state[key] ?? null);
  const text = JSON.stringify([fields, beneath]);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
  }
  return `${text.length}:${a.toString(16)}:${b.toString(16)}`;
}
