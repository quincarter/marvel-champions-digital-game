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
  EffectSpec,
  LogValue,
  Predicate,
} from "@mc/engine";
import { issueNumberOf, issueStoryFor, type CampaignStory } from "../campaign/story.js";
import {
  campaignDossierPool,
  poolFieldsOf,
  type CardMetaOf,
  type CampaignPoolOverview,
  type PoolCopy,
} from "./campaign-pool-model.js";
import { campaignLogSheet, renderLogValue, type CardNameOf } from "./campaign-log-model.js";
import type { RunIssueRow } from "./campaign-run-model.js";
import {
  campaignRunModel,
  FIELD_SHORT_LABEL,
  PLURALIZED_FIELDS,
  pluralizeFieldWord,
  signedCount,
} from "./campaign-run-model.js";
import { resolvedWritesOf } from "./campaign-log-deltas.js";

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

/**
 * Every node (in printed order) whose setup/victory/defeat instructions write `fieldId` — `nodeWritingField`
 * generalized to every occurrence, not just the first. Used by `campaign-frozen-deck-model.ts` to find every issue
 * a Wallet's card-list field (`walletFieldsOf`'s `cardListField`) is written by, i.e. every issue The Market opens.
 */
export function nodesWritingField(definition: CampaignDefinition, fieldId: string): readonly CampaignNode[] {
  return definition.graph.nodes.filter((node) => {
    const instructions = [...node.setup, ...node.victory, ...(node.defeat ?? [])];
    return instructions.some((instruction) => stepWritesField(instruction.step, fieldId));
  });
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

export interface DossierWalletSeat {
  readonly seatNumber: number;
  readonly heroName: string;
  /** e.g. "1 UNIT" / "0 UNITS" — the field's own short word, pluralized the same way the Run screen does. */
  readonly balanceLabel: string;
  /** Cards this seat has already added from the campaign's shop, in the order the log recorded them. */
  readonly cardNames: readonly string[];
}

export interface DossierOverview {
  readonly seats: readonly DossierOverviewSeat[];
  readonly world: readonly DossierWorldRow[];
  /** Null for a campaign whose definition never spends a perSeat currency field on a card list (MC10). */
  readonly wallets: readonly DossierWalletSeat[] | null;
  readonly bountyLadder: DossierBountyLadder | null;
  /** Null for a campaign with no pool-shaped log fields at all (`campaign-pool-model.ts`'s `poolFieldsOf`). */
  readonly pool: CampaignPoolOverview | null;
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
/**
 * A shared field's presentation, keyed by field id. `inForce` marks a field that also belongs on the Log tab's
 * "In force now" box (`campaignDossierLog`'s `inForce` rows) — `true` reuses this same label/when there, an object
 * overrides both with the shorter wording that box wants instead. A field with no `inForce` at all (MC10's
 * `imprisonedAllies`, a decision made later rather than a live effect) shows on The World but not there.
 */
interface FieldPresentation {
  readonly label: string;
  readonly when: string;
  readonly inForce?: true | { readonly label: string; readonly note: string };
}

const WORLD_FIELD_PRESENTATION: Readonly<Record<string, FieldPresentation | { readonly hidden: true }>> = {
  experimental: {
    label: "Stolen weapons",
    when: "Shuffled into every remaining issue.",
    inForce: { label: "Weapons", note: "in every encounter deck" },
  },
  // Not a number: the threat is this count on Standard and this count per player on Expert (MC10 p. 15).
  delayCounters: {
    label: "Delay counters",
    when: "Issue #5: added to Red Skull's starting threat.",
    inForce: { label: "Delay", note: "starting threat, next issue" },
  },
  imprisonedAllies: { label: "Lost allies", when: "Decided in #4." },
  hydraPrison: { hidden: true },
  heroForm: { hidden: true },
  healedByObligation: { hidden: true },
  engagedWithEnemy: { hidden: true },
  // MC16 p. 4/p. 8/p. 10/p. 12/p. 14/p. 18: the Badoon Headhunter ladder unlocks a harsher rung per mark here.
  headhunterDefeated: {
    label: "Headhunter marks",
    when: "Each mark shuffles the ladder's next card into every remaining issue.",
    inForce: true,
  },
  // MC16 p. 5/p. 10: the Collection is spent (and its cards removed from the game) once the group has few enough left.
  collection: { hidden: true },
  collectionCount: {
    label: "Cards in The Collection",
    when: "Removed from the game once 1 or fewer remain per player.",
    inForce: true,
  },
  powerStoneControl: {
    label: "Power Stone control",
    when: "Whoever holds it when scenario 5 is lost loses the campaign.",
    inForce: true,
  },
  evasionCounters: {
    label: "Evasion counters on Nebula's Ship",
    when: "Fewer counters raise scenario 4's threat.",
    inForce: true,
  },
  galacticArtifacts: { hidden: true },
  kreeSupremacyRevealed: { hidden: true },
  // MC21 p. 7/p. 13/p. 17/p. 21's bridging fields (modeling choice 2, `mts.ts`'s own doc comment): read by an
  // instruction within one scenario, printed nowhere on the log sheet — mirroring `trors.ts`'s own four above. The
  // pool flags themselves (`cosmoInPool`, etc.) never reach here at all: `campaignDossierOverview` drops every
  // field `poolFieldsOf` recognizes before this map is even consulted, so a pool card is never shown twice.
  secureLandingPadInPlay: { hidden: true },
  saveShawarmaPlaceInPlay: { hidden: true },
  blackSwanDefeated: { hidden: true },
  defensiveProtocolsDefeated: { hidden: true },
  findNornStonesInPlay: { hidden: true },
  infinityStones1BCompleted: { hidden: true },
  avengersTowerDamaged: { hidden: true },
};

/**
 * MC10 p. 3 vs MC16 p. 4: both print the same "reset and try again with no penalty" retry rule (`LossPolicy`'s own
 * doc comment), but a rewind isn't a log field the way every other "In force now" row above is, so it has no field
 * id to key its wording off of — this is the one row on that box keyed by `campaignId` instead. A campaign with no
 * entry here falls back to the generic printed rule rather than guessing a box-specific phrasing.
 */
const REWIND_NOTE_BY_CAMPAIGN: Readonly<Record<string, string>> = {
  trors: "free on Standard",
  gmw: "no penalty, any difficulty",
};

export function campaignDossierOverview(
  record: CampaignLog & { readonly name: string },
  definition: CampaignDefinition,
  heroNameOf: (identityCardId: string) => string,
  cardName: CardNameOf = (id) => id as string,
  cardTypeOf?: CardMetaOf,
  poolCopy?: PoolCopy,
  firstPlayerName?: string,
): DossierOverview {
  const sheet = campaignLogSheet(definition, record, cardName);
  const poolFieldIds = new Set(poolFieldsOf(definition).map((field) => field.fieldId));
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
    .filter((field) => !poolFieldIds.has(field.id))
    .filter(
      (field) => WORLD_FIELD_PRESENTATION[field.id] === undefined || !("hidden" in WORLD_FIELD_PRESENTATION[field.id]!),
    )
    .map((field) => {
      const presentation = WORLD_FIELD_PRESENTATION[field.id];
      const raw = record.shared[field.id];
      const bigValue = bigValueOf(raw, heroNameOf, cardName);
      return {
        id: field.id,
        bigValue,
        label: presentation && "label" in presentation ? presentation.label : field.label,
        when: presentation && "when" in presentation ? presentation.when : `${field.label} (${field.citation}).`,
      };
    });
  return {
    seats,
    world,
    wallets: dossierWallets(record, definition, heroNameOf, cardName),
    bountyLadder: campaignDossierBountyLadder(record, definition, cardName),
    pool: campaignDossierPool(record, definition, cardTypeOf, poolCopy, firstPlayerName),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Wallets (MC16 p. 5): a perSeat currency field spent, alongside a matching perSeat card list, on a shopping trip
// — detected from the definition's own `betweenGames` ops (a `spend` on the currency field paired with an
// `appendToList` onto the card list in the same `if`'s `then`, the exact shape `marketShoppingSetup` compiles to),
// never by campaign id. A box with no such pairing (MC10) has no Wallets panel at all.
// ---------------------------------------------------------------------------------------------------------------

export interface WalletFields {
  readonly currencyField: string;
  readonly cardListField: string;
}

function walletOpsIn(ops: readonly CampaignOp[]): WalletFields | null {
  for (const op of ops) {
    if (op.kind === "forEachSeat") {
      const found = walletOpsIn(op.ops);
      if (found) return found;
    } else if (op.kind === "if") {
      const spend = op.then.find((inner) => inner.kind === "spend");
      const append = op.then.find((inner) => inner.kind === "appendToList");
      if (spend?.kind === "spend" && append?.kind === "appendToList") {
        return { currencyField: spend.field, cardListField: append.field };
      }
      const foundThen = walletOpsIn(op.then);
      if (foundThen) return foundThen;
      if (op.else) {
        const foundElse = walletOpsIn(op.else);
        if (foundElse) return foundElse;
      }
    }
  }
  return null;
}

export function walletFieldsOf(definition: CampaignDefinition): WalletFields | null {
  for (const node of definition.graph.nodes) {
    for (const instruction of [...node.setup, ...node.victory, ...(node.defeat ?? [])]) {
      const step = instruction.step;
      if (step.kind !== "betweenGames") continue;
      const found = walletOpsIn(step.ops);
      if (found) return found;
    }
  }
  return null;
}

function dossierWallets(
  record: CampaignLog,
  definition: CampaignDefinition,
  heroNameOf: (identityCardId: string) => string,
  cardName: CardNameOf,
): readonly DossierWalletSeat[] | null {
  const fields = walletFieldsOf(definition);
  if (!fields) return null;
  const shortLabel = FIELD_SHORT_LABEL[fields.currencyField] ?? fields.currencyField;
  const plural = PLURALIZED_FIELDS.has(fields.currencyField);
  return record.seats.map((seat) => {
    const balance = seat.fields[fields.currencyField];
    const amount = balance?.kind === "number" ? balance.value : 0;
    const word = plural && amount !== 1 ? `${shortLabel}s` : shortLabel;
    const cards = seat.fields[fields.cardListField];
    const cardIds = cards?.kind === "cardList" ? cards.cardIds : [];
    return {
      seatNumber: seat.seatNumber,
      heroName: heroNameOf(seat.identityCardId as string),
      balanceLabel: `${amount} ${word.toUpperCase()}`,
      cardNames: cardIds.map((id) => cardName(id)),
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// The Badoon bounty ladder (MC16 p. 4/p. 8/p. 10/p. 12/p. 14/p. 18): rungs read off the definition's own setup
// instructions, never hard-coded — a scenario's `headhunterLadder` (`packages/cards/src/campaigns/gmw.ts`) is an
// `if campaignLog(<field> atLeast N) → moveCards(encounterSetAside({printedId}), …)` pair per rung, so this walks
// the *compiled* `EffectSpec` tree the same way an engine trace would, rather than re-deriving the mapping by name.
// ---------------------------------------------------------------------------------------------------------------

export interface DossierBountyRung {
  readonly tier: number;
  readonly cardId: string;
  readonly name: string;
  readonly unlocked: boolean;
  /** "#2" — the first issue (in printed order) whose setup instructions reveal this rung. */
  readonly firstIssueLabel: string;
}

function conditionTier(condition: Predicate, fieldId: string): number | null {
  if (condition.kind === "campaignLog" && condition.field === fieldId && typeof condition.atLeast === "number") {
    return condition.atLeast;
  }
  return null;
}

function encounterSetAsidePrintedId(selector: unknown): string | null {
  if (!selector || typeof selector !== "object") return null;
  const candidate = selector as { readonly kind?: string; readonly filter?: { readonly printedId?: unknown } };
  if (candidate.kind !== "encounterSetAside") return null;
  const printedId = candidate.filter?.printedId;
  return typeof printedId === "string" ? printedId : null;
}

/** Every card an `ifThen(campaignLogAtLeast(fieldId, tier), moveCards(encounterSetAside({printedId}), …))` reveals. */
function ladderCardsIn(effects: readonly EffectSpec[], fieldId: string): readonly { tier: number; cardId: string }[] {
  const found: { tier: number; cardId: string }[] = [];
  for (const effect of effects) {
    if (effect.kind !== "if") continue;
    const tier = conditionTier(effect.condition, fieldId);
    if (tier === null) continue;
    for (const inner of effect.then) {
      if (inner.kind !== "moveCards") continue;
      const printedId = encounterSetAsidePrintedId(inner.cards);
      if (printedId) found.push({ tier, cardId: printedId });
    }
  }
  return found;
}

/**
 * Every rung this campaign's setup instructions ever reveal for shared number field `fieldId`, tier order,
 * deduplicated by card id (every later scenario's setup repeats the same `ifThen` for rungs it also unlocks).
 * `unlocked` compares each rung's tier against `currentMarks` (the field's live value).
 */
export function bountyLadderRungs(
  definition: CampaignDefinition,
  fieldId: string,
  currentMarks: number,
  cardName: CardNameOf = (id) => id as string,
): readonly DossierBountyRung[] {
  const byCardId = new Map<string, { tier: number; nodeId: string }>();
  for (const node of definition.graph.nodes) {
    for (const instruction of [...node.setup, ...node.victory, ...(node.defeat ?? [])]) {
      const step = instruction.step;
      if (step.kind !== "inGame") continue;
      for (const found of ladderCardsIn(step.effects, fieldId)) {
        if (!byCardId.has(found.cardId)) byCardId.set(found.cardId, { tier: found.tier, nodeId: node.id });
      }
    }
  }
  const nodeIds = definition.graph.nodes.map((node) => node.id);
  return [...byCardId.entries()]
    .sort(([, a], [, b]) => a.tier - b.tier)
    .map(([cardId, { tier, nodeId }]) => ({
      tier,
      cardId,
      name: cardName(cardId as CardId),
      unlocked: currentMarks >= tier,
      firstIssueLabel: `#${issueNumberOf(nodeIds, nodeId)}`,
    }));
}

/**
 * The first shared number field (in printed order) an `ifThen(campaignLogAtLeast(field, N), moveCards(…))` reveals
 * cards for — the same shape `ladderCardsIn` reads, so a campaign with no such field (MC10) never shows a ladder.
 *
 * Exported so `campaign-cover-model.ts`'s Dossier button can name "Bounty ladder" in its subtitle for a box that
 * has one, the same detect-by-shape way this whole module already finds Wallets — never by campaign id.
 */
export function ladderFieldOf(definition: CampaignDefinition): string | null {
  for (const node of definition.graph.nodes) {
    for (const instruction of [...node.setup, ...node.victory, ...(node.defeat ?? [])]) {
      const step = instruction.step;
      if (step.kind !== "inGame") continue;
      for (const effect of step.effects) {
        if (effect.kind !== "if") continue;
        if (effect.condition.kind !== "campaignLog" || typeof effect.condition.atLeast !== "number") continue;
        const revealsCards = effect.then.some(
          (inner) => inner.kind === "moveCards" && encounterSetAsidePrintedId(inner.cards) !== null,
        );
        if (revealsCards) return effect.condition.field;
      }
    }
  }
  return null;
}

/** Per-field flavor for the ladder's own title bar — the printed sheet's section name, in this box's own words. */
const LADDER_FIELD_TITLE: Readonly<Record<string, string>> = {
  headhunterDefeated: "Badoon Bounty",
};

export interface DossierBountyLadder {
  readonly title: string;
  /** "2 HEADHUNTER MARKS" — the field's live count, in the same words the World box already uses for it. */
  readonly marksLabel: string;
  readonly rungs: readonly DossierBountyRung[];
  readonly caption: string;
}

/**
 * The Bounty Ladder panel (design tile 19): null for a definition with no ladder-shaped field at all, or one whose
 * setup never actually reveals a rung (nothing to show yet). Every rung, name and mark count comes straight off
 * `bountyLadderRungs`/`record.shared` — the title bar is the one piece of box-specific flavor, keyed by field id
 * like `WORLD_FIELD_PRESENTATION` above, never by campaign id.
 */
function campaignDossierBountyLadder(
  record: CampaignLog,
  definition: CampaignDefinition,
  cardName: CardNameOf,
): DossierBountyLadder | null {
  const fieldId = ladderFieldOf(definition);
  if (!fieldId) return null;
  const marksValue = record.shared[fieldId];
  const currentMarks = marksValue?.kind === "number" ? marksValue.value : 0;
  const rungs = bountyLadderRungs(definition, fieldId, currentMarks, cardName);
  if (rungs.length === 0) return null;
  const fieldMeta = definition.logFields.find((field) => field.id === fieldId);
  const presentation = WORLD_FIELD_PRESENTATION[fieldId];
  const countLabel = presentation && "label" in presentation ? presentation.label : (fieldMeta?.label ?? fieldId);
  return {
    title: LADDER_FIELD_TITLE[fieldId] ?? (fieldMeta?.label ?? fieldId).toUpperCase(),
    marksLabel: `${currentMarks} ${countLabel.toUpperCase()}`,
    rungs,
    caption: "Each rung stays in every remaining issue once it joins — the ladder only ever climbs.",
  };
}

const HIDDEN_PLACEHOLDER = "not yet known";

/**
 * `heroNameOf` first (Power Stone Control names an identity, and a player-facing screen should say "Rocket", not
 * a card id) — `cardName` is the fallback for a `cardRef` naming something that isn't a seat's identity.
 */
function bigValueOf(
  value: LogValue | undefined,
  heroNameOf?: (identityCardId: string) => string,
  cardName?: CardNameOf,
): string {
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
    case "cardRef":
      return heroNameOf?.(value.cardId as string) ?? cardName?.(value.cardId) ?? (value.cardId as string);
    default:
      return "—";
  }
}

/**
 * The Log tab's "In force now" box, box-driven the same way The World is: every shared field this run tracks
 * (mode-gated and hidden fields already dropped by `campaignLogSheet`) whose `WORLD_FIELD_PRESENTATION` entry
 * marks it `inForce`, in the field's printed order. MC10 shows exactly what it always has (`experimental`,
 * `delayCounters`); GMW shows the fields that feed a later setup (`headhunterDefeated`, `collectionCount`,
 * `powerStoneControl`, `evasionCounters`) — nothing here checks `campaignId`.
 */
function inForceWorldRows(
  record: CampaignLog,
  definition: CampaignDefinition,
  cardName: CardNameOf,
  heroNameOf: (identityCardId: string) => string,
): DossierInForceRow[] {
  const sheet = campaignLogSheet(definition, record, cardName);
  return sheet.shared.flatMap((field) => {
    if (field.rendered === HIDDEN_PLACEHOLDER) return [];
    const presentation = WORLD_FIELD_PRESENTATION[field.id];
    if (!presentation || "hidden" in presentation || !presentation.inForce) return [];
    const wording =
      presentation.inForce === true ? { label: presentation.label, note: presentation.when } : presentation.inForce;
    return [
      { label: wording.label, value: bigValueOf(record.shared[field.id], heroNameOf, cardName), note: wording.note },
    ];
  });
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

/** `seatOfCard.get(cardId)` resolved to a hero name, or null when this card's grant has no known owning seat. */
function heroNameOfSeatOrNull(
  seatOfCard: ReadonlyMap<string, number>,
  cardId: string,
  heroNameOfSeat: (seatNumber: number) => string | null,
): string | null {
  const seatNumber = seatOfCard.get(cardId);
  return seatNumber === undefined ? null : heroNameOfSeat(seatNumber);
}

export function campaignDossierLog(
  record: CampaignLog,
  definition: CampaignDefinition,
  cardName: CardNameOf = (id) => id as string,
  heroNameOf: (identityCardId: string) => string = (id) => id,
): DossierLog {
  // A seat's own printed name, the same way the Issue detail's write list names a per-seat write's hero
  // (`campaign-issue-model.ts`'s `heroNameOfSeatFrom`) — so "+3 units" reads "+3 units → Groot" here too.
  const heroNameOfSeat = (seatNumber: number): string | null => {
    const seat = record.seats.find((candidate) => candidate.seatNumber === seatNumber);
    return seat ? heroNameOf(seat.identityCardId as string) : null;
  };
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
      // A `cardRef` write's seat, keyed by the card it names (`campaign-issue-model.ts`'s `seatOfCard`) — a
      // single-card grant below reads the hero it belongs to off this map instead of showing no name at all.
      const seatOfCard = new Map<string, number>();
      for (const write of winning.steps.flatMap((step) => (step.skipped ? [] : step.writes))) {
        if (write.value.kind === "cardRef" && write.seatNumber !== null) {
          seatOfCard.set(write.value.cardId as string, write.seatNumber);
        }
      }
      // `resolvedWritesOf`: an `add`-mode number write only appears here at its group's *last* (delta-adjusted)
      // occurrence — every other write kind/mode still appears once per write, exactly as printed today.
      for (const group of resolvedWritesOf(winning)) {
        const { field, seatNumber, value, stepIndex, writeIndex, step } = group;
        // A `cardRef` write is always paired with this same step's `grantCard` — the grant row below already
        // names the card, so the write row would only repeat it. An unset flag is a non-event on the sheet.
        if (value.kind === "cardRef") continue;
        if (value.kind === "flag" && !value.value) continue;
        if (value.kind === "cardList" && value.cardIds.length === 0) continue;
        // A number write that stayed at (or fell back to) zero is a non-event, the same as an unset flag above.
        if (value.kind === "number" && value.value === 0) continue;
        const base =
          value.kind === "flag"
            ? fieldLabel(field)
            : value.kind === "number"
              ? `${signedCount(value.value)} ${pluralizeFieldWord(fieldLabel(field), field, value.value)}`
              : value.kind === "cardList"
                ? `+ ${value.cardIds.map((id) => cardName(id)).join(", ")}`
                : `${renderLogValue(value, cardName)} ${fieldLabel(field)}`;
        const hero = seatNumber !== null ? heroNameOfSeat(seatNumber) : null;
        entries.push({
          key: `${node.id}:write:${stepIndex}:${writeIndex}`,
          headline: hero ? `${base} → ${hero}` : base,
          detail: step.text,
          citation: step.citation,
        });
      }
      winning.steps.forEach((step, stepIndex) => {
        if (step.skipped) return;
        // A card this same step's own `cardList` write already named (a Market purchase, `+ A, B, C → Groot`) —
        // the grant row below would only repeat it, the way a `cardRef` write's paired grant is skipped above.
        const namedByListWrite = new Set(
          step.writes.flatMap((write) => (write.value.kind === "cardList" ? write.value.cardIds : [])),
        );
        step.grants.forEach((grant, grantIndex) => {
          if (namedByListWrite.has(grant.cardId)) return;
          const hero = heroNameOfSeatOrNull(seatOfCard, grant.cardId as string, heroNameOfSeat);
          const forRest = grant.permanence === "campaign" ? "for the rest of the campaign" : "for this game only";
          entries.push({
            key: `${node.id}:grant:${stepIndex}:${grantIndex}`,
            headline: `${cardName(grant.cardId)} added`,
            detail: hero ? `Added to ${hero}'s deck · ${forRest}.` : `Added to the deck · ${forRest}.`,
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

  // "Struck" is `removedFromCampaign` (RRG 1.8 p. 29): the one campaign-wide removal every box shares. A box with
  // its own `strikeList` field (none of MC10's are perSeat/shared strike fields yet) would add to this count too.
  const removedCount = record.removedFromCampaign.length;
  const inForce: DossierInForceRow[] = [
    ...inForceWorldRows(record, definition, cardName, heroNameOf),
    {
      label: "Struck",
      value: String(removedCount),
      note: removedCount > 0 ? "removed from the campaign" : "nothing lost yet",
    },
    {
      label: "Rewinds",
      value: String(rewinds),
      note: REWIND_NOTE_BY_CAMPAIGN[definition.campaignId as string] ?? "no penalty",
    },
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

/**
 * The card's own first non-empty line, skipping a leading "Unit Cost N." line (MC16 p. 5's Market price tag,
 * carried on `PlayerCardCommon.unitCost`) — that's campaign data the wallet already shows as a price, not the
 * card's effect, so a Market card's Heroes-tab row reads its ability instead of repeating the tag it was bought at.
 */
function firstLineOf(text: string): string {
  const line = text.split("\n").find((candidate) => {
    const trimmed = candidate.trim();
    return trimmed.length > 0 && !/^unit cost \d+\.$/i.test(trimmed);
  });
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
