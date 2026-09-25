/**
 * The campaign pool (MC21 p. 7/13/17/21/25's "campaign pool", `docs/campaign-client-per-box.md` §3 row 39/41): a
 * shared set of `flag` log fields a box uses to carry named cards forward — some help the players (an ally, an
 * upgrade), some hurt them (an enemy, an obligation) — resolved back into the game at a later scenario's setup.
 *
 * Nothing here is keyed by `campaignId` or by a card's name. A pool field is detected purely by shape, the same way
 * `campaign-dossier-model.ts`'s Wallets and Bounty Ladder panels detect *their* shape: MC21's own
 * `packages/cards/src/campaigns/mts.ts` declares every pool field as a `shared`/`flag` field whose printed label is
 * `"<Name> added to campaign pool"` (its own doc comment, "MC21 p. 28"'s log-sheet columns), and every instruction
 * that reads a resolved pool card back into a game is written `"If <Name> is in the campaign pool, <what happens>."`
 * (`poolPutIntoPlay`/`poolPutIntoPlayEngaged`/`poolShuffleIntoEncounterDeck`/`poolDeckGrant`'s own doc comments, plus
 * Loki's one inline setup instruction that repeats the same phrase by hand). A later box that reuses this same
 * "added to campaign pool" / "is in the campaign pool" phrasing convention gets this module for free; one that
 * doesn't simply has no pool fields detected, and the Dossier/Briefing render as they do today (`campaignId`-free).
 *
 * Whether a pool card *helps* or *hurts* is read off the card's own printed type via `cardTypeOf` (the same
 * dependency-injected card lookup `campaign-dossier-model.ts`'s `cardName`/`heroNameOf` already take): an encounter
 * card type (`minion`/`treachery`/`side_scheme`/`obligation`/`environment`/`main_scheme`/`villain`) hurts; anything
 * else (`ally`/`upgrade`/`resource`/`event`/`support`/…) helps. `cardTypeOf` resolves by the card's *name* (the pool
 * field's label names a card, never an id — modeling choice `mts.ts` itself makes, since a synthetic pool set has no
 * id of its own until it is composed into a game), so a caller with no card lookup handy still gets `helps: true`
 * (the safer of the two — an unclassified card is shown as a green row rather than a red one).
 */
import type { CampaignDefinition, CampaignInstruction, CampaignLog, CampaignNode } from "@mc/engine";

/** Encounter-side card types (`@mc/content`'s `AnyCard["type"]` union) — anything else is a player-side card. */
const ENCOUNTER_CARD_TYPES: ReadonlySet<string> = new Set([
  "minion",
  "treachery",
  "side_scheme",
  "obligation",
  "environment",
  "main_scheme",
  "villain",
  "evidence",
]);

/** A card's type/keywords, as far as this module needs them — `cardTypeOf`'s own return shape. */
export interface PoolCardMeta {
  readonly type: string;
  /** Whether the card prints the Setup keyword (RRG 1.8 p. 8): an upgrade a deck-grant still starts in play. */
  readonly hasSetupKeyword?: boolean;
}

export type CardMetaOf = (name: string) => PoolCardMeta | undefined;

const POOL_FIELD_LABEL = /^(.+?) added to campaign pool$/i;
const DESTINATION_PREFIX = /^if .+? is in the campaign pool,\s*/i;

export interface PoolField {
  readonly fieldId: string;
  readonly name: string;
  readonly citation: string;
}

/** Every shared flag field this definition uses as a campaign-pool slot, in the field's printed (declared) order. */
export function poolFieldsOf(definition: CampaignDefinition): readonly PoolField[] {
  const found: PoolField[] = [];
  for (const field of definition.logFields) {
    if (field.scope !== "shared" || field.type.kind !== "flag") continue;
    const match = POOL_FIELD_LABEL.exec(field.label);
    if (!match) continue;
    found.push({ fieldId: field.id, name: match[1]!, citation: field.citation });
  }
  return found;
}

function helpsOf(name: string, cardTypeOf?: CardMetaOf): boolean {
  const meta = cardTypeOf?.(name);
  if (!meta) return true;
  return !ENCOUNTER_CARD_TYPES.has(meta.type);
}

/** Every setup/composition instruction across the whole graph, in printed (node, then array) order. */
function allInstructionsOf(
  definition: CampaignDefinition,
): readonly { node: CampaignNode; instruction: CampaignInstruction }[] {
  const found: { node: CampaignNode; instruction: CampaignInstruction }[] = [];
  for (const node of definition.graph.nodes) {
    for (const instruction of [...(node.composition ?? []), ...node.setup]) found.push({ node, instruction });
  }
  return found;
}

/**
 * The first instruction (in printed order) that reads `field.name`'s pool flag back into a game — the
 * `"If <name> is in the campaign pool, …"` sentence every reading instruction shares. Composition-only bridge
 * instructions (`composeCarriedForward`'s own parenthetical text) never match this phrasing, so they're skipped
 * automatically rather than needing to be named.
 */
function firstDestinationInstructionOf(
  definition: CampaignDefinition,
  field: PoolField,
): { readonly node: CampaignNode; readonly instruction: CampaignInstruction } | null {
  const prefix = new RegExp(`^if ${escapeRegExp(field.name)} is in the campaign pool,`, "i");
  for (const entry of allInstructionsOf(definition)) {
    if (prefix.test(entry.instruction.text)) return entry;
  }
  return null;
}

/** Every instruction in `node`'s own setup/composition that reads `field`'s pool flag back — see the doc comment above. */
function nodeReadsField(definition: CampaignDefinition, node: CampaignNode, field: PoolField): boolean {
  const prefix = new RegExp(`^if ${escapeRegExp(field.name)} is in the campaign pool,`, "i");
  return [...(node.composition ?? []), ...node.setup].some((instruction) => prefix.test(instruction.text));
}

/** The first instruction (in printed order) whose `record`/`betweenGames` write sets `field.fieldId` true. */
function firstSourceInstructionOf(
  definition: CampaignDefinition,
  field: PoolField,
): { readonly node: CampaignNode; readonly instruction: CampaignInstruction } | null {
  for (const node of definition.graph.nodes) {
    for (const instruction of [...node.victory, ...(node.defeat ?? [])]) {
      if (instructionWritesFlagTrue(instruction, field.fieldId)) return { node, instruction };
    }
  }
  return null;
}

function instructionWritesFlagTrue(instruction: CampaignInstruction, fieldId: string): boolean {
  const step = instruction.step;
  if (step.kind === "betweenGames") return step.ops.some((op) => op.kind === "setField" && op.field === fieldId);
  if (step.kind === "record") {
    return step.writes.some((write) => write.field === fieldId);
  }
  return false;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strips the shared `"If <name> is in the campaign pool, "` lead-in and capitalizes what's left. */
function destinationTextOf(raw: string): string {
  const stripped = raw.replace(DESTINATION_PREFIX, "").trim();
  if (stripped.length === 0) return raw;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

const nodeIssueLabel = (definition: CampaignDefinition, node: CampaignNode): string =>
  `#${definition.graph.nodes.findIndex((candidate) => candidate.id === node.id) + 1}`;

export type PoolDestinationKind = "intoPlay" | "encounterDeck" | "eachPlayersDeck" | "upgrades";

function destinationKindOf(destinationText: string, meta: PoolCardMeta | undefined): PoolDestinationKind {
  if (/encounter deck/i.test(destinationText)) return "encounterDeck";
  if (/into play/i.test(destinationText)) return "intoPlay";
  if (meta?.type === "upgrade") return "upgrades";
  return "eachPlayersDeck";
}

// ---------------------------------------------------------------------------------------------------------------
// The Dossier's own shape (Overview panel + "Still in play for")
// ---------------------------------------------------------------------------------------------------------------

export interface PoolCardRow {
  readonly fieldId: string;
  readonly name: string;
  readonly helps: boolean;
  /** "Put him into play under the first player's control." — the reading instruction's own text, prefix stripped. */
  readonly destination: string;
  /** "#1 · If Secure the Landing Pad was defeated, add Cosmo to the campaign pool." — the real printed sentence. */
  readonly source: string;
}

export interface PoolStillInPlayRow {
  readonly fieldId: string;
  readonly name: string;
  readonly citation: string;
  /** "#3 · If Defensive Protocols is NOT in the victory display, add System Shock to the campaign pool." */
  readonly note: string;
}

export interface PoolEmptySlot {
  readonly fieldId: string;
  readonly name: string;
  /** "#1 · If Secure the Landing Pad was defeated, add Cosmo to the campaign pool." Null if never resolvable at all. */
  readonly note: string | null;
}

export interface CampaignPoolOverview {
  readonly totalSlots: number;
  readonly filledSlots: number;
  readonly helpsCount: number;
  readonly hurtsCount: number;
  /** Resolved cards, helping cards first (in field-declared order), then hurting cards — the design's own grouping. */
  readonly cards: readonly PoolCardRow[];
  /** Not-yet-resolved fields, in field-declared order. */
  readonly stillInPlayFor: readonly PoolStillInPlayRow[];
  /** Every field, in field-declared order — shown only while `filledSlots === 0`. */
  readonly emptySlots: readonly PoolEmptySlot[];
}

/** Null for a definition with no pool-shaped fields at all — the Dossier/Briefing render exactly as they do today. */
export function campaignDossierPool(
  record: Pick<CampaignLog, "shared">,
  definition: CampaignDefinition,
  cardTypeOf?: CardMetaOf,
): CampaignPoolOverview | null {
  const fields = poolFieldsOf(definition);
  if (fields.length === 0) return null;

  const isSet = (fieldId: string): boolean => {
    const value = record.shared[fieldId];
    return value?.kind === "flag" && value.value === true;
  };

  const cards: PoolCardRow[] = [];
  const stillInPlayFor: PoolStillInPlayRow[] = [];
  const emptySlots: PoolEmptySlot[] = [];
  for (const field of fields) {
    const source = firstSourceInstructionOf(definition, field);
    const emptyNote = source ? `${nodeIssueLabel(definition, source.node)} · ${source.instruction.text}` : null;
    emptySlots.push({ fieldId: field.fieldId, name: field.name, note: emptyNote });
    if (isSet(field.fieldId)) {
      const destinationEntry = firstDestinationInstructionOf(definition, field);
      const destination = destinationEntry ? destinationTextOf(destinationEntry.instruction.text) : "";
      cards.push({
        fieldId: field.fieldId,
        name: field.name,
        helps: helpsOf(field.name, cardTypeOf),
        destination,
        source: emptyNote ?? "",
      });
    } else if (source) {
      stillInPlayFor.push({
        fieldId: field.fieldId,
        name: field.name,
        citation: field.citation,
        note: emptyNote ?? source.instruction.text,
      });
    }
  }

  // Helping cards first, hurting cards after — each group keeping the field-declared order within itself, matching
  // the design's own ordering (`23-d-21-c09-dossier-pool.png`: two "ON YOUR SIDE" rows, then two "AGAINST YOU" rows).
  const grouped = [...cards.filter((card) => card.helps), ...cards.filter((card) => !card.helps)];

  return {
    totalSlots: fields.length,
    filledSlots: cards.length,
    helpsCount: cards.filter((card) => card.helps).length,
    hurtsCount: cards.filter((card) => !card.helps).length,
    cards: grouped,
    stillInPlayFor,
    emptySlots,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The Briefing's own shape ("From the pool")
// ---------------------------------------------------------------------------------------------------------------

export interface BriefingPoolRow {
  readonly fieldId: string;
  readonly name: string;
  readonly helps: boolean;
  readonly destination: string;
  readonly destinationKind: PoolDestinationKind;
}

export interface BriefingPoolGroup {
  readonly kind: PoolDestinationKind;
  readonly title: string;
  readonly rows: readonly BriefingPoolRow[];
}

export interface BriefingPoolView {
  readonly rows: readonly BriefingPoolRow[];
  /** Present only when there's more than one destination kind among `rows` — the finale's own grouped layout. */
  readonly groups: readonly BriefingPoolGroup[] | null;
}

const GROUP_TITLES: Readonly<Record<PoolDestinationKind, string>> = {
  intoPlay: "Into play",
  encounterDeck: "Encounter deck",
  eachPlayersDeck: "Each player's deck",
  upgrades: "Upgrades",
};
const GROUP_ORDER: readonly PoolDestinationKind[] = ["intoPlay", "encounterDeck", "eachPlayersDeck", "upgrades"];

/**
 * Not-grouped (an ordinary issue): every pooled card *this node's own* setup/composition actually reads back
 * (`nodeReadsField`) and that is currently resolved true — a field this run never reached, or one true but not read
 * by this issue, produces no row. Null when there's nothing to show (issue #1, before anything has ever entered the
 * pool).
 *
 * `grouped` (the box's finale) instead recaps the *whole* pool regardless of what this last node's own setup reads
 * — the finale's own framing is "everything we carried, all at once" (`26-…-briefing-finale-pool.png`), not "what
 * changes in this specific game" (MC21's own finale composes only Odin; Cosmo/Security Breach/Black Swan were
 * already resolved back in issue #3 and have nothing left to do). Pass `true` for the box's own finale node
 * (`docs/campaign-client-per-box.md` never keys this by `campaignId`; a caller decides "is this the last node" the
 * same way `campaign-run-model.ts`'s own callers do) to get the finale's "one section per destination" layout.
 */
export function campaignBriefingPool(
  record: Pick<CampaignLog, "shared">,
  definition: CampaignDefinition,
  node: CampaignNode,
  cardTypeOf?: CardMetaOf,
  grouped = false,
): BriefingPoolView | null {
  const fields = grouped
    ? poolFieldsOf(definition)
    : poolFieldsOf(definition).filter((field) => nodeReadsField(definition, node, field));
  const isSet = (fieldId: string): boolean => {
    const value = record.shared[fieldId];
    return value?.kind === "flag" && value.value === true;
  };
  const rows: BriefingPoolRow[] = [];
  for (const field of fields) {
    if (!isSet(field.fieldId)) continue;
    const destinationEntry = firstDestinationInstructionOf(definition, field);
    if (!destinationEntry) continue;
    const destination = destinationTextOf(destinationEntry.instruction.text);
    const meta = cardTypeOf?.(field.name);
    rows.push({
      fieldId: field.fieldId,
      name: field.name,
      helps: helpsOf(field.name, cardTypeOf),
      destination,
      destinationKind: destinationKindOf(destination, meta),
    });
  }
  if (rows.length === 0) return null;
  if (!grouped) return { rows, groups: null };

  const groups: BriefingPoolGroup[] = GROUP_ORDER.map((kind) => ({
    kind,
    title: GROUP_TITLES[kind],
    rows: rows.filter((row) => row.destinationKind === kind),
  })).filter((group) => group.rows.length > 0);
  return { rows, groups };
}
