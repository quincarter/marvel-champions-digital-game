/**
 * The round debrief (guided mode G8 part 1, `docs/guided-mode.md` §4, tiles P07/D03): content plus layout for the
 * screen shown between the villain phase and the next round's start — a lesson checklist, one "Worth remembering"
 * line, "New on your board" unlock notes, and the guide-level control. `scenes/round-debrief.ts` draws this; this
 * module owns what to say and where things go. Only the content model and a `?screen=debrief` demo land here —
 * wiring this to actually fire at the end of a tutorial round is a separate follow-up (§4 "in flight").
 *
 * **Inputs stay small and visible** (`docs/guided-mode.md` §2's "advice uses only visible information"):
 * `lessonList` (`view/lesson-model.ts`) for the checklist, the round number, the round's own `GameEvent`s for
 * "Worth remembering", and the live `GuideLevel` for the segmented control. Nothing here reads `GameState` or
 * `EngineDeps` — every heuristic below reads printed card data (`content/pool.ts`) plus event fields a player
 * already saw happen, the same discipline `guide-hints.ts` documents for its own heuristics.
 */
import type { GameEvent } from "@mc/engine";
import { CARDS_BY_ID } from "../content/pool.js";
import type { GuideLevel } from "../guide/guide-prefs.js";
import type { Lesson, LessonListEntry } from "./lesson-model.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export type RoundDebriefLessonStatus = "done" | "upNext" | "upcoming";

export interface RoundDebriefLessonRow {
  readonly id: string;
  readonly title: string;
  readonly status: RoundDebriefLessonStatus;
  /** "Next round · …" — only on the `upNext` row. */
  readonly subline?: string;
}

export interface RoundDebriefContent {
  /** "End of round N". */
  readonly title: string;
  /** A short, varied headline ("Nice work, recruit."). */
  readonly headline: string;
  readonly lessons: readonly RoundDebriefLessonRow[];
  /** One line from `WORTH_REMEMBERING_HEURISTICS`, or the no-notable-events fallback. */
  readonly worthRemembering: string;
  /** Unlock notes — today just the Log tab (`docs/guided-mode.md` §3.11); Flip is already live, so it's never listed. */
  readonly newOnBoard: readonly string[];
  readonly level: GuideLevel;
}

export interface RoundDebriefInput {
  readonly lessons: readonly LessonListEntry[];
  readonly round: number;
  readonly events: readonly GameEvent[];
  readonly level: GuideLevel;
}

const HEADLINES: readonly string[] = [
  "Nice work, recruit.",
  "Solid round.",
  "You're getting the hang of this.",
  "Good instincts out there.",
];

/** Varied but deterministic per round, so the same round always reads the same in a test or a replay. */
export function headlineFor(round: number): string {
  const index = (((round - 1) % HEADLINES.length) + HEADLINES.length) % HEADLINES.length;
  return HEADLINES[index] ?? HEADLINES[0]!;
}

function sublineFor(lesson: Lesson): string {
  if (!lesson.waitingCopy) return "Next round";
  const cleaned = lesson.waitingCopy.replace(/^It\s+/i, "").replace(/\.+$/, "");
  const lower = cleaned.length > 0 ? cleaned.charAt(0).toLowerCase() + cleaned.slice(1) : cleaned;
  return `Next round · ${lower}`;
}

/**
 * The checklist rows, in `lessonList`'s own order: every `"done"` entry stays `"done"`; the first not-done entry
 * — the next lesson the run will pick up — becomes `"upNext"` and gets a "Next round · …" subline built from that
 * lesson's own `waitingCopy`; anything further out stays a plain `"upcoming"` row with no tag, since only one
 * lesson is ever "next" at a time.
 */
export function lessonRowsOf(lessons: readonly LessonListEntry[]): readonly RoundDebriefLessonRow[] {
  const upNextIndex = lessons.findIndex((entry) => entry.status !== "done");
  return lessons.map((entry, index) => {
    if (entry.status === "done") return { id: entry.lesson.id, title: entry.lesson.title, status: "done" as const };
    if (index === upNextIndex) {
      return {
        id: entry.lesson.id,
        title: entry.lesson.title,
        status: "upNext" as const,
        subline: sublineFor(entry.lesson),
      };
    }
    return { id: entry.lesson.id, title: entry.lesson.title, status: "upcoming" as const };
  });
}

/**
 * The Log tab's own unlock note (`docs/guided-mode.md` §3.11: "The Log tab and the Log chip unlock after lesson
 * 5... Flip is taught in lesson 2, so it's live from the start" — which is why Flip never gets a line here).
 * `lessons.length` stands in for "lesson 5" generically, so this still reads right if the run's lesson count ever
 * changes: pending until the run's last lesson is done, then a one-line "just unlocked" note.
 */
export function newOnBoardLines(lessons: readonly LessonListEntry[]): readonly string[] {
  if (lessons.length === 0) return [];
  const last = lessons[lessons.length - 1]!;
  return last.status === "done"
    ? ["The Log tab just unlocked."]
    : [`The Log tab unlocks after lesson ${lessons.length}.`];
}

// ---------------------------------------------------------------------------
// "Worth remembering" — named, tested heuristics over the round's own events (§2: visible information only).
// ---------------------------------------------------------------------------

/** Ally instance ids played this round, by the ally's own printed name — from `cardPlayed`, never `GameState`. */
function alliesPlayedThisRound(events: readonly GameEvent[]): ReadonlyMap<string, string> {
  const allies = new Map<string, string>();
  for (const event of events) {
    if (event.type !== "cardPlayed") continue;
    const card = CARDS_BY_ID.get(event.cardId as string);
    if (card?.type === "ally") allies.set(event.instanceId as string, card.name);
  }
  return allies;
}

/** An ally played this round later declared as a defender (RRG 1.8 p. 9's defend step) — good use of the play. */
export function blockedWithAllyLine(events: readonly GameEvent[]): string | null {
  const allies = alliesPlayedThisRound(events);
  for (const event of events) {
    if (event.type !== "defenderDeclared") continue;
    const name = allies.get(event.defenderInstanceId as string);
    if (name) return `You blocked with ${name} — good call. That's what allies are for.`;
  }
  return null;
}

/** The hero took an attack undefended (`defenseDeclined`) at least once this round. */
export function tookDamageWithoutDefendingLine(events: readonly GameEvent[]): string | null {
  if (!events.some((event) => event.type === "defenseDeclined")) return null;
  return "You took a hit without defending. An ally or exhausting yourself can soak it next time.";
}

/** The main scheme gained threat this round (`threatPlaced`) with no thwart landing (`threatRemoved`) to answer it. */
export function schemeGrewUnthwartedLine(events: readonly GameEvent[]): string | null {
  const grew = events.some((event) => event.type === "threatPlaced" && event.amount > 0);
  const thwarted = events.some((event) => event.type === "threatRemoved" && event.amount > 0);
  if (!grew || thwarted) return null;
  return "The scheme gained threat and you didn't thwart. Worth clearing once it's past halfway.";
}

/** A card was paid for with exactly its printed cost — no resources spent past what it needed. */
export function paidExactlyLine(events: readonly GameEvent[]): string | null {
  for (const event of events) {
    if (event.type !== "cardPlayed") continue;
    const card = CARDS_BY_ID.get(event.cardId as string);
    const cost = card && "cost" in card ? card.cost : undefined;
    if (typeof cost === "number" && cost > 0 && event.resourcesPaid === cost) {
      return `You paid exactly ${cost} for ${card!.name} — no resources wasted.`;
    }
  }
  return null;
}

const NO_NOTABLE_EVENTS_LINE = "A clean round — nothing to flag.";

/** Priority order matches `docs/guided-mode.md` §4 G8's own list. First match wins; empty round events fall back. */
const WORTH_REMEMBERING_HEURISTICS: readonly ((events: readonly GameEvent[]) => string | null)[] = [
  blockedWithAllyLine,
  tookDamageWithoutDefendingLine,
  schemeGrewUnthwartedLine,
  paidExactlyLine,
];

export function worthRemembering(events: readonly GameEvent[]): string {
  for (const heuristic of WORTH_REMEMBERING_HEURISTICS) {
    const line = heuristic(events);
    if (line) return line;
  }
  return NO_NOTABLE_EVENTS_LINE;
}

export function roundDebriefContentOf(input: RoundDebriefInput): RoundDebriefContent {
  return {
    title: `End of round ${input.round}`,
    headline: headlineFor(input.round),
    lessons: lessonRowsOf(input.lessons),
    worthRemembering: worthRemembering(input.events),
    newOnBoard: newOnBoardLines(input.lessons),
    level: input.level,
  };
}

// ---------------------------------------------------------------------------
// Layout — phone/tablet-portrait stacked (P07); desktop/tablet-landscape split, hero art left (D03).
// ---------------------------------------------------------------------------

export interface RoundDebriefLayout {
  readonly formFactor: FormFactor;
  /** Desktop/tabletLandscape: hero art in a left column, content on the right (D03). Phone/tabletPortrait: stacked (P07). */
  readonly wide: boolean;
  /** Left art panel on wide layouts; zero-area on narrow (no full-bleed picture on P07 — a solid header band instead). */
  readonly art: Rect;
  /** Wide only (D03): the yellow "END OF ROUND N / headline" banner over the art panel's own foot. Zero on narrow. */
  readonly banner: Rect;
  /** Narrow only (P07): the dark header band carrying the same eyebrow/headline. Zero on wide. */
  readonly header: Rect;
  /** One rect per `RoundDebriefContent.lessons` entry, in order — the `upNext` row is taller (room for its subline). */
  readonly lessonRows: readonly Rect[];
  readonly worthRemembering: Rect;
  readonly newOnBoard: Rect;
  readonly guideLevelLabel: Rect;
  /** The three-cell segmented row; the scene divides it into `GUIDE_LEVEL_OPTIONS.length` equal cells. */
  readonly guideLevel: Rect;
  readonly replayLesson: Rect;
  readonly nextRound: Rect;
}

const PAD = 24;
const NARROW_PAD = 16;
const GAP = 12;
const HEADER_HEIGHT = 80;
const ROW_HEIGHT = 40;
const UP_NEXT_ROW_HEIGHT = 70;
const WORTH_REMEMBERING_HEIGHT = 80;
const NEW_ON_BOARD_HEIGHT = 64;
const GUIDE_LABEL_HEIGHT = 18;
const GUIDE_LEVEL_HEIGHT = 52;
const ACTION_HEIGHT = 52;
const WIDE_ART_WIDTH_RATIO = 0.4;
const CONTENT_MAX_WIDTH = 1200;

function rowHeightOf(index: number, upNextIndex: number): number {
  return index === upNextIndex ? UP_NEXT_ROW_HEIGHT : ROW_HEIGHT;
}

function lessonRowRects(x: number, y: number, width: number, lessons: readonly RoundDebriefLessonRow[]): Rect[] {
  const upNextIndex = lessons.findIndex((row) => row.status === "upNext");
  const rows: Rect[] = [];
  let cy = y;
  lessons.forEach((_row, index) => {
    const height = rowHeightOf(index, upNextIndex);
    rows.push({ x, y: cy, width, height });
    cy += height;
  });
  return rows;
}

function lessonsHeight(lessons: readonly RoundDebriefLessonRow[]): number {
  const upNextIndex = lessons.findIndex((row) => row.status === "upNext");
  return lessons.reduce((sum, _row, index) => sum + rowHeightOf(index, upNextIndex), 0);
}

function narrowLayout(
  width: number,
  height: number,
  formFactor: FormFactor,
  lessons: readonly RoundDebriefLessonRow[],
): RoundDebriefLayout {
  const pad = NARROW_PAD;
  const column = width - pad * 2;
  const header: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const banner: Rect = { x: 0, y: 0, width: 0, height: 0 };

  let y = HEADER_HEIGHT + GAP;
  const lessonRows = lessonRowRects(pad, y, column, lessons);
  y += lessonsHeight(lessons) + GAP;

  const worthRemembering: Rect = { x: pad, y, width: column, height: WORTH_REMEMBERING_HEIGHT };
  y += WORTH_REMEMBERING_HEIGHT + GAP;

  const newOnBoard: Rect = { x: pad, y, width: column, height: NEW_ON_BOARD_HEIGHT };
  y += NEW_ON_BOARD_HEIGHT + GAP;

  const guideLevelLabel: Rect = { x: pad, y, width: column, height: GUIDE_LABEL_HEIGHT };
  y += GUIDE_LABEL_HEIGHT + 6;
  const guideLevel: Rect = { x: pad, y, width: column, height: GUIDE_LEVEL_HEIGHT };

  const nextRoundY = height - pad - ACTION_HEIGHT;
  const replayY = nextRoundY - GAP - ACTION_HEIGHT;
  const replayLesson: Rect = { x: pad, y: replayY, width: column, height: ACTION_HEIGHT };
  const nextRound: Rect = { x: pad, y: nextRoundY, width: column, height: ACTION_HEIGHT };

  return {
    formFactor,
    wide: false,
    art: { x: 0, y: 0, width: 0, height: 0 },
    banner,
    header,
    lessonRows,
    worthRemembering,
    newOnBoard,
    guideLevelLabel,
    guideLevel,
    replayLesson,
    nextRound,
  };
}

function wideLayout(
  width: number,
  height: number,
  formFactor: FormFactor,
  lessons: readonly RoundDebriefLessonRow[],
): RoundDebriefLayout {
  const artWidth = Math.round(width * WIDE_ART_WIDTH_RATIO);
  const art: Rect = { x: 0, y: 0, width: artWidth, height };
  // The yellow "END OF ROUND N / headline" banner over the art panel's own foot — the same placement
  // `guide-chooser-model.ts`'s own wide split gives its banner.
  const banner: Rect = { x: 20, y: height - 96, width: Math.min(320, artWidth - 40), height: 76 };

  const contentX = artWidth + PAD;
  const contentWidth = Math.min(CONTENT_MAX_WIDTH, width - contentX - PAD);
  const leftWidth = Math.round(contentWidth * 0.56);
  const rightWidth = contentWidth - leftWidth - GAP;
  const rightX = contentX + leftWidth + GAP;

  const header: Rect = { x: contentX, y: PAD, width: contentWidth, height: 48 };

  let leftY = header.y + header.height + GAP;
  const lessonRows = lessonRowRects(contentX, leftY, leftWidth, lessons);
  leftY += lessonsHeight(lessons) + GAP;
  const guideLevelLabel: Rect = { x: contentX, y: leftY, width: leftWidth, height: GUIDE_LABEL_HEIGHT };
  leftY += GUIDE_LABEL_HEIGHT + 6;
  const guideLevel: Rect = { x: contentX, y: leftY, width: leftWidth, height: GUIDE_LEVEL_HEIGHT };

  let rightY = header.y + header.height + GAP;
  const worthRemembering: Rect = { x: rightX, y: rightY, width: rightWidth, height: WORTH_REMEMBERING_HEIGHT };
  rightY += WORTH_REMEMBERING_HEIGHT + GAP;
  const newOnBoard: Rect = { x: rightX, y: rightY, width: rightWidth, height: NEW_ON_BOARD_HEIGHT };

  const nextRoundY = height - PAD - ACTION_HEIGHT;
  const replayLesson: Rect = { x: contentX, y: nextRoundY, width: leftWidth * 0.42, height: ACTION_HEIGHT };
  const nextRound: Rect = {
    x: contentX + leftWidth * 0.42 + GAP,
    y: nextRoundY,
    width: contentWidth - leftWidth * 0.42 - GAP,
    height: ACTION_HEIGHT,
  };

  return {
    formFactor,
    wide: true,
    art,
    banner,
    header,
    lessonRows,
    worthRemembering,
    newOnBoard,
    guideLevelLabel,
    guideLevel,
    replayLesson,
    nextRound,
  };
}

export function roundDebriefLayout(
  width: number,
  height: number,
  lessons: readonly RoundDebriefLessonRow[],
): RoundDebriefLayout {
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  return wide ? wideLayout(width, height, formFactor, lessons) : narrowLayout(width, height, formFactor, lessons);
}

/** Every drawn content region except `art` (a picture, never content to keep clear of) — for a no-overlap test. */
export function roundDebriefLayoutRects(layout: RoundDebriefLayout): readonly Rect[] {
  return [
    layout.header,
    ...layout.lessonRows,
    layout.worthRemembering,
    layout.newOnBoard,
    layout.guideLevelLabel,
    layout.guideLevel,
    layout.replayLesson,
    layout.nextRound,
  ];
}
