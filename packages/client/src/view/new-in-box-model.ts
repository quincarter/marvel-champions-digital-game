/**
 * The "New in this box" pages (guided mode §3.14, owner request 2026-10-03): the How to play hub lists one page per
 * box that introduced mechanics, and each page lists that box's new glossary entries (grouped as Keywords, Hero
 * mechanics, Scenario mechanics) and its Try-it lessons. Pure data plus a pure layout, the same split as
 * `how-to-play-model.ts`.
 *
 * **Data-driven.** A page's entries are `GLOSSARY_ENTRIES` filtered by `introducedIn` (`@mc/content`'s
 * `GlossaryEntry`), never a second list kept here; a box with no tagged entries and no lesson has no page. The
 * glossary itself stays one alphabetical list: the tag only decides which page lists an entry, not where it sits
 * in the Rules reference.
 *
 * **Locked boxes have no page.** `isBoxOpen` takes the unlock key (`Cycle.id`) of the box and answers whether the
 * player has opened it (`progression/unlocks.ts`, `?unlock=all` opens every one). MojoMania is its own box inside
 * Mutant Genesis' cycle and opens with it, so both pages share one unlock key.
 *
 * Never says "wave" in what a player reads: the first packs after the Core Set are "the first packs".
 */
import { GLOSSARY_ENTRIES, type GlossaryBoxId, type GlossaryEntry } from "@mc/content";
import { MECHANIC_TRYITS, type MechanicTryIt } from "../guide/mechanic-tryits.js";
import { contentSlotHeights, formFactorFor, type FormFactor, type Rect } from "./layout.js";

export interface BoxDef {
  /** `"core"` is the "Core rules, added later" page: entries tagged `appliesToCore`, from every unlocked box. */
  readonly id: Exclude<GlossaryBoxId, "later">;
  /** What the page and its hub row are called after "New in", e.g. "Mutant Genesis". */
  readonly name: string;
  /** The page's whole title, when it is not "New in <name>". */
  readonly title?: string;
  /** The `UNLOCK_WAVES` row (`Cycle.id`) that opens this box. */
  readonly unlockKey: string;
}

/** Every box a page can exist for, in release order. `new-in-box-model.test.ts` checks the names against the unlock path. */
export const BOXES: readonly BoxDef[] = [
  { id: "core", name: "Core rules", title: "Core rules, added later", unlockKey: "core" },
  { id: "wave1", name: "the first packs", unlockKey: "wave1" },
  { id: "cycle1", name: "The Rise of Red Skull", unlockKey: "cycle1" },
  { id: "cycle3", name: "The Galaxy's Most Wanted", unlockKey: "cycle3" },
  { id: "cycle4", name: "The Mad Titan's Shadow", unlockKey: "cycle4" },
  { id: "cycle5", name: "Sinister Motives", unlockKey: "cycle5" },
  { id: "cycle6", name: "Mutant Genesis", unlockKey: "cycle6" },
  { id: "mojo", name: "MojoMania", unlockKey: "cycle6" },
];

/** The small line under a row that points at the entry's other home: its box, or the Core rules page. */
export interface BoxEntryLink {
  readonly label: string;
  /** The page it opens. */
  readonly boxId: BoxDef["id"];
}

export interface BoxEntryRow {
  readonly id: string;
  readonly displayName: string;
  readonly link?: BoxEntryLink;
}

const boxById = (id: string): BoxDef | undefined => BOXES.find((b) => b.id === id);

/**
 * "Added with Mutant Genesis · applies to Core cards too" for an entry written for a later box that Core cards
 * already use, or `null` for every other entry. The glossary entry view draws it, linking to `boxId`'s page.
 */
export function originNoteOf(entry: GlossaryEntry): { readonly text: string; readonly boxId: BoxDef["id"] } | null {
  if (!entry.appliesToCore) return null;
  const box = boxById(entry.introducedIn);
  if (!box) return null;
  return { text: `Added with ${box.name} · applies to Core cards too`, boxId: box.id };
}

export interface BoxLessonRow {
  readonly id: MechanicTryIt["id"];
  readonly title: string;
  readonly tagline: string;
}

export interface BoxPage {
  readonly id: BoxDef["id"];
  /** "New in Mutant Genesis". */
  readonly title: string;
  readonly name: string;
  readonly keywords: readonly BoxEntryRow[];
  readonly heroMechanics: readonly BoxEntryRow[];
  readonly scenarioMechanics: readonly BoxEntryRow[];
  readonly lessons: readonly BoxLessonRow[];
  /** "5 new entries · 2 Try-its", for the hub row. */
  readonly summary: string;
}

const byName = (a: BoxEntryRow, b: BoxEntryRow): number => a.displayName.localeCompare(b.displayName);

function summaryOf(entries: number, lessons: number): string {
  const parts = [`${entries} new ${entries === 1 ? "entry" : "entries"}`];
  if (lessons > 0) parts.push(`${lessons} Try-it${lessons === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/**
 * The page for one box, or `null` when it has nothing to list. The Core page lists every `appliesToCore` entry whose
 * own box passes `isBoxOpen` (a link to a locked box's page would be dead); a box page marks its own such entries
 * "Also a Core rule". Each row's `link` is the way to the entry's other home.
 */
export function boxPageOf(
  box: BoxDef,
  entries: readonly GlossaryEntry[] = GLOSSARY_ENTRIES,
  tryits: readonly MechanicTryIt[] = MECHANIC_TRYITS,
  isBoxOpen: (unlockKey: string) => boolean = () => true,
): BoxPage | null {
  const isCore = box.id === "core";
  const mine = isCore
    ? entries.filter((e) => {
        const home = boxById(e.introducedIn);
        return e.appliesToCore && home !== undefined && isBoxOpen(home.unlockKey);
      })
    : entries.filter((e) => e.introducedIn === box.id);
  const rowOf = (entry: GlossaryEntry): BoxEntryRow => {
    if (!entry.appliesToCore) return { id: entry.id, displayName: entry.displayName };
    const link: BoxEntryLink = isCore
      ? { label: `Added with ${boxById(entry.introducedIn)!.name}`, boxId: boxById(entry.introducedIn)!.id }
      : { label: "Also a Core rule", boxId: "core" };
    return { id: entry.id, displayName: entry.displayName, link };
  };
  const keywords = mine
    .filter((e) => e.kind === "keyword")
    .map(rowOf)
    .sort(byName);
  const heroMechanics = mine
    .filter((e) => e.kind !== "keyword" && e.mechanicGroup === "hero")
    .map(rowOf)
    .sort(byName);
  const scenarioMechanics = mine
    .filter((e) => e.kind !== "keyword" && e.mechanicGroup === "scenario")
    .map(rowOf)
    .sort(byName);
  const lessons = isCore
    ? []
    : tryits
        .filter((l) => l.box === box.id)
        .map((l): BoxLessonRow => ({ id: l.id, title: l.title, tagline: l.tagline }));
  const count = keywords.length + heroMechanics.length + scenarioMechanics.length;
  if (count === 0 && lessons.length === 0) return null;
  return {
    id: box.id,
    title: box.title ?? `New in ${box.name}`,
    name: box.name,
    keywords,
    heroMechanics,
    scenarioMechanics,
    lessons,
    summary: isCore ? `${count} ${count === 1 ? "entry" : "entries"}` : summaryOf(count, lessons.length),
  };
}

/** Every page the player can see: boxes in release order, with no tagged entries or no unlock yielding no page. */
export function boxPages(
  isBoxOpen: (unlockKey: string) => boolean,
  entries: readonly GlossaryEntry[] = GLOSSARY_ENTRIES,
  tryits: readonly MechanicTryIt[] = MECHANIC_TRYITS,
): readonly BoxPage[] {
  const pages: BoxPage[] = [];
  for (const box of BOXES) {
    if (!isBoxOpen(box.unlockKey)) continue;
    const page = boxPageOf(box, entries, tryits, isBoxOpen);
    if (page) pages.push(page);
  }
  return pages;
}

export interface BoxPageSection {
  readonly kind: "keywords" | "hero" | "scenario" | "tryit";
  readonly label: string;
  readonly rows: readonly (BoxEntryRow | BoxLessonRow)[];
}

/** A page's non-empty sections, in reading order: Keywords, Hero mechanics, Scenario mechanics, Try it. */
export function boxPageSections(page: BoxPage): readonly BoxPageSection[] {
  const sections: BoxPageSection[] = [
    { kind: "keywords", label: "KEYWORDS", rows: page.keywords },
    { kind: "hero", label: "HERO MECHANICS", rows: page.heroMechanics },
    { kind: "scenario", label: "SCENARIO MECHANICS", rows: page.scenarioMechanics },
    { kind: "tryit", label: "TRY IT", rows: page.lessons },
  ];
  return sections.filter((s) => s.rows.length > 0);
}

/**
 * Focus order: close, then every row in reading order. A lesson stop is `lesson:<id>`, an entry stop `entry:<id>`; an
 * entry with a link to its other home has a second stop right after it, `link:<id>`.
 */
export function boxPageFocusOrder(page: BoxPage): readonly string[] {
  return [
    "close",
    ...boxPageSections(page).flatMap((s) =>
      s.rows.flatMap((row) =>
        s.kind === "tryit"
          ? [`lesson:${row.id}`]
          : [`entry:${row.id}`, ...("link" in row && row.link ? [`link:${row.id}`] : [])],
      ),
    ),
  ];
}

const HEADER_HEIGHT = 64;
const CLOSE_SIZE = 44;
const PAD = 28;
const NARROW_PAD = 16;
const CONTENT_MAX_WIDTH = 760;
const TOP_PAD = 24;
const LABEL_HEIGHT = 24;
const LABEL_ROW_GAP = 8;
const SECTION_GAP = 24;
const ROW_GAP = 8;
const ENTRY_ROW_HEIGHT = 52;
/** An entry row with a link line under its title. */
const LINKED_ROW_HEIGHT = 72;
const LINK_HEIGHT = 26;
const LESSON_ROW_HEIGHT = 72;
const BOTTOM_PAD = 32;
const WIDE_MIN_WIDTH = 700;

export interface BoxPageHeaderLayout {
  readonly formFactor: FormFactor;
  readonly header: Rect;
  readonly close: Rect;
  readonly title: Rect;
}

export function boxPageHeaderLayout(width: number, height: number): BoxPageHeaderLayout {
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  const pad = wide ? PAD : NARROW_PAD;
  const close: Rect = { x: pad, y: (HEADER_HEIGHT - CLOSE_SIZE) / 2, width: CLOSE_SIZE, height: CLOSE_SIZE };
  return {
    formFactor,
    header: { x: 0, y: 0, width, height: HEADER_HEIGHT },
    close,
    title: {
      x: close.x + close.width + 12,
      y: 0,
      width: width - close.x - close.width - 12 - pad,
      height: HEADER_HEIGHT,
    },
  };
}

export interface BoxPageSectionLayout {
  readonly section: BoxPageSection;
  readonly label: Rect;
  /** One rect per `section.rows`, same order, content space (`y` from the content's own top). */
  readonly rows: readonly Rect[];
  /** For a row with a link line, that line's own tap rect (inside the row, along its bottom); `null` otherwise. */
  readonly linkRects: readonly (Rect | null)[];
}

export interface BoxPageContentLayout {
  readonly sections: readonly BoxPageSectionLayout[];
  /** `McScrollRegion`'s `heights`: one slot per drawn rect (`contentSlotHeights`' convention), summing to `totalHeight`. */
  readonly heights: readonly number[];
  readonly totalHeight: number;
  /** For `McScrollRegion#scrollIntoView`, keyed like `boxPageFocusOrder` (without "close"). */
  readonly scrollIndexByStop: ReadonlyMap<string, number>;
}

/** The page body: one centered column of sections, each a label and full-width rows. Content-space, scrolled by the scene. */
export function boxPageContentLayout(width: number, page: BoxPage): BoxPageContentLayout {
  const pad = width >= WIDE_MIN_WIDTH ? PAD : NARROW_PAD;
  const columnWidth = Math.min(CONTENT_MAX_WIDTH, width - pad * 2);
  const x = Math.round((width - columnWidth) / 2);
  let y = TOP_PAD;
  const sections: BoxPageSectionLayout[] = [];
  const slots: Rect[] = [{ x, y: 0, width: columnWidth, height: 0 }];
  const scrollIndexByStop = new Map<string, number>();
  for (const section of boxPageSections(page)) {
    const label: Rect = { x, y, width: columnWidth, height: LABEL_HEIGHT };
    slots.push(label);
    y += LABEL_HEIGHT + LABEL_ROW_GAP;
    const rows: Rect[] = [];
    const linkRects: (Rect | null)[] = [];
    for (const row of section.rows) {
      const linked = section.kind !== "tryit" && "link" in row && row.link !== undefined;
      const rowHeight = section.kind === "tryit" ? LESSON_ROW_HEIGHT : linked ? LINKED_ROW_HEIGHT : ENTRY_ROW_HEIGHT;
      const rect: Rect = { x, y, width: columnWidth, height: rowHeight };
      rows.push(rect);
      linkRects.push(
        linked ? { x, y: y + rowHeight - LINK_HEIGHT - 4, width: columnWidth, height: LINK_HEIGHT } : null,
      );
      scrollIndexByStop.set(`${section.kind === "tryit" ? "lesson" : "entry"}:${row.id}`, slots.length);
      if (linked) scrollIndexByStop.set(`link:${row.id}`, slots.length);
      slots.push(rect);
      y += rowHeight + ROW_GAP;
    }
    y += SECTION_GAP - ROW_GAP;
    sections.push({ section, label, rows, linkRects });
  }
  const totalHeight = y - SECTION_GAP + BOTTOM_PAD;
  // Close the last slot at the content's real bottom so the slots sum to `totalHeight`.
  slots.push({ x, y: totalHeight, width: columnWidth, height: 0 });
  return { sections, heights: contentSlotHeights(slots), totalHeight, scrollIndexByStop };
}

/** Every drawn row, for a no-overlap test. */
export function boxPageRowRects(layout: BoxPageContentLayout): readonly Rect[] {
  return layout.sections.flatMap((s) => s.rows);
}
