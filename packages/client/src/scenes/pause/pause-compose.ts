import type {
  PauseChoiceInput,
  PauseLinkInput,
  PauseLogInput,
  PauseMenuItem,
  PausePageModel,
  PauseResultRow,
  PauseResultsInput,
  PauseSwitchInput,
} from "../../components/pause/pause.types.js";
import { t } from "../../i18n/translate.js";
import { logLineWords } from "../../view/pause-log-window.js";
import { groupPauseResults } from "../../view/pause-search.js";
import { pauseFocusOrder } from "../../view/screen-focus.js";
import { guideRowDetailOf, type GuideRowInfo } from "../../view/settings-rows.js";
import type { SettingsSearchResult } from "../../view/settings-search.js";
import type { PauseContext } from "./pause-context.types.js";

/** Below this width there is no room for the two panels side by side, and Pause is the phone's single ink sheet. */
export const PAUSE_PHONE_MAX_WIDTH = 700;

export const pauseModeOf = (width: number): "wide" | "phone" => (width < PAUSE_PHONE_MAX_WIDTH ? "phone" : "wide");

/** The retained log's newest lines shown: a long game keeps hundreds, and the box scrolls through them. */
const LOG_LINES_SHOWN = 400;

const STATUS_TONES: ReadonlySet<string> = new Set(["stunned", "confused", "tough"]);

type NonLevelGuideRow = Exclude<GuideRowInfo, { kind: "segmented" }>;

export interface ComposedPause {
  readonly model: PausePageModel;
  /** The focus route's order: the stop keys, front to back. Keys not drawn are skipped by the route. */
  readonly order: readonly string[];
}

function wideMenu(c: PauseContext): PauseMenuItem[] {
  const onInk = (id: PauseMenuItem["id"], label: string, span: 1 | 2 = 2, more: Partial<PauseMenuItem> = {}) => ({
    id,
    label,
    kind: "onInk" as const,
    span,
    ...more,
  });
  return [
    {
      id: "resume",
      label: t("pause.resume"),
      kind: "primary",
      span: 2,
      ...(c.cancelGlyph ? { glyph: c.cancelGlyph } : {}),
    },
    onInk("full-game-log", t("pause.fullGameLog"), 2, { selected: c.logExpanded }),
    onInk("rules-reference", t("pause.rulesReference")),
    onInk("settings", t("settings.title"), 1),
    // A room game's chat takes the stats slot: its stop keeps the id, so the focus route is the same (#881).
    onInk("stats", c.roomChat ? t("chat.open") : t("pause.yourStats"), 1),
    onInk("save-quit", c.quitLabel),
    onInk("music", t("pause.music"), 1),
    onInk("report", t("pause.report"), 1),
    ...(c.watchLinkLabel ? [onInk("watch-link", c.watchLinkLabel)] : []),
    ...(c.showHandLabel ? [onInk("show-hand", c.showHandLabel)] : []),
    ...(c.guidedRunActive
      ? [
          onInk("guide-stop-tutorial", t("pause.stopTutorial"), 1),
          onInk("guide-turn-guide-off", t("pause.turnGuideOff"), 1),
        ]
      : []),
    // Off unless the player turned it on in Settings > More > Cheats (the owner, 2026-11-19).
    ...(c.manualAdjustOn ? [onInk("manual-adjust", c.adjustLabel, 2, { foot: true })] : []),
    onInk("concede", t("pause.concede"), 2, { foot: true }),
  ];
}

function phoneFooter(c: PauseContext): PauseMenuItem[] {
  return [
    { id: "resume", label: t("pause.resume"), kind: "primary", span: 2 },
    { id: "save-quit", label: c.quitLabel, kind: "onInk", span: 1 },
    { id: "concede", label: t("pause.concede"), kind: "onInk", span: 1 },
  ];
}

function linkOf(row: PauseContext["quickRows"][number]): PauseLinkInput {
  return {
    stop: `quick:${row.id}`,
    title: row.title,
    detail: row.unavailable ?? row.detail,
    variant: row.compact ? "compact" : "panel",
    ...(row.enabled ? {} : { disabled: true }),
    action: { type: "quick", id: row.id },
  };
}

const switchState = (on: boolean, unavailable: boolean): string =>
  unavailable ? "—" : on ? t("settings.toggleOn") : t("settings.toggleOff");

function guideSwitch(row: NonLevelGuideRow): PauseSwitchInput {
  const unavailable = row.kind === "action" && row.unavailable !== undefined;
  return {
    stop: `guide:${row.id}`,
    title: row.title,
    detail: guideRowDetailOf(row),
    state: unavailable ? "—" : row.kind === "toggle" ? switchState(row.on, false) : t("settings.open"),
    on: row.kind === "toggle" && row.on,
    unavailable,
    action: { type: "guide", id: row.id },
  };
}

function logOf(c: PauseContext): PauseLogInput {
  return {
    title: c.logExpanded ? t("pause.fullGameLog") : t("pause.jump"),
    note: c.logExpanded ? t("pause.fullLogNote") : "",
    empty: t("pause.logEmpty"),
    hint: c.undoable.size > 0 ? t("pause.logUndoHint") : t("pause.logUndoNone"),
    lines: [...c.logLines]
      .reverse()
      .slice(0, LOG_LINES_SHOWN)
      .map((line) => ({
        id: line.id,
        ref: line.ref,
        words: logLineWords(line),
        stop: c.undoable.has(line.id) ? `moment:${line.id}` : null,
      })),
  };
}

/** The results rows, and the stop keys they draw in order. */
function resultsOf(c: PauseContext): { readonly input: PauseResultsInput; readonly stops: readonly string[] } | null {
  if (!c.searching) return null;
  if (c.results === null) return { input: { note: t("pause.searching"), groups: [] }, stops: [] };
  const query = c.query.trim();
  const rowsById = new Map(c.settingRows.map((row) => [row.id as string, row]));
  const stops: string[] = [];
  const rowOf = (result: SettingsSearchResult): PauseResultRow => {
    const { entry } = result;
    const target = entry.target;
    const setting = target.kind === "setting" ? rowsById.get(target.item) : undefined;
    if (setting && setting.control.kind === "toggle") {
      const unavailable = setting.control.unavailable !== undefined;
      stops.push(`result:${setting.id}`);
      return {
        kind: "switch",
        row: {
          stop: `result:${setting.id}`,
          title: setting.title,
          detail: setting.detail,
          state: switchState(setting.control.on, unavailable),
          on: setting.control.on && !unavailable,
          unavailable,
          action: { type: "setting", id: setting.id },
        },
      };
    }
    if (setting && setting.control.kind === "choice") {
      const control = setting.control;
      const choice: PauseChoiceInput = {
        title: setting.title,
        detail: setting.detail,
        look: "cell",
        options: control.options.map((option) => {
          const stop = `result:${setting.id}:${option.value}`;
          stops.push(stop);
          return {
            stop,
            label: option.label,
            selected: control.selected === option.value,
            action: { type: "setting", id: setting.id, value: option.value },
          };
        }),
      };
      return { kind: "choice", row: choice };
    }
    stops.push(`result:${entry.id}`);
    return {
      kind: "link",
      row: {
        stop: `result:${entry.id}`,
        title: entry.title,
        detail: entry.detail,
        place: entry.place,
        variant: "result",
        titleRanges: result.titleRanges,
        detailRanges: result.detailRanges,
        action: { type: "result", id: entry.id },
      },
    };
  };
  const groups = groupPauseResults(c.results).map((group) => {
    const rows = group.results.map(rowOf);
    // The Rules group ends with the way into the full glossary, filtered to what is typed.
    if (group.id === "rules")
      rows.push(
        rowOf({
          entry: {
            id: "pause-glossary-search",
            title: t("pause.glossarySearch", { query }),
            detail: t("pause.glossarySearchDetail"),
            place: t("pause.rulesReference"),
            target: { kind: "rules", tab: "glossary", query },
          },
          titleRanges: [],
          detailRanges: [],
        }),
      );
    return { title: group.title, rows };
  });
  return { input: { note: c.results.length === 0 ? t("pause.noMatch") : "", groups }, stops };
}

/** The Pause page's model, and the focus route's order, from what the scene gathered. */
export function composePause(c: PauseContext): ComposedPause {
  const phone = c.mode === "phone";
  const results = resultsOf(c);
  const quickRows = c.quickExpanded ? c.quickRows : c.quickRows.filter((row) => row.compact);
  const compactFirst = [...quickRows.filter((row) => row.compact), ...quickRows.filter((row) => !row.compact)];
  const levelRow = c.guideRows.find((row) => row.kind === "segmented");
  const afterLevel = c.guideRows.filter((row): row is NonLevelGuideRow => row.kind !== "segmented");
  const log = logOf(c);
  const momentIds = log.lines.filter((line) => line.stop !== null).map((line) => line.id);

  const model: PausePageModel = {
    mode: c.mode,
    searching: c.searching,
    header: {
      title: t("pause.title"),
      status: c.hasGame ? c.status : t("pause.noGame"),
      blind: c.blindLines,
      note: !phone && c.adjusted ? t("pause.adjusted") : "",
      close: phone ? { label: "✕", ...(c.cancelGlyph ? { glyph: c.cancelGlyph } : {}) } : null,
    },
    menu: phone ? phoneFooter(c) : wideMenu(c),
    search: { value: c.query, placeholder: t("pause.searchPlaceholder"), clearLabel: t("pause.cancel") },
    results: results?.input ?? null,
    rules: {
      title: t("pause.rulesReference"),
      filtered: c.hasGame ? t("pause.filtered") : t("pause.filteredNone"),
      empty: c.hasGame ? t("pause.keywordsNone") : t("pause.keywordsNoGame"),
      entries: c.entries.map((entry) => {
        const card = entry.cardRefs[0];
        return {
          id: entry.id,
          term: entry.displayName,
          definition: entry.definition,
          tone: STATUS_TONES.has(entry.id) ? (entry.id as "stunned" | "confused" | "tough") : "plain",
          tail: card ? { text: t("pause.onCard", { card: card.name }), cardId: card.cardId } : null,
        };
      }),
    },
    log,
    logExpanded: c.logExpanded,
    quick: {
      toggle: { label: t("pause.reference"), open: quickRows.some((row) => !row.compact) },
      rows: compactFirst.map(linkOf),
    },
    table: {
      guideRun: c.guidedRunActive
        ? [
            { id: "guide-stop-tutorial", label: t("pause.stopTutorial") },
            { id: "guide-turn-guide-off", label: t("pause.turnGuideOff") },
          ]
        : [],
      tableHeading: t("pause.table"),
      cardSize: {
        title: c.cardSize.title,
        detail: "",
        look: "cell",
        options: c.cardSize.options.map((option) => ({
          stop: `table:card-size:${option.value}`,
          label: option.label,
          selected: c.cardSize.selected === option.value,
          action: { type: "card-size", value: option.value },
        })),
      },
      rows: c.tableRows.map((row) => ({
        stop: `table:${row.id}`,
        title: row.title,
        detail: row.unavailable ?? row.detail,
        state: switchState(row.on, row.unavailable !== undefined),
        on: row.on && row.unavailable === undefined,
        unavailable: row.unavailable !== undefined,
        action: { type: "table", id: row.id },
      })),
      guideHeading: t("pause.guide"),
      level:
        levelRow && levelRow.kind === "segmented"
          ? {
              title: "",
              detail: "",
              look: "tile",
              options: levelRow.options.map((option) => ({
                stop: `guide:guide-level:${option.value}`,
                label: option.label,
                detail: option.detail,
                selected: levelRow.selected === option.value,
                action: { type: "guide-level", value: option.value },
              })),
            }
          : null,
      guideRows: afterLevel.map(guideSwitch),
    },
    confirm: c.confirmingConcede
      ? {
          sentence: c.concedeSentence,
          yes: c.seatGame ? t("concede.seatConfirm") : t("pause.concedeYes"),
          cancel: t("pause.cancel"),
        }
      : null,
  };

  const searchResultIds = results ? { searchResultIds: results.stops } : {};
  const order = phone
    ? pauseFocusOrder({
        ...searchResultIds,
        kind: "phone",
        quickReferenceIds: compactFirst.map((row) => row.id),
        momentIds: c.logExpanded ? momentIds : [],
        tableRowIds: c.logExpanded
          ? []
          : [...c.cardSize.options.map((option) => `card-size:${option.value}`), ...c.tableRows.map((row) => row.id)],
        guideRowIds: c.logExpanded
          ? []
          : [
              ...(levelRow && levelRow.kind === "segmented"
                ? levelRow.options.map((option) => `guide-level:${option.value}`)
                : []),
              ...afterLevel.map((row) => row.id),
            ],
        confirmingConcede: c.confirmingConcede,
        guidedRunActive: c.guidedRunActive && !c.logExpanded,
      })
    : pauseFocusOrder({
        ...searchResultIds,
        kind: "wide",
        keywordIds: c.logExpanded ? [] : c.entries.map((entry) => entry.id),
        momentIds,
        confirmingConcede: c.confirmingConcede,
        guidedRunActive: c.guidedRunActive,
        watchLink: c.watchLinkLabel !== null,
        showHand: c.showHandLabel !== null,
      });
  return { model, order };
}
