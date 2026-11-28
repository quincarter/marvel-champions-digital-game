/**
 * The tiles of Choose a scenario's shelves as `mc-shelf-roster` items: a scenario's picture (a pack's own, else the villain's
 * scene art at roster size, else its stage-I card scan), its caption, lock and selection, and the "Build your own" tile.
 */
import type { PictureSource, ShelfRosterItem } from "@mc/ui";
import { currentCardsById, currentEncounterSets, currentScenarios, isPackScenario } from "../../content/pool.js";
import { PackLeases, packPictureFor } from "../../art/pack-art.js";
import { artFor, artLanguageNow } from "../../art/art-source.js";
import { ART_CATALOG, packCoverFor, villainArtFor } from "../../art/scenario-art.js";
import type { Picture } from "../../art/pictures.js";
import { customBadge } from "../../view/custom-content.js";
import { isBuilderTile, isCivilWarScenario, type RosterEntry } from "../../view/civil-war-entry.js";
import { hasRandomChosenVillain } from "../../view/random-villain.js";
import { lockCaptionOf, scenarioDetailOf, shelfSubtitleOf } from "../../view/scenario-detail.js";
import { unlocks } from "../../progression/progression.js";
import { unlockCostOf } from "../unlock-confirm.js";
import { t } from "../../i18n/translate.js";
import type { Scenario } from "@mc/content";

/** One tile's face for the hover popover and Inspect: the villain's stage I, or the main scheme when the villain is drawn at random. */
export function faceOfScenario(s: Scenario): unknown {
  const unknown = hasRandomChosenVillain(s);
  if (unknown) return { kind: "mainSchemeStage", stageIndex: 0, side: "A" } as const;
  const card = currentCardsById().get(s.villainCardId as string);
  return card?.type === "villain"
    ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const)
    : ({ kind: "hero" } as const);
}

export interface TileDebug {
  readonly id: string;
  readonly title: string;
  readonly villainArt: boolean;
  readonly baked: boolean;
}

export class ScenarioTiles {
  readonly leases = new PackLeases();
  readonly #art = new Map<string, Picture | null>();
  readonly #covers = new Map<string, Picture | null>();
  /** Dev e2e hook only: every tile drawn so far. */
  readonly debug = new Map<string, TileDebug>();

  villainArtFor(scenario: Scenario): Picture | null {
    const id = scenario.id as string;
    if (!this.#art.has(id)) this.#art.set(id, villainArtFor(ART_CATALOG, id));
    return this.#art.get(id) ?? null;
  }

  coverFor(packCode: string): Picture | null {
    if (!this.#covers.has(packCode)) this.#covers.set(packCode, packCoverFor(ART_CATALOG, packCode));
    return this.#covers.get(packCode) ?? null;
  }

  /** A tile's picture: a pack's own, else the villain's scene art (its roster-size copy), else its stage-I card scan. */
  #pictureOf(s: Scenario, custom: boolean): PictureSource {
    const crop = { x: 0.5, y: 0 } as const;
    if (custom) {
      const held = this.leases.image(packPictureFor("villain", s.villainCardId as string));
      return { src: held.src, cover: crop, ...(held.retry !== undefined ? { retry: held.retry } : {}) };
    }
    const art = this.villainArtFor(s);
    if (art) {
      const focus = art.focus;
      return {
        src: art.tileUrl ?? art.url,
        cover: focus?.y !== undefined ? { x: focus.x ?? 0.5, y: focus.y, centered: true } : crop,
      };
    }
    const villainCard = hasRandomChosenVillain(s) ? undefined : currentCardsById().get(s.villainCardId as string);
    if (!villainCard) return { src: null, cover: crop };
    const held = this.leases.image(artFor(villainCard, { kind: "villainStage", sideIndex: 0, stageIndex: 0 }));
    return { src: held.src, cover: crop, ...(held.retry !== undefined ? { retry: held.retry } : {}) };
  }

  /** One roster entry as a tile; `selectedId` is the picked scenario's id, or null before a pick. */
  itemOf(entry: RosterEntry, selectedId: string | null): ShelfRosterItem {
    if (isBuilderTile(entry)) return this.#builderItem(entry.id as string);
    const s = entry;
    const custom = isPackScenario(s.id as string);
    const picture = this.#pictureOf(s, custom);
    const detail = scenarioDetailOf(s, currentCardsById(), currentEncounterSets(), artLanguageNow());
    const selected = selectedId === (s.id as string);
    // A locked scenario stays selectable, so its stages can be read ahead of time; only "Choose heroes" refuses it.
    const lock = unlocks().scenarioLock(s);
    // A pack's scenario says so in words, beside SELECTED when both apply.
    const tag = lock
      ? t("scenario.locked")
      : [custom ? customBadge() : null, selected ? t("scenario.selected") : null].filter(Boolean).join(" · ");
    if (import.meta.env.DEV) {
      this.debug.set(s.id as string, {
        id: s.id as string,
        title: detail.tileTitle,
        villainArt: !custom && this.villainArtFor(s) !== null,
        baked: picture.src !== null,
      });
    }
    const unknown = hasRandomChosenVillain(s);
    return {
      id: s.id as string,
      cardId: (unknown ? s.mainSchemeCardId : s.villainCardId) as string,
      face: faceOfScenario(s),
      picture,
      selected,
      inspect: true,
      card: {
        src: null,
        focusY: 0,
        dim: lock !== null,
        chip: tag,
        chipTone: lock ? "locked" : "action",
        title: detail.tileTitle,
        titleDisplay: true,
        detail: lock
          ? lockCaptionOf(
              unlocks().scenarioLockShort(s) ?? lock,
              unlockCostOf({ kind: "scenario", scenarioId: s.id as string }),
            )
          : shelfSubtitleOf(detail),
        detailLines: 2,
        detailTone: lock ? "alert" : "meta",
        initial: detail.tileTitle.slice(0, 1).toUpperCase(),
        captionHeight: 76,
      },
    };
  }

  /** The "Build your own" tile: the box cover (Captain America against Iron Man over the flag, which says "pick a side"). */
  #builderItem(id: string): ShelfRosterItem {
    const civilWar = currentScenarios().find((s) => isCivilWarScenario(s));
    const cover = civilWar ? this.coverFor(civilWar.packCode as string) : null;
    return {
      id,
      cardId: "",
      picture: { src: cover ? (cover.tileUrl ?? cover.url) : null, cover: { x: 0.5, y: 0.25 } },
      selected: false,
      inspect: false,
      card: {
        src: null,
        focusY: 0,
        dim: false,
        chip: t("scenario.builder"),
        chipTone: "action",
        title: t("scenario.buildYourOwnTitle"),
        titleDisplay: true,
        detail: t("scenario.buildYourOwnSubtitle"),
        detailLines: 2,
        detailTone: "meta",
        initial: "+",
        captionHeight: 76,
      },
    };
  }
}
