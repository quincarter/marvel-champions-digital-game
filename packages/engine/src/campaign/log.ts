/**
 * The campaign log as the runner mutates it between games (design §5, §11 step 4).
 *
 * Everything here is deliberately boring: a flat working copy of the log, one function that reads a field and one
 * that writes it, and the coercion from "what an instruction computed" to "what the box declared the field holds".
 * The runner never reaches into a `CampaignLog` directly, so there is exactly one place that knows a `hidden` field
 * lives in its own record (design Q4) and exactly one place that knows what `mode: "add"` means.
 *
 * No campaign and no card is named here, and nothing reads a clock or a global: the whole runner is a pure function
 * of `(log, answers)`, which is what makes a campaign replayable from its seed and its recorded answers.
 */

import type { CardId } from "@mc/content";
import type {
  CampaignCardFace,
  CampaignDefinition,
  CampaignLog,
  CampaignLogSnapshot,
  CampaignSeat,
  CampaignStatus,
  LogFieldDef,
  LogValue,
  LogWrite,
} from "../campaign.js";
import { EngineInvariantError } from "../errors.js";
import type { RngState } from "../rng.js";

/**
 * The log while a step list is running. Flat rather than nested (`CampaignPosition` is spread across
 * `nextNodeId`/`resolved`/`progress`) because every op touches one of its parts and nothing benefits from the
 * grouping until the value is written back out.
 */
export interface CampaignWorkingLog {
  shared: Record<string, LogValue>;
  hidden: Record<string, LogValue>;
  seats: CampaignSeat[];
  removedFromCampaign: CampaignCardFace[];
  nextNodeId: string | null;
  resolved: Record<string, "completed" | "failed">;
  progress: Record<string, number>;
  rng: RngState;
  /** `endCampaign` (MC45 p. 20) writes here; the runner stops advancing the graph once it is no longer `"active"`. */
  status: CampaignStatus;
}

const cloneSeat = (seat: CampaignSeat): CampaignSeat => ({
  ...seat,
  deck: { ...seat.deck, cards: seat.deck.cards.map((line) => ({ ...line })) },
  grants: seat.grants.map((grant) => ({ ...grant })),
  fields: { ...seat.fields },
});

/** A working copy of a whole log. The copy is deep enough that nothing the runner does is visible in the input. */
export const workingOf = (log: CampaignLog): CampaignWorkingLog => ({
  shared: { ...log.shared },
  hidden: { ...log.hidden },
  seats: log.seats.map(cloneSeat),
  removedFromCampaign: log.removedFromCampaign.map((face) => ({ ...face })),
  nextNodeId: log.position.nextNodeId,
  resolved: { ...log.position.resolved },
  progress: { ...log.position.progress },
  rng: { ...log.rng },
  status: log.status,
});

/** A working copy of a `retryBaseline` snapshot. The status is the campaign's, which a snapshot never carries. */
export const workingOfSnapshot = (snapshot: CampaignLogSnapshot, status: CampaignStatus): CampaignWorkingLog => ({
  shared: { ...snapshot.shared },
  hidden: { ...snapshot.hidden },
  seats: snapshot.seats.map(cloneSeat),
  removedFromCampaign: snapshot.removedFromCampaign.map((face) => ({ ...face })),
  nextNodeId: snapshot.position.nextNodeId,
  resolved: { ...snapshot.position.resolved },
  progress: { ...snapshot.position.progress },
  rng: { ...snapshot.rng },
  status,
});

/** The snapshot a history entry keeps, and the thing `retryBaseline: "nodeStart"` restores. */
export const snapshotOf = (working: CampaignWorkingLog, definitionVersion: string): CampaignLogSnapshot => ({
  definitionVersion,
  shared: { ...working.shared },
  hidden: { ...working.hidden },
  seats: working.seats.map(cloneSeat),
  removedFromCampaign: working.removedFromCampaign.map((face) => ({ ...face })),
  position: { nextNodeId: working.nextNodeId, resolved: { ...working.resolved }, progress: { ...working.progress } },
  rng: { ...working.rng },
});

/** The box's declaration of a field. A field an instruction names but the box never declared is a definition bug. */
export function fieldDefOf(definition: CampaignDefinition, field: string): LogFieldDef {
  const found = definition.logFields.find((declared) => declared.id === field);
  if (!found) {
    throw new EngineInvariantError(
      `campaign ${definition.campaignId} has an instruction naming log field "${field}", which it does not declare`,
    );
  }
  return found;
}

/**
 * Where a field's value lives.
 *
 * A `hidden` field is kept in its own record and is shared-only, because `CampaignLog.hidden` is one flat map
 * (design §5, Q4): MC50 p. 5's envelope is a table-wide secret, and no rulebook prints a per-seat hidden field.
 * A `hidden` field declared `perSeat` therefore reads and writes as shared, which is flagged rather than guessed.
 */
function recordFor(
  definition: CampaignDefinition,
  working: CampaignWorkingLog,
  field: string,
  seatNumber: number | null,
): Record<string, LogValue> | undefined {
  const declared = fieldDefOf(definition, field);
  if (declared.hidden) return working.hidden;
  if (declared.scope === "shared") return working.shared;
  if (seatNumber === null) return undefined;
  const seat = working.seats.find((candidate) => candidate.seatNumber === seatNumber);
  if (!seat) return undefined;
  const fields = { ...seat.fields };
  working.seats = working.seats.map((candidate) =>
    candidate.seatNumber === seatNumber ? { ...candidate, fields } : candidate,
  );
  return fields;
}

/** One field's value, or undefined when nothing is recorded (which every reader treats as "nothing", never as 0). */
export function readField(
  definition: CampaignDefinition,
  working: CampaignWorkingLog,
  field: string,
  seatNumber: number | null,
): LogValue | undefined {
  const declared = fieldDefOf(definition, field);
  if (declared.hidden) return working.hidden[field];
  if (declared.scope === "shared") return working.shared[field];
  if (seatNumber === null) return undefined;
  return working.seats.find((seat) => seat.seatNumber === seatNumber)?.fields[field];
}

/** RRG-irrelevant but box-relevant: a `number` field's printed bounds (MC27 p. 5's clamp, MC16 p. 5's floor). */
function bounded(declared: LogFieldDef, value: number): number {
  if (declared.type.kind !== "number") return value;
  let out = value;
  if (declared.type.clampAtZero) out = Math.max(0, out);
  if (declared.type.min !== undefined) out = Math.max(declared.type.min, out);
  if (declared.type.max !== undefined) out = Math.min(declared.type.max, out);
  return out;
}

const numberOf = (value: LogValue | undefined): number => {
  if (!value) return 0;
  switch (value.kind) {
    case "number":
      return value.value;
    case "flag":
      return value.value ? 1 : 0;
    case "cardList":
      return value.cardIds.length;
    case "strikeList":
      return value.struck.length;
    case "instructionList":
      return value.ids.length;
    case "cardState":
      return Object.keys(value.cards).length;
    case "cardRef":
      return 1;
    case "choice":
      return value.option === "" ? 0 : 1;
    case "text":
      return 0;
  }
};

/** The option strings a value names, for `mode: "strike"` and for appending to a list of names. */
const optionsOf = (value: LogValue): readonly string[] => {
  switch (value.kind) {
    case "choice":
      return [value.option];
    case "text":
      return [value.value];
    case "cardList":
      return value.cardIds;
    case "cardRef":
      return [value.cardId];
    case "strikeList":
      return value.struck;
    case "instructionList":
      return value.ids;
    case "number":
      return [String(value.value)];
    case "flag":
      return [String(value.value)];
    case "cardState":
      return Object.keys(value.cards);
  }
};

const dedupe = (values: readonly string[]): readonly string[] => [...new Set(values)];

/** `mode: "append"` — only the three list-shaped field kinds have a tail to append to; a number simply adds. */
function appended(declared: LogFieldDef, existing: LogValue | undefined, next: LogValue): LogValue {
  switch (declared.type.kind) {
    case "cardList":
      return {
        kind: "cardList",
        // Duplicates are kept: "Record each copy individually" (ruling June 2, 2026 (3) answer 3).
        cardIds: [
          ...(existing?.kind === "cardList" ? existing.cardIds : []),
          ...(optionsOf(next) as readonly CardId[]),
        ],
      };
    case "instructionList":
      return {
        kind: "instructionList",
        ids: dedupe([...(existing?.kind === "instructionList" ? existing.ids : []), ...optionsOf(next)]),
      };
    case "strikeList":
      return struck(existing, next);
    case "number":
      return { kind: "number", value: bounded(declared, numberOf(existing) + numberOf(next)) };
    case "flag":
    case "cardRef":
    case "choice":
    case "cardState":
    case "text":
      throw new EngineInvariantError(
        `campaign log field "${declared.id}" is a ${declared.type.kind} field and cannot be appended to`,
      );
  }
}

/** MC45 p. 5 / MC40 p. 7: a struck option is gone for good, so striking the same one twice changes nothing. */
const struck = (existing: LogValue | undefined, next: LogValue): LogValue => ({
  kind: "strikeList",
  struck: dedupe([...(existing?.kind === "strikeList" ? existing.struck : []), ...optionsOf(next)]),
});

/**
 * `mode` applied to what is already recorded. Exhaustive on both the mode and the field's declared kind, because a
 * box writing a `cardList` with `mode: "add"` is a definition bug and must say so rather than quietly setting.
 */
function combine(
  declared: LogFieldDef,
  mode: LogWrite["mode"],
  existing: LogValue | undefined,
  next: LogValue,
): LogValue {
  switch (mode) {
    case "set":
      return next.kind === "number" ? { kind: "number", value: bounded(declared, next.value) } : next;
    case "add":
      return { kind: "number", value: bounded(declared, numberOf(existing) + numberOf(next)) };
    case "append":
      return appended(declared, existing, next);
    case "strike":
      if (declared.type.kind !== "strikeList") {
        throw new EngineInvariantError(
          `campaign log field "${declared.id}" is a ${declared.type.kind} field, and only a strikeList can be struck`,
        );
      }
      return struck(existing, next);
  }
}

/**
 * Folds one resolved write into the working log.
 *
 * A write naming a per-seat field with no seat, or a seat the log does not have, is dropped rather than guessed at:
 * a record instruction with `seat: "each"` is expanded by the caller, so a seatless per-seat write can only come
 * from a definition that meant a shared field, and inventing a seat for it would be worse than recording nothing.
 */
export function applyLogWrite(
  definition: CampaignDefinition,
  working: CampaignWorkingLog,
  write: LogWrite,
): LogWrite | null {
  const declared = fieldDefOf(definition, write.field);
  if (declared.type.kind === "cardState") {
    // Flagged, not guessed (design §4.2): MC50 p. 6's Board Members carry counters *and a face* between scenarios,
    // and neither `CampaignGameQuery` nor `CampaignValue` can compose that value. The foundation has the storage
    // shape and no way to fill it, so refusing is the honest behaviour until the write half is designed.
    throw new EngineInvariantError(
      `campaign log field "${declared.id}" is a cardState field, which the between-games vocabulary cannot yet write`,
    );
  }
  const record = recordFor(definition, working, write.field, write.seatNumber);
  if (!record) return null;
  const combined = combine(declared, write.mode, record[write.field], write.value);
  record[write.field] = combined;
  return { ...write, value: combined };
}

/** `clearField`: the field goes back to "nothing recorded", which is absence rather than an empty value. */
export function clearLogField(
  definition: CampaignDefinition,
  working: CampaignWorkingLog,
  field: string,
  seatNumber: number | null,
): void {
  const record = recordFor(definition, working, field, seatNumber);
  if (!record) return;
  delete record[field];
}

/** Two removals name the same thing when they name the same card id and the same face (ruling April 30, 2026 (4)). */
export const sameFace = (a: CampaignCardFace, b: CampaignCardFace): boolean =>
  a.cardId === b.cardId && a.face === b.face;

/** RRG 1.8 p. 29: a removal is a fact, not a counter, so recording one twice records nothing new. */
export function addRemoval(working: CampaignWorkingLog, face: CampaignCardFace): boolean {
  if (working.removedFromCampaign.some((existing) => sameFace(existing, face))) return false;
  working.removedFromCampaign = [...working.removedFromCampaign, face];
  return true;
}
