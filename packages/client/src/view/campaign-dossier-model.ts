/**
 * The Dossier (C10/C10b/C10c, `scenes/campaign/dossier.ts`): the printed campaign log read back as a screen, in
 * `campaign-log-model.ts`'s own words plus a per-tab shape for each of Overview / Log / Heroes.
 *
 * Every field this module shows is either read straight off `CampaignLog`/`CampaignDefinition`/card data, or
 * derived by *scanning the definition* for the node whose own instructions write it — never invented copy. Where
 * the design's example values ("2 prototypes", "improves in #4") depend on data this build cannot compute
 * honestly for every box (a stat modifier from a printed effect, a "one use" tag with no modeled signal), the row
 * is simply omitted rather than guessed.
 */
import type { AnyCard, CardId } from "@mc/content";
import type {
  CampaignDefinition,
  CampaignGrant,
  CampaignLog,
  CampaignNode,
  CampaignOp,
  CampaignStep,
  LogValue,
} from "@mc/engine";
import { issueNumberOf, issueStoryFor, type CampaignStory } from "../campaign/story.js";
import { campaignLogSheet, renderLogValue, type CardNameOf } from "./campaign-log-model.js";
import type { RunIssueRow } from "./campaign-run-model.js";
import { campaignRunModel, FIELD_SHORT_LABEL } from "./campaign-run-model.js";

/** A field's short word if one is known, else the printed sheet label, lowercased so it reads mid-sentence. */
function fieldLabelOf(definition: CampaignDefinition): (fieldId: string) => string {
  const byId = new Map(definition.logFields.map((field) => [field.id, field.label]));
  return (fieldId) => FIELD_SHORT_LABEL[fieldId] ?? byId.get(fieldId)?.toLowerCase() ?? fieldId;
}

// ---------------------------------------------------------------------------------------------------------------
// Shared: which node's instructions write a given log field, scanned from the definition itself.
// ---------------------------------------------------------------------------------------------------------------

function opWritesField(op: CampaignOp, fieldId: string): boolean {
  switch (op.kind) {
    case "setField":
    case "addToField":
    case "appendToList":
    case "strike":
    case "clearField":
      return op.field === fieldId;
    case "forEachSeat":
      return op.ops.some((inner) => opWritesField(inner, fieldId));
    case "if":
      return (
        op.then.some((inner) => opWritesField(inner, fieldId)) ||
        (op.else?.some((inner) => opWritesField(inner, fieldId)) ?? false)
      );
    default:
      return false;
  }
}

function stepWritesField(step: CampaignStep, fieldId: string): boolean {
  if (step.kind === "record") return step.writes.some((write) => write.field === fieldId);
  if (step.kind === "betweenGames") return step.ops.some((op) => opWritesField(op, fieldId));
  return false;
}

/** The first node (in printed order) whose setup/victory/defeat instructions write `fieldId`, or null. */
function nodeWritingField(definition: CampaignDefinition, fieldId: string): CampaignNode | null {
  for (const node of definition.graph.nodes) {
    const instructions = [...node.setup, ...node.victory, ...(node.defeat ?? [])];
    if (instructions.some((instruction) => stepWritesField(instruction.step, fieldId))) return node;
  }
  return null;
}

/** Whether `op` (recursively) calls `setGrantFace` on the card currently held by log field `fieldId`. */
function opFlipsFieldFace(op: CampaignOp, fieldId: string): boolean {
  if (op.kind === "setGrantFace") return op.card.kind === "field" && op.card.field === fieldId;
  if (op.kind === "forEachSeat") return op.ops.some((inner) => opFlipsFieldFace(inner, fieldId));
  if (op.kind === "if") {
    return (
      op.then.some((inner) => opFlipsFieldFace(inner, fieldId)) ||
      (op.else?.some((inner) => opFlipsFieldFace(inner, fieldId)) ?? false)
    );
  }
  return false;
}

/**
 * The first node whose instructions flip the card recorded in log field `fieldId` to a new face with
 * `setGrantFace` (MC10 p. 12's Improved side). `fieldId` is the `cardRef` field this grant is tracked under
 * (e.g. `basicUpgrade`), not the card itself — `setGrantFace`'s target is a field reference, never a literal card.
 */
function nodeImprovingField(definition: CampaignDefinition, fieldId: string): CampaignNode | null {
  for (const node of definition.graph.nodes) {
    for (const instruction of [...node.setup, ...node.victory, ...(node.defeat ?? [])]) {
      const step = instruction.step;
      if (step.kind === "betweenGames" && step.ops.some((op) => opFlipsFieldFace(op, fieldId))) return node;
    }
  }
  return null;
}

function nodeIndexLabel(definition: CampaignDefinition, node: CampaignNode | null): string | null {
  if (!node) return null;
  const nodeIds = definition.graph.nodes.map((n) => n.id);
  return `#${issueNumberOf(nodeIds, node.id)}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------------------------------------------

export interface DossierOverviewRow {
  readonly label: string;
  readonly value: string;
  /** "earned in #3" when the field is still unset and a later node's own instructions write it. Null otherwise. */
  readonly note: string | null;
  readonly empty: boolean;
}

export interface DossierOverviewSeat {
  readonly seatNumber: number;
  readonly identityCardId: string;
  readonly heroName: string;
  readonly locked: true;
  readonly rows: readonly DossierOverviewRow[];
}

export interface DossierWorldRow {
  readonly id: string;
  readonly bigValue: string;
  readonly label: string;
  readonly when: string;
}

export interface DossierOverview {
  readonly seats: readonly DossierOverviewSeat[];
  readonly world: readonly DossierWorldRow[];
}

/** The printed sheet's own per-seat columns this screen surfaces, matching MC10 p. 20's log sheet layout. */
const OVERVIEW_SEAT_FIELD_IDS: readonly string[] = ["techUpgrade", "basicUpgrade", "obligations", "rescuedAllies"];

/**
 * A shared field's presentation on "The World" — short, player-facing words in place of the printed sheet's own
 * column header, and the one sentence that says when the number matters (design tile 12's three lines). `hidden`
 * marks a field the printed log sheet keeps no column for: it exists only so an in-game instruction can read it
 * back within one scenario (`hydraPrison`, `heroForm`, `healedByObligation`, `engagedWithEnemy`), so it has nothing
 * a player needs read out between issues. A field with neither an entry here nor a citation-based fallback is
 * still shown — the sheet's own label and citation, so an unmapped field never disappears silently.
 */
const WORLD_FIELD_PRESENTATION: Readonly<
  Record<string, { readonly label: string; readonly when: string } | { readonly hidden: true }>
> = {
  experimental: { label: "Stolen weapons", when: "Shuffled into every remaining issue." },
  // Not a number: the threat is this count on Standard and this count per player on Expert (MC10 p. 15).
  delayCounters: { label: "Delay counters", when: "Issue #5: added to Red Skull's starting threat." },
  imprisonedAllies: { label: "Lost allies", when: "Decided in #4." },
  hydraPrison: { hidden: true },
  heroForm: { hidden: true },
  healedByObligation: { hidden: true },
  engagedWithEnemy: { hidden: true },
};

export function campaignDossierOverview(
  record: CampaignLog & { readonly name: string },
  definition: CampaignDefinition,
  heroNameOf: (identityCardId: string) => string,
  cardName: CardNameOf = (id) => id as string,
): DossierOverview {
  const sheet = campaignLogSheet(definition, record, cardName);
  // `campaignLogSheet` already drops a field whose `whenModes` doesn't match this log's modes (an Expert Campaign
  // field on a Standard run) — `sheet.*.fields` simply doesn't carry it. This screen must not resurrect it by
  // falling back to `OVERVIEW_SEAT_FIELD_IDS`' own label when the lookup misses: a field this run never tracks is
  // omitted from the row list entirely, not shown as an "earned in #N" placeholder.
  const seats: DossierOverviewSeat[] = sheet.seats.map((seatSheet) => {
    const rows: DossierOverviewRow[] = OVERVIEW_SEAT_FIELD_IDS.filter((id) =>
      seatSheet.fields.some((field) => field.id === id),
    ).map((id) => {
      const row = seatSheet.fields.find((field) => field.id === id)!;
      const empty = row.rendered === "—" || row.rendered === "(none)";
      const earning = empty ? nodeWritingField(definition, id) : null;
      return {
        label: row.label,
        value: row.rendered,
        note: earning ? `earned in ${nodeIndexLabel(definition, earning)}` : null,
        empty,
      };
    });
    return {
      seatNumber: seatSheet.seatNumber,
      identityCardId: seatSheet.identityCardId as string,
      heroName: heroNameOf(seatSheet.identityCardId as string),
      locked: true,
      rows,
    };
  });

  const world: DossierWorldRow[] = sheet.shared
    .filter((field) => field.rendered !== HIDDEN_PLACEHOLDER)
    .filter(
      (field) => WORLD_FIELD_PRESENTATION[field.id] === undefined || !("hidden" in WORLD_FIELD_PRESENTATION[field.id]!),
    )
    .map((field) => {
      const presentation = WORLD_FIELD_PRESENTATION[field.id];
      const raw = record.shared[field.id];
      const bigValue = bigValueOf(raw);
      return {
        id: field.id,
        bigValue,
        label: presentation && "label" in presentation ? presentation.label : field.label,
        when: presentation && "when" in presentation ? presentation.when : `${field.label} (${field.citation}).`,
      };
    });
  return { seats, world };
}

const HIDDEN_PLACEHOLDER = "not yet known";

function bigValueOf(value: LogValue | undefined): string {
  if (!value) return "—";
  switch (value.kind) {
    case "number":
      return String(value.value);
    case "flag":
      return value.value ? "Yes" : "—";
    case "cardList":
      return String(value.cardIds.length);
    case "strikeList":
      return String(value.struck.length);
    default:
      return "—";
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------------------------------------------

export interface DossierLogEntryRow {
  readonly key: string;
  readonly headline: string;
  readonly detail: string;
  readonly citation: string;
}

export interface DossierLogSection {
  readonly nodeId: string;
  readonly headline: string;
  readonly outcomeLabel: string;
  readonly entries: readonly DossierLogEntryRow[];
}

export interface DossierLogNext {
  readonly nodeId: string;
  readonly headline: string;
  readonly promise: string;
}

export interface DossierInForceRow {
  readonly label: string;
  readonly value: string;
  readonly note: string;
}

export interface DossierLog {
  readonly sections: readonly DossierLogSection[];
  readonly next: DossierLogNext | null;
  readonly inForce: readonly DossierInForceRow[];
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function campaignDossierLog(
  record: CampaignLog,
  definition: CampaignDefinition,
  cardName: CardNameOf = (id) => id as string,
): DossierLog {
  const nodeIds = definition.graph.nodes.map((node) => node.id);
  const sections: DossierLogSection[] = [];
  let rewinds = 0;
  for (const node of definition.graph.nodes) {
    const resolved = record.position.resolved[node.id];
    if (!resolved) continue;
    const attempts = record.history.filter((entry) => entry.nodeId === node.id);
    const winning = attempts.find((entry) => entry.outcome === "won");
    const winIndex = winning ? attempts.indexOf(winning) + 1 : attempts.length;
    const story = issueStoryFor(definition.campaignId as string, node.id);
    const entries: DossierLogEntryRow[] = [];
    attempts.forEach((entry, index) => {
      if (entry.outcome === "won") return;
      rewinds += 1;
      entries.push({
        key: `${node.id}:rewind:${index}`,
        headline: `Attempt ${index + 1} lost · rewound`,
        detail: "Log restored to issue start; nothing kept from that game.",
        citation: "MC10 p. 3",
      });
    });
    if (winning) {
      const fieldLabel = fieldLabelOf(definition);
      winning.steps.forEach((step, stepIndex) => {
        if (step.skipped) return;
        step.writes.forEach((write, writeIndex) => {
          // A `cardRef` write is always paired with this same step's `grantCard` — the grant row below already
          // names the card, so the write row would only repeat it. An unset flag is a non-event on the sheet.
          if (write.value.kind === "cardRef") return;
          if (write.value.kind === "flag" && !write.value.value) return;
          if (write.value.kind === "cardList" && write.value.cardIds.length === 0) return;
          const rendered = renderLogValue(write.value, cardName);
          entries.push({
            key: `${node.id}:write:${stepIndex}:${writeIndex}`,
            headline: write.value.kind === "flag" ? fieldLabel(write.field) : `${rendered} ${fieldLabel(write.field)}`,
            detail: step.text,
            citation: step.citation,
          });
        });
        step.grants.forEach((grant, grantIndex) => {
          entries.push({
            key: `${node.id}:grant:${stepIndex}:${grantIndex}`,
            headline: `${cardName(grant.cardId)} added`,
            detail: grant.permanence === "campaign" ? "Permanent condition." : "For this game only.",
            citation: step.citation,
          });
        });
      });
    }
    sections.push({
      nodeId: node.id,
      headline: `#${issueNumberOf(nodeIds, node.id)} · ${story?.villain ?? node.label}`,
      outcomeLabel: resolved === "completed" ? `WON · ${ordinal(winIndex)} try` : "LOST",
      entries,
    });
  }
  const nextNode = record.position.nextNodeId
    ? definition.graph.nodes.find((node) => node.id === record.position.nextNodeId)
    : undefined;
  const nextStory = nextNode ? issueStoryFor(definition.campaignId as string, nextNode.id) : null;
  const next: DossierLogNext | null = nextNode
    ? {
        nodeId: nextNode.id,
        headline: `#${issueNumberOf(nodeIds, nextNode.id)} · ${nextStory?.villain ?? nextNode.label} · NEXT`,
        promise: nextStory?.blurb ?? nextNode.label,
      }
    : null;

  const experimental = record.shared.experimental;
  const delay = record.shared.delayCounters;
  // "Struck" is `removedFromCampaign` (RRG 1.8 p. 29): the one campaign-wide removal every box shares. A box with
  // its own `strikeList` field (none of MC10's are perSeat/shared strike fields yet) would add to this count too.
  const removedCount = record.removedFromCampaign.length;
  const inForce: DossierInForceRow[] = [
    { label: "Weapons", value: bigValueOf(experimental), note: "in every encounter deck" },
    { label: "Delay", value: bigValueOf(delay), note: "starting threat, next issue" },
    {
      label: "Struck",
      value: String(removedCount),
      note: removedCount > 0 ? "removed from the campaign" : "nothing lost yet",
    },
    { label: "Rewinds", value: String(rewinds), note: "free on Standard" },
  ];
  return { sections, next, inForce };
}

// ---------------------------------------------------------------------------------------------------------------
// Heroes
// ---------------------------------------------------------------------------------------------------------------

export interface DossierHeroIssueBox {
  readonly number: number;
  readonly label: string;
  readonly state: "won" | "lost" | "next" | "sealed";
}

export interface DossierHeroCampaignCard {
  readonly cardId: string;
  readonly typeLabel: string;
  readonly name: string;
  readonly textLine: string;
  readonly improvesIn: string | null;
}

export interface DossierHeroStatRow {
  readonly label: string;
  readonly value: string;
  readonly note: string;
}

export interface DossierHero {
  readonly seatNumber: number;
  readonly identityCardId: string;
  readonly heroName: string;
  readonly alterEgoName: string | null;
  readonly quote: string | null;
  readonly issues: readonly DossierHeroIssueBox[];
  readonly campaignCards: readonly DossierHeroCampaignCard[];
  readonly stats: readonly DossierHeroStatRow[];
}

export function campaignDossierHero(
  record: CampaignLog & { readonly name: string },
  definition: CampaignDefinition,
  seatNumber: number,
  cardOf: (cardId: string) => AnyCard | undefined,
): DossierHero | null {
  const seat = record.seats.find((s) => s.seatNumber === seatNumber);
  if (!seat) return null;
  const identity = cardOf(seat.identityCardId as string);
  const isHero = identity?.type === "hero_identity";
  const hero = isHero ? (identity as { readonly hero: { readonly faceName: string } }) : null;
  const alterEgo = isHero ? (identity as { readonly alterEgo: { readonly faceName: string } }) : null;
  const heroName = hero?.hero.faceName ?? (seat.identityCardId as string);

  const nodeIds = definition.graph.nodes.map((node) => node.id);
  const issues: DossierHeroIssueBox[] = definition.graph.nodes.map((node) => {
    const resolved = record.position.resolved[node.id];
    const isCurrent = node.id === record.position.nextNodeId;
    const state: DossierHeroIssueBox["state"] = isCurrent
      ? "next"
      : resolved === "completed"
        ? "won"
        : resolved === "failed"
          ? "lost"
          : "sealed";
    return {
      number: issueNumberOf(nodeIds, node.id),
      label: state === "won" ? "WON" : state === "lost" ? "LOST" : state === "next" ? "NEXT" : "—",
      state,
    };
  });

  // A field this grant's card is currently recorded under (`cardRef`), so `nodeImprovingField` can find the node
  // whose `setGrantFace` targets that same field — the field is the only thing `setGrantFace` ever names.
  const cardRefFieldIds = definition.logFields
    .filter((field) => field.scope === "perSeat" && field.type.kind === "cardRef")
    .map((field) => field.id);
  const fieldIdOfGrant = (cardId: string): string | null => {
    for (const fieldId of cardRefFieldIds) {
      const value = seat.fields[fieldId];
      if (value?.kind === "cardRef" && value.cardId === cardId) return fieldId;
    }
    return null;
  };

  const campaignCards: DossierHeroCampaignCard[] = seat.grants.map((grant: CampaignGrant) => {
    const card = cardOf(grant.cardId as string);
    const typeLabel = card ? card.type.replace(/_/g, " ") : "card";
    const textLine =
      card && "text" in card ? (card as { readonly text: { readonly current: string } }).text.current : "";
    const grantFieldId = fieldIdOfGrant(grant.cardId as string);
    const improving = grantFieldId ? nodeImprovingField(definition, grantFieldId) : null;
    return {
      cardId: grant.cardId as string,
      typeLabel,
      name: card?.name ?? (grant.cardId as string),
      textLine: firstLineOf(textLine),
      improvesIn: nodeIndexLabel(definition, improving),
    };
  });

  // `seat.deck.cards` already includes the granted lines (design Q5's "campaign's own copy"), so a grant would be
  // double-counted if just summed — split the same way the Briefing's own `deckRowsOf` does (`campaign-briefing-model.ts`).
  const grantedIds = new Set(seat.grants.map((grant) => grant.cardId));
  let deckSize = 0;
  let pinnedCount = 0;
  for (const line of seat.deck.cards) {
    if (grantedIds.has(line.cardId)) pinnedCount += line.quantity;
    else deckSize += line.quantity;
  }
  const stats: DossierHeroStatRow[] = [
    {
      label: "Hit points",
      value: identity && "hp" in identity ? String((identity as { readonly hp: number }).hp) : "—",
      note: "base",
    },
    { label: "Deck", value: `${deckSize} + ${pinnedCount}`, note: "campaign cards don't count" },
    { label: "Aspect", value: seat.deck.aspects.join(" / ") || "—", note: "free to change" },
  ];

  return {
    seatNumber: seat.seatNumber,
    identityCardId: seat.identityCardId as string,
    heroName,
    alterEgoName: alterEgo?.alterEgo.faceName ?? null,
    quote: quoteFor(definition, record, seat.identityCardId as string),
    issues,
    campaignCards,
    stats,
  };
}

function firstLineOf(text: string): string {
  const line = text.split("\n").find((candidate) => candidate.trim().length > 0);
  return line ? line.trim() : "";
}

/**
 * The current (next) issue's opening line, when it's written for this hero specifically — the Hero sheet's speech
 * bubble (design tile 14). A campaign with no current issue (won/lost), a box with no story, or a briefing line
 * written for a different hero (or narrated) all produce no bubble rather than a guessed one.
 */
function quoteFor(definition: CampaignDefinition, record: CampaignLog, identityCardId: string): string | null {
  const nodeId = record.position.nextNodeId;
  if (!nodeId) return null;
  const line = issueStoryFor(definition.campaignId as string, nodeId)?.briefing;
  if (!line || line.speaker.kind !== "hero" || line.speaker.identityId !== identityCardId) return null;
  return line.text;
}

// ---------------------------------------------------------------------------------------------------------------
// Issues (reuses the Run model's rows)
// ---------------------------------------------------------------------------------------------------------------

export function campaignDossierIssues(
  record: CampaignLog & { readonly name: string; readonly box: string },
  definition: CampaignDefinition,
  story: CampaignStory | undefined,
  cardName: CardNameOf = (id) => id as string,
): readonly RunIssueRow[] {
  return campaignRunModel(record, definition, story, cardName).issues;
}

export type { CardId };
