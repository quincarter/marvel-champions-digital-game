/**
 * Extras' page model (`views/extras/mc-extras-page`), as plain data from what is open, the music controller and the
 * settings. No Phaser here: the scene hands in what it knows (the sizes, the glyphs, the bar's clearance).
 */
import type { ControlGlyph, HintGlyph } from "@mc/ui";
import type { ExtrasTile } from "../../components/extras/mc-extras-shelf/mc-extras-shelf.types.js";
import type { ExtrasTrackItem } from "../../components/extras/mc-extras-tracks/mc-extras-tracks.types.js";
import type { ExtrasPlayerModel } from "../../components/extras/mc-extras-player/mc-extras-player.types.js";
import { PROMO_SETS } from "../../art/promo-art.js";
import { t } from "../../i18n/translate.js";
import type { Extras, ExtrasTab } from "../../progression/extras.js";
import { appSession } from "../../session.js";
import { extrasSummaryOf, extrasTabsOf, extrasTilesOf, type ExtrasTileView } from "../../view/extras-model.js";
import { earnedSongsOf, nowPlayingTitleOf } from "../../view/music-player.js";
import type { ExtrasPageModel } from "../../views/extras/mc-extras-page/mc-extras-page.types.js";

/** A rail with eight tabs and the doors beside it needs this much width to print every tab whole. */
export const DOORS_BESIDE_MIN = 1400;

export interface ExtrasModelInput {
  readonly extras: Extras;
  readonly tab: ExtrasTab;
  readonly width: number;
  readonly phone: boolean;
  /** The Music tab's slider shows (a desktop form factor). */
  readonly withSlider: boolean;
  readonly volume: number;
  readonly backGlyph: HintGlyph | null;
  readonly tabsHint: ControlGlyph | undefined;
  readonly clearance: { readonly drop: number; readonly maxRight: number };
  /** The tile views of this draw come back so the scene can answer a tap by id. */
  readonly onViews: (views: readonly ExtrasTileView[]) => void;
}

const PORTRAIT_TABS: ReadonlySet<ExtrasTab> = new Set(["heroes", "villains", "promos"]);

function tileOf(view: ExtrasTileView, tab: ExtrasTab): ExtrasTile {
  const set = tab === "promos" ? PROMO_SETS.find((one) => `promo:${one.id}` === view.id) : undefined;
  return {
    id: view.id,
    card: {
      src: view.thumb?.url ?? null,
      focusY: PORTRAIT_TABS.has(tab) ? 0.2 : 0.4,
      // Locked: a gray ghost of the picture on the ink ground, so the shelf shows what there is to earn.
      dim: !view.open,
      chip: view.open ? `${view.action} ▸` : t("extras.locked"),
      chipTone: view.open ? "action" : "locked",
      title: view.title,
      detail: view.open ? view.subtitle : (view.hint ?? ""),
      detailTone: view.open ? "meta" : "alert",
      initial: view.title.charAt(0).toUpperCase(),
    },
    ...(set ? { cardId: set.cardId, promoSetId: set.id } : {}),
  };
}

function trackOf(view: ExtrasTileView, playing: string | null): ExtrasTrackItem {
  const content = view.entry.content;
  const isPlaying = content.kind === "track" && playing === content.track.key;
  return {
    id: view.id,
    row: {
      leading: isPlaying ? "■" : "▶",
      title: view.title,
      detail: view.open
        ? isPlaying
          ? t("extras.nowPlaying", { detail: view.subtitle })
          : view.subtitle
        : (view.hint ?? ""),
      open: view.open,
      active: isPlaying,
    },
  };
}

function playerOf(input: ExtrasModelInput): ExtrasPlayerModel {
  const session = appSession();
  const music = session.music;
  const playing = music?.nowPlaying() ?? null;
  const songs = earnedSongsOf(input.extras);
  const shuffle = session.settings.musicShuffle;
  const paused = music?.paused() ?? false;
  const song = playing ? songs.find((one) => one.track.key === playing.key) : undefined;
  const mode = shuffle ? t("music.shuffling") : song ? t("music.repeating") : t("music.screenOwn");
  const earnFirst = songs.length === 0 ? t("music.earnFirst") : undefined;
  return {
    status: playing ? (paused ? t("music.paused") : t("music.nowPlaying")) : t("music.nothingPlaying"),
    title: playing ? nowPlayingTitleOf(playing).toUpperCase() : null,
    detail: playing ? (song ? `${mode} · ${song.where}` : mode) : null,
    shuffle: {
      key: "player:shuffle",
      label: shuffle ? t("music.shuffleOn") : t("music.shuffleOff"),
      kind: "secondary",
      selected: shuffle,
      ...(earnFirst ? { disabled: earnFirst } : {}),
    },
    next: {
      key: "player:next",
      label: t("music.next"),
      kind: "secondary",
      ...(earnFirst ? { disabled: earnFirst } : {}),
    },
    pause: {
      key: "player:pause",
      label: paused ? t("music.play") : t("music.pause"),
      kind: "secondary",
      selected: paused,
    },
    volume: input.withSlider ? { value: input.volume, label: `${input.volume}%`, stepLabels: ["−", "+"] } : null,
  };
}

export function extrasPageModelOf(input: ExtrasModelInput): ExtrasPageModel {
  const { extras, tab, phone } = input;
  const views = extrasTilesOf(extras, tab, appSession().settings.promoArt);
  input.onViews(views);
  const back = phone ? "◂" : t("extras.back");
  const music = tab === "music";
  const playing = appSession().music?.nowPlaying()?.key ?? null;
  return {
    phone,
    stackDoors: phone || input.width < DOORS_BESIDE_MIN,
    bar: {
      backLabel: back,
      title: t("title.extras"),
      right: extrasSummaryOf(extras),
      backGlyph: input.backGlyph,
      titleDrop: input.clearance.drop,
      titleMaxRight: input.clearance.maxRight,
    },
    doors: { trophies: phone ? t("extras.trophies") : `${t("title.trophyRoom")} ▸`, credits: t("extras.credits") },
    tabs: {
      tabs: extrasTabsOf(extras).map((one) => ({ id: one.id, label: phone ? one.name : one.label })),
      selected: tab,
      size: 0,
      hint: input.tabsHint,
    },
    player: music ? playerOf(input) : null,
    shelf: music
      ? null
      : {
          shape: tab === "promos" ? "card" : PORTRAIT_TABS.has(tab) ? "portrait" : "landscape",
          tiles: views.map((view) => tileOf(view, tab)),
          empty: t("extras.empty"),
        },
    tracks: music ? { tracks: views.map((view) => trackOf(view, playing)), empty: t("extras.empty") } : null,
  };
}
