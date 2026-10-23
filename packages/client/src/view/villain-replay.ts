/**
 * Where the villain-phase replay stands against the game the engine has already finished.
 *
 * The engine runs a whole villain phase (and often the start of the next round) inside one command, so the table, the
 * pending decision and the outcome are all the engine's *end* state while the rail is still replaying the first beats.
 * Everything here is a plain function of the walkthrough and the reveal cursor, so the scene can hold each of those back
 * until the rail reaches them (the QA of 2026-10-15: the board showed round 2 and "Your turn" over round 1's step 2).
 */
import { locateCard, type GameOutcome, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { revealOf } from "./villain-phase-reveal.js";
import { dealtByBeat, VILLAIN_STEPS, type Walkthrough } from "./villain-walkthrough.js";

export const totalBeats = (walkthrough: Walkthrough): number =>
  walkthrough.steps.reduce((sum, step) => sum + step.beats.length, 0);

/**
 * Whether the replay has reached the open decision. The engine parks a pause on the last beat it has recorded, so a
 * pending decision belongs to the last beat: until the cursor is there, an earlier activation is still being shown and
 * a decision from a later one would sit under the wrong headline.
 */
export function decisionReached(paused: boolean, revealed: number, total: number): boolean {
  return !paused || revealed >= total;
}

/** What the table's chrome says while the rail is still replaying: the round and the step being shown. */
export interface TableHold {
  readonly round: number;
  /** "Villain phase · step 2 of 5". */
  readonly stepLabel: string;
  /**
   * Encounter cards dealt this phase that the rail has not revealed yet, in the order dealt (issue #311). The engine
   * has already revealed them, so the live table shows their faces (an obligation in your play area, a treachery
   * attached to the villain) while the rail is still on the deal. The table draws them as the facedown pile they were
   * dealt into until the rail reaches their reveal. Absent when there are none.
   */
  readonly facedown?: readonly FacedownCard[];
  /**
   * The game as the engine had it at the beat the rail is on (`Walkthrough.tables`, issue #386), for the table to draw
   * in place of the engine's end state: a minion a side scheme puts into play, a status card given to the villain or a
   * surge's card dealt facedown appears when the rail gets there, not before. Absent when the host recorded none.
   */
  readonly game?: GameState;
}

/** A card dealt facedown to a player and not yet shown revealed by the rail. */
export interface FacedownCard {
  readonly instanceId: InstanceId;
  readonly playerId: PlayerId;
}

/**
 * The chrome the table wears while the replay is behind the engine; null once the replay has caught up (the live game
 * is then the game being shown) or when there is nothing to replay.
 */
export function tableHoldOf(
  walkthrough: Walkthrough,
  revealed: number,
  /** The card the rail is holding facedown for Flip Encounter Card (or turning over), whose reveal beat is up already. */
  unflipped: InstanceId | null = null,
): TableHold | null {
  const total = totalBeats(walkthrough);
  // Caught up, unless the last card is still waiting on Flip Encounter Card.
  if (total === 0 || (revealed >= total && unflipped === null)) return null;
  const active = revealOf(walkthrough, revealed).steps.find((step) => step.revealStatus === "active");
  const shown = new Set(
    walkthrough.steps
      .flatMap((step) => step.beats)
      .slice(0, revealed)
      .map((beat) => beat.encounterInstanceId ?? null),
  );
  if (unflipped !== null) shown.delete(unflipped);
  // Only cards dealt as far as the rail has got: a surge's card is not in the pile before the surge (issue #386).
  const facedown = walkthrough.encounter.dealt
    .filter((card) => !shown.has(card.instanceId) && dealtByBeat(card, revealed))
    .map((card) => ({ instanceId: card.instanceId, playerId: card.playerId }));
  const game = tableAt(walkthrough, revealed);
  return {
    round: walkthrough.round,
    stepLabel: active
      ? `Villain phase · step ${active.number} of ${VILLAIN_STEPS.length}`
      : "Villain phase · about to begin",
    ...(facedown.length > 0 ? { facedown } : {}),
    ...(game ? { game } : {}),
  };
}

/**
 * The latest table the rail is past (`WalkthroughTable.atBeat` below `revealed`): before any beat is shown, the phase's
 * opening. Undefined when the host recorded none. Without an opening (a game resumed mid-phase, whose next command's
 * tables start past the beats replayed so far) the earliest recorded table stands in: still nearer the rail than the
 * engine's end state. A command's last tables can sit at `atBeat === total` and never be drawn: the hold lets go of
 * the table once the rail has caught up, and on a last card waiting on Flip Encounter Card the table rightly stays
 * at its reveal.
 */
export function tableAt(walkthrough: Walkthrough, revealed: number): GameState | undefined {
  let found: GameState | undefined;
  for (const table of walkthrough.tables) {
    if (table.atBeat >= revealed) break;
    found = table.game;
  }
  return found ?? walkthrough.tables[0]?.game;
}

/** Whether two holds draw the same table: the same cards hidden on the same game (it redraws only when this or the chrome changes). */
export const sameFacedown = (a: TableHold | null | undefined, b: TableHold | null | undefined): boolean =>
  a?.game === b?.game &&
  (a?.facedown ?? []).map((card) => card.instanceId).join() ===
    (b?.facedown ?? []).map((card) => card.instanceId).join();

/**
 * The game as the table should draw it while the rail is behind: each card in `facedown` taken out of wherever the
 * engine has put it since its reveal (a play area, the villain area, an attachment, a discard pile) and put back in its
 * player's facedown pile, so the table shows a card back until the rail reveals it. A card back in a deck is hidden
 * already and is left there. A view of the state only: the engine's game is never changed.
 */
export function withFacedownHeld(game: GameState, facedown: readonly FacedownCard[]): GameState {
  const held = facedown.filter((card) => {
    const zone = locateCard(game, card.instanceId);
    return zone !== null && zone.kind !== "deck" && zone.kind !== "encounterDeck" && zone.kind !== "dealtEncounter";
  });
  if (held.length === 0) return game;
  const ids = new Set<InstanceId>(held.map((card) => card.instanceId));
  const keep = (list: readonly InstanceId[]): readonly InstanceId[] =>
    list.some((id) => ids.has(id)) ? list.filter((id) => !ids.has(id)) : list;

  const instances: Record<string, GameState["instances"][string]> = { ...game.instances };
  for (const [key, instance] of Object.entries(game.instances)) {
    if (ids.has(instance.instanceId) && instance.attachedTo !== null) {
      instances[key] = { ...instance, attachedTo: null };
    } else if (instance.attachments.some((id) => ids.has(id))) {
      instances[key] = { ...instance, attachments: keep(instance.attachments) };
    }
  }
  const encounterDecks: Record<string, GameState["encounterDecks"][string]> = {};
  for (const [deckId, piles] of Object.entries(game.encounterDecks)) {
    encounterDecks[deckId] = { ...piles, discard: keep(piles.discard) };
  }
  return {
    ...game,
    instances,
    encounterDecks,
    villainArea: keep(game.villainArea),
    victoryDisplay: keep(game.victoryDisplay),
    removedFromGame: keep(game.removedFromGame),
    players: game.players.map((player) => {
      const mine = held.filter((card) => card.playerId === player.playerId).map((card) => card.instanceId);
      return {
        ...player,
        hand: keep(player.hand),
        discard: keep(player.discard),
        playArea: keep(player.playArea),
        resolving: keep(player.resolving),
        dealtEncounter: [...player.dealtEncounter, ...mine],
      };
    }),
  };
}

/** Whether a finished game's outcome screen may replace the rail: every beat has been shown (or there is nothing to show). */
export const outcomeReleasable = (revealed: number, total: number): boolean => revealed >= total;

/**
 * Whether an outcome ends the replay on the spot instead of waiting for the rail. A win or a defeat came out of the
 * phase's own beats, so the rail plays them out first; a concession came from the pause menu, not from the phase, and
 * the beats still to play (or a phase not yet started) have nothing to do with it. Waiting there hung the game: a
 * phase parked on "Start villain phase" never reveals a beat, so its outcome was never released.
 */
export const outcomeEndsReplay = (outcome: GameOutcome): boolean => outcome.result === "conceded";

/**
 * The heading over a held decision: who decides and what it is about. With one seat it is "Your decision"; with
 * several (hot-seat especially) the deciding seat is named every time, since "your" is whoever is holding the device.
 */
export function decisionTitleOf(input: {
  readonly seatCount: number;
  readonly deciderName: string;
  /** "Electro attacks You" while an activation is the thing being decided about, else null. */
  readonly activation: string | null;
  /** The card the decision is about when it is not an activation (a revealed encounter card), else null. */
  readonly subject: string | null;
}): string {
  const who = input.seatCount > 1 ? input.deciderName : "Your decision";
  const about = input.activation ?? input.subject ?? "The villain phase";
  return `${who} — ${about}`;
}

/** A seat named for a heading: "Spider-Man (Peter Parker)" is "Spider-Man", which is what the table calls the seat. */
export const seatHeadingName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, "");
