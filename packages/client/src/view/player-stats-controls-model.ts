/**
 * The controls of Your stats as the page's elements take them (`view/player-stats-page-model.ts`): the filter chips, the
 * Matchups chips, the hero and villain steppers, "Hide hero cards", and Share. Each says what its press means as a
 * `StatsEventDetail`; the scene decides what that does. Pure: the key and pad glyphs come in through `StatsGlyphs`.
 */
import type { ControlGlyph } from "@mc/ui";
import type { StatsChipModel } from "../components/player-stats/mc-stats-chip-row/mc-stats-chip-row.types.js";
import type { StatsControlRow } from "../components/player-stats/mc-stats-controls/mc-stats-controls.types.js";
import { t, type MessageKey } from "../i18n/translate.js";
import { MATCHUP_VIEWS, type MatchupKind, type MatchupView } from "./matchup-grid.js";
import { globalRowFailed, shareLabel, shareLine, sharingOnLabel } from "./global-stats-ui.js";
import type { StatsFilter, HeroCardsView, PlayerStats } from "./player-stats-model.js";
import type { ShortcutId } from "./input-shortcuts.js";

/** The key and pad glyphs a control wears, built by the scene (`dom/control-glyphs.ts`). */
export interface StatsGlyphs {
  /** A shortcut's glyph (LB / RB, X), or none while no keyboard or pad is in use. */
  readonly shortcut: (key: string, ids: readonly ShortcutId[]) => ControlGlyph | undefined;
  /** The LT or RT trigger's glyph on a pad; none on a keyboard. */
  readonly trigger: (key: string, which: "lt" | "rt") => ControlGlyph | undefined;
}

const DIFFICULTY_CHIP: Readonly<Record<NonNullable<StatsFilter["difficulty"]>, MessageKey>> = {
  standard: "stats.difficulty.standard",
  expert: "stats.difficulty.expert",
  extreme: "stats.difficulty.extreme",
};

export interface FilterChips {
  /** A phone's one Filters chip, which takes the right end of the tab row. */
  readonly toggle: StatsChipModel | null;
  /** The filter chips themselves: all of them on a wide screen, those shown while a phone's are open. */
  readonly chips: readonly StatsChipModel[];
}

const chip = (
  key: string,
  label: string,
  selected: boolean,
  action: StatsChipModel["action"],
  glyph?: ControlGlyph,
): StatsChipModel => ({ key, label, selected, action, glyph });

/**
 * The filter chips (all / per hero / per villain / per difficulty): each steps through what your games hold, from All,
 * and Clear puts every one back. On a phone they fold behind one Filters chip.
 */
export function filterChipsOf(
  stats: PlayerStats,
  filter: StatsFilter,
  phone: boolean,
  open: boolean,
  glyphs: StatsGlyphs,
): FilterChips {
  const { heroes, villains, difficulties } = stats.filterOptions;
  const set = filter.hero !== undefined || filter.villain !== undefined || filter.difficulty !== undefined;
  if (heroes.length <= 1 && villains.length <= 1 && !set) return { toggle: null, chips: [] };
  const heroName = heroes.find((h) => h.id === filter.hero)?.name.replace(/ \(.*\)$/, "");
  const chips: StatsChipModel[] = [
    chip(
      "filter:hero",
      heroName ?? t(phone ? "stats.chip.heroes" : "stats.chip.allHeroes"),
      filter.hero !== undefined,
      { type: "filter", filter: "hero" },
      phone ? undefined : glyphs.shortcut("filter:hero", ["guide"]),
    ),
    chip(
      "filter:villain",
      filter.villain ?? t(phone ? "stats.chip.villains" : "stats.chip.allVillains"),
      filter.villain !== undefined,
      {
        type: "filter",
        filter: "villain",
      },
    ),
    ...(difficulties.length > 1 || filter.difficulty !== undefined
      ? [
          chip(
            "filter:difficulty",
            filter.difficulty
              ? t(DIFFICULTY_CHIP[filter.difficulty])
              : t(phone ? "stats.chip.difficulty" : "stats.chip.allDifficulties"),
            filter.difficulty !== undefined,
            { type: "filter", filter: "difficulty" },
          ),
        ]
      : []),
    ...(set ? [chip("filter:clear", t("stats.chip.clear"), false, { type: "filter", filter: "clear" })] : []),
  ];
  if (!phone) return { toggle: null, chips };
  const count = [filter.hero, filter.villain, filter.difficulty].filter((v) => v !== undefined).length;
  const toggle = chip(
    "filter:toggle",
    `${open ? "▾" : "▸"} ${t("stats.chip.filters")}${count > 0 ? ` · ${count}` : ""}`,
    count > 0,
    { type: "filter", filter: "toggle" },
    glyphs.shortcut("filter:toggle", ["guide"]),
  );
  return { toggle, chips: open ? chips : [] };
}

/** The Matchups tab's chips: which view, which grid, and how it shows. LT and RT pick the grid too. */
export function gridChipsOf(
  phone: boolean,
  wide: boolean,
  view: MatchupView,
  kind: MatchupKind,
  toggles: { readonly counts: boolean; readonly played: boolean; readonly flipped: boolean },
  glyphs: StatsGlyphs,
): readonly StatsChipModel[] {
  const views: readonly StatsChipModel[] =
    phone || wide
      ? MATCHUP_VIEWS.map((v) =>
          chip(`view:${v}`, t(`stats.view.${v}` as MessageKey), view === v, { type: "view", view: v }),
        )
      : [
          // One chip that steps through the views, where four would wrap to another row above the grid.
          chip("view:step", t("stats.chip.viewStep", { view: t(`stats.view.${view}` as MessageKey) }), true, {
            type: "view",
            view: MATCHUP_VIEWS[(MATCHUP_VIEWS.indexOf(view) + 1) % MATCHUP_VIEWS.length]!,
          }),
        ];
  return [
    ...views,
    chip(
      "grid:heroes",
      t("stats.chip.byHero"),
      kind === "heroes",
      { type: "grid", kind: "heroes" },
      phone ? undefined : glyphs.trigger("grid:heroes", "lt"),
    ),
    chip(
      "grid:modulars",
      t("stats.chip.byModular"),
      kind === "modulars",
      { type: "grid", kind: "modulars" },
      phone ? undefined : glyphs.trigger("grid:modulars", "rt"),
    ),
    ...(view === "shelves"
      ? []
      : [chip("grid:counts", t("stats.chip.counts"), toggles.counts, { type: "grid-toggle", toggle: "counts" })]),
    chip("grid:played", t(phone ? "stats.chip.notBeatenShort" : "stats.chip.notBeaten"), toggles.played, {
      type: "grid-toggle",
      toggle: "played",
    }),
    chip("grid:flip", t("stats.chip.flip"), toggles.flipped, { type: "grid-toggle", toggle: "flip" }),
  ];
}

/** Cards by hero's stepper: the previous hero, this one, the next (LT / RT step them too). */
export function heroStepperOf(
  stats: PlayerStats,
  current: HeroCardsView,
  phone: boolean,
  glyphs: StatsGlyphs,
): StatsControlRow {
  const several = stats.heroCards.length > 1;
  const heroName = current.name.replace(/ \(.*\)$/, "");
  const games = current.games.split(" ")[0];
  return {
    kind: "stepper",
    id: "hero-stepper",
    label:
      phone || !several
        ? `${heroName} · ${games}`
        : t("stats.chip.heroOf", {
            name: heroName,
            games: current.games,
            n: stats.heroCards.indexOf(current) + 1,
            total: stats.heroCards.length,
          }),
    prevStop: "hero:previous",
    nextStop: "hero:next",
    nameStop: `hero:${current.identityCardId}`,
    prevAction: { type: "hero-step", direction: -1 },
    nextAction: { type: "hero-step", direction: 1 },
    prevGlyph: glyphs.trigger("hero:previous", "lt"),
    nextGlyph: glyphs.trigger("hero:next", "rt"),
    several,
  };
}

/** The Focus view's stepper, where there is no room for its side list. */
export function focusStepperOf(name: string): StatsControlRow {
  return {
    kind: "stepper",
    id: "focus-stepper",
    label: name,
    prevStop: "focus:previous",
    nextStop: "focus:next",
    nameStop: "focus:name",
    prevAction: { type: "focus-step", direction: -1 },
    nextAction: { type: "focus-step", direction: 1 },
    prevGlyph: undefined,
    nextGlyph: undefined,
    several: true,
  };
}

/** "Hide hero cards", on the tabs that show a hero's own cards among the rest. */
export function hideSignatureRowOf(hidden: boolean): StatsControlRow {
  return {
    kind: "chips",
    id: "hide-signature",
    scroll: false,
    chips: [
      chip("hide-signature", t(hidden ? "stats.chip.cardsHidden" : "stats.chip.hideCards"), hidden, {
        type: "hide-signature",
      }),
    ],
  };
}

/** Everyone's Share my games, or Sharing on. */
export function shareRowOf(sharing: boolean, failed: boolean): StatsControlRow {
  return {
    kind: "share",
    id: "share",
    input: sharing
      ? { kind: "on", label: sharingOnLabel() }
      : {
          kind: "offer",
          chip: chip("share:global", shareLabel(), false, { type: "share" }),
          line: failed ? `${globalRowFailed()} ${shareLine()}` : shareLine(),
        },
  };
}
