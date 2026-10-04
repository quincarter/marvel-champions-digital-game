/**
 * The Briefing's "Your call" when a campaign setup asks the players to pick modular encounter sets (MojoMania's genre
 * sets, insert pp. 7, 13, 17): a question, a one-line explanation, a "what is a genre set" line and one labeled tile per
 * set with its card count and type, each marked chosen, open or checked off. Pure over the engine's pending choice and
 * the log: what is legal (the options the runner offers) is read, never recomputed here, and a checked-off set is shown
 * as unavailable only because the runner did not offer it.
 *
 * Detected by shape, never by `campaignId`: every option of the pending choice is an encounter set the app knows.
 */
import type { Campaign, Scenario } from "@mc/content";
import { setAsideModularSetCountFor } from "@mc/content";
import type { CampaignChoiceAnswer, CampaignPendingChoice } from "@mc/engine";
import { isRoleChoice } from "./campaign-role-call-model.js";

/** True when `pending` is a pick of exactly one encounter set (every option is a known set id). */
export function isModularSetChoice(pending: CampaignPendingChoice, knownSetIds: ReadonlySet<string>): boolean {
  return (
    !pending.random &&
    pending.count === 1 &&
    !pending.optional &&
    pending.options.length > 0 &&
    pending.options.every((option) => knownSetIds.has(option))
  );
}

/**
 * Whether the Briefing draws `pending` as the modular-set call: a pick of one encounter set, and not a pick of one
 * of the box's roles. MC32's roles (Brawler, Commander, ...) share their names with encounter sets in the pool, so
 * the box's own `roles` decide which of the two a pick of those ids is.
 */
export function isModularSetCall(
  pending: CampaignPendingChoice,
  knownSetIds: ReadonlySet<string>,
  roles: Campaign["roles"],
): boolean {
  return isModularSetChoice(pending, knownSetIds) && !isRoleChoice(pending, roles);
}

/**
 * The encounter-set ids a pick can be a genre-set pick of: every known set but the box's own role ids, which
 * MC32 shares with encounter sets ("Brawler"). Used by the picks row, which reads the step trace and so has no
 * pending choice to ask `isRoleChoice` of.
 */
export function modularSetIdsWithout(knownSetIds: ReadonlySet<string>, roles: Campaign["roles"]): ReadonlySet<string> {
  if (!roles || roles.length === 0) return knownSetIds;
  const roleIds = new Set(roles.map((role) => role.id as string));
  return new Set([...knownSetIds].filter((id) => !roleIds.has(id)));
}

export type ModularSetTileStatus = "open" | "chosen" | "checkedOff" | "reusable";

export interface ModularSetTile {
  readonly id: string;
  readonly name: string;
  /** "6 cards · side schemes", or "6 cards" when the set has no dominant type worth naming. */
  readonly detail: string;
  readonly status: ModularSetTileStatus;
  /** The status in words, so state is never color alone. Empty for an open set. */
  readonly statusLabel: string;
  /** Only an offered set can be picked. */
  readonly available: boolean;
}

export interface ModularSetCallView {
  readonly question: string;
  readonly explain: string;
  readonly whatIs: string;
  /** The checked-off rule, or null when it has nothing to say. */
  readonly rule: string | null;
  readonly pickNumber: number;
  /** How many sets this scenario picks in all, or null when the scenario is not known. */
  readonly pickTotal: number | null;
  readonly tiles: readonly ModularSetTile[];
}

export interface ModularSetCallInput {
  readonly pending: CampaignPendingChoice;
  /** Every answer already given while composing this issue, in order. */
  readonly answers: readonly CampaignChoiceAnswer[];
  /** Every set the tiles show, in the log's printed order. */
  readonly universe: readonly string[];
  /** Sets checked off in the campaign log. */
  readonly checkedOff: readonly string[];
  readonly scenario: Scenario | undefined;
  readonly seatCount: number;
  readonly setNameOf: (id: string) => string;
  readonly cardCountOf: (id: string) => number;
  readonly descriptorOf: (id: string) => string | null;
}

/** How many sets this scenario's setup picks at this table size: shuffled in, or set aside. */
export function modularPickTotalOf(scenario: Scenario | undefined, seatCount: number): number | null {
  if (!scenario) return null;
  const shuffledIn = scenario.modularSetCount ?? 1;
  const total = shuffledIn > 0 ? shuffledIn : setAsideModularSetCountFor(scenario, Math.max(1, seatCount));
  return total > 0 ? total : null;
}

/** Sets this issue's earlier picks already took, in the order the table chose them. */
function chosenEarlierOf(pending: CampaignPendingChoice, answers: readonly CampaignChoiceAnswer[]): readonly string[] {
  return answers
    .filter((answer) => answer.instructionId === pending.instructionId && answer.picked.length === 1)
    .map((answer) => answer.picked[0]!);
}

export function modularSetCallOf(input: ModularSetCallInput): ModularSetCallView {
  const { pending, scenario } = input;
  const chosenEarlier = chosenEarlierOf(pending, input.answers);
  const pickNumber = chosenEarlier.length + 1;
  const pickTotal = modularPickTotalOf(scenario, input.seatCount);
  const offered = new Set(pending.options);
  const checked = new Set(input.checkedOff);
  const universe = [...new Set([...input.universe, ...pending.options])];

  const tiles = universe.map((id): ModularSetTile => {
    const count = input.cardCountOf(id);
    const descriptor = input.descriptorOf(id);
    const detail = [count > 0 ? `${count} cards` : null, descriptor ? descriptor.toLowerCase() : null]
      .filter((part): part is string => part !== null)
      .join(" · ");
    const base = { id, name: input.setNameOf(id), detail };
    const earlier = chosenEarlier.indexOf(id);
    if (earlier >= 0) {
      return { ...base, status: "chosen", statusLabel: `CHOSEN · PICK ${earlier + 1}`, available: false };
    }
    if (checked.has(id)) {
      return offered.has(id)
        ? { ...base, status: "reusable", statusLabel: "CHECKED OFF · REUSABLE", available: true }
        : { ...base, status: "checkedOff", statusLabel: "CHECKED OFF", available: false };
    }
    return { ...base, status: "open", statusLabel: "", available: offered.has(id) };
  });

  const setAside = !!scenario && (scenario.modularSetCount ?? 1) === 0;
  const reusing = tiles.some((tile) => tile.status === "reusable");
  const anyChecked = tiles.some((tile) => tile.status === "checkedOff" || tile.status === "reusable");
  const rule = reusing
    ? "Every set that was not checked off is already chosen, so a checked-off set may be reused."
    : anyChecked
      ? "A set used in an earlier issue is checked off in the campaign log and can't be chosen again."
      : pickNumber === 1
        ? "Nothing is checked off yet, so any of these sets may be chosen."
        : null;

  return {
    question:
      pickTotal !== null && pickTotal > 1
        ? `Choose genre set ${pickNumber} of ${pickTotal}.`
        : "Choose this issue's genre set.",
    explain: setAside
      ? "The sets you choose are set aside until setup brings them in, first pick first."
      : "Each set you choose is shuffled into the encounter deck for this issue.",
    whatIs: "A genre set is a themed pack of extra encounter cards that changes what this issue throws at you.",
    rule,
    pickNumber,
    pickTotal,
    tiles,
  };
}

/** The log field a `choose` offers its options from (`fieldOptions`, possibly under `excludingTitles`), or null. */
function optionFieldOf(source: unknown): string | null {
  if (source === null || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  if (record.kind === "fieldOptions" && typeof record.field === "string") return record.field;
  return optionFieldOf(record.from);
}

/** Walks an op tree for the `choose` of `slot` and returns the log field it picks from. */
function chooseFieldOf(ops: unknown, slot: string): string | null {
  if (Array.isArray(ops)) {
    for (const op of ops) {
      const found = chooseFieldOf(op, slot);
      if (found) return found;
    }
    return null;
  }
  if (ops === null || typeof ops !== "object") return null;
  const record = ops as Record<string, unknown>;
  if (record.kind === "choose" && record.slot === slot) return optionFieldOf(record.from);
  for (const value of Object.values(record)) {
    const found = chooseFieldOf(value, slot);
    if (found) return found;
  }
  return null;
}

interface InstructionLike {
  readonly id: string;
  readonly step: unknown;
}

/**
 * The log field `pending` picks its set from, read off the instruction that asks it: the list of every set (its
 * options, in printed order) and the sets checked off in the log under that same field (its struck entries). Null
 * when the choice does not pick from a log field's options at all (a role, a card), which is how a pick of
 * something that merely shares an id with an encounter set is never taken for a modular-set call.
 */
export function modularCallSourceOf(
  pending: CampaignPendingChoice,
  instructions: readonly InstructionLike[],
  logFields: readonly {
    readonly id: string;
    readonly type: { readonly kind: string; readonly options?: readonly string[] };
  }[],
  shared: Readonly<Record<string, { readonly kind: string; readonly struck?: readonly string[] } | undefined>>,
): { readonly universe: readonly string[]; readonly checkedOff: readonly string[] } | null {
  const instruction = instructions.find((candidate) => candidate.id === pending.instructionId);
  const fieldId = instruction ? chooseFieldOf((instruction.step as { ops?: unknown }).ops, pending.slot) : null;
  const field = logFields.find((candidate) => candidate.id === fieldId);
  if (!fieldId || field?.type.kind !== "strikeList") return null;
  const value = shared[fieldId];
  return {
    universe: field.type.options ?? pending.options,
    checkedOff: value?.kind === "strikeList" ? (value.struck ?? []) : [],
  };
}

/** Which panel of the Briefing a waiting note is for. */
export type WaitingPanel = "handled" | "decks";

/**
 * What a not-yet-filled Briefing panel says while it waits, in plain words: what is being waited on and what shows
 * here afterwards. `asking` names the pending call ("genre-set pick"), or null for a call that has no short name.
 */
export function waitingNoteOf(panel: WaitingPanel, state: "asking" | "composing", asking: string | null): string {
  if (state === "composing") return "Setting up this issue…";
  const what = asking ?? "call";
  return panel === "handled"
    ? `Waiting on your ${what} below. What setup does for you shows here once you answer.`
    : `Waiting on your ${what} below. Each hero's deck shows here once you answer.`;
}

/** The part of a step trace the picks row reads. */
interface PickedStep {
  readonly choices: readonly { readonly picked: readonly string[] }[];
}

/**
 * "Genre sets you chose: Crime, Western": the Briefing's own record of the modular-set calls the players just made,
 * put first in "Handled for you" so the answer does not disappear once the call is gone. Null when no call picked a
 * set. `describe` gives each set's name and one-line detail ("6 cards · minions").
 */
export function modularPicksRowOf(
  steps: readonly PickedStep[],
  knownSetIds: ReadonlySet<string>,
  describe: (id: string) => { readonly name: string; readonly detail: string },
): { readonly key: string; readonly status: "done"; readonly title: string; readonly detail: string } | null {
  const picked = steps
    .flatMap((step) => step.choices)
    .filter((choice) => choice.picked.length === 1 && knownSetIds.has(choice.picked[0]!))
    .map((choice) => choice.picked[0]!);
  if (picked.length === 0) return null;
  const described = picked.map(describe);
  return {
    key: "modular-picks",
    status: "done",
    title: `${picked.length === 1 ? "Genre set" : "Genre sets"} you chose: ${described.map((set) => set.name).join(", ")}`,
    detail: described.map((set) => (set.detail ? `${set.name}: ${set.detail}` : set.name)).join(". ") + ".",
  };
}
