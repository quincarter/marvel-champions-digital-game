/**
 * The briefing's role-building step (MC32 p. 5, "Role-building"): each player may take up to 1 event and up to 1
 * upgrade from their role's two aspects. The runner decides what may be chosen (`CampaignPendingChoice.options`, which
 * already skips cards in the deck); this model only decides how the list is *presented* — card faces with their
 * disambiguating names, aspect filter chips, a short "Recommended" group with a one-line reason each, and the confirm
 * step that stands between a tap and the record. Pure and deterministic, Vitest-tested without Phaser.
 *
 * Recommendation rule (a heuristic, never a legality check; every reason says which part fired):
 *  - +3 "gives access": the card's aspect is one of the role's two and the hero's deck does not run it.
 *  - +1 "strengthens": the card's aspect is one the deck already runs.
 *  - +2 "fits your lean": the hero's printed THW and ATK differ and the card's text is about the stronger one
 *    (thwart / threat for THW-leaning, attack / damage for ATK-leaning); +1 when the text covers both.
 *  - +2 "cheap": cost 2 or less.
 * Top 3 by score (then lower cost, then name), one per printed name, shown first.
 */
import type { Campaign, CoreAspect } from "@mc/content";
import type { CampaignPendingChoice } from "@mc/engine";
import { aspectStampOf, type AspectStamp } from "./aspect-stamp.js";

export const RECOMMENDED_MAX = 3;

export interface RoleBuildCard {
  readonly id: string;
  /** The option's label: the card's name plus what tells two printings apart ("Toe to Toe · Hulk"). */
  readonly label: string;
  readonly name: string;
  readonly type: "event" | "upgrade";
  readonly aspect: CoreAspect;
  /** Null for an X or dash cost. */
  readonly cost: number | null;
  /** The card's current rules text, used only to read thwart/attack leaning. */
  readonly text: string;
}

export interface RoleBuildContext {
  readonly heroName: string;
  readonly roleName: string;
  readonly roleAspects: readonly CoreAspect[];
  /** The aspects the seat's deck runs. */
  readonly deckAspects: readonly CoreAspect[];
  /** The hero side's printed stats; null when unknown. */
  readonly atk: number | null;
  readonly thw: number | null;
}

export type CardLean = "thwart" | "attack" | "both" | "none";

const THWART_TEXT = /\bthwart|remove (?:\d+|x|all|1) threat|remove threat/i;
const ATTACK_TEXT = /\battack|\bdeal \w+ damage|\bstun/i;

export function leanOfText(text: string): CardLean {
  const thwart = THWART_TEXT.test(text);
  const attack = ATTACK_TEXT.test(text);
  return thwart && attack ? "both" : thwart ? "thwart" : attack ? "attack" : "none";
}

/** Which of THW / ATK the hero leans toward, from the printed stats. */
export function heroLeanOf(atk: number | null, thw: number | null): "thwart" | "attack" | "none" {
  if (atk === null || thw === null || atk === thw) return "none";
  return thw > atk ? "thwart" : "attack";
}

const label = (aspect: CoreAspect): string => aspectStampOf(aspect).label;
const deckLabelOf = (aspects: readonly CoreAspect[]): string =>
  aspects.length === 0 ? "current" : aspects.map(label).join(" + ");

export interface Scored {
  readonly score: number;
  readonly clauses: readonly string[];
}

export function scoreCard(card: RoleBuildCard, ctx: RoleBuildContext): Scored {
  let score = 0;
  const aspectClauses: string[] = [];
  const otherClauses: string[] = [];
  if (!ctx.deckAspects.includes(card.aspect)) {
    score += 3;
    aspectClauses.push(
      `Gives ${ctx.heroName} ${label(card.aspect)}, which the ${deckLabelOf(ctx.deckAspects)} deck lacks`,
    );
  } else {
    score += 1;
    aspectClauses.push(`Strengthens the ${label(card.aspect)} deck`);
  }
  const heroLean = heroLeanOf(ctx.atk, ctx.thw);
  const lean = leanOfText(card.text);
  if (heroLean !== "none" && (lean === heroLean || lean === "both")) {
    score += lean === "both" ? 1 : 2;
    otherClauses.push(
      heroLean === "thwart"
        ? `Thwart effect suits ${ctx.heroName}'s THW ${ctx.thw} vs ATK ${ctx.atk}`
        : `Attack effect suits ${ctx.heroName}'s ATK ${ctx.atk} vs THW ${ctx.thw}`,
    );
  }
  if (card.cost !== null && card.cost <= 2) {
    score += 2;
    otherClauses.push(card.cost === 0 ? "Free to play" : `Cheap: costs ${card.cost}`);
  }
  return { score, clauses: [...aspectClauses, ...otherClauses] };
}

export interface RoleBuildCardView {
  readonly id: string;
  readonly label: string;
  readonly name: string;
  readonly aspect: AspectStamp;
  readonly cost: number | null;
  readonly recommended: boolean;
  /** One line, only on a recommended card. */
  readonly reason: string | null;
}

export interface RoleBuildChip {
  /** Null is "All". */
  readonly aspect: CoreAspect | null;
  readonly label: string;
  readonly count: number;
  readonly selected: boolean;
}

export interface RoleBuildState {
  readonly aspect: CoreAspect | null;
  /** The card whose confirm step is open. */
  readonly selected: string | null;
}

export const ROLE_BUILD_START: RoleBuildState = { aspect: null, selected: null };

export interface RoleBuildView {
  readonly noun: "event" | "upgrade";
  readonly chips: readonly RoleBuildChip[];
  /** Up to `RECOMMENDED_MAX`, best first, narrowed by the filter chip. */
  readonly recommended: readonly RoleBuildCardView[];
  /** Everything else (matching the filter), by name. */
  readonly rest: readonly RoleBuildCardView[];
  /** Every card, unfiltered — what the confirm step looks a pick up in. */
  readonly all: readonly RoleBuildCardView[];
}

/**
 * The cards of one role-building choice, ordered recommended-first and narrowed by the aspect chip. The
 * recommendation is computed over every option, so a filter hides a recommendation but never changes which cards
 * are recommended.
 */
export function roleBuildOf(
  cards: readonly RoleBuildCard[],
  ctx: RoleBuildContext,
  state: RoleBuildState,
): RoleBuildView {
  const scored = cards
    .map((card) => ({ card, ...scoreCard(card, ctx) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.card.cost ?? 99) - (b.card.cost ?? 99) ||
        a.card.name.localeCompare(b.card.name) ||
        a.card.id.localeCompare(b.card.id),
    );
  const pickedNames = new Set<string>();
  const recommendedIds = new Map<string, string>();
  for (const entry of scored) {
    if (recommendedIds.size >= RECOMMENDED_MAX) break;
    if (pickedNames.has(entry.card.name)) continue;
    pickedNames.add(entry.card.name);
    recommendedIds.set(entry.card.id, `${entry.clauses.slice(0, 2).join(". ")}.`);
  }
  const viewOf = (card: RoleBuildCard): RoleBuildCardView => ({
    id: card.id,
    label: card.label,
    name: card.name,
    aspect: aspectStampOf(card.aspect),
    cost: card.cost,
    recommended: recommendedIds.has(card.id),
    reason: recommendedIds.get(card.id) ?? null,
  });
  const byName = (a: RoleBuildCardView, b: RoleBuildCardView): number =>
    a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
  const shown = (view: RoleBuildCardView): boolean => state.aspect === null || view.aspect.aspect === state.aspect;
  const recommended = scored.filter((entry) => recommendedIds.has(entry.card.id)).map((entry) => viewOf(entry.card));
  const all = cards.map(viewOf).sort(byName);
  return {
    noun: cards[0]?.type ?? "event",
    chips: [
      { aspect: null, label: "All", count: cards.length, selected: state.aspect === null },
      ...ctx.roleAspects.map((aspect) => ({
        aspect,
        label: label(aspect),
        count: cards.filter((card) => card.aspect === aspect).length,
        selected: state.aspect === aspect,
      })),
    ],
    recommended: recommended.filter(shown),
    rest: all.filter((view) => !view.recommended && shown(view)),
    all,
  };
}

/**
 * True when `pending` is a role-building pick: an optional single event or upgrade, per seat, every option within the
 * seat's role's two aspects. Detected by shape (never by campaign id), like `isRoleChoice`.
 */
export function isRoleBuildChoice(
  pending: CampaignPendingChoice,
  role: { readonly aspects: readonly string[] } | null,
  cardOf: (id: string) => { readonly type: string; readonly aspect?: string } | undefined,
): boolean {
  if (!role || pending.random || !pending.optional || pending.count !== 1 || pending.seatNumber === null) return false;
  if (pending.options.length === 0) return false;
  return pending.options.every((id) => {
    const card = cardOf(id);
    return !!card && (card.type === "event" || card.type === "upgrade") && role.aspects.includes(card.aspect ?? "");
  });
}

/**
 * The role a seat took: the answer it gave to this briefing's role question (composing re-runs from the top on every
 * answer, so a role picked a moment ago is in `answers` before it is in the seat's log), else its `role` log field.
 */
export function seatRoleOf(
  seat:
    | {
        readonly seatNumber?: number;
        readonly fields: Readonly<Record<string, { readonly kind: string; readonly option?: string }>>;
      }
    | undefined,
  roles: NonNullable<Campaign["roles"]>,
  answers: readonly { readonly seatNumber: number | null; readonly picked: readonly string[] }[] = [],
): NonNullable<Campaign["roles"]>[number] | null {
  const answered = [...answers]
    .reverse()
    .find((answer) => answer.seatNumber === seat?.seatNumber && roles.some((role) => role.id === answer.picked[0]));
  if (answered) return roles.find((role) => role.id === answered.picked[0]) ?? null;
  const field = seat?.fields["role"];
  if (field?.kind !== "choice") return null;
  return roles.find((role) => role.id === field.option) ?? null;
}

export interface RoleBuildConfirmView {
  readonly title: string;
  readonly card: RoleBuildCardView;
  readonly detail: string;
}

export function roleBuildConfirmOf(
  card: RoleBuildCardView,
  heroName: string,
  noun: "event" | "upgrade",
): RoleBuildConfirmView {
  return {
    title: `Add ${card.name} to ${heroName}'s deck?`,
    card,
    detail: `This ${noun} joins the deck for this game only and doesn't count toward deck size. It is recorded in the campaign log.`,
  };
}

/** Choosing a chip narrows the list; tapping it again (or "All") clears it. */
export function setRoleBuildFilter(state: RoleBuildState, aspect: CoreAspect | null): RoleBuildState {
  return { ...state, aspect: state.aspect === aspect ? null : aspect };
}

/** A card opens its confirm step; one that isn't on offer can't. */
export function selectRoleBuildCard(state: RoleBuildState, view: RoleBuildView, id: string): RoleBuildState {
  return view.all.some((card) => card.id === id) ? { ...state, selected: id } : state;
}

/** Back keeps the filter, so the list returns to the same place. */
export const backFromRoleBuild = (state: RoleBuildState): RoleBuildState => ({ ...state, selected: null });

/** The one answer Confirm records, or null when nothing is selected. */
export function confirmedRoleBuildCard(state: RoleBuildState, view: RoleBuildView): string | null {
  return view.all.find((card) => card.id === state.selected)?.id ?? null;
}

// ------------------------------------------------------------------------------------------------------------
// Row layout: the list is virtualized rows (a section label, a recommended card, or a row of grid cells).
// ------------------------------------------------------------------------------------------------------------

export const GRID_GAP = 8;
const MIN_CELL_WIDTH = 100;
const MAX_COLUMNS = 6;
/** A scan's own shape (300 x 419). */
export const CARD_RATIO = 300 / 419;
export const LABEL_ROW_HEIGHT = 30;
export const REC_ART_WIDTH = 104;
export const REC_ROW_PAD = 16;
/** Room for a name on three lines at 11 px: a printing suffix ("Chase Them Down · Galaxy's Most Wanted") must not be cut. */
export const NAME_HEIGHT = 44;
export const META_HEIGHT = 14;
export const BUTTON_HEIGHT = 36;

export interface GridGeometry {
  readonly columns: number;
  readonly cellWidth: number;
  readonly artHeight: number;
  readonly cellHeight: number;
}

/** 2-3 columns on a 390 px phone, up to 6 on a desktop column. */
export function gridGeometryOf(width: number): GridGeometry {
  const columns = Math.min(MAX_COLUMNS, Math.max(2, Math.floor((width + GRID_GAP) / (MIN_CELL_WIDTH + GRID_GAP))));
  const cellWidth = Math.floor((width - GRID_GAP * (columns - 1)) / columns);
  const artHeight = Math.round(cellWidth / CARD_RATIO);
  return {
    columns,
    cellWidth,
    artHeight,
    cellHeight: artHeight + 6 + NAME_HEIGHT + META_HEIGHT + 4 + BUTTON_HEIGHT + 12,
  };
}

export const recRowHeight = (): number => Math.round(REC_ART_WIDTH / CARD_RATIO) + REC_ROW_PAD;

export type RoleBuildRow =
  | { readonly kind: "label"; readonly text: string }
  | { readonly kind: "recommended"; readonly card: RoleBuildCardView }
  | { readonly kind: "grid"; readonly cards: readonly RoleBuildCardView[] };

export interface RoleBuildRows {
  readonly rows: readonly RoleBuildRow[];
  readonly heights: readonly number[];
  readonly geometry: GridGeometry;
}

/** The recommended group first (own label), then every other card in a grid. */
export function roleBuildRowsOf(view: RoleBuildView, width: number): RoleBuildRows {
  const geometry = gridGeometryOf(width);
  const rows: RoleBuildRow[] = [];
  if (view.recommended.length > 0) {
    rows.push({ kind: "label", text: "RECOMMENDED FOR YOU" });
    for (const card of view.recommended) rows.push({ kind: "recommended", card });
  }
  if (view.rest.length > 0) {
    rows.push({
      kind: "label",
      text: view.recommended.length > 0 ? `ALL OTHER ${view.noun.toUpperCase()}S` : `ALL ${view.noun.toUpperCase()}S`,
    });
    for (let start = 0; start < view.rest.length; start += geometry.columns) {
      rows.push({ kind: "grid", cards: view.rest.slice(start, start + geometry.columns) });
    }
  }
  const heights = rows.map((row) =>
    row.kind === "label" ? LABEL_ROW_HEIGHT : row.kind === "recommended" ? recRowHeight() : geometry.cellHeight,
  );
  return { rows, heights, geometry };
}
