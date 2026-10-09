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
  CampaignPredicate,
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
import { hiddenEvidenceEnvelope, type HiddenEvidenceEnvelope } from "./campaign-hidden-evidence-model.js";
import { missionTableOf, type MissionTable } from "./campaign-mission-model.js";
import { sideSchemeTableOf, type SideSchemeTable } from "./campaign-side-scheme-model.js";
import type { RunIssueRow } from "./campaign-run-model.js";
import {
  campaignRunModel,
  FIELD_SHORT_LABEL,
  lostAtNodeIdOf,
  PLURALIZED_FIELDS,
  pluralizeFieldWord,
  signedCount,
  fieldIdWords,
} from "./campaign-run-model.js";
import { seatDeckSizeSplit } from "./campaign-deck-edit-model.js";
import { resolvedWritesOf, unlistedFieldIds } from "./campaign-log-deltas.js";
import { idWords } from "./campaign-option-labels.js";
import { plainWriteRows } from "./campaign-write-words.js";
import { heroFaceDisplayName } from "./hero-names.js";

/** A field's short word if one is known, else the printed sheet label, lowercased so it reads mid-sentence. */
function fieldLabelOf(definition: CampaignDefinition): (fieldId: string) => string {
  const byId = new Map(definition.logFields.map((field) => [field.id, field.label]));
  return (fieldId) => FIELD_SHORT_LABEL[fieldId] ?? byId.get(fieldId)?.toLowerCase() ?? fieldIdWords(fieldId);
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

function isChoiceField(definition: CampaignDefinition, fieldId: string): boolean {
  return definition.logFields.find((field) => field.id === fieldId)?.type.kind === "choice";
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
  /** Null for a campaign with no crossed-node track shape at all (every box but MC27 today). */
  readonly reputationTrack: DossierReputationTrack | null;
  /** Null for a campaign with no pool-shaped log fields at all (`campaign-pool-model.ts`'s `poolFieldsOf`). */
  readonly pool: CampaignPoolOverview | null;
  /** The hidden-evidence envelope (docs/campaign-mode-design.md §Q4; MC50 p. 5). Null for a box with no hidden field. */
  readonly hiddenEvidence: HiddenEvidenceEnvelope | null;
  /** The player-side-scheme table and the log's other tallies (MC40 p. 24). Null for a box without the choice. */
  readonly sideSchemes: SideSchemeTable | null;
  /** The four mission rows and five Overseers of the log sheet (MC45 p. 24). Null for a box without missions. */
  readonly missions: MissionTable | null;
}

/** The printed sheet's own per-seat columns this screen surfaces, matching MC10 p. 20's log sheet layout. */
const OVERVIEW_SEAT_FIELD_IDS: readonly string[] = [
  "role",
  "techUpgrade",
  "basicUpgrade",
  "obligations",
  "rescuedAllies",
];

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
  // MC32 p. 24's log sheet. A defeated campaign side scheme earns every hero a random role upgrade next issue
  // (pp. 10/12/16/19, "If ... Defeated is checked in the campaign log").
  frightenedPolice: { label: "Frightened Police", when: "Defeated: role upgrades start #2." },
  enemyOfMyEnemy: { label: "Enemy of My Enemy", when: "Defeated: role upgrades start #3." },
  findThePrisoners: { label: "Find the Prisoners", when: "Defeated: role upgrades start #4." },
  surpriseAttack: { label: "Surprise Attack", when: "Defeated: role upgrades start #5." },
  // Cards in the victory display only wait for the removal that follows (the Log shows each removal).
  futurePastVictoryDisplay: { hidden: true },
  futurePast: { label: "Future Past cards", when: "Recorded; shuffled into later encounter decks." },
  jubilee: { label: "Jubilee", when: "Recorded: starts in play each later issue." },
  captives: { label: "Captives", when: "Recorded: each may be shuffled into a deck later." },
  heldAllies: { label: "Allies struck", when: "Held under Find the Prisoners or Rescue Captives; out for good." },
  // MC27 p. 5/p. 22: the reputation track itself — every scenario's own victory bullet adds to it, and it drives a
  // Setup instruction in every scenario after the one that crosses each node (`sm.ts`'s `REPUTATION_VICTORY`/
  // `CONDITIONAL_INSTRUCTIONS`). This is the box's own headline mechanic, so it gets a real sentence rather than
  // the generic fallback.
  reputation: {
    label: "Reputation",
    when: "Rises after every scenario; each node it crosses adds a reward or a penalty to every scenario after.",
    inForce: { label: "Reputation", note: "nodes crossed so far" },
  },
  // Not printed as its own log column: `sm.reputation.mark`'s own scratch pad, the ids of the conditional Setup
  // instructions a crossed node has queued up (`sm.rep.node5.reward`, etc.). A player reads what those instructions
  // do at the next scenario's own Briefing/Setup, never this raw id list.
  reputationSetups: { hidden: true },
  // MojoMania (insert p. 9): the genre sets already played, and Longshot's carry-over.
  modularSets: { label: "Genre sets checked off", when: "Not picked again while others remain." },
  longshotInPlay: { label: "Longshot", when: "Was in play when the last issue ended." },
  // NeXt Evolution (MC40 p. 24): the six-row scheme table and its tallies are their own panel (`sideSchemes`), so the
  // fields that panel reads are not repeated as world rows.
  sideSchemes: { hidden: true },
  sideSchemeScenario1: { hidden: true },
  sideSchemeScenario2: { hidden: true },
  sideSchemeScenario3: { hidden: true },
  sideSchemeScenario4: { hidden: true },
  sideSchemeScenario5: { hidden: true },
  environmentsEarned: { hidden: true },
  encounterCards: { hidden: true },
  maraudersDefeated: { hidden: true },
  morlocksSaved: { hidden: true },
  hopeDamage3: { hidden: true },
  hopeDamage4: { hidden: true },
  // Age of Apocalypse (MC45 p. 24): the four mission rows and five Overseers are their own panel (`missions`), so the
  // strike lists and the four result fields are not repeated as world rows.
  missions: { hidden: true },
  overseers: { hidden: true },
  resultLiberate: { hidden: true },
  resultEvacuate: { hidden: true },
  resultSabotage: { hidden: true },
  resultFind: { hidden: true },
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
        // A choice reads as its words ("brawler" -> "Brawler"), the way the briefing names a role.
        value: isChoiceField(definition, id) && !empty ? idWords(row.rendered) : row.rendered,
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
        // A field with no authored sentence shows its label alone: repeating the label as its own description (plus a
        // page ref) told the player nothing.
        when: presentation && "when" in presentation ? presentation.when : "",
      };
    });
  return {
    seats,
    world,
    wallets: dossierWallets(record, definition, heroNameOf, cardName),
    bountyLadder: campaignDossierBountyLadder(record, definition, cardName),
    reputationTrack: campaignDossierReputationTrack(record, definition),
    pool: campaignDossierPool(record, definition, cardTypeOf, poolCopy, firstPlayerName),
    hiddenEvidence: hiddenEvidenceEnvelope(record, definition, cardName),
    sideSchemes: sideSchemeTableOf(record, definition, cardName),
    missions: missionTableOf(record, definition),
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

// ---------------------------------------------------------------------------------------------------------------
// The reputation track (MC27 p. 5/p. 22): a shared field crossed by threshold, each crossing appending one or more
// repeating "Setup:" instructions to every remaining scenario's own setup — read generically off the definition's
// own `everyNodeVictory` op tree (`sm.ts`'s `crossed(n)`), never by campaign id, the same discipline
// `ladderFieldOf`/`walletFieldsOf` above already use for their own box-agnostic shapes.
// ---------------------------------------------------------------------------------------------------------------

export interface DossierReputationNode {
  readonly node: number;
  readonly marked: boolean;
  /** This node's own repeating "Setup:" text(s) (MC27 p. 5's "pink box"), queued for every remaining scenario once
   * marked. Empty for a node whose reward/penalty resolves immediately instead (a "white box"), or one with no
   * `conditionalInstructions` entry to read a sentence off of. */
  readonly inForceText: readonly string[];
}

export interface DossierReputationTrack {
  readonly label: string;
  /** "4 REPUTATION" — the field's live value, in the same words `WORLD_FIELD_PRESENTATION`'s own label uses. */
  readonly valueLabel: string;
  readonly nodes: readonly DossierReputationNode[];
  readonly caption: string;
}

/** `{ field, threshold }` for a `when` shaped exactly like `sm.ts`'s own `crossed(n)`: "the tracked field is now at
 * least `threshold`, and it was not before" — `null` for any other predicate shape (every other box's `if`s). */
function crossedNodeShape(when: CampaignPredicate): { readonly field: string; readonly threshold: number } | null {
  if (when.kind !== "and" || when.of.length !== 2) return null;
  const [first, second] = when.of;
  if (!first || !second) return null;
  if (first.kind !== "valueAtLeast" || first.value.kind !== "field") return null;
  if (first.amount.kind !== "const" || typeof first.amount.value !== "number") return null;
  if (second.kind !== "not" || second.of.kind !== "valueAtLeast" || second.of.value.kind !== "field") return null;
  if (second.of.amount.kind !== "const" || second.of.amount.value !== first.amount.value) return null;
  return { field: first.value.field, threshold: first.amount.value };
}

/** Every `appendToList` (recursively, through `forEachSeat`/`if`) in `ops` naming a `conditionalInstructions` id
 * whose own text is a repeating "Setup:" instruction (MC27 p. 5's pink-box rule, `sm.ts`'s own header comment: "a
 * bullet printed with a 'Setup:' label is a pink, repeating instruction"). */
function inForceInstructionIdsIn(ops: readonly CampaignOp[], definition: CampaignDefinition): string[] {
  const instructions = definition.conditionalInstructions ?? {};
  const found: string[] = [];
  for (const op of ops) {
    if (op.kind === "appendToList" && op.value.kind === "const" && typeof op.value.value === "string") {
      const instruction = instructions[op.value.value];
      if (instruction?.text.startsWith("Setup:")) found.push(op.value.value);
    } else if (op.kind === "forEachSeat") {
      found.push(...inForceInstructionIdsIn(op.ops, definition));
    } else if (op.kind === "if") {
      found.push(...inForceInstructionIdsIn(op.then, definition));
      if (op.else) found.push(...inForceInstructionIdsIn(op.else, definition));
    }
  }
  return found;
}

/** Every `{ field, threshold, inForceIds }` an `everyNodeVictory` `if(crossed(field, n), then: […])` names, in
 * printed order (MC27 p. 5's "whenever a node is marked"). A campaign with no such shape (every box but MC27
 * today) returns an empty list. */
function reputationNodesOf(
  definition: CampaignDefinition,
): readonly { readonly field: string; readonly threshold: number; readonly inForceIds: readonly string[] }[] {
  const found: { field: string; threshold: number; inForceIds: readonly string[] }[] = [];
  const walk = (ops: readonly CampaignOp[]): void => {
    for (const op of ops) {
      if (op.kind === "if") {
        const shape = crossedNodeShape(op.when);
        if (shape) found.push({ ...shape, inForceIds: inForceInstructionIdsIn(op.then, definition) });
        walk(op.then);
        if (op.else) walk(op.else);
      } else if (op.kind === "forEachSeat") {
        walk(op.ops);
      }
    }
  };
  for (const instruction of definition.everyNodeVictory ?? []) {
    if (instruction.step.kind === "betweenGames") walk(instruction.step.ops);
  }
  return found;
}

/**
 * The reputation track panel (design tile 19's MC27 counterpart): null for a definition with no crossed-node shape
 * at all. Every node's `marked`/`inForceText` reads straight off `record.shared[field]` and the definition's own
 * conditional instructions — never invented copy, the same discipline every other Dossier panel in this file uses.
 */
function campaignDossierReputationTrack(
  record: CampaignLog,
  definition: CampaignDefinition,
): DossierReputationTrack | null {
  const nodes = reputationNodesOf(definition);
  if (nodes.length === 0) return null;
  const fieldId = nodes[0]!.field;
  const value = record.shared[fieldId];
  const currentValue = value?.kind === "number" ? value.value : 0;
  const fieldMeta = definition.logFields.find((field) => field.id === fieldId);
  const presentation = WORLD_FIELD_PRESENTATION[fieldId];
  const label = presentation && "label" in presentation ? presentation.label : (fieldMeta?.label ?? fieldId);
  const instructions = definition.conditionalInstructions ?? {};
  return {
    label,
    valueLabel: `${currentValue} ${label.toUpperCase()}`,
    nodes: nodes.map(({ threshold, inForceIds }) => {
      const marked = currentValue >= threshold;
      return {
        node: threshold,
        marked,
        // Structurally, `inForceIds` is what crossing *would* queue — only a node this run has actually crossed
        // has really appended it to `reputationSetups` (`sm.ts`'s own `sm.reputation.mark`).
        inForceText: marked ? inForceIds.map((id) => instructions[id]!.text) : [],
      };
    }),
    caption:
      'Each node stays marked once crossed — a marked node\'s own "Setup:" instructions join every remaining issue.',
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

/**
 * A card-list field's Log row in plain words, keyed by field id: what the cards in it do from here on, in place of
 * the instruction's whole printed sentence (MC32 p. 7: Future Past cards found in the encounter deck, discard pile
 * or in play are recorded and shuffled into every later encounter deck).
 */
const CARD_LIST_LOG_WORDS: Readonly<Record<string, { readonly verb: string; readonly detail: string }>> = {
  futurePast: { verb: "Recorded", detail: "Joins later encounter decks." },
};

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
        // The box's own printed page for its retry rule; a box that defines none shows no page.
        citation: definition.loss.citation ?? "",
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
      // A `hidden` field is the campaign's own bookkeeping (MC32's roles-taken strike list) and is never listed, and a
      // field that only stages a removal is shown by the removal row below, not as a write.
      const unlisted = unlistedFieldIds(definition);
      for (const group of resolvedWritesOf(winning, (fieldId) => !unlisted.has(fieldId))) {
        const { field, seatNumber, value, stepIndex, writeIndex, step } = group;
        // A `cardRef` write is always paired with this same step's `grantCard` — the grant row below already
        // names the card, so the write row would only repeat it. An unset flag is a non-event on the sheet.
        if (value.kind === "cardRef") continue;
        if (value.kind === "flag" && !value.value) continue;
        if (value.kind === "cardList" && value.cardIds.length === 0) continue;
        // A number write that stayed at (or fell back to) zero is a non-event, the same as an unset flag above.
        if (value.kind === "number" && value.value === 0) continue;
        const hero = seatNumber !== null ? heroNameOfSeat(seatNumber) : null;
        const cardsWords = value.kind === "cardList" ? CARD_LIST_LOG_WORDS[field] : undefined;
        if (value.kind === "choice" && field === "role" && hero) {
          // The briefing's own sentence for the same pick (`rolePickRowsOf`): "Colossus took the Brawler role."
          entries.push({
            key: `${node.id}:write:${stepIndex}:${writeIndex}`,
            headline: `${hero} took the ${idWords(value.option)} role.`,
            detail: "Each player takes a different role.",
            citation: step.citation,
          });
          continue;
        }
        const plain = plainWriteRows(field, value, hero, cardName);
        if (plain) {
          plain.forEach((row, rowIndex) => {
            entries.push({
              key: `${node.id}:write:${stepIndex}:${writeIndex}:${rowIndex}`,
              headline: row.headline,
              detail: row.detail,
              citation: step.citation,
            });
          });
          continue;
        }
        if (cardsWords && value.kind === "cardList") {
          // One short line per fact in plain words, not the instruction's whole printed sentence.
          entries.push({
            key: `${node.id}:write:${stepIndex}:${writeIndex}`,
            headline: `${cardsWords.verb}: ${value.cardIds.map((id) => cardName(id)).join(", ")}`,
            detail: cardsWords.detail,
            citation: step.citation,
          });
          continue;
        }
        const base =
          value.kind === "flag"
            ? fieldLabel(field)
            : value.kind === "number"
              ? `${signedCount(value.value)} ${pluralizeFieldWord(fieldLabel(field), field, value.value)}`
              : value.kind === "cardList"
                ? `+ ${value.cardIds.map((id) => cardName(id)).join(", ")}`
                : value.kind === "choice"
                  ? `${idWords(value.option)} ${fieldLabel(field)}`
                  : `${renderLogValue(value, cardName)} ${fieldLabel(field)}`;
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
        step.removedFromCampaign.forEach((card, removedIndex) => {
          entries.push({
            key: `${node.id}:removed:${stepIndex}:${removedIndex}`,
            headline: `${cardName(card.cardId)} removed from the campaign`,
            detail: "Gone for the rest of the campaign.",
            citation: step.citation,
          });
        });
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

/** Per-seat card-list fields whose cards the Heroes tab shows as that hero's campaign cards. */
const HERO_RECORDED_FIELDS: readonly string[] = ["recordedCards"];

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
  const alterEgo = isHero ? (identity as { readonly alterEgo: { readonly faceName: string } }) : null;
  const heroName = isHero ? heroFaceDisplayName(identity) : (seat.identityCardId as string);

  const nodeIds = definition.graph.nodes.map((node) => node.id);
  const lostAt = lostAtNodeIdOf(record, nodeIds);
  const issues: DossierHeroIssueBox[] = definition.graph.nodes.map((node) => {
    const resolved = record.position.resolved[node.id];
    const isCurrent = node.id === record.position.nextNodeId;
    const state: DossierHeroIssueBox["state"] = isCurrent
      ? "next"
      : node.id === lostAt
        ? "lost"
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

  // A card the hero recorded in the log (MojoMania's support or upgrade) is a campaign card of theirs too, though no
  // grant adds it to the deck: it is put into play from any deck at a later setup.
  const recordedIds = HERO_RECORDED_FIELDS.flatMap((fieldId) => {
    const value = seat.fields[fieldId];
    return value?.kind === "cardList" ? value.cardIds : [];
  }).filter((id) => !seat.grants.some((grant) => grant.cardId === id));
  const cardsOfHero: readonly { readonly cardId: CardId; readonly recorded: boolean }[] = [
    ...seat.grants.map((grant: CampaignGrant) => ({ cardId: grant.cardId, recorded: false })),
    ...recordedIds.map((id) => ({ cardId: id, recorded: true })),
  ];
  const campaignCards: DossierHeroCampaignCard[] = cardsOfHero.map(({ cardId: grantedCardId, recorded }) => {
    const grant = { cardId: grantedCardId };
    const card = cardOf(grant.cardId as string);
    const typeLabel = card ? card.type.replace(/_/g, " ") : "card";
    const textLine =
      card && "text" in card ? (card as { readonly text: { readonly current: string } }).text.current : "";
    const grantFieldId = fieldIdOfGrant(grant.cardId as string);
    const improving = grantFieldId && !recorded ? nodeImprovingField(definition, grantFieldId) : null;
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
  const { counted: deckSize, pinned: pinnedCount } = seatDeckSizeSplit(seat);
  const role = seat.fields["role"];
  const stats: DossierHeroStatRow[] = [
    ...(role?.kind === "choice" ? [{ label: "Role", value: idWords(role.option), note: "chosen in #1" }] : []),
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
