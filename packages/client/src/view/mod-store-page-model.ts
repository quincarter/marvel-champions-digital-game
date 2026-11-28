/**
 * What the Mod Store's page shows, as plain data (`views/mod-store/mc-mod-store-page`): the header, the browse view (tabs,
 * the Update all bar, the finders, a grid of pack tiles or Credits) and the heads-up about mods. The scene hands it the
 * store's state; nothing here draws, loads or decides what can be installed (`view/mod-store-model.ts` and
 * `packs/pack-state.ts` do), so all of it is tested without a screen. Pictures arrive already resolved, as functions the
 * scene passes in.
 */
import type { FilterChip } from "@mc/ui";
import { t } from "../i18n/translate.js";
import {
  MOD_STORE_TABS,
  emptyTextOf,
  modStoreTabLabel,
  type ModStoreTab,
  type ModStoreTile,
} from "./mod-store-model.js";
import {
  creditLineOf,
  creditsOf,
  filterTiles,
  isFiltering,
  packCountText,
  resultCountText,
  tagChipsOf,
  type ModStoreFilter,
} from "./mod-store-browse.js";
import { MOD_NOTICE_BUTTONS, MOD_NOTICE_LINES, modNoticeControlLabelOf, modStoreBetaCaption } from "./mod-notice.js";
import type { UpdateAllBar } from "./mod-store-update-all.js";
import type { PackThumb, PackTileModel } from "../components/mod-store/mc-pack-tile/mc-pack-tile.types.js";
import type { ModNoticeLineModel } from "../components/mod-store/mc-mod-notice/mc-mod-notice.types.js";
import type {
  BrowseModel,
  FindersModel,
  ModStorePageModel,
} from "../views/mod-store/mc-mod-store-page/mc-mod-store-page.types.js";
import type { ControlGlyph, PictureFocus } from "@mc/ui";

/** A symbol and the words: a state never rests on colour alone. */
const MARKS = { install: "+", installed: "✓", update: "↑", "needs-app-update": "!", withdrawn: "✕" } as const;

/** The chip words of a pack's state: a pack Update all could not update says so itself (issue #957). */
export function stateChipOf(tile: ModStoreTile, failed: boolean): { readonly text: string; readonly solid: boolean } {
  const mark = failed ? "!" : MARKS[tile.state];
  return {
    text: `${mark} ${failed ? t("modStore.updateAll.retry") : tile.stateLabel}`,
    solid: tile.state === "install" || tile.state === "update",
  };
}

export function tileModelOf(tile: ModStoreTile, failed: boolean, thumb: PackThumb): PackTileModel {
  const chip = stateChipOf(tile, failed);
  return {
    id: tile.id,
    name: tile.name,
    meta: `${tile.kindLabel} · by ${tile.creator}`,
    summary: tile.summary,
    foot: tile.size,
    badge: chip.text,
    solid: chip.solid,
    letter: tile.name.charAt(0).toUpperCase(),
    thumb,
  };
}

/** The finders' chips: the creator picked on Credits first (its ✕ undoes that), then the tab's tags, the most used first. */
export function finderChipsOf(tabTiles: readonly ModStoreTile[], filter: ModStoreFilter): readonly FilterChip[] {
  const chips: FilterChip[] = [];
  if (filter.creator !== null) {
    chips.push({
      id: "creator",
      label: `${t("modStore.byCreator", { name: filter.creator })}  ✕`,
      selected: true,
      mark: false,
    });
  }
  for (const chip of tagChipsOf(tabTiles, filter.tags)) {
    chips.push({ id: `tag:${chip.tag}`, label: chip.tag, count: chip.count, selected: chip.on, mark: true });
  }
  return chips;
}

export function findersOf(tabTiles: readonly ModStoreTile[], filter: ModStoreFilter): FindersModel {
  const filtering = isFiltering(filter);
  return {
    search: {
      value: filter.text,
      placeholder: t("modStore.search"),
      clearLabel: t("modStore.clearSearch"),
    },
    sortLabel: `⇅ ${t(filter.sort === "name" ? "modStore.sort.name" : "modStore.sort.newest")}`,
    chips: finderChipsOf(tabTiles, filter),
    clearLabel: filtering ? t("modStore.clear") : "",
    countText: resultCountText(filterTiles(tabTiles, filter).length, tabTiles.length, filtering),
  };
}

export interface BrowseInput {
  readonly tab: ModStoreTab;
  readonly status: "loading" | "ready" | "failed";
  readonly offline: boolean;
  readonly phone: boolean;
  /** A phone's finders were opened with the magnifier. */
  readonly findersOpen: boolean;
  readonly filter: ModStoreFilter;
  /** The tab's packs before the search, tags and creator narrow them. */
  readonly tabTiles: readonly ModStoreTile[];
  readonly updateBar: UpdateAllBar | null;
  /** Packs the last Update all could not update: their tiles say so. */
  readonly failedIds: ReadonlySet<string>;
  /** Goes up when a new filter sends the grid back to its top. */
  readonly scrollFrom: number;
  readonly thumbOf: (tile: ModStoreTile) => PackThumb;
}

/** The browse view's model. A phone keeps its finders behind the magnifier unless a search, tag or creator narrows the list. */
export function browseModelOf(input: BrowseInput): BrowseModel {
  const { tab, status, phone, filter, tabTiles } = input;
  const finding = phone && tab !== "credits" && status !== "loading";
  const open = finding && (input.findersOpen || isFiltering(filter));
  const caption = modStoreBetaCaption();
  const base = {
    caption: { heading: caption.heading, body: phone ? caption.phoneBody : caption.body },
    tabs: MOD_STORE_TABS.map((one) => ({ id: one.id, label: modStoreTabLabel(one) })),
    selected: tab,
    toggle: { shown: finding, open, label: t("modStore.finders") },
    offline: input.offline && status === "ready" ? t("modStore.offline") : null,
    updateBar: status === "ready" && tab !== "credits" ? input.updateBar : null,
  };
  const message = (text: string, retryLabel = ""): BrowseModel => ({
    ...base,
    finders: null,
    body: { kind: "message", text, retryLabel },
  });
  if (status === "loading") return message(t("modStore.loading"));
  if (status === "failed" && tabTiles.length === 0) return message(t("modStore.loadFailed"), t("modStore.tryAgain"));
  if (tab === "credits") {
    return {
      ...base,
      finders: null,
      body: {
        kind: "credits",
        intro: t("modStore.credits.intro"),
        empty: emptyTextOf("credits"),
        credits: creditsOf(tabTiles).map((credit) => ({
          name: credit.name,
          countText: `${packCountText(credit.packs.length)} ▸`,
          line: creditLineOf(credit),
        })),
      },
    };
  }
  if (tabTiles.length === 0) return message(emptyTextOf(tab));
  const finders = !phone || open ? findersOf(tabTiles, filter) : null;
  const tiles = filterTiles(tabTiles, filter);
  if (tiles.length === 0) return { ...message(t("modStore.noMatch")), finders };
  return {
    ...base,
    finders,
    body: {
      kind: "grid",
      listId: `grid:${tab}`,
      scrollFrom: input.scrollFrom,
      tiles: tiles.map((tile) =>
        tileModelOf(tile, tile.state === "update" && input.failedIds.has(tile.id), input.thumbOf(tile)),
      ),
    },
  };
}

export interface HeaderInput {
  readonly phone: boolean;
  /** A pack's page is open: Back returns to the store, not to where it was opened from. */
  readonly inPack: boolean;
  readonly installedCount: number;
  readonly backGlyph: ControlGlyph | undefined;
  readonly aboutGlyph: ControlGlyph | undefined;
}

export function headerModelOf(input: HeaderInput): ModStorePageModel["header"] {
  return {
    // A phone's Back is a bare arrow: its bar has no room for words.
    backLabel: input.phone ? "◂" : input.inPack ? t("modStore.back.store") : t("modStore.back.title"),
    heading: t("title.modStore"),
    // Quin, 2026-11-13: the store and community packs are new; say so on every store screen.
    badge: "Beta",
    installedText: input.installedCount > 0 ? t("modStore.installedCount", { count: input.installedCount }) : "",
    aboutLabel: modNoticeControlLabelOf(input.phone),
    backGlyph: input.backGlyph,
    aboutGlyph: input.aboutGlyph,
  };
}

/** The heads-up: the two speakers with their portraits (`portraitOf`, null while one has none) and the two answers. */
export function noticeModelOf(
  portraitOf: (identityId: string) => { readonly src: string; readonly focus?: PictureFocus } | null,
  closeGlyph: ControlGlyph | undefined,
): NonNullable<ModStorePageModel["notice"]> {
  const lines: ModNoticeLineModel[] = MOD_NOTICE_LINES.map((line) => {
    const picture = portraitOf(line.identityId);
    return {
      speaker: line.speaker,
      text: line.text,
      portrait: picture ? { src: picture.src, ...(picture.focus ? { focus: picture.focus } : {}) } : { src: null },
    };
  });
  return { lines, buttons: MOD_NOTICE_BUTTONS, closeGlyph };
}

/**
 * The focus route's order for the stops the page offers (`keys`, in document order, which is the screen's order): a pack's
 * page puts its buttons before its cards (the buttons are what the page is for), the heads-up offers Got it, then Report.
 */
export function modStoreFocusOrder(keys: readonly string[], view: "browse" | "pack" | "notice"): readonly string[] {
  if (view === "notice") return ["close", "report"].filter((key) => keys.includes(key));
  if (view === "browse") return keys;
  const rank = (key: string): number => (key === "back" || key === "about" ? 0 : key.startsWith("action:") ? 1 : 2);
  return keys
    .map((key, index) => ({ key, index }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.index - b.index)
    .map(({ key }) => key);
}
