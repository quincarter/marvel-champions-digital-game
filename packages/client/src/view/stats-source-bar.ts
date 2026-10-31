/**
 * Where Your stats puts its You / Everyone switch: in the ink top bar, a compact segmented pair to the right of the
 * title, so it costs the content area no height (a small phone's scroll area is the scarce thing). Pure sizes only.
 *
 * The bar already holds Back and the title at the left, the dark mode button at the top centre (`view/theme-button.ts`:
 * a short tab hanging from the edge on a phone, a square button on a desktop) and, on a desktop, "N games played" at the
 * right edge. The pair sits to the right of the centre button; where the desktop's "games played" would crowd it, that
 * text is dropped, and on a narrow phone "Everyone" is shortened to "All".
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";

export interface SourceBar {
  readonly you: Rect;
  readonly everyone: Rect;
  readonly labels: readonly [string, string];
  /** False: the bar's "N games played" would not fit beside the pair, and is left out. */
  readonly showRight: boolean;
  /** Room at the bar's right edge the title must stop short of. */
  readonly reserveRight: number;
}

const GAP = 8;
/**
 * Half the width of the dark mode button's press zone (`scenes/theme-button.ts` widens its slot to `hit.target`, and the
 * zone runs from the very top edge), plus the room kept clear beside it. The drawn tab is narrower; the zone is what a
 * press hits.
 */
const THEME_HALF = hit.target / 2;
/** One segment's widest, and its text's side padding. */
const SEGMENT_MAX = { phone: 96, wide: 112 } as const;
const SEGMENT_PAD = 16;

/**
 * `measure(text)` is the width the label draws at; `rightWidth` is the width of the bar's right-hand text (0: none).
 * The segments are `hit.target` tall, or the bar's height if that is less.
 */
export function sourceBarOf(
  frame: { readonly width: number; readonly phone: boolean; readonly topBar: number },
  rightWidth: number,
  measure: (text: string) => number,
): SourceBar {
  const pad = frame.phone ? 12 : 22;
  const kind = frame.phone ? "phone" : "wide";
  const centreClear = Math.round(frame.width / 2) + THEME_HALF + GAP;
  const height = Math.min(hit.target, frame.topBar);
  const y = Math.round((frame.topBar - height) / 2);
  // The right text sits at the edge; the pair sits left of it when both fit right of the dark mode button.
  const place = (reserved: number): { x: number; segment: number } => {
    const room = frame.width - pad - reserved - centreClear;
    const segment = Math.min(SEGMENT_MAX[kind], Math.floor(room / 2));
    return { x: frame.width - pad - reserved - segment * 2, segment };
  };
  const withRight = rightWidth > 0 ? place(rightWidth + GAP * 2) : null;
  const useRight = withRight !== null && withRight.segment >= SEGMENT_MAX[kind];
  const { x, segment } = useRight ? withRight : place(0);
  const long = ["You", "Everyone"] as const;
  const fits = measure(long[1].toUpperCase()) + SEGMENT_PAD <= segment;
  return {
    you: { x, y, width: segment, height },
    everyone: { x: x + segment, y, width: segment, height },
    labels: fits ? long : ["You", "All"],
    showRight: useRight,
    reserveRight: frame.width - x + GAP,
  };
}
