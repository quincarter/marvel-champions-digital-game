/**
 * The per-scenario player-side-scheme choice a box can print (NeXt Evolution, MC40 p. 7) as a Briefing section and a
 * Dossier table: the players choose one row of a strike list, a retry repeats the pick without asking, the row's
 * encounter card joins the deck from then on, and the row's environment is earned by defeating the scheme (one not
 * defeated at a win is removed from the campaign).
 *
 * Generic, found by shape: a node's `betweenGames` step holds a `choose` over a `strikeList` field's unstruck options
 * with `repeatOnRetry`. Each row's cards are read out of the definition's own ops (`setAsideCards` of the scheme, an
 * `appendToList` of the encounter card, the `removeFromCampaign` of scheme and environment), all guarded by
 * `fieldContains(<scenario field>, <row title>)`, so no card id is written here. A campaign with no such choice gets
 * null from every function. Which rows are offered is the log's own strike list; `removedFromCampaign` says which rows
 * are gone. Nothing is computed that the engine decides: the offered options of a live prompt are the engine's.
 */
import type { CardId } from "@mc/content";
import type {
  CampaignAttempt,
  CampaignDefinition,
  CampaignInstruction,
  CampaignLog,
  CampaignNode,
  CampaignOp,
  CampaignPendingChoice,
  CampaignPredicate,
  CampaignValue,
  LogValue,
} from "@mc/engine";
import type { CardNameOf } from "./campaign-log-model.js";

/** A card a row names, by the id the Inspect view opens (a printed face id such as "40190a" or "40190b"). */
export interface SchemeCardRef {
  readonly cardId: CardId;
  readonly name: string;
}

/** One row of the campaign sheet: the scheme's two faces, its encounter card, and what its environment hands out. */
export interface SideSchemeRow {
  /** The row's title and the option id of the choice ("Mission Prep"). */
  readonly name: string;
  /** The player side scheme (its A face). */
  readonly scheme: SchemeCardRef;
  /** The environment on the scheme's back (its B face). Null when the definition names none. */
  readonly environment: SchemeCardRef | null;
  /** The encounter card that joins the encounter deck from the scenario this row is chosen. Null when none. */
  readonly encounterCard: SchemeCardRef | null;
}

/** One thing that carries into this scenario from the log, in a few words, with cards the player may inspect. */
export interface CarryInRow {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly cards: readonly SchemeCardRef[];
}

export interface SideSchemeBriefing {
  readonly nodeId: string;
  /** 1-based position of the node in the graph. */
  readonly scenarioNumber: number;
  readonly instructionId: string;
  /** The printed sentence the choice comes from, for the box's own words. */
  readonly text: string;
  readonly citation: string;
  /** The rows the players may choose from: the unstruck ones, in the sheet's order. Empty on a retry (not asked). */
  readonly offered: readonly SideSchemeRow[];
  /** The pick, once made (this attempt's own, or the repeated one on a retry). Null while the choice is open. */
  readonly chosen: SideSchemeRow | null;
  /** The pick is the last attempt's, repeated without a prompt: shown, not asked. */
  readonly repeated: boolean;
  /** The sets the node requires in its encounter deck (shown as fixed), as set ids. */
  readonly requiredSetIds: readonly string[];
  readonly carryIns: readonly CarryInRow[];
}

// ---------------------------------------------------------------------------------------------------------------
// Reading the definition
// ---------------------------------------------------------------------------------------------------------------

interface CardIds {
  scheme?: CardId;
  encounterCard?: CardId;
  environment?: CardId;
}

interface ChoicePoint {
  readonly node: CampaignNode;
  readonly instruction: CampaignInstruction;
  readonly slot: string;
  /** The `choice` field this node's pick is written to ("sideSchemeScenario3"), when its step writes one. */
  readonly pickField: string | null;
}

interface SideSchemeSpec {
  /** The strike list the unstruck options are read from. */
  readonly strikeField: string;
  readonly options: readonly string[];
  readonly points: readonly ChoicePoint[];
  readonly cards: ReadonlyMap<string, CardIds>;
}

const constantId = (value: CampaignValue): CardId | null =>
  value.kind === "const" && typeof value.value === "string" ? (value.value as CardId) : null;

function eachOp(ops: readonly CampaignOp[], visit: (op: CampaignOp, guard: CampaignPredicate | null) => void): void {
  const walk = (list: readonly CampaignOp[], guard: CampaignPredicate | null): void => {
    for (const op of list) {
      visit(op, guard);
      if (op.kind === "forEachSeat") walk(op.ops, guard);
      if (op.kind === "if") {
        walk(op.then, op.when);
        if (op.else) walk(op.else, null);
      }
    }
  };
  walk(ops, null);
}

/** The row title a guard picks out (`fieldContains(<field>, <title>)`, alone or inside an `and`), or null. */
function guardTitle(guard: CampaignPredicate | null): string | null {
  if (!guard) return null;
  if (guard.kind === "fieldContains") return guard.value;
  if (guard.kind === "and") {
    for (const part of guard.of) {
      const found = guardTitle(part);
      if (found) return found;
    }
  }
  return null;
}

const stepOps = (instruction: CampaignInstruction): readonly CampaignOp[] =>
  instruction.step.kind === "betweenGames" ? instruction.step.ops : [];

const nodeInstructions = (node: CampaignNode): readonly CampaignInstruction[] => [
  ...(node.composition ?? []),
  ...node.setup,
  ...node.victory,
  ...(node.defeat ?? []),
];

/** The side-scheme choice a definition prints, or null. Pure over the definition. */
function sideSchemeSpecOf(definition: CampaignDefinition): SideSchemeSpec | null {
  const points: ChoicePoint[] = [];
  let strikeField: string | null = null;
  for (const node of definition.graph.nodes) {
    for (const instruction of [...(node.composition ?? []), ...node.setup]) {
      const ops = stepOps(instruction);
      eachOp(ops, (op) => {
        if (op.kind !== "choose" || op.from.kind !== "fieldOptions" || !op.from.unstruckOnly || !op.repeatOnRetry)
          return;
        const field = definition.logFields.find((candidate) => candidate.id === (op.from as { field: string }).field);
        if (field?.type.kind !== "strikeList") return;
        strikeField ??= field.id;
        if (field.id !== strikeField) return;
        let pickField: string | null = null;
        eachOp(ops, (inner) => {
          if (inner.kind === "setField" && inner.value.kind === "choice" && inner.value.slot === op.slot) {
            pickField = inner.field;
          }
        });
        points.push({ node, instruction, slot: op.slot, pickField });
      });
    }
  }
  if (!strikeField || points.length === 0) return null;
  const strikeDef = definition.logFields.find((candidate) => candidate.id === strikeField)!;
  const options = strikeDef.type.kind === "strikeList" ? strikeDef.type.options : [];
  const cards = new Map<string, CardIds>(options.map((name) => [name, {}]));
  for (const node of definition.graph.nodes) {
    for (const instruction of nodeInstructions(node)) {
      eachOp(stepOps(instruction), (op, guard) => {
        const title = guardTitle(guard);
        const entry = title ? cards.get(title) : undefined;
        if (!entry) return;
        if (op.kind === "setAsideCards" && entry.scheme === undefined) {
          // The scheme is the first card the row sets aside; what its environment hands out follows it.
          const id = op.cards.length > 0 ? constantId(op.cards[0]!) : null;
          if (id) entry.scheme = id;
        } else if (op.kind === "appendToList" && entry.encounterCard === undefined) {
          const id = constantId(op.value);
          if (id) entry.encounterCard = id;
        } else if (op.kind === "removeFromCampaign" && entry.environment === undefined) {
          const id = op.cards.length > 1 ? constantId(op.cards[1]!) : null;
          if (id) entry.environment = id;
        }
      });
    }
  }
  return { strikeField, options, points, cards };
}

const refOf = (cardId: CardId | undefined, cardName: CardNameOf): SchemeCardRef | null =>
  cardId ? { cardId, name: cardName(cardId) } : null;

function rowsOf(spec: SideSchemeSpec, cardName: CardNameOf): readonly SideSchemeRow[] {
  return spec.options.map((name) => {
    const ids = spec.cards.get(name) ?? {};
    return {
      name,
      scheme: refOf(ids.scheme, cardName) ?? { cardId: "" as CardId, name },
      environment: refOf(ids.environment, cardName),
      encounterCard: refOf(ids.encounterCard, cardName),
    };
  });
}

const struckOf = (shared: Readonly<Record<string, LogValue>>, field: string): readonly string[] => {
  const value = shared[field];
  return value?.kind === "strikeList" ? value.struck : [];
};

const cardIdsOf = (value: LogValue | undefined): readonly CardId[] => (value?.kind === "cardList" ? value.cardIds : []);

// ---------------------------------------------------------------------------------------------------------------
// Briefing
// ---------------------------------------------------------------------------------------------------------------

/** Every log field an effect tree reads, and whether it deals a card facedown (the structural walk the Briefing uses). */
function readsOf(effects: unknown, fields: Set<string> = new Set(), found = { facedownDeal: false }) {
  if (Array.isArray(effects)) {
    for (const item of effects) readsOf(item, fields, found);
  } else if (effects !== null && typeof effects === "object") {
    const record = effects as Record<string, unknown>;
    if (record.kind === "campaignLog" && typeof record.field === "string") fields.add(record.field);
    if (record.kind === "dealAsEncounterCard") found.facedownDeal = true;
    for (const value of Object.values(record)) readsOf(value, fields, found);
  }
  return { fields, ...found };
}

/** Plain words for what a carried-in field does here (a few words each), keyed by field id like the Briefing's other tables. */
const CARRY_IN_WORDS: Readonly<
  Record<string, { readonly title: (n: number, names: string) => string; readonly detail: string }>
> = {
  maraudersDefeated: { title: (_n, names) => `Marauders out: ${names}`, detail: "Removed from the game first." },
  morlocksSaved: { title: (n) => `Morlocks saved: ${n}`, detail: "Each lets a player search their deck." },
  environmentsEarned: { title: (n) => `Environments earned: ${n}`, detail: "Each is put into play." },
  encounterCards: { title: (n) => `Encounter cards added: ${n}`, detail: "All shuffled into the deck." },
  hopeDamage3: { title: (n) => `Hope Summers: ${n} damage`, detail: "Place it on her, or as threat." },
  hopeDamage4: { title: (n) => `Hope Summers: ${n} damage`, detail: "Place it on her, or as threat." },
};

/** An in-game instruction that deals cards facedown, by id: its plain words (title and a few-word detail). */
const FACEDOWN_DEAL_WORDS: Readonly<Record<string, { readonly title: string; readonly detail: string }>> = {
  "mc40.s3.setup.black-tom": { title: "Black Tom deal", detail: "Tom or a Willow, facedown, one each." },
};

function carryInsOf(
  definition: CampaignDefinition,
  spec: SideSchemeSpec,
  node: CampaignNode,
  shared: Readonly<Record<string, LogValue>>,
  cardName: CardNameOf,
): readonly CarryInRow[] {
  const own = new Set<string>([
    spec.strikeField,
    ...spec.points.flatMap((point) => (point.pickField ? [point.pickField] : [])),
  ]);
  const rows: CarryInRow[] = [];
  const seen = new Set<string>();
  const labelOf = (id: string): string => definition.logFields.find((field) => field.id === id)?.label ?? id;
  for (const instruction of [...(node.composition ?? []), ...node.setup]) {
    if (instruction.step.kind !== "inGame") continue;
    const read = readsOf(instruction.step.effects);
    if (read.facedownDeal) {
      const words = FACEDOWN_DEAL_WORDS[instruction.id];
      rows.push({
        key: `deal:${instruction.id}`,
        title: words?.title ?? "Facedown encounter cards",
        detail: words?.detail ?? "One dealt to each player.",
        cards: [],
      });
    }
    for (const field of read.fields) {
      if (own.has(field) || seen.has(field)) continue;
      seen.add(field);
      const value = shared[field];
      const words = CARRY_IN_WORDS[field];
      if (value?.kind === "number") {
        if (value.value === 0) continue;
        rows.push({
          key: `field:${field}`,
          title: words ? words.title(value.value, "") : `${labelOf(field)}: ${value.value}`,
          detail: words?.detail ?? "",
          cards: [],
        });
      } else if (value?.kind === "cardList") {
        if (value.cardIds.length === 0) continue;
        const cards = value.cardIds.map((cardId) => ({ cardId, name: cardName(cardId) }));
        const names = [...new Set(cards.map((card) => card.name))].join(", ");
        rows.push({
          key: `field:${field}`,
          title: words ? words.title(value.cardIds.length, names) : `${labelOf(field)}: ${value.cardIds.length}`,
          detail: words?.detail ?? "",
          cards,
        });
      }
    }
  }
  return rows;
}

export interface SideSchemeBriefingInput {
  readonly definition: CampaignDefinition;
  /** The run: before composing (no `attempt`) or after (the attempt's own steps say what was picked). */
  readonly record: CampaignLog;
  /** The unanswered choice from the runner, when there is one: its options are the engine's own offer. */
  readonly pending?: CampaignPendingChoice | null;
  /** The node to read; defaults to the attempt's, else the next one. */
  readonly nodeId?: string;
  readonly cardName: CardNameOf;
}

/** The scheme choice of the node a briefing is for, with what carries in from the log. Null for a box without one. */
export function sideSchemeBriefingOf(input: SideSchemeBriefingInput): SideSchemeBriefing | null {
  const { definition, record, pending, cardName } = input;
  const spec = sideSchemeSpecOf(definition);
  if (!spec) return null;
  const attempt: CampaignAttempt | undefined = record.attempt;
  const nodeId = input.nodeId ?? attempt?.nodeId ?? record.position.nextNodeId ?? "";
  const point = spec.points.find((candidate) => candidate.node.id === nodeId);
  if (!point) return null;
  const rows = rowsOf(spec, cardName);
  const rowByName = new Map(rows.map((row) => [row.name, row]));
  // What the choice saw: the log before this attempt's own strike (a composed attempt already holds the pick).
  const baseline = attempt && attempt.nodeId === nodeId ? attempt.logBefore.shared : record.shared;
  const struck = new Set(struckOf(baseline, spec.strikeField));
  const unstruck = rows.filter((row) => !struck.has(row.name));
  const choicesMade = attempt?.nodeId === nodeId ? attempt.steps.flatMap((step) => step.choices) : [];
  const made = choicesMade.find((choice) => choice.slot === point.slot);
  const pickedName = made?.picked[0];
  const chosen = pickedName ? (rowByName.get(pickedName) ?? null) : null;
  const repeated = made?.repeated === true;
  const offered = repeated
    ? []
    : pending?.slot === point.slot
      ? pending.options.flatMap((name) => rowByName.get(name) ?? [])
      : unstruck;
  return {
    nodeId,
    scenarioNumber: definition.graph.nodes.findIndex((node) => node.id === nodeId) + 1,
    instructionId: point.instruction.id,
    text: point.instruction.text,
    citation: point.instruction.citation,
    offered,
    chosen,
    repeated,
    requiredSetIds: (point.node.requiredModularSetIds ?? []).map((id) => id as string),
    carryIns: carryInsOf(definition, spec, point.node, record.shared, cardName),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Dossier
// ---------------------------------------------------------------------------------------------------------------

/** "open": still on the sheet to choose. "chosen": picked, not yet settled. "earned": its environment is earned. "removed": struck from the campaign. */
export type SideSchemeRowState = "open" | "chosen" | "earned" | "removed";

export interface SideSchemeTableRow extends SideSchemeRow {
  readonly state: SideSchemeRowState;
  /** The row is struck through on the sheet: its scheme was removed from the campaign. */
  readonly struck: boolean;
  /** The scenario (1-based) this row was chosen for; null while open. */
  readonly scenarioNumber: number | null;
  /** Its encounter card is in the encounter deck (recorded under Encounter Cards). */
  readonly encounterAdded: boolean;
}

export interface SideSchemeTally {
  readonly key: string;
  readonly label: string;
  /** A few words or a figure ("3 of 4", "Bishop, Sabretooth"). */
  readonly value: string;
  readonly cards: readonly SchemeCardRef[];
}

export interface SideSchemeTable {
  readonly label: string;
  readonly citation: string;
  readonly rows: readonly SideSchemeTableRow[];
  readonly tallies: readonly SideSchemeTally[];
}

const TALLIES: readonly { readonly field: string; readonly label: string }[] = [
  { field: "maraudersDefeated", label: "Marauders defeated" },
  { field: "morlocksSaved", label: "Morlocks saved" },
  { field: "environmentsEarned", label: "Environments earned" },
  { field: "encounterCards", label: "Encounter cards added" },
  { field: "hopeDamage3", label: "Hope's damage after #3" },
  { field: "hopeDamage4", label: "Hope's damage after #4" },
];

/** The six-row table and the log's other tallies for the Dossier, or null for a box without the choice. */
export function sideSchemeTableOf(
  record: CampaignLog,
  definition: CampaignDefinition,
  cardName: CardNameOf = (id) => id as string,
): SideSchemeTable | null {
  const spec = sideSchemeSpecOf(definition);
  if (!spec) return null;
  const rows = rowsOf(spec, cardName);
  const struck = new Set(struckOf(record.shared, spec.strikeField));
  const removed = new Set(record.removedFromCampaign.map((face) => face.cardId as string));
  const earned = new Set(cardIdsOf(record.shared["environmentsEarned"]).map((id) => id as string));
  const added = new Set(cardIdsOf(record.shared["encounterCards"]).map((id) => id as string));
  const scenarioOf = (name: string): number | null => {
    for (const point of spec.points) {
      const value = point.pickField ? record.shared[point.pickField] : undefined;
      if (value?.kind === "choice" && value.option === name) {
        return definition.graph.nodes.findIndex((node) => node.id === point.node.id) + 1;
      }
    }
    return null;
  };
  const tableRows = rows.map((row): SideSchemeTableRow => {
    const isRemoved = removed.has(row.scheme.cardId as string);
    const isEarned = row.environment !== null && earned.has(row.environment.cardId as string);
    const state: SideSchemeRowState = isRemoved
      ? "removed"
      : isEarned
        ? "earned"
        : struck.has(row.name)
          ? "chosen"
          : "open";
    return {
      ...row,
      state,
      struck: isRemoved,
      scenarioNumber: scenarioOf(row.name),
      encounterAdded: row.encounterCard !== null && added.has(row.encounterCard.cardId as string),
    };
  });
  const tallies: SideSchemeTally[] = [];
  for (const { field, label } of TALLIES) {
    const def = definition.logFields.find((candidate) => candidate.id === field);
    if (!def) continue;
    const value = record.shared[field];
    if (value?.kind === "number") {
      const max = def.type.kind === "number" ? def.type.max : undefined;
      tallies.push({
        key: field,
        label,
        value: max === undefined ? String(value.value) : `${value.value} of ${max}`,
        cards: [],
      });
    } else if (value?.kind === "cardList" || value === undefined) {
      const ids = cardIdsOf(value);
      const cards = ids.map((cardId) => ({ cardId, name: cardName(cardId) }));
      tallies.push({
        key: field,
        label,
        value:
          field === "maraudersDefeated"
            ? ids.length === 0
              ? "—"
              : [...new Set(cards.map((card) => card.name))].join(", ")
            : field === "environmentsEarned"
              ? `${ids.length} of ${rows.length}`
              : String(ids.length),
        cards,
      });
    }
  }
  const strikeDef = definition.logFields.find((candidate) => candidate.id === spec.strikeField)!;
  return { label: strikeDef.label, citation: strikeDef.citation, rows: tableRows, tallies };
}

/** The rows of a definition's side-scheme choice, for a caller labeling a pending prompt's options. Empty for another box. */
export function sideSchemeRowsOf(definition: CampaignDefinition, cardName: CardNameOf): readonly SideSchemeRow[] {
  const spec = sideSchemeSpecOf(definition);
  return spec ? rowsOf(spec, cardName) : [];
}
