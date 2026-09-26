/**
 * "Back out" (docs/wave4/back-out.md; the choice scene's own button): rewinds a game to the state just before the
 * local player's own `playCard`/`useAbility`, undoing everything that command's own resolution opened — a discard
 * choice, a target choice, whatever else — as if the player had never played it.
 *
 * RRG 1.8 has no such rule: an initiated ability or played card can't be taken back once it's started resolving.
 * This is a digital convenience, offered only in the one case where taking it back changes nothing the player
 * didn't already know — no card was drawn, revealed, looked at, or dealt in the meantime — so undoing it puts the
 * game back exactly where it stood, rather than letting a player peek at hidden information and then retreat from
 * a choice made worse by knowing it.
 *
 * The trail this reads (`BackOutTrailEntry[]`) is kept by `SessionStore` itself, one entry per command it has
 * successfully dispatched since the game started or was resumed — never recomputed from the engine, since the
 * whole point is remembering exactly what was learned and when.
 */
import type { Command, GameEvent, InstanceId, PendingChoice, PlayerId } from "@mc/engine";

export interface BackOutTrailEntry {
  readonly playerId: PlayerId;
  readonly command: Command;
  readonly events: readonly GameEvent[];
}

/**
 * Event types that, on their own, always mean something not previously known became visible: a draw, a reveal, a
 * dealt encounter or boost card, or a reshuffle of a deck whose order was secret. Denylist, not allowlist, so a
 * future event type this hasn't been taught about is caught by `revealsHiddenInformation`'s own catch-all rather
 * than silently passing through.
 */
const ALWAYS_REVEALING_EVENT_TYPES: ReadonlySet<GameEvent["type"]> = new Set([
  "cardDrawn",
  "drawnObligationPlaced",
  "cardTurnedFaceup",
  "encounterCardRevealed",
  "boostCardDealt",
  "boostCardFlipped",
  "deckShuffled",
  "scenarioDeckReset",
  "separateDeckReset",
  "villainReplaced",
]);

/** `PendingChoice.prompt.kind`s that only ever exist to look at or search through a deck's hidden order. */
const DECK_LOOKING_PROMPT_KINDS: ReadonlySet<PendingChoice["prompt"]["kind"]> = new Set([
  "chooseCards",
  "chooseBottomCards",
  "orderCards",
]);

const DECK_ZONE_KINDS = new Set(["deck", "encounterDeck", "separateDeck"]);

/**
 * Whether one event, on its own, taught this table something about hidden information it didn't already have.
 * Deliberately over-inclusive: `cardMoved` out of a deck zone counts (a random discard off the top, an obligation
 * hitting play, anything that turns a deck's top card into open information), and `choiceRequested` counts for the
 * prompt kinds that exist only to look through or search a deck. Anything this hasn't been taught about explicitly
 * falls through to `false` only via one of the two allowlisted checks below — every other event type is silent
 * about hidden information by construction (damage, threat, exhaust/ready, resource generation, …), which is why
 * this is workable as a denylist rather than needing to enumerate every safe event too.
 */
export function revealsHiddenInformation(event: GameEvent): boolean {
  if (ALWAYS_REVEALING_EVENT_TYPES.has(event.type)) return true;
  if (event.type === "cardMoved") {
    return DECK_ZONE_KINDS.has(event.from.kind) && !DECK_ZONE_KINDS.has(event.to.kind);
  }
  if (event.type === "choiceRequested") {
    return DECK_LOOKING_PROMPT_KINDS.has(event.choice.prompt.kind);
  }
  return false;
}

const INITIATING_COMMAND_TYPES: ReadonlySet<Command["type"]> = new Set(["playCard", "useAbility"]);

/**
 * Whether the choice scene should offer "Back out" right now: the pending choice belongs to `perspectiveId`, the
 * most recent command that player dispatched was their own `playCard` or `useAbility`, every command since then is
 * only `resolveChoice` inside that same resolution, and none of the events any of those commands (including the
 * initiating one) produced revealed hidden information. Returns the command count to rewind *to* — the number of
 * commands before the initiating one, i.e. what `SessionStore.rewindTo` should be called with — or `null` when any
 * of that doesn't hold.
 */
export function backOutTargetOf(
  trail: readonly BackOutTrailEntry[],
  choice: PendingChoice,
  perspectiveId: PlayerId,
): number | null {
  if (choice.playerId !== perspectiveId) return null;
  let cursor = trail.length;
  // Walk back over this player's own `resolveChoice` answers inside the resolution the choice is asking about.
  while (
    cursor > 0 &&
    trail[cursor - 1]!.command.type === "resolveChoice" &&
    trail[cursor - 1]!.playerId === perspectiveId
  ) {
    cursor -= 1;
  }
  if (cursor === 0) return null;
  const initiating = trail[cursor - 1]!;
  if (initiating.playerId !== perspectiveId || !INITIATING_COMMAND_TYPES.has(initiating.command.type)) return null;
  // Every event from the initiating command onward, not just the resolveChoice answers': the initiating command's
  // own resolution may itself have opened the choice by revealing something (an ability that draws, then asks what
  // to discard from the drawn cards).
  for (const entry of trail.slice(cursor - 1)) {
    if (entry.events.some(revealsHiddenInformation)) return null;
  }
  return cursor - 1;
}

/** The card the initiating command played or used, named by the caller's own `cardName` (`view/names.ts`). */
export function backOutSubjectName(
  trail: readonly BackOutTrailEntry[],
  target: number,
  cardName: (instanceId: InstanceId) => string,
): string | null {
  const initiating = trail[target];
  if (!initiating) return null;
  const { command } = initiating;
  if (command.type === "playCard") return cardName(command.cardInstanceId);
  if (command.type === "useAbility") return cardName(command.cardInstanceId);
  return null;
}
