/**
 * The shared replay loading screen's layout (issue #858, `ui/replay-link-loading.ts`): one ink panel in the middle of
 * the screen, with a spinner while the replay loads, a heading, a line of text and one button (Cancel while loading,
 * Main menu once it failed; none while the opened replay goes onto the board).
 */
import type { Rect } from "./layout.js";

export const REPLAY_LINK_PANEL_MAX_WIDTH = 440;
export const REPLAY_LINK_MARGIN = 16;
export const REPLAY_LINK_PAD = 24;
export const REPLAY_LINK_SPINNER_RADIUS = 22;
const GAP = 16;

export interface ReplayLinkScreenLayout {
  readonly panel: Rect;
  /** The spinner's center, when there is one. */
  readonly spinner: { readonly x: number; readonly y: number } | null;
  /** The heading's top center. */
  readonly heading: { readonly x: number; readonly y: number };
  /** The body text's top center, and the width it wraps at. */
  readonly body: { readonly x: number; readonly y: number; readonly width: number };
  readonly button: Rect;
}

export interface ReplayLinkScreenInput {
  readonly width: number;
  readonly height: number;
  readonly spinner: boolean;
  readonly headingHeight: number;
  readonly bodyHeight: number;
  readonly buttonHeight: number;
}

/** The width the body text wraps at on a screen `width` wide. */
export function replayLinkBodyWidth(width: number): number {
  return panelWidthOf(width) - REPLAY_LINK_PAD * 2;
}

function panelWidthOf(width: number): number {
  return Math.max(0, Math.min(REPLAY_LINK_PANEL_MAX_WIDTH, width - REPLAY_LINK_MARGIN * 2));
}

export function replayLinkScreenLayout(input: ReplayLinkScreenInput): ReplayLinkScreenLayout {
  const panelWidth = panelWidthOf(input.width);
  const spinnerHeight = input.spinner ? REPLAY_LINK_SPINNER_RADIUS * 2 + GAP : 0;
  const panelHeight =
    REPLAY_LINK_PAD * 2 +
    spinnerHeight +
    input.headingHeight +
    8 +
    input.bodyHeight +
    (input.buttonHeight > 0 ? GAP + input.buttonHeight : 0);
  const panel: Rect = {
    x: Math.round((input.width - panelWidth) / 2),
    y: Math.max(REPLAY_LINK_MARGIN, Math.round((input.height - panelHeight) / 2)),
    width: panelWidth,
    height: panelHeight,
  };
  const centerX = panel.x + panelWidth / 2;
  let y = panel.y + REPLAY_LINK_PAD;
  const spinner = input.spinner ? { x: centerX, y: y + REPLAY_LINK_SPINNER_RADIUS } : null;
  y += spinnerHeight;
  const heading = { x: centerX, y };
  y += input.headingHeight + 8;
  const body = { x: centerX, y, width: panelWidth - REPLAY_LINK_PAD * 2 };
  y += input.bodyHeight + GAP;
  const button: Rect = {
    x: panel.x + REPLAY_LINK_PAD,
    y,
    width: panelWidth - REPLAY_LINK_PAD * 2,
    height: input.buttonHeight,
  };
  return { panel, spinner, heading, body, button };
}
