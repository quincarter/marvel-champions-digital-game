/**
 * Pack campaigns (docs/custom-content-packs.md §11.10): the record a pack's `campaigns/*.json` holds, and the checks
 * `validatePack` runs on it. A campaign is data only: the engine's plain-JSON `CampaignDefinition` plus a display and
 * content record, so a pack adds a campaign without touching the engine. Browser-safe (no Node imports).
 */
import { CAMPAIGNS, campaignDefinitionProblems, isBaseEncounterSetId, isBaseScenarioId, opsOfKind } from "@mc/cards";
import { isSafePackPath, type PackCampaignOf, type EncounterSet, type Scenario } from "@mc/content";
import type { CampaignDefinition } from "@mc/engine";

/** One entry of a pack's `campaigns/*.json`: the display record, the content record, the definition and the story. */
export type PackCampaign = PackCampaignOf<CampaignDefinition>;

/** What a campaign's references are checked against, and where its problems go. */
export interface CampaignCheckInput {
  readonly packId: string;
  readonly campaigns: readonly unknown[];
  /** Ids of the pack's own scenarios and encounter sets, and the card codes a step may name. */
  readonly packScenarioIds: ReadonlySet<string>;
  readonly packSetIds: ReadonlySet<string>;
  readonly isCardId: (code: string) => boolean;
  readonly required: { readonly scenarios: readonly Scenario[]; readonly encounterSets: readonly EncounterSet[] };
  /** The paths `pack.json` lists, for a campaign's art. */
  readonly listedFiles: ReadonlySet<string>;
  readonly add: (path: string, message: string) => void;
}

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/** Whether a value is plain JSON: no `undefined`, function, NaN, Infinity, class instance, Map or Set anywhere. */
export function isPlainJson(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPlainJson);
  if (isObj(value)) {
    const proto = Object.getPrototypeOf(value) as unknown;
    return (proto === Object.prototype || proto === null) && Object.values(value).every(isPlainJson);
  }
  return false;
}

/** Ops and fields the first version of pack campaigns leaves out (a market, roles, composition), by what to say. */
const LIMITED_OPS: Readonly<Record<string, string>> = {
  spend: "spending a currency (a market or shop) is not available to a pack campaign yet",
  composeVillain: "choosing a villain between games is not available to a pack campaign yet",
  composeEncounterSets: "composing encounter sets between games is not available to a pack campaign yet",
  setAsideCards: "setting cards aside between games is not available to a pack campaign yet",
};

/** Checks a pack's campaigns; every problem goes through `input.add` with the path `campaigns/<id>`. */
export function checkPackCampaigns(input: CampaignCheckInput): void {
  const { add } = input;
  const ids = new Set<string>();
  const requiredScenarioIds = new Set(input.required.scenarios.map((scenario) => scenario.id as string));
  const requiredSetIds = new Set(input.required.encounterSets.map((set) => set.id as string));
  for (const [index, entry] of input.campaigns.entries()) {
    if (!isObj(entry)) {
      add(`campaigns[${index}]`, "must be a campaign object");
      continue;
    }
    const id = typeof entry.id === "string" ? entry.id : "";
    const at = `campaigns/${id || index}`;
    if (input.packId === "" || !id.startsWith(`${input.packId}-`) || id.length === input.packId.length + 1)
      add(at, `campaign id must be "${input.packId}-<name>"`);
    if (Object.hasOwn(CAMPAIGNS, id)) add(at, "campaign id is a base-game campaign id (the base game always wins)");
    if (ids.has(id)) add(at, "campaign id is used by two campaigns");
    ids.add(id);
    for (const field of ["name", "description"] as const) {
      if (!text(entry[field])) add(at, `${field} must be a non-empty string`);
    }
    if (entry.tagline !== undefined && !text(entry.tagline)) add(at, "tagline must be a non-empty string");
    if (!text(entry.version)) add(at, "version must be a non-empty string");

    const definition = entry.definition;
    if (!isObj(definition)) {
      add(at, "definition must be a campaign definition object");
      continue;
    }
    if (!isPlainJson(definition)) add(at, "definition must be plain JSON (no undefined, functions or NaN)");
    if (definition.campaignId !== id) add(at, `definition.campaignId must equal the campaign's id "${id}"`);
    if (definition.version !== entry.version) add(at, "definition.version must equal the campaign's version");

    const problems = campaignDefinitionProblems(definition as unknown as CampaignDefinition, {
      isCardId: input.isCardId,
      isScenarioId: (scenarioId) =>
        input.packScenarioIds.has(scenarioId) || isBaseScenarioId(scenarioId) || requiredScenarioIds.has(scenarioId),
    });
    for (const problem of problems) add(at, problem);
    // The structure below reads the graph; a definition the generic check could not read has nothing to limit.
    if (!isReadable(definition)) continue;
    const readable = definition as unknown as CampaignDefinition;
    try {
      checkLimits(at, readable, add);
      checkRecord(at, entry, readable, input, requiredSetIds);
      checkStory(at, entry, readable, add);
    } catch (error) {
      add(at, `could not be checked: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (entry.art !== undefined) {
      const cover = isObj(entry.art) ? entry.art.cover : undefined;
      if (!isObj(entry.art) || (cover !== undefined && (typeof cover !== "string" || !isSafePackPath(cover))))
        add(at, "art must be { cover?: a pack file path }");
      else if (typeof cover === "string" && !input.listedFiles.has(cover))
        add(at, `art.cover "${cover}" is not a listed file`);
    }
  }
}

/**
 * Whether the definition has the shape the checks below read: a graph of node objects with list setup and victory, and a
 * list of log field objects. The generic check has already said what is wrong with one that does not.
 */
function isReadable(definition: Obj): boolean {
  const graph = definition.graph;
  const listOfObjects = (value: unknown): boolean => Array.isArray(value) && value.every(isObj);
  return (
    isObj(graph) &&
    listOfObjects(graph.nodes) &&
    (graph.nodes as Obj[]).every((node) => Array.isArray(node.setup) && Array.isArray(node.victory)) &&
    listOfObjects(definition.logFields)
  );
}

/** The first version's limits (§11.10), each as a sentence naming what to change. */
function checkLimits(at: string, definition: CampaignDefinition, add: (path: string, message: string) => void): void {
  const graph = definition.graph;
  if (graph.kind !== "linear")
    add(at, `the graph must be "linear" (a "${String(graph.kind)}" graph is not available yet)`);
  for (const node of graph.nodes) {
    const name = `node "${String(node.id)}"`;
    if (node.scenario?.kind !== "fixed") add(at, `${name}: the scenario must be "fixed" (a named scenario record)`);
    if (node.composition !== undefined && node.composition.length > 0)
      add(at, `${name}: composition (choosing a villain or sets between games) is not available yet`);
    if (node.requiredModularSetIds !== undefined && node.requiredModularSetIds.length > 0)
      add(at, `${name}: requiredModularSetIds is not available yet`);
  }
  if (definition.elimination !== undefined)
    add(at, "an elimination policy is not available yet (it is part of an expert campaign)");
  const everything: unknown = [
    definition.everyNodeSetup,
    definition.everyNodeVictory,
    definition.conditionalInstructions,
    definition.loss,
    graph.nodes,
  ];
  for (const [kind, message] of Object.entries(LIMITED_OPS)) {
    if (opsOfKind(everything, kind).length > 0) add(at, message);
  }
  if (opsOfKind(everything, "perSeatSet").length > 0)
    add(at, "a per-seat set (an expert campaign's numbered sets) is not available yet");
  if (JSON.stringify(everything).includes('"unitCostExactly"'))
    add(at, "a Unit Cost filter (a market) is not available yet");
  if (JSON.stringify(everything).includes('"expertCampaign"'))
    add(at, "an instruction gated by expertCampaign is not available yet (no expert campaign rules)");
  if (definition.logFields.some((field) => field.whenModes !== undefined))
    add(at, "a log field gated by modes (whenModes) is not available yet");
}

/** The content record: the scenarios it lists are the nodes' in order, and its campaign sets are real and not base. */
function checkRecord(
  at: string,
  entry: Obj,
  definition: CampaignDefinition,
  input: CampaignCheckInput,
  requiredSetIds: ReadonlySet<string>,
): void {
  const { add } = input;
  const record = entry.record;
  if (!isObj(record)) {
    add(at, "record must be { scenarioIds, campaignSetIds }");
    return;
  }
  const nodeScenarios = definition.graph.nodes.flatMap((node) =>
    node.scenario?.kind === "fixed" ? [String(node.scenario.scenarioId)] : [],
  );
  const listed: unknown = record.scenarioIds;
  if (!Array.isArray(listed) || listed.some((scenarioId) => typeof scenarioId !== "string"))
    add(at, "record.scenarioIds must be a list of scenario ids");
  else if (listed.join("\n") !== nodeScenarios.join("\n"))
    add(at, `record.scenarioIds must list the nodes' scenarios in order: ${nodeScenarios.join(", ")}`);
  const sets: unknown = record.campaignSetIds;
  if (!Array.isArray(sets) || sets.some((setId) => typeof setId !== "string")) {
    add(at, "record.campaignSetIds must be a list of encounter set ids (empty is fine)");
  } else {
    for (const setId of sets as string[]) {
      if (isBaseEncounterSetId(setId)) add(at, `record.campaignSetIds: "${setId}" is a base-game set`);
      else if (!input.packSetIds.has(setId) && !requiredSetIds.has(setId))
        add(at, `record.campaignSetIds: "${setId}" is not an encounter set of this pack or a required pack`);
    }
    const own = new Set(sets as string[]);
    for (const source of opsOfKind(
      [definition.everyNodeSetup, definition.everyNodeVictory, definition.conditionalInstructions, definition.graph],
      "campaignSet",
    )) {
      if (!own.has(String(source.encounterSetId)))
        add(at, `draws from "${String(source.encounterSetId)}", which is not in record.campaignSetIds`);
    }
  }
  if (record.prohibited !== undefined && !isObj(record.prohibited)) add(at, "record.prohibited must be an object");
}

const SPEAKERS = ["narrator", "villain", "npc"];

/** The optional story: node ids that exist, non-empty text, and only the speakers the client knows. */
function checkStory(
  at: string,
  entry: Obj,
  definition: CampaignDefinition,
  add: (path: string, message: string) => void,
): void {
  const story = entry.story;
  if (story === undefined) return;
  if (!isObj(story)) {
    add(at, "story must be an object");
    return;
  }
  if (!text(story.blurb)) add(at, "story.blurb must be a non-empty string");
  if (story.rosterBanner !== undefined && !text(story.rosterBanner)) add(at, "story.rosterBanner must be text");
  const nodeIds = new Set(definition.graph.nodes.map((node) => String(node.id)));
  const line = (where: string, value: unknown): void => {
    if (!isObj(value) || !text(value.text) || !isObj(value.speaker) || !SPEAKERS.includes(String(value.speaker.kind))) {
      add(at, `${where} must be { speaker: narrator | villain | npc, text }`);
    } else if (value.speaker.kind === "npc" && !text(value.speaker.name))
      add(at, `${where}: an npc speaker needs a name`);
  };
  if (story.issues !== undefined) {
    if (!Array.isArray(story.issues)) add(at, "story.issues must be a list");
    const seen = new Set<string>();
    for (const issue of Array.isArray(story.issues) ? (story.issues as unknown[]) : []) {
      if (!isObj(issue)) {
        add(at, "every story issue must be an object");
        continue;
      }
      const nodeId = String(issue.nodeId);
      if (!nodeIds.has(nodeId)) add(at, `story issue names node "${nodeId}", which the campaign does not have`);
      if (seen.has(nodeId)) add(at, `story has two issues for node "${nodeId}"`);
      seen.add(nodeId);
      for (const field of ["title", "villain"] as const) {
        if (!text(issue[field])) add(at, `story issue "${nodeId}": ${field} must be text`);
      }
      for (const field of ["blurb", "rewindTaunt"] as const) {
        if (issue[field] !== undefined && !text(issue[field]))
          add(at, `story issue "${nodeId}": ${field} must be text`);
      }
      for (const field of ["briefing", "aftermath"] as const) {
        if (issue[field] !== undefined) line(`story issue "${nodeId}": ${field}`, issue[field]);
      }
    }
  }
  const finale = story.finale;
  if (finale !== undefined) {
    if (
      !isObj(finale) ||
      !text(finale.caption) ||
      !text(finale.headline) ||
      !text(finale.villainLine) ||
      !Array.isArray(finale.heroLines) ||
      finale.heroLines.length === 0 ||
      finale.heroLines.some((heroLine) => !text(heroLine))
    )
      add(at, "story.finale must be { caption, headline, villainLine, heroLines: [text, ...] }");
  }
}

/** The campaign records of an input's `campaigns` list that are well formed enough to list; `validatePack` says the rest. */
export function packCampaignsOf(campaigns: readonly unknown[] | undefined): readonly PackCampaign[] {
  return (campaigns ?? []).filter(
    (entry): entry is PackCampaign =>
      isObj(entry) && typeof entry.id === "string" && isObj(entry.definition) && isObj(entry.record),
  );
}
