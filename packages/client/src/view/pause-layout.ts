/**
 * Pause's own layout (docs/phase4-screen-gaps.md §3 "W4"), built on the shared
 * `overlay-layout.ts` panel. Top to bottom: the "PAUSED" headline and status
 * line, Resume, Save & quit, the Rules reference and Settings nav rows,
 * "Jump to a moment" (S7 — landed as a dashed, unavailable list; see
 * `scenes/pause.ts`), and Concede pinned to the footer, separated from the rest
 * the way both P16 and D13 draw it (dimmer, and last).
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import { overlayPanelLayout, stackedRow } from "./overlay-layout.js";

const HEADER_HEIGHT = 74;
const FOOTER_HEIGHT = hit.target + 16;
const ROW_GAP = 8;
const MOMENTS_HEADING_HEIGHT = 22;

export interface PauseLayout {
  readonly panel: Rect;
  readonly header: Rect;
  readonly resume: Rect;
  readonly saveQuit: Rect;
  readonly rulesButton: Rect;
  readonly settingsButton: Rect;
  readonly momentsHeading: Rect;
  /** The moments list viewport — empty (zero height) if the body is too short to fit it below the four rows above. */
  readonly moments: Rect;
  readonly footer: Rect;
}

export function pauseLayout(bounds: Rect): PauseLayout {
  const { panel, header, body, footer } = overlayPanelLayout(bounds, HEADER_HEIGHT, FOOTER_HEIGHT);
  const resume: Rect = { x: body.x + 16, y: body.y + 8, width: body.width - 32, height: hit.primary };
  const saveQuit = stackedRow({ x: body.x + 16, y: resume.y + resume.height + 10, width: body.width - 32, height: 0 }, 0, hit.target, ROW_GAP);
  const rulesButton = stackedRow(saveQuit, 1, hit.target, ROW_GAP);
  const settingsButton = stackedRow(saveQuit, 2, hit.target, ROW_GAP);
  const momentsHeadingY = settingsButton.y + settingsButton.height + 14;
  const momentsHeading: Rect = { x: body.x + 16, y: momentsHeadingY, width: body.width - 32, height: MOMENTS_HEADING_HEIGHT };
  const momentsTop = momentsHeading.y + momentsHeading.height + 6;
  const momentsBottom = body.y + body.height - 8;
  const moments: Rect = { x: body.x + 16, y: momentsTop, width: body.width - 32, height: Math.max(0, momentsBottom - momentsTop) };
  return { panel, header, resume, saveQuit, rulesButton, settingsButton, momentsHeading, moments, footer };
}
