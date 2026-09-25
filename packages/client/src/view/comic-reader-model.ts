/**
 * The comic reader (`art/README.md`'s "comic reader"; design tiles `gmw-comic-reader.dc/`): one page at a time,
 * lit panel by panel. Pure so beat stepping, page changes and "last beat → Suit up" are Vitest-tested without a
 * scene; the issue opener (`scenes/campaign/opener.ts`) and any later screen that reads comic pages (The Run, the
 * in-game stage beat, Rewind, the Aftermath, the Finale) share this model over their own `ComicBeatRef` list.
 */
import { lineForRoster } from "../campaign/story.js";
import type { BubblePlacement, ComicBeat, ComicPage, ComicBeatRef, StorySpeaker } from "../campaign/story.js";

export interface ResolvedComicBeat {
  readonly page: ComicPage;
  readonly beat: ComicBeat;
  /** The beat's own index within `page.beats` — the page strip and "PANEL N" label read off this, 1-based. */
  readonly beatIndexInPage: number;
}

export interface ComicReaderLineView {
  readonly speaker: StorySpeaker;
  readonly text: string;
  /** The line's own spot over the art, when it has one — kept for a narrator fallback too, minus the tail. */
  readonly placement?: BubblePlacement;
}

export interface ComicReaderStepView {
  readonly page: ComicPage;
  readonly panel: ComicBeat["panel"];
  readonly caption: string | null;
  readonly lines: readonly ComicReaderLineView[];
  readonly sfx: string | null;
  /** "PAGE 2 · PANEL 6" (1-based on both counters, matching the design tile). */
  readonly pageLabel: string;
  /** "BEAT 1 OF 28". */
  readonly beatLabel: string;
}

export interface ComicPageStripEntry {
  readonly file: string;
  readonly active: boolean;
}

export interface ComicReaderView {
  readonly step: ComicReaderStepView;
  readonly pageStrip: readonly ComicPageStripEntry[];
  readonly isFirst: boolean;
  readonly isLast: boolean;
  /** "SUIT UP ▸" once the last beat is reached, "NEXT ▸" otherwise — the issue opener's own CTA reuses this. */
  readonly ctaLabel: string;
}

/**
 * Resolves an issue's ordered `ComicBeatRef` list against the box's `pages`. Throws on a ref that names a page or
 * beat that does not exist — a story-authoring bug, not a runtime condition a player can hit, so it fails loudly
 * rather than silently dropping a beat.
 */
export function resolveComicBeats(
  pages: readonly ComicPage[],
  refs: readonly ComicBeatRef[],
): readonly ResolvedComicBeat[] {
  return refs.map((ref) => {
    const page = pages.find((candidate) => candidate.file === ref.page);
    if (!page) throw new Error(`comic reader: unknown page "${ref.page}"`);
    const beat = page.beats[ref.beatIndex];
    if (!beat) throw new Error(`comic reader: page "${ref.page}" has no beat ${ref.beatIndex}`);
    return { page, beat, beatIndexInPage: ref.beatIndex };
  });
}

/** `current` is clamped into range — a caller can pass an out-of-range index (e.g. after a page resize) safely. */
export function comicReaderViewOf(
  steps: readonly ResolvedComicBeat[],
  current: number,
  rosterIdentityIds: readonly string[],
): ComicReaderView {
  const total = steps.length;
  const clamped = Math.max(0, Math.min(current, total - 1));
  const resolved = steps[clamped]!;
  const lines = resolved.beat.lines.flatMap((line): ComicReaderLineView[] => {
    const shown = lineForRoster(line, rosterIdentityIds);
    if (!shown) return [];
    const view = { speaker: shown.speaker, text: shown.text };
    return [line.placement ? { ...view, placement: line.placement } : view];
  });

  const orderedPageFiles: string[] = [];
  for (const step of steps) if (!orderedPageFiles.includes(step.page.file)) orderedPageFiles.push(step.page.file);
  const pageStrip = orderedPageFiles.map((file) => ({ file, active: file === resolved.page.file }));

  const pageNumber = orderedPageFiles.indexOf(resolved.page.file) + 1;
  const isLast = clamped >= total - 1;

  return {
    step: {
      page: resolved.page,
      panel: resolved.beat.panel,
      caption: resolved.beat.caption ?? null,
      lines,
      sfx: resolved.beat.sfx ?? null,
      pageLabel: `PAGE ${pageNumber} · PANEL ${resolved.beatIndexInPage + 1}`,
      beatLabel: `BEAT ${clamped + 1} OF ${total}`,
    },
    pageStrip,
    isFirst: clamped === 0,
    isLast,
    ctaLabel: isLast ? "SUIT UP ▸" : "NEXT ▸",
  };
}

/** Advances one beat, clamped at the last — the caller checks `isLast`/`ctaLabel` to know when to leave instead. */
export function nextComicBeat(current: number, total: number): number {
  return Math.min(current + 1, Math.max(0, total - 1));
}

/** Steps back one beat, clamped at the first. */
export function prevComicBeat(current: number): number {
  return Math.max(current - 1, 0);
}
