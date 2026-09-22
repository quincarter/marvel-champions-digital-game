/**
 * Reading a finished game back into the campaign (design §7.2, §11 step 4).
 *
 * `campaignResultOf` is a **derived reducer** over the final `GameState` and the event stream, exactly as
 * `client/src/engine/game-record.ts` is over the same two things — never something a client accumulates and hands
 * back, because then the campaign would believe whatever the client said. Everything it reads is already in the
 * replayable record, so replaying a saved game reproduces the same result value.
 *
 * The one thing it does *not* derive is the in-game writes: `recordInCampaignLog` and the in-game
 * `removeFromCampaign` accumulate in `GameState.campaignWrites` as they resolve (`resolve/campaign.ts`), and those
 * are copied through verbatim so a lost game's writes stay distinguishable from between-games writes.
 */

import type { CardId } from "@mc/content";
import { matchesModes } from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps } from "../abilities.js";
import type {
  CampaignDefinition,
  CampaignGameQuery,
  CampaignGameResult,
  CampaignInstruction,
  CampaignLog,
  CampaignNode,
  LogFieldDef,
  LogValue,
  LogWrite,
  LogWriteMode,
  LogWriteSpec,
} from "../campaign.js";
import { EngineInvariantError } from "../errors.js";
import type { GameEvent } from "../events.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { cardsInPlay, matchesQuery, type EffectContext } from "../select.js";
import { getInstance, maxHitPoints, minionsEngagedWith, remainingHitPoints } from "../query.js";
import type { TargetQuery } from "../spec.js";
import type { GameState } from "../state.js";
import { fieldDefOf } from "./log.js";

/** What one `CampaignGameQuery` answered to. Kept typed so the coercion into a `LogValue` cannot be sloppy. */
type QueryValue =
  | { readonly kind: "cards"; readonly instanceIds: readonly InstanceId[] }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "string"; readonly value: string };

const contextFor = (state: GameState, playerId: PlayerId | null, deps: EngineDeps): EffectContext => ({
  selfInstanceId: null,
  controllerId: playerId,
  event: null,
  bindings: {},
  deps,
  scopedPlayerId: playerId,
});

const matching = (
  state: GameState,
  ids: readonly InstanceId[],
  query: TargetQuery,
  context: EffectContext,
): readonly InstanceId[] => ids.filter((id) => getInstance(state, id) && matchesQuery(state, id, query, context));

/** Every card that entered play at any point, in the order it did (RRG "Enter Play"); duplicates are kept. */
const enteredPlay = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((event) =>
    event.type === "triggerEvent" && event.phase === "resolved" && event.event.kind === "cardEntersPlay"
      ? [event.event.instanceId]
      : [],
  );

/** MC60 p. 13: "each unique ally and support that was removed from the game". Read off the zone transitions. */
const removedFromGame = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((event) =>
    event.type === "cardMoved" && event.to.kind === "removedFromGame" ? [event.instanceId] : [],
  );

const countOf = (value: QueryValue): number => {
  switch (value.kind) {
    case "cards":
      return value.instanceIds.length;
    case "number":
      return value.value;
    case "boolean":
      return value.value ? 1 : 0;
    case "string":
      return Number.isFinite(Number(value.value)) ? Number(value.value) : 0;
  }
};

/** One query against the finished game. Exhaustive: a member no built box uses must still have an answer. */
function evaluateQuery(
  state: GameState,
  events: readonly GameEvent[],
  query: CampaignGameQuery,
  playerId: PlayerId | null,
  deps: EngineDeps,
): QueryValue {
  const context = contextFor(state, playerId, deps);
  switch (query.kind) {
    case "cardsThatEnteredPlay":
      return { kind: "cards", instanceIds: matching(state, enteredPlay(events), query.query, context) };
    case "cardsRemovedFromGame":
      return { kind: "cards", instanceIds: matching(state, removedFromGame(events), query.query, context) };
    case "cardsInPlay":
      return { kind: "cards", instanceIds: matching(state, cardsInPlay(state), query.query, context) };
    case "cardsInVictoryDisplay":
      return { kind: "cards", instanceIds: matching(state, state.victoryDisplay, query.query, context) };
    case "countersOn": {
      const counter = query.counter;
      const total = matching(state, cardsInPlay(state), query.query, context).reduce(
        (sum, id) => sum + (getInstance(state, id)?.counters[counter] ?? 0),
        0,
      );
      return { kind: "number", value: total };
    }
    case "threatOn": {
      const total = matching(state, cardsInPlay(state), query.query, context).reduce(
        (sum, id) => sum + (getInstance(state, id)?.threat ?? 0),
        0,
      );
      return { kind: "number", value: total };
    }
    case "remainingHitPointsCappedAtBase": {
      // MC10 p. 17: "If a player's remaining hit point value is higher than their base hit point value, record
      // their base hit points in the campaign log instead." The cap is part of the query, because every box prints it.
      if (playerId === null) return { kind: "number", value: 0 };
      const identity = state.players.find((player) => player.playerId === playerId)?.identity.instanceId;
      if (identity === undefined) return { kind: "number", value: 0 };
      const remaining = remainingHitPoints(state, identity, deps) ?? 0;
      const base = maxHitPoints(state, identity, deps) ?? remaining;
      return { kind: "number", value: Math.max(0, Math.min(remaining, base)) };
    }
    case "isEngagedWithEnemy":
      // MC10 p. 12: "Each player engaged with an enemy records they are engaged with an enemy in the campaign log."
      return { kind: "boolean", value: playerId !== null && minionsEngagedWith(state, playerId).length > 0 };
    case "const":
      return typeof query.value === "number"
        ? { kind: "number", value: query.value }
        : typeof query.value === "boolean"
          ? { kind: "boolean", value: query.value }
          : { kind: "string", value: query.value };
    case "count":
      return { kind: "number", value: countOf(evaluateQuery(state, events, query.of, playerId, deps)) };
    case "atLeast":
      return {
        kind: "boolean",
        value: countOf(evaluateQuery(state, events, query.of, playerId, deps)) >= query.amount,
      };
  }
}

const cardIdsOf = (state: GameState, value: QueryValue): readonly CardId[] =>
  value.kind === "cards"
    ? value.instanceIds.flatMap((id) => {
        const instance = getInstance(state, id);
        return instance ? [instance.cardId] : [];
      })
    : [];

const stringOf = (state: GameState, value: QueryValue): string => {
  switch (value.kind) {
    case "cards":
      return (cardIdsOf(state, value)[0] as string | undefined) ?? "";
    case "number":
      return String(value.value);
    case "boolean":
      return String(value.value);
    case "string":
      return value.value;
  }
};

/** The `LogValue` a query becomes in a field of the declared kind. Exhaustive, so no field kind is forgotten. */
function logValueOf(state: GameState, declared: LogFieldDef, mode: LogWriteMode, value: QueryValue): LogValue {
  if (mode === "strike") return { kind: "strikeList", struck: [stringOf(state, value)] };
  switch (declared.type.kind) {
    case "number":
      return { kind: "number", value: countOf(value) };
    case "flag":
      return { kind: "flag", value: value.kind === "boolean" ? value.value : countOf(value) > 0 };
    case "cardList":
      return { kind: "cardList", cardIds: cardIdsOf(state, value) };
    case "cardRef": {
      const [first] = cardIdsOf(state, value);
      return { kind: "cardRef", cardId: (first ?? (stringOf(state, value) as CardId)) as CardId };
    }
    case "choice":
      return { kind: "choice", option: stringOf(state, value) };
    case "strikeList":
      return { kind: "strikeList", struck: [stringOf(state, value)] };
    case "instructionList":
      return { kind: "instructionList", ids: [stringOf(state, value)] };
    case "text":
      return { kind: "text", value: stringOf(state, value) };
    case "cardState":
      throw new EngineInvariantError(
        `campaign log field "${declared.id}" is a cardState field, which a record instruction cannot yet write`,
      );
  }
}

/**
 * The seats a `LogWriteSpec` writes, as `(seatNumber, playerId)` pairs.
 *
 * A shared field is one write with no seat. Both `"each"` and `"self"` write every seat: a record instruction
 * reads a *finished game*, where there is no "self" to scope to — "each player records their remaining hit
 * points" and "record your remaining hit points" are the same sentence once the game is over.
 */
function seatsFor(state: GameState, spec: LogWriteSpec): readonly (readonly [number | null, PlayerId | null])[] {
  if (spec.seat === undefined) return [[null, null]];
  const seats = state.campaign?.seats ?? [];
  return seats.map((seat, index) => [seat.seatNumber, state.players[index]?.playerId ?? null] as const);
}

const recordInstructions = (
  definition: CampaignDefinition,
  node: CampaignNode,
  won: boolean,
): readonly CampaignInstruction[] =>
  won
    ? [...(definition.everyNodeVictory ?? []), ...node.victory]
    : [...(node.defeat ?? []), ...(definition.loss.everyNodeDefeat ?? [])];

/**
 * What the finished game hands the campaign.
 *
 * Takes the whole `CampaignLog` rather than the node the design sketched, because the attempt in the log is what
 * says which node was played and under which modes, and because `expiringGrants` is a fact about the log's grants
 * (`permanence: "thisGame"`, MC32 p. 5) that no game state can tell you.
 *
 * Every `record` instruction of the matching branch is computed, whatever its `when` predicate says: the predicate
 * reads the *log*, which is `applyCampaignResult`'s job, so gating here would compute the answer twice against two
 * different states. Unused records are simply never folded in.
 */
export function campaignResultOf(
  definition: CampaignDefinition,
  log: CampaignLog,
  state: GameState,
  events: readonly GameEvent[],
  deps: EngineDeps = DEFAULT_DEPS,
): CampaignGameResult {
  const attempt = log.attempt;
  if (!attempt) throw new EngineInvariantError(`campaign ${log.id} has no game in progress to take a result from`);
  const node = definition.graph.nodes.find((candidate) => candidate.id === attempt.nodeId);
  if (!node) throw new EngineInvariantError(`campaign ${log.campaignId} has no node "${attempt.nodeId}"`);
  if (!state.outcome) throw new EngineInvariantError(`the game for campaign node "${attempt.nodeId}" has not ended`);
  // RRG 1.8 has no "conceded" campaign outcome: a conceded game is a game the players did not win (design §7.2).
  const outcome = state.outcome.result === "win" ? "won" : "lost";

  const records: { readonly instructionId: string; readonly write: LogWrite }[] = [];
  for (const instruction of recordInstructions(definition, node, outcome === "won")) {
    if (instruction.step.kind !== "record") continue;
    if (!matchesModes(attempt.modes, instruction.whenModes)) continue;
    for (const spec of instruction.step.writes) {
      const declared = fieldDefOf(definition, spec.field);
      for (const [seatNumber, playerId] of seatsFor(state, spec)) {
        const value = evaluateQuery(state, events, spec.value, playerId, deps);
        records.push({
          instructionId: instruction.id,
          write: {
            field: spec.field,
            seatNumber,
            mode: spec.mode,
            value: logValueOf(state, declared, spec.mode, value),
          },
        });
      }
    }
  }

  return {
    nodeId: attempt.nodeId,
    outcome,
    records,
    removedFromCampaign: state.campaignWrites?.removedFromCampaign ?? [],
    logWrites: state.campaignWrites?.logWrites ?? [],
    expiringGrants: log.seats.flatMap((seat) =>
      seat.grants.flatMap((grant) => (grant.permanence === "thisGame" ? [grant.cardId] : [])),
    ),
  };
}
