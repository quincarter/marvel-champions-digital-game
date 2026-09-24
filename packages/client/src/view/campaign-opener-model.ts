/**
 * C03 issue opener (`scenes/campaign/opener.ts`): what one tap-through panel shows, and the bottom CTA's label —
 * pure so the reveal sequencing and the roster-fallback rules (`lineForRoster`) are Vitest-tested without a scene.
 *
 * The screen owns nothing but a "how many panels are revealed" counter; everything it draws from that counter comes
 * from here.
 */
import type { IssueStory, PanelArt, StoryPanel, StorySpeaker } from "../campaign/story.js";
import { lineForRoster } from "../campaign/story.js";

export interface OpenerLineView {
  readonly speaker: StorySpeaker;
  readonly text: string;
}

export interface OpenerPanelView {
  readonly index: number;
  /** False for a still-dashed slot — draw the empty frame, not the art/caption/lines/sfx. */
  readonly revealed: boolean;
  /** True only for the slot right after the last revealed one — the design's "TAP ▸" hint. */
  readonly isNext: boolean;
  readonly art: PanelArt | null;
  readonly caption: string | null;
  readonly lines: readonly OpenerLineView[];
  readonly sfx: string | null;
}

export interface OpenerView {
  readonly issueLabel: string;
  readonly title: string;
  readonly panels: readonly OpenerPanelView[];
  /** "TAP TO CONTINUE 1/3" mid-issue, "SUIT UP ▸" once every panel is revealed. */
  readonly ctaLabel: string;
  /** True once the last panel is revealed — the CTA now leaves the screen instead of revealing another panel. */
  readonly allRevealed: boolean;
}

function panelViewOf(
  panel: StoryPanel,
  index: number,
  revealed: boolean,
  rosterIdentityIds: readonly string[],
): OpenerPanelView {
  if (!revealed) {
    return { index, revealed: false, isNext: false, art: null, caption: null, lines: [], sfx: null };
  }
  const lines = panel.lines
    .map((line) => lineForRoster(line, rosterIdentityIds))
    .filter((line): line is OpenerLineView => line !== null);
  return {
    index,
    revealed: true,
    isNext: false,
    art: panel.art,
    caption: panel.caption ?? null,
    lines,
    sfx: panel.sfx ?? null,
  };
}

/**
 * `revealedCount` is how many of `story.opener` panels are shown (1..panels.length, never 0 — the first panel is
 * revealed on entry, matching the design's opening state).
 */
export function openerViewOf(
  story: IssueStory,
  issueNumber: number,
  issueTotal: number,
  rosterIdentityIds: readonly string[],
  revealedCount: number,
): OpenerView {
  const total = story.opener.length;
  const clamped = Math.max(1, Math.min(revealedCount, total));
  const panels = story.opener.map((panel, index) => panelViewOf(panel, index, index < clamped, rosterIdentityIds));
  // The slot right after the last revealed one reads "TAP ▸"; everything further out reads "…" (drawn by the
  // scene itself off `revealed`/`isNext` — no further slot ever needs its own label).
  const nextIndex = clamped < total ? clamped : -1;
  const withNext = panels.map((panel) => (panel.index === nextIndex ? { ...panel, isNext: true } : panel));
  const allRevealed = clamped >= total;
  return {
    issueLabel: `ISSUE #${issueNumber} OF ${issueTotal}`,
    title: story.title,
    panels: withNext,
    ctaLabel: allRevealed ? "SUIT UP ▸" : `TAP TO CONTINUE ${clamped}/${total}`,
    allRevealed,
  };
}
