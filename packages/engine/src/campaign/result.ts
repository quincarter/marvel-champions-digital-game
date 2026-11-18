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
import { cardsInPlay, matchesQuery, offSchemeAccelerationTokens, type EffectContext } from "../select.js";
import {
  cardOf,
  encounterDeckOf,
  getCard,
  getInstance,
  mainSchemeStage,
  mainSchemeStates,
  maxHitPoints,
  minionsEngagedWith,
  remainingHitPoints,
} from "../query.js";
import type { TargetQuery } from "../spec.js";
import type { GameState } from "../state.js";
import { campaignFaceOf } from "../campaign-state.js";
import { fieldDefOf } from "./log.js";

/** What one `CampaignGameQuery` answered to. Kept typed so the coercion into a `LogValue` cannot be sloppy. */
type QueryValue =
  | { readonly kind: "cards"; readonly instanceIds: readonly InstanceId[] }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "string"; readonly value: string }
  /** `cardStateOf`: the matching cards in play, with the counters asked for (and whether the face was asked for). */
  | {
      readonly kind: "cardState";
      readonly withFace: boolean;
      readonly entries: readonly {
        readonly instanceId: InstanceId;
        readonly counters: Readonly<Record<string, number>>;
      }[];
    };

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

/** Every scheme and character defeated, with the card it was at the moment of defeat (`cardsDefeated`). */
const defeated = (events: readonly GameEvent[]): readonly { instanceId: InstanceId; cardId: CardId }[] =>
  events.flatMap((event) =>
    event.type === "schemeDefeated" || event.type === "characterDefeated"
      ? [{ instanceId: event.instanceId, cardId: event.cardId }]
      : [],
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
    case "cardState":
      return value.entries.length;
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
    case "cardsThatEnteredPlay": {
      const entered = enteredPlay(events);
      const ids = query.distinct ? [...new Set(entered)] : entered;
      return { kind: "cards", instanceIds: matching(state, ids, query.query, context) };
    }
    case "cardsRemovedFromGame":
      return { kind: "cards", instanceIds: matching(state, removedFromGame(events), query.query, context) };
    case "cardsDefeated":
      return {
        kind: "cards",
        instanceIds: defeated(events)
          .filter((entry) => getCard(state, entry.cardId)?.name === query.name)
          .map((entry) => entry.instanceId),
      };
    case "cardsInPlay":
      return { kind: "cards", instanceIds: matching(state, cardsInPlay(state), query.query, context) };
    case "cardsInEncounterDeckAndDiscard": {
      // MC32 pp. 7/10/12/16: "found in the encounter deck, discard pile, and in play". Every encounter deck and its
      // discard pile, then in play, then the named scenario decks; an instance is listed once whatever it read as.
      const piles = state.encounterDeckOrder.flatMap((deckId) => {
        const deck = encounterDeckOf(state, deckId);
        return [...deck.deck, ...deck.discard];
      });
      const scenario = (query.scenarioDecks ?? []).flatMap((name) => {
        const deck = state.scenarioDecks[name];
        return deck ? [...deck.deck, ...deck.discard] : [];
      });
      const ids = [...new Set([...piles, ...(query.inPlay ? cardsInPlay(state) : []), ...scenario])];
      return { kind: "cards", instanceIds: matching(state, ids, query.query, context) };
    }
    case "cardsTuckedUnder": {
      // RRG 1.8 "Tuck": a tucked card is out of play, so `cardsInPlay` never reaches it — the host is in play and
      // what is underneath is not (MC10 p. 12's allies beneath a side scheme). A host that has left play names
      // nothing, which is the printed "if the … side scheme is still in play" condition.
      const tucked = matching(state, cardsInPlay(state), query.under, context).flatMap(
        (id) => getInstance(state, id)?.tucked ?? [],
      );
      return { kind: "cards", instanceIds: matching(state, tucked, query.query, context) };
    }
    case "cardsInVictoryDisplay":
      return { kind: "cards", instanceIds: matching(state, state.victoryDisplay, query.query, context) };
    case "cardsInScenarioArea":
      return {
        kind: "cards",
        instanceIds: matching(state, state.scenarioAreas?.[query.name] ?? [], query.query, context),
      };
    case "countersOn": {
      const counter = query.counter;
      const total = matching(state, cardsInPlay(state), query.query, context).reduce(
        (sum, id) => sum + (getInstance(state, id)?.counters[counter] ?? 0),
        0,
      );
      return { kind: "number", value: total };
    }
    case "cardStateOf":
      // One entry for each matching card in play. The key and the face are worked out when the value is written,
      // against the field's own `cardIds` (`cardStateValueOf`).
      return {
        kind: "cardState",
        withFace: query.withFace === true,
        entries: matching(state, cardsInPlay(state), query.query, context).map((instanceId) => ({
          instanceId,
          counters: Object.fromEntries(
            query.counters.map((counter) => [counter, getInstance(state, instanceId)?.counters[counter] ?? 0]),
          ),
        })),
      };
    case "threatOn": {
      const total = matching(state, cardsInPlay(state), query.query, context).reduce(
        (sum, id) => sum + (getInstance(state, id)?.threat ?? 0),
        0,
      );
      return { kind: "number", value: total };
    }
    case "damageOn": {
      // MC40 pp. 14, 16: "the amount of damage on" a card is its damage tokens, not its hit points remaining.
      const total = matching(state, cardsInPlay(state), query.query, context).reduce(
        (sum, id) => sum + (getInstance(state, id)?.damage ?? 0),
        0,
      );
      return { kind: "number", value: total };
    }
    case "accelerationTokensInPlay": {
      // Each main scheme holds its own on its state; any other card in play, as its `acceleration` counter (§3.4).
      const onSchemes = mainSchemeStates(state).reduce((sum, scheme) => sum + scheme.accelerationTokens, 0);
      return { kind: "number", value: onSchemes + offSchemeAccelerationTokens(state) };
    }
    case "defeatedIdentities":
      return { kind: "number", value: state.players.filter((player) => player.eliminated).length };
    case "cardsInPlayerDecks":
      return {
        kind: "cards",
        instanceIds: state.players.flatMap((player) =>
          player.eliminated ? [] : matching(state, player.deck, query.query, context),
        ),
      };
    case "playersInScenario":
      // The players who started it: a seat that sat the scenario out is not one (docs/phase7-wave9.md §4.1 row 66 = B).
      return { kind: "number", value: state.startingPlayerCount };
    case "keywordValueSum": {
      const total = matching(state, state.victoryDisplay, query.query, context).reduce((sum, id) => {
        const card = cardOf(state, id);
        const keyword =
          card && "keywords" in card ? card.keywords.find((entry) => entry.name === query.keyword) : undefined;
        return sum + (keyword && "value" in keyword ? keyword.value : 0);
      }, 0);
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
    case "mainSchemeStageNumber":
      return { kind: "number", value: mainSchemeStage(state).stageNumber };
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
    case "atMost":
      return {
        kind: "boolean",
        value: countOf(evaluateQuery(state, events, query.of, playerId, deps)) <= query.amount,
      };
    case "equals":
      return {
        kind: "boolean",
        value: countOf(evaluateQuery(state, events, query.of, playerId, deps)) === query.amount,
      };
    case "capAt":
      return {
        kind: "number",
        value: Math.min(countOf(evaluateQuery(state, events, query.of, playerId, deps)), query.amount),
      };
  }
}

const cardIdsOf = (state: GameState, value: QueryValue): readonly CardId[] => {
  const ids =
    value.kind === "cards"
      ? value.instanceIds
      : value.kind === "cardState"
        ? value.entries.map((entry) => entry.instanceId)
        : [];
  return ids.flatMap((id) => {
    const instance = getInstance(state, id);
    return instance ? [instance.cardId] : [];
  });
};

const stringOf = (state: GameState, value: QueryValue): string => {
  switch (value.kind) {
    case "cards":
    case "cardState":
      return (cardIdsOf(state, value)[0] as string | undefined) ?? "";
    case "number":
      return String(value.value);
    case "boolean":
      return String(value.value);
    case "string":
      return value.value;
  }
};

/**
 * A `cardStateOf` answer as a `cardState` field holds it (MC50 pp. 9 to 15; docs/phase7-wave9.md §3.74).
 *
 * Each card is keyed by the id the field lists for it: its own card id while it is on that face, and the id of its
 * other face (`BaseCard.otherFaceId`) once it has flipped to a face that is a card record of its own. The face is
 * named only when the query asked for it and the card is not on the listed face: the showing card's id for a card of
 * two records, the printed name of the flip side for a card of one (`campaignFaceOf`).
 *
 * A card the field does not list is refused, and so are two cards in play that would be written under one key: the
 * field holds one state for each listed card, and a silent overwrite would lose one of them.
 */
function cardStateValueOf(
  state: GameState,
  declared: LogFieldDef,
  cardIds: readonly CardId[],
  value: Extract<QueryValue, { kind: "cardState" }>,
): LogValue {
  const cards: Record<string, { counters: Readonly<Record<string, number>>; face?: string }> = {};
  for (const entry of value.entries) {
    const instance = getInstance(state, entry.instanceId);
    if (!instance) continue;
    const other = getCard(state, instance.cardId)?.otherFaceId;
    const key = cardIds.includes(instance.cardId)
      ? instance.cardId
      : other !== undefined && cardIds.includes(other)
        ? other
        : undefined;
    if (key === undefined) {
      throw new EngineInvariantError(
        `campaign log field "${declared.id}" records the state of ${cardIds.join(", ")}, and a record instruction named ${instance.cardId}, which is not one of them`,
      );
    }
    if (Object.hasOwn(cards, key)) {
      throw new EngineInvariantError(
        `campaign log field "${declared.id}" holds one state for ${key}, and a record instruction found two such cards in play`,
      );
    }
    const face = key !== instance.cardId ? (instance.cardId as string) : campaignFaceOf(state, entry.instanceId)?.face;
    cards[key] = { counters: entry.counters, ...(value.withFace && face !== undefined ? { face } : {}) };
  }
  return { kind: "cardState", cards };
}

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
      // Only `cardStateOf` composes a card's counters and face (docs/phase7-wave9.md §3.74): any other query has no
      // such value to give, and guessing one from a count or a card list would record a state nobody read.
      if (value.kind !== "cardState" || mode !== "set") {
        throw new EngineInvariantError(
          `campaign log field "${declared.id}" is a cardState field, which a record instruction writes with mode "set" and a cardStateOf query only`,
        );
      }
      return cardStateValueOf(state, declared, declared.type.cardIds, value);
  }
}

/**
 * The seats a `LogWriteSpec` writes, as `(seatNumber, playerId)` pairs.
 *
 * A shared field is one write with no seat. Both `"each"` and `"self"` write every seat: a record instruction
 * reads a *finished game*, where there is no "self" to scope to — "each player records their remaining hit
 * points" and "record your remaining hit points" are the same sentence once the game is over.
 *
 * A seat sitting out the Victory steps (§4.6b, `sittingOutOf`) gets no per-seat write at all.
 */
function seatsFor(
  state: GameState,
  spec: LogWriteSpec,
  sittingOut: readonly number[],
): readonly (readonly [number | null, PlayerId | null])[] {
  if (spec.seat === undefined) return [[null, null]];
  const seats = state.campaign?.seats ?? [];
  return seats.flatMap((seat, index) =>
    sittingOut.includes(seat.seatNumber) ? [] : [[seat.seatNumber, state.players[index]?.playerId ?? null] as const],
  );
}

/**
 * The seats that do not participate in this scenario's Victory steps (§4.6b; MC16 p. 5 "Elimination and Victory",
 * printed in every box's expert rules): eliminated during a game the team won, when the definition declares the
 * policy for these modes. `state.players[i]` is `state.campaign.seats[i]`, the same pairing `seatsFor` uses.
 */
function sittingOutOf(definition: CampaignDefinition, log: CampaignLog, state: GameState): readonly number[] {
  const policy = definition.elimination;
  if (!policy || state.outcome?.result !== "win") return [];
  if (!log.attempt || !matchesModes(log.attempt.modes, policy.whenModes)) return [];
  const seats = state.campaign?.seats ?? [];
  return seats.flatMap((seat, index) => (state.players[index]?.eliminated ? [seat.seatNumber] : []));
}

/**
 * MC16 p. 5: the eliminated seat "can rejoin their teammates for the next scenario, healing their identity to its
 * printed hit point value" — its printed hit points, not whatever its identity was showing when it was eliminated,
 * written under the policy's own instruction id so the runner traces it as one step.
 */
function rejoinRecords(
  definition: CampaignDefinition,
  state: GameState,
  sittingOut: readonly number[],
): readonly { readonly instructionId: string; readonly write: LogWrite }[] {
  const policy = definition.elimination;
  const rejoin = policy?.rejoinAtPrintedHitPoints;
  if (!policy || !rejoin) return [];
  const declared = fieldDefOf(definition, rejoin.field);
  if (declared.scope !== "perSeat" || declared.type.kind !== "number") {
    throw new EngineInvariantError(
      `campaign ${definition.campaignId}'s elimination policy writes "${rejoin.field}", which is not a per-seat number field`,
    );
  }
  const seats = state.campaign?.seats ?? [];
  return seats.flatMap((seat, index) => {
    if (!sittingOut.includes(seat.seatNumber)) return [];
    const identity = state.players[index]?.identity;
    const card = identity ? getCard(state, identity.cardId) : undefined;
    if (!card || card.type !== "hero_identity") {
      throw new EngineInvariantError(`seat ${seat.seatNumber} has no identity card to read printed hit points from`);
    }
    return [
      {
        instructionId: policy.id,
        write: {
          field: rejoin.field,
          seatNumber: seat.seatNumber,
          mode: "set",
          value: { kind: "number", value: card.hp },
        },
      },
    ];
  });
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

  const sittingOut = sittingOutOf(definition, log, state);
  const records: { readonly instructionId: string; readonly write: LogWrite }[] = [];
  for (const instruction of recordInstructions(definition, node, outcome === "won")) {
    if (instruction.step.kind !== "record") continue;
    if (!matchesModes(attempt.modes, instruction.whenModes)) continue;
    for (const spec of instruction.step.writes) {
      const declared = fieldDefOf(definition, spec.field);
      for (const [seatNumber, playerId] of seatsFor(state, spec, sittingOut)) {
        const value = evaluateQuery(state, events, spec.value, playerId, deps);
        records.push({
          instructionId: instruction.id,
          write: {
            field: spec.field,
            seatNumber,
            mode: spec.mode,
            value: logValueOf(state, declared, spec.mode, value),
            ...(spec.distinct ? { distinct: true as const } : {}),
          },
        });
      }
    }
  }
  records.push(...rejoinRecords(definition, state, sittingOut));

  return {
    nodeId: attempt.nodeId,
    outcome,
    records,
    removedFromCampaign: state.campaignWrites?.removedFromCampaign ?? [],
    logWrites: state.campaignWrites?.logWrites ?? [],
    expiringGrants: log.seats.flatMap((seat) =>
      seat.grants.flatMap((grant) => (grant.permanence === "thisGame" ? [grant.cardId] : [])),
    ),
    ...(sittingOut.length > 0 ? { sittingOut } : {}),
  };
}
