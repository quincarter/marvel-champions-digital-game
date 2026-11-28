/** The scenario list as the `mc-scenario-shelves` model: the Random row, and the roster's shelves (or a box opened as a grid). */
import type { ShelfRosterShelf } from "@mc/ui";
import type { ScenarioShelvesModel } from "../../components/scenario-select/mc-scenario-shelves/mc-scenario-shelves.types.js";
import { t, tPlural } from "../../i18n/translate.js";
import { isBuilderTile, type RosterEntry } from "../../view/civil-war-entry.js";
import type { Shelf } from "../../view/roster-shelves.js";
import type { ScenarioTiles } from "./tiles.js";

export interface ShelvesInput {
  readonly shelves: readonly Shelf<RosterEntry>[];
  /** The open box's id, or null on the full shelf list. */
  readonly drilledPack: string | null;
  readonly tiles: ScenarioTiles;
  /** The picked scenario's id, or null before a pick. */
  readonly selectedId: string | null;
}

/** The focus keys the roster marks (`ShelfRosterModel.stops`): `scenario:<id>`, `scenario-shelf:<id>` and `scenario-clear`. */
const STOPS = { entry: "scenario:", fold: "scenario-shelf:", clear: "scenario-clear" } as const;

export function shelvesModelOf(input: ShelvesInput): ScenarioShelvesModel {
  const { shelves, drilledPack, tiles, selectedId } = input;
  const drilled = drilledPack !== null;
  const open = drilled ? shelves.find((s) => s.id === drilledPack) : undefined;
  const shelfModels: ShelfRosterShelf[] = drilled
    ? [
        {
          id: drilledPack,
          title: "",
          count: "",
          cover: null,
          open: undefined,
          seeAll: "",
          items: (open?.items ?? []).map((entry) => tiles.itemOf(entry, selectedId)),
        },
      ]
    : shelves.map((shelf) => {
        const cover = shelf.id === "your-decks" ? null : tiles.coverFor(shelf.id);
        const folded = shelf.collapsed === true;
        return {
          id: shelf.id,
          title: shelf.title,
          count: tPlural("scenario.countCaption", shelf.items.filter((e) => !isBuilderTile(e)).length),
          cover: cover ? { src: cover.tileUrl ?? cover.url, cover: { x: 0.5, y: 0.5 } } : null,
          open: !folded,
          seeAll: t("scenario.seeAll"),
          items: folded ? [] : shelf.items.map((entry) => tiles.itemOf(entry, selectedId)),
        };
      });
  return {
    randomRow: drilled
      ? {
          drillBack: t("scenario.allPacks"),
          title: open?.title ?? "",
          buttons: [{ id: "random-villain", label: t("scenario.randomVillain") }],
        }
      : {
          drillBack: null,
          title: "",
          buttons: [
            { id: "random-box", label: t("scenario.randomBox") },
            { id: "random-scenario", label: t("scenario.randomScenario") },
          ],
        },
    roster: {
      mode: drilled ? "grid" : "shelves",
      shelves: shelfModels,
      cardWidth: 0,
      cardHeight: 0,
      gap: 12,
      contentWidth: 0,
      previousLabel: t("scenario.rowPrevious"),
      nextLabel: t("scenario.rowNext"),
      emptyText: shelves.length === 0 ? t("scenario.noMatches") : null,
      clearLabel: shelves.length === 0 ? t("scenario.clear") : "",
      stops: STOPS,
    },
  };
}

/** Each tile's shelf and place in it, by focus key (`scenario:<id>`), for LT / RT paging. */
export function rowOfKeyOf(
  shelves: readonly Shelf<RosterEntry>[],
  drilledPack: string | null,
): ReadonlyMap<string, { readonly shelfId: string; readonly itemIndex: number }> {
  const out = new Map<string, { shelfId: string; itemIndex: number }>();
  for (const shelf of shelves) {
    if (drilledPack !== null && shelf.id !== drilledPack) continue;
    if (drilledPack === null && shelf.collapsed) continue;
    shelf.items.forEach((entry, itemIndex) =>
      out.set(`scenario:${entry.id as string}`, { shelfId: shelf.id, itemIndex }),
    );
  }
  return out;
}
