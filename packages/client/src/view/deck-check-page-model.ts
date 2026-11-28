/**
 * What Deck check's page element (`views/deck-check/mc-deck-check-page`) shows, computed from the deck: every number comes
 * from `view/deck-stats.ts` and the engine's own legality verdict (`view/deck-list-model.ts`), and every word through the
 * i18n layer. The scene calls this and sets the result on the page; the page and its parts draw it and compute nothing.
 */
import type { BarChartBar, CardCellModel, PictureSource, StatTile } from "@mc/ui";
import type { CoreAspect, Deck } from "@mc/content";
import { POOL_VERSION, currentCardsById, currentDeps, currentPool } from "../content/pool.js";
import { artFor, artLanguageNow, type ArtSource } from "../art/art-source.js";
import { SELECTABLE_ASPECTS } from "./deck-builder-model.js";
import {
  costCurveBars,
  deckCountText,
  deckListGroupsOf,
  deckListSortLabel,
  deckStatsOf,
  filterDeckListGroups,
  outsideDeckGroupsOf,
  type DeckListEntry,
  type DeckListGroup,
  type DeckListSort,
  type PlayerCardType,
} from "./deck-stats.js";
import { deckFaceGroups } from "./deck-faces.js";
import { deckOptionOf } from "./deck-list-model.js";
import { deckStatusOf } from "./deck-status.js";
import type { CampaignDeckVerdict } from "./campaign-deck-edit-model.js";
import { aspectLabelOf } from "./seat-slots.js";
import { aspectTipContentOf } from "./aspect-tip-model.js";
import { aspectName } from "./aspect-stamp.js";
import { cardTypeWordOf } from "./card-type-word.js";
import type { DeckCheckPageModel } from "../views/deck-check/mc-deck-check-page/mc-deck-check-page.types.js";
import { surface } from "../tokens.js";
import { costPipColor } from "../ui/deck-stats-widgets.js";
import { sheetColor } from "../dom/sheet-builder.js";
import { t, type MessageKey } from "../i18n/translate.js";

/** The rail's type filter: the same seven the deck builder offers. */
export const TYPE_FILTERS: readonly {
  readonly id: string;
  readonly label: MessageKey;
  readonly type: PlayerCardType | null;
}[] = [
  { id: "all", label: "deckCheck.all", type: null },
  { id: "ally", label: "cardType.ally", type: "ally" },
  { id: "event", label: "cardType.event", type: "event" },
  { id: "upgrade", label: "cardType.upgrade", type: "upgrade" },
  { id: "support", label: "cardType.support", type: "support" },
  { id: "resource", label: "cardType.resource", type: "resource" },
  { id: "scheme", label: "cardType.sideScheme", type: "player_side_scheme" },
];

/** The panel's list is cut to this many lines, the rest named by "+ N more" (the deck builder's own cap). */
const PANEL_LIST_ENTRY_CAP = 12;

export interface DeckCheckModelInput {
  readonly deck: Deck;
  readonly verdict: CampaignDeckVerdict | undefined;
  readonly wide: boolean;
  /** The Back button says "Seats" and the header "3/4" when the screen is a step of the setup flow. */
  readonly inFlow: boolean;
  readonly canStart: boolean;
  readonly typeFilter: PlayerCardType | null;
  readonly deckSort: DeckListSort;
  /** A scan's picture: its URL held for as long as the screen shows it. */
  readonly pictureOf: (source: ArtSource | null) => PictureSource;
  readonly backLabel: string;
  readonly cardScale: number;
  readonly desktop: boolean;
}

export interface DeckCheckModelResult {
  readonly model: DeckCheckPageModel;
  /** The cards and faces the page lists, for the focus route's order. */
  readonly cardIds: readonly string[];
  readonly faceIds: readonly string[];
  /** The face each face tile shows, by its `face:<id>` key, for Inspect. */
  readonly faces: ReadonlyMap<string, { readonly cardId: string; readonly face: object }>;
}

/** One flattened, unwrapped line of a card's rules text, for a cell's own short strip: the full text is in Inspect. */
function truncate(text: string, maxChars: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > maxChars ? `${flat.slice(0, maxChars - 1)}…` : flat;
}

/** The cost curve as bars: its commonest cost in red, or (the narrow tab) each in its cost's own hue. */
function barsOf(stats: ReturnType<typeof deckStatsOf>, rainbow: boolean): readonly BarChartBar[] {
  const bars = costCurveBars(stats);
  const peak = Math.max(0, ...bars.map((bar) => bar.count));
  return bars.map((bar, cost) => ({
    label: bar.label,
    count: bar.count,
    highlight: !rainbow && peak > 0 && bar.count === peak,
    ...(rainbow ? { tint: sheetColor(costPipColor(cost), "fill") } : {}),
  }));
}

const pipColorOf = (cost: number | null): string =>
  sheetColor(cost !== null ? costPipColor(cost) : surface.ink.hex, "fill");

export function deckCheckPageModel(input: DeckCheckModelInput): DeckCheckModelResult {
  const { deck, verdict, wide, typeFilter } = input;
  const language = artLanguageNow();
  const option = deckOptionOf(deck, currentPool(), POOL_VERSION, currentDeps());
  const stats = deckStatsOf(deck, currentPool());
  // The Curve and Aspect tabs read the deck by aspect whatever the card list's sort.
  const byAspect = deckListGroupsOf(deck, currentPool(), undefined, false, language);
  const sorted = deckListGroupsOf(deck, currentPool(), input.deckSort, true, language);
  const status = verdict?.status ?? deckStatusOf(option, language);
  const count = verdict?.count ?? deckCountText(stats, language);
  const verdictWords = `${count.toUpperCase()} · ${status.text.toUpperCase()}`;

  const header = wide
    ? {
        backLabel: input.backLabel,
        title:
          `${option.identityName ?? t("deckCheck.unknown")} — ${aspectLabelOf(deck.aspects, language)}`.toUpperCase(),
        badgeText: verdictWords,
        badgeTone: status.tone,
        meta: "",
      }
    : {
        backLabel: input.backLabel,
        title: t("deckCheck.yourDeckCount", { count: verdict?.counted ?? stats.countedCards }),
        badgeText: "",
        badgeTone: status.tone,
        meta: input.inFlow ? "3/4" : verdictWords,
      };

  const tips: Record<string, string> = {};
  const aspects = SELECTABLE_ASPECTS.map((aspect: CoreAspect) => {
    const content = aspectTipContentOf(aspect);
    if (content) tips[aspect] = `${content.title}. ${content.tagline}. ${content.tipLine}`;
    return {
      aspect,
      label: aspectName(aspect, language),
      chosen: deck.aspects.includes(aspect),
      tipLabel: content?.title ?? "",
    };
  });

  const average = stats.averageCost !== null ? t("deckCheck.average", { avg: stats.averageCost.toFixed(1) }) : "";
  const typeTile = (label: string, n: number): StatTile => ({ id: label, text: `${label} ${n}` });
  const all = byAspect.flatMap((group) => group.entries);

  // The panel: the first lines up to the cap, the rest as "+ N more".
  let room = PANEL_LIST_ENTRY_CAP;
  let more = 0;
  const panelGroups = sorted
    .map((group) => {
      const shown = group.entries.slice(0, Math.max(0, room));
      room -= shown.length;
      more += group.entries.length - shown.length;
      return {
        label: `${group.label} · ${group.count}`,
        entries: shown.map((entry) => ({ name: entry.name, quantity: entry.quantity, hover: entry.cardId as string })),
      };
    })
    .filter((group) => group.entries.length > 0);

  // The cards: wide narrows them by the rail's filter; narrow lists them all (its Cards tab).
  const cardGroups: readonly DeckListGroup[] = wide ? filterDeckListGroups(sorted, typeFilter) : sorted;
  const faces = new Map<string, { readonly cardId: string; readonly face: object }>();
  const faceIds: string[] = [];
  const faceGroups =
    typeFilter === null
      ? deckFaceGroups(deck, currentCardsById()).map((group) => ({
          title: group.identity
            ? t("deckCheck.identityFaces", { count: group.tiles.length })
            : t("deckCheck.cardFaces", { title: group.title.toUpperCase(), count: group.tiles.length }),
          tiles: group.tiles.map((tile, i) => {
            const id = `${group.cardId}:${(tile.face as { kind?: string } | undefined)?.kind ?? "front"}:${i}`;
            faceIds.push(id);
            faces.set(`face:${id}`, { cardId: group.cardId, face: tile.face as object });
            return {
              id,
              cardId: group.cardId,
              picture: input.pictureOf(tile.art),
              label: tile.label,
              name: tile.name,
              face: tile.face,
            };
          }),
        }))
      : [];
  // What the identity brings besides the deck (#960), under the deck's own cards and never counted in it.
  const outside = typeFilter === null ? outsideDeckGroupsOf(deck.identityCardId, currentPool(), language) : [];
  const cardIds: string[] = [];
  const cellOf = (entry: DeckListEntry): CardCellModel => {
    const card = currentCardsById().get(entry.cardId as string);
    const rules =
      card && "text" in card ? truncate((card as unknown as { text: { current: string } }).text.current, 120) : "";
    return {
      id: entry.cardId as string,
      cardId: entry.cardId as string,
      cost: entry.cost,
      costColor: pipColorOf(entry.cost),
      name: entry.name,
      typeWord: cardTypeWordOf(entry.type),
      picture: input.pictureOf(artFor(card, { kind: "front" })),
      rules,
      quantity: entry.quantity,
    };
  };
  const groups = [...cardGroups, ...outside].map((group) => {
    for (const entry of group.entries)
      if (!cardIds.includes(entry.cardId as string)) cardIds.push(entry.cardId as string);
    return { title: `${group.label.toUpperCase()} · ${group.count}`, cells: group.entries.map(cellOf) };
  });

  const model: DeckCheckPageModel = {
    header,
    rail: {
      aspectHeading: t("deckCheck.aspect"),
      aspects,
      tips,
      filterHeading: t("deckCheck.filter"),
      chips: TYPE_FILTERS.map((f) => ({ id: f.id, label: t(f.label) })),
      curveHeading: t("deckCheck.costCurve"),
      bars: barsOf(stats, false),
    },
    curve: {
      heading: t("deckCheck.resourceCurve"),
      average,
      bars: barsOf(stats, true),
      tiles: [
        typeTile(t("deckTypes.resource"), stats.countsByType.resource ?? 0),
        typeTile(t("deckTypes.ally"), stats.countsByType.ally ?? 0),
        typeTile(t("deckTypes.event"), stats.countsByType.event ?? 0),
      ],
      rows: all.map((entry) => ({
        id: entry.cardId as string,
        cost: entry.cost,
        costColor: pipColorOf(entry.cost),
        name: entry.name,
        quantity: entry.quantity,
      })),
    },
    composition: {
      heading: t("deckCheck.composition"),
      tiles: byAspect.map((g) => ({ id: g.key, text: `${g.label} ${g.count}` })),
      empty: t("deckCheck.noCards"),
    },
    tabs: [
      { id: "curve", label: t("deckCheck.tabCurve") },
      { id: "cards", label: t("deckCheck.tabCards") },
      { id: "aspect", label: t("deckCheck.tabAspect") },
    ],
    panel: {
      heading: t("deckCheck.yourDeck").toUpperCase(),
      groups: panelGroups,
      more: more > 0 ? t("deckList.more", { count: more }) : "",
    },
    sortLabel: deckListSortLabel(input.deckSort, language),
    actions: {
      editLabel: t("deckCheck.editDeck"),
      startLabel: t("deckCheck.startGame"),
      startUnavailable: input.canStart ? "" : t("deckCheck.startUnavailable"),
    },
    cards: {
      faces: faceGroups,
      groups,
      note: cardGroups.length === 0 ? t("deckCheck.noMatch") : "",
      cardScale: input.cardScale,
      desktop: input.desktop,
    },
  };
  return { model, cardIds, faceIds, faces };
}
