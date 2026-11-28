import { gameDeps, gameEncounterSets } from "../../content/game-deps.js";
import { t, tPlural } from "../../i18n/translate.js";
import { detectPlatform } from "../../platform/platform.js";
import { padAvailable } from "../../platform/input-device.js";
import type { SessionState } from "../../store/session-store.js";
import { rulesGlossaryOf } from "../../view/rules-reference.js";
import { scenarioCardListOf } from "../../view/scenario-card-list.js";
import type { RulesTab } from "../../view/rules-layout.js";
import { watchLinkLabelOf } from "../../view/live-watch-ui.js";
import type { RulesSceneData } from "../rules.js";
import { SCENES } from "../keys.js";
import type { QuickReferenceRow } from "./pause-context.types.js";

/** A Quick reference row and what a press on it does (absent: it opens nothing yet). */
export interface QuickEntry extends Omit<QuickReferenceRow, "enabled"> {
  readonly open?: () => void;
}

/** What the rows ask of the Pause scene. */
export interface QuickHost {
  openRules(data: RulesSceneData): void;
  toggleFullGameLog(): void;
  launchOver(key: string, data: object): void;
  launch(key: string, data?: object): void;
  isActive(key: string): boolean;
  /** The rows as the last draw built them (a search result names one by id). */
  quick(): readonly QuickEntry[];
  /** Opens an overlay that does not take Pause's input (Music, Report, a competitive concede). */
  openLauncher(key: string): void;
  logExpanded(): boolean;
  roomChat(): boolean;
  openChat(): void;
  openStats(): void;
  manualAdjustOn(): boolean;
  seatGame(): boolean;
  adjustLabel(): string;
  openManualAdjust(): void;
  watchLinkShown(): boolean;
  linkCopied(): boolean;
  copyWatchLink(): void;
  showHandLabel(): string | null;
  flipShowHand(): void;
}

/** Other words a player might search Pause's Reference rows by. Searched, never drawn. */
export const REFERENCE_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  villainPhase: ["villain turn", "steps", "order", "phase"],
  glossary: ["keywords", "terms", "definitions", "status"],
  cardList: ["encounter sets", "cards", "scenario", "modular"],
  jumpLog: ["history", "log", "undo", "rewind", "jump to a moment", "what happened"],
  settings: ["options", "preferences", "all settings"],
  stats: ["record", "wins", "losses", "win rate"],
  manualAdjust: ["fix", "edit", "change", "override", "health", "threat", "counters", "bug", "misclick"],
  music: ["songs", "soundtrack", "jukebox", "player"],
  report: ["bug", "feedback", "issue", "wrong ruling", "problem"],
  controls: ["controller", "gamepad", "keyboard", "shortcuts", "buttons"],
};

/** The phone's Reference rows: wide mode's menu links straight to Rules reference and Settings instead. */
export function quickEntriesOf(host: QuickHost, game: SessionState["game"]): readonly QuickEntry[] {
  const glossaryCount = game ? rulesGlossaryOf(game, gameDeps()).length : 0;
  const cardListSetCount = game ? scenarioCardListOf(game, gameEncounterSets()).length : 0;
  const chat = host.roomChat();
  const showHand = host.showHandLabel();
  return [
    {
      id: "villainPhase",
      title: t("pause.q.villainPhase.title"),
      detail: t("pause.q.villainPhase.detail"),
      open: () => host.openRules({ initialTab: "villainPhase" satisfies RulesTab }),
    },
    {
      id: "glossary",
      title: t("pause.q.glossary.title"),
      detail: game ? tPlural("pause.q.glossary.count", glossaryCount) : t("pause.noGame"),
      open: () => host.openRules({ initialTab: "glossary" satisfies RulesTab }),
    },
    {
      id: "cardList",
      title: t("pause.q.cardList.title"),
      detail: game ? tPlural("pause.q.cardList.count", cardListSetCount) : t("pause.noGame"),
      open: () => host.openRules({ initialTab: "cardList" satisfies RulesTab }),
    },
    {
      id: "jumpLog",
      title: t("pause.q.log.title"),
      detail: host.logExpanded() ? t("pause.q.log.shown") : t("pause.q.log.detail"),
      open: () => host.toggleFullGameLog(),
    },
    // The Table rows below are only a few of them: the rest are on the standalone Settings screen.
    {
      id: "settings",
      title: t("pause.q.settings.title"),
      detail: t("pause.q.settings.detail"),
      open: () => host.launchOver(SCENES.settings, {}),
    },
    {
      id: "stats",
      title: chat ? t("chat.title") : t("pause.yourStats"),
      detail: chat ? t("chat.pauseDetail") : t("pause.q.stats.detail"),
      open: () => (chat ? host.openChat() : host.openStats()),
    },
    // Only once the player has turned it on in Settings > More > Cheats (the owner, 2026-11-19).
    ...(host.manualAdjustOn()
      ? [
          {
            id: "manualAdjust",
            title: host.adjustLabel(),
            detail: host.seatGame() ? t("ask.changeDetail") : t("pause.q.adjust.detail"),
            open: () => host.openManualAdjust(),
          },
        ]
      : []),
    {
      id: "music",
      title: t("pause.music"),
      detail: t("pause.q.music.detail"),
      compact: true as const,
      open: () => host.openLauncher(SCENES.musicPlayer),
    },
    {
      id: "report",
      title: t("pause.report"),
      detail: t("pause.q.report.detail"),
      compact: true as const,
      open: () => host.openLauncher(SCENES.reportIssue),
    },
    // The live room's link (#876), only while one is open: a compact cell beside Music and Report.
    ...(host.watchLinkShown()
      ? [
          {
            id: "watch-link",
            title: watchLinkLabelOf(host.linkCopied(), true),
            detail: t("live.copyLink"),
            compact: true as const,
            open: () => host.copyWatchLink(),
          },
        ]
      : []),
    ...(showHand
      ? [
          {
            id: "show-hand",
            title: showHand,
            detail: showHand,
            // Its own full-width row in the expanded Quick reference: a fifth compact cell cannot hold "Mostrar mano".
            open: () => host.flipShowHand(),
          },
        ]
      : []),
    // The phone apps show Controls only once a controller is connected (the owner, 2026-10-24).
    ...(detectPlatform() !== "capacitor" || padAvailable()
      ? [
          {
            id: "controls",
            title: t("pause.q.controls.title"),
            detail: t("pause.q.controls.detail"),
            compact: true as const,
            open: () => host.launch(SCENES.controls),
          },
        ]
      : []),
  ];
}

/** The rows as the page's context wants them. */
export const quickRowsOf = (entries: readonly QuickEntry[]): readonly QuickReferenceRow[] =>
  entries.map(({ open, ...row }) => ({ ...row, enabled: open !== undefined }));
