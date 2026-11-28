/**
 * The Title page's input (`views/title/mc-title-page`) as plain data, built from the facts the scene gathers (saves, the
 * rank, the update state, the input device) and the app's own words. No Phaser, no DOM: the scene supplies the facts and
 * the glyph lookup, this words and orders them. Layout is the page's CSS; nothing here knows a rect.
 */
import type { ControlGlyph, SvgOp } from "@mc/ui";
import type { TitleBannerInput } from "../components/title/mc-title-banner/mc-title-banner.types.js";
import type { TitleGamesInput } from "../components/title/mc-title-games/mc-title-games.types.js";
import type { TitleIconButton } from "../components/title/mc-title-icon-row/mc-title-icon-row.types.js";
import type {
  TitleMenuRow,
  TitleRowIcon,
} from "../components/title/mc-title-menu-button/mc-title-menu-button.types.js";
import type { TitleMode } from "../components/title/shared/title.types.js";
import type { TitlePageInput } from "../views/title/mc-title-page/mc-title-page.types.js";
import type { TitlePromoInput } from "../components/title/mc-title-promo/mc-title-promo.types.js";
import type { TitleRankInput } from "../components/title/mc-title-rank/mc-title-rank.types.js";
import { t } from "../i18n/translate.js";
import { typeRole } from "../tokens.js";
import { ICON_GRID, playPlatformMarkOf, type PlayPlatformMark } from "./play-platform-mark.js";
import { BETA_TAG_TEXT, SHOW_BETA_TAGS } from "./beta-tag.js";
import { badgeTextOf } from "../packs/pack-updates.js";
import { liveCountOf } from "./title-online-panel.js";
import type { GameRow } from "./games-list-model.js";
import type { TitleRankBadge } from "./title-rank-badge.js";

/** A control's key or pad glyph: `undefined` while a touch screen or a mouse is the input. */
export type GlyphFor = (
  key: string,
  ids: readonly ("activate" | "expand" | "cancel")[],
  ground: "ink" | "paper",
  controlHeight: number,
  place?: "inside" | "left",
) => ControlGlyph | undefined;

export interface TitleFacts {
  readonly mode: TitleMode;
  /** A game is being resumed: Continue, New game and the games list are drawn unavailable. */
  readonly starting: boolean;
  /** Continue: the label (a built game names its stages and sets) and where the game was last played. */
  readonly continue: { readonly label: string; readonly mark: PlayPlatformMark | null } | null;
  /** The games the list shows (none when Continue already is the only one). */
  readonly games: readonly GameRow[];
  /** The games as the art column's panel (a wide screen), else as a menu row that opens the list. */
  readonly gamesPanel: boolean;
  readonly removing: string | null;
  readonly removeBusy: boolean;
  readonly removeError: string | null;
  readonly civilWar: { readonly label: string } | null;
  readonly quit: boolean;
  /** Where the Play online panel stands: beside the menu, over the art, or none (a phone: a menu button). */
  readonly promo: "side" | "art" | "none";
  readonly online: { readonly available: boolean; readonly liveCount: number | null };
  readonly packUpdates: number;
  readonly notice: { readonly version: string } | null;
  readonly banner: TitleBannerInput | null;
  readonly rank: TitleRankBadge;
  readonly rankUp: string | null;
  readonly footer: {
    readonly cards: string;
    readonly version: string;
    readonly discordLink: boolean;
    readonly aside: string | null;
  };
  readonly status: string | null;
  readonly problem: string | null;
  readonly focused: string | null;
  readonly theme: "moon" | "sun";
  readonly languageCode: string;
  readonly languageOpen: boolean;
  readonly musicOpen: boolean;
  /** The store and Discord icons in the top row (a wide screen: a phone has the menu item and the footer link). */
  readonly topRowExtras: boolean;
  readonly glyph: GlyphFor;
}

/** A platform mark's shapes as drawing ops in its own 24-unit grid, painted in the row text colour. */
export function platformIconOps(mark: PlayPlatformMark): readonly SvgOp[] {
  const ink = "currentColor";
  return mark.shapes.map((shape): SvgOp => {
    switch (shape.kind) {
      case "ring":
        return { k: "circle", cx: shape.cx, cy: shape.cy, r: shape.r, stroke: ink, sw: shape.w };
      case "ellipse":
        // An ellipse as two arcs: the ops have no ellipse.
        return {
          k: "path",
          d: `M${shape.cx - shape.rx} ${shape.cy}a${shape.rx} ${shape.ry} 0 1 0 ${shape.rx * 2} 0a${shape.rx} ${shape.ry} 0 1 0 ${-shape.rx * 2} 0`,
          stroke: ink,
          sw: shape.w,
        };
      case "line":
        return { k: "line", x1: shape.x1, y1: shape.y1, x2: shape.x2, y2: shape.y2, stroke: ink, sw: shape.w };
      case "box":
        return { k: "rect", x: shape.x, y: shape.y, w: shape.width, h: shape.height, stroke: ink, sw: shape.w };
      case "fillBox":
        return { k: "rect", x: shape.x, y: shape.y, w: shape.width, h: shape.height, fill: ink };
      case "dot":
        return { k: "circle", cx: shape.cx, cy: shape.cy, r: shape.r, fill: ink };
    }
  });
}

/** A mark as the row draws it. */
export const rowIconOf = (mark: PlayPlatformMark): TitleRowIcon => ({
  grid: ICON_GRID,
  ops: platformIconOps(mark),
  label: mark.label,
});

/** The rank card's words: a full card stacks the rank over its name; a phone strip puts them on one line. */
export function rankInputOf(badge: TitleRankBadge, up: string | null, compact: boolean): TitleRankInput {
  const name = up ? up.replace(/^Rank up: /, "") : badge.title;
  const rankUp = t("title.rankUp");
  return {
    compact,
    up: up !== null,
    label: compact
      ? up
        ? `${rankUp} · ${name}`
        : `${badge.rankLabel} · ${badge.title}`
      : up
        ? rankUp
        : badge.rankLabel,
    title: name,
    points: up ? null : badge.pointsLabel,
    next: up ? null : badge.nextLabel,
    fraction: badge.fraction,
    summary: badge.summary,
  };
}

/** The Play online panel's words (`view/title-online-panel.ts` placed it; the page does now). */
export function promoInputOf(variant: "side" | "art", online: TitleFacts["online"]): TitlePromoInput {
  const count = online.available ? liveCountOf(online.liveCount) : null;
  return {
    variant,
    title: t("title.playOnline"),
    pitch: online.available ? t("title.online.pitch") : t("title.online.offline"),
    live: count !== null ? t("title.online.live", { count }) : null,
    host: t("online.host"),
    join: t("online.join"),
    available: online.available,
  };
}

/** The games panel of a wide Title. */
export function gamesInputOf(facts: TitleFacts): TitleGamesInput {
  const rows = facts.games;
  const confirming = facts.removing === null ? null : (rows.find((row) => row.id === facts.removing) ?? null);
  return {
    heading: t("title.games.heading", { count: rows.length }),
    ...(SHOW_BETA_TAGS ? { tag: BETA_TAG_TEXT } : {}),
    hint: facts.glyph("games-panel", ["expand"], "ink", 36, "left"),
    rows: rows.map((row) => {
      const mark = playPlatformMarkOf(row.save.lastPlayedOn);
      return {
        id: row.id,
        title: row.title,
        detail: [row.kicker, row.detail].filter((part): part is string => part !== null).join(" · "),
        ...(mark ? { icon: rowIconOf(mark) } : {}),
        needsUpdate: row.needsUpdate ? t("title.games.needsUpdate") : null,
        resume: t("title.games.resume"),
        watch: t("gamesList.watch"),
        remove: t("title.games.remove"),
      };
    }),
    confirming: confirming
      ? {
          id: confirming.id,
          title: confirming.title,
          message: t("title.games.confirm"),
          keep: t("title.games.keep"),
          remove: t("title.games.remove"),
          error: facts.removeError,
          keepGlyph: facts.glyph("remove-keep", ["cancel"], "ink", 44),
        }
      : null,
    enabled: !facts.starting && !facts.removeBusy,
  };
}

/** The top row of chrome buttons, left to right as drawn. */
export function iconButtonsOf(facts: TitleFacts): readonly TitleIconButton[] {
  const hung = (key: string): ControlGlyph | undefined =>
    facts.focused === key ? facts.glyph(key, ["activate"], facts.mode === "phone" ? "ink" : "paper", 44) : undefined;
  const button = (b: Omit<TitleIconButton, "glyph">): TitleIconButton => {
    const glyph = hung(b.key);
    return glyph ? { ...b, glyph } : b;
  };
  return [
    ...(facts.topRowExtras
      ? [
          button({
            key: "chrome:mod-store",
            icon: "store",
            name: t("title.icon.store"),
            ...(facts.packUpdates > 0 ? { badge: badgeTextOf(facts.packUpdates) } : {}),
          }),
          button({ key: "chrome:discord", icon: "discord", name: t("title.icon.discord") }),
        ]
      : []),
    button({ key: "chrome:theme", icon: facts.theme, name: t("title.icon.theme") }),
    button({
      key: "chrome:language",
      icon: "globe",
      name: t("title.icon.language"),
      label: facts.languageCode,
      lit: facts.languageOpen,
    }),
    button({ key: "chrome:music", icon: "note", name: t("title.icon.music"), lit: facts.musicOpen }),
    button({ key: "chrome:report", icon: "bug", name: t("title.icon.report") }),
  ];
}

/** The menu's rows in reading order; a half row sits beside the next half row. */
export function menuRowsOf(facts: TitleFacts): readonly TitleMenuRow[] {
  const phone = facts.mode === "phone";
  const kind = phone ? "onInk" : "secondary";
  const size = typeRole.menuButton.size;
  const row = (key: string, label: string, extra: Partial<TitleMenuRow> = {}): TitleMenuRow => ({
    key,
    label,
    kind,
    width: "full",
    plain: true,
    size,
    ...extra,
  });
  const half = { width: "half" } as const;
  const rows: TitleMenuRow[] = [];
  if (facts.continue) {
    const { label, mark } = facts.continue;
    rows.push(
      row("continue", label, {
        kind: "primary",
        tall: true,
        wrap: true,
        disabled: facts.starting,
        ...(mark ? { icon: rowIconOf(mark) } : {}),
      }),
    );
  }
  if (!facts.gamesPanel && facts.games.length > 0) {
    const glyph = facts.glyph("games-row", ["expand"], "ink", 44);
    rows.push(
      row("games-row", t("title.gamesRow", { count: facts.games.length }), {
        disabled: facts.starting,
        ...(SHOW_BETA_TAGS ? { tag: BETA_TAG_TEXT } : {}),
        ...(glyph ? { glyph } : {}),
      }),
    );
  }
  rows.push(
    row("new-game", facts.starting ? t("title.starting") : t("title.newGame"), {
      kind: "primary",
      tall: true,
      plain: false,
      display: true,
      size: typeRole.barTitle.size,
      disabled: facts.starting,
    }),
    row("decks", t("title.decks")),
  );
  // A phone: Campaign and Play online share a row. A wide screen has the Play online panel, and Campaign takes the row.
  if (facts.promo === "none") {
    rows.push(row("campaign", t("title.campaign"), half), row("play-online", t("title.playOnline"), half));
  } else rows.push(row("campaign", t("title.campaign")));
  if (facts.civilWar) rows.push(row("civil-war", facts.civilWar.label));
  rows.push(
    row("extras", t("title.extras"), half),
    row("past-games", t("title.pastGames"), half),
    row("trophies", t("title.trophyRoom"), half),
    row("stats", t("title.yourStats"), half),
    row("how-to-play", t("title.howToPlay"), half),
    row("mod-store", t("title.modStore"), {
      ...half,
      ...(facts.packUpdates > 0 ? { badge: badgeTextOf(facts.packUpdates) } : {}),
    }),
    row("settings", t("title.settings")),
  );
  if (facts.quit) rows.push(row("quit", t("title.quit")));
  return rows;
}

/** The whole page's input. */
export function titlePageInputOf(facts: TitleFacts): TitlePageInput {
  const phone = facts.mode === "phone";
  const noticeGlyph =
    facts.focused === "release-notice" ? facts.glyph("release-notice", ["activate"], "ink", 18) : undefined;
  return {
    notice: facts.notice
      ? {
          tag: t("title.news.tag"),
          message: t("title.news.text", { version: facts.notice.version }),
          link: t("title.news.link"),
          linkShort: t("title.news.linkShort"),
          glyph: noticeGlyph,
        }
      : null,
    logo: { eyebrow: t("title.eyebrow") },
    icons: { buttons: iconButtonsOf(facts) },
    banner: facts.banner,
    menu: { rows: menuRowsOf(facts) },
    games: facts.gamesPanel && facts.games.length > 0 ? gamesInputOf(facts) : null,
    promo: facts.promo === "none" ? null : promoInputOf(facts.promo, facts.online),
    rank: rankInputOf(facts.rank, facts.rankUp, phone),
    footer: {
      note: facts.footer.cards,
      version: facts.footer.version,
      links: [
        ...(facts.footer.discordLink ? [{ key: "discord", label: "Discord ↗" }] : []),
        { key: "release-notes", label: t("title.releaseNotes") },
      ],
      aside: facts.footer.aside,
    },
    status: facts.status ? { text: facts.status, kind: "status" } : null,
    problem: facts.problem ? { text: facts.problem, kind: "problem" } : null,
  };
}
