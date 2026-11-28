/**
 * What the Cover's bottom block (`cover/bottom.ts`) needs of its scene: the scene (to navigate from), the glyph hints, the
 * press and focus maps it fills, and the two facts that change between draws.
 */
import type Phaser from "phaser";
import type { SheetGlyphs } from "../../../dom/sheet-glyphs.js";
import type { Rect } from "../../../view/layout.js";
import type { FocusStop } from "../../focus-route.js";

export interface CoverState {
  runId: string | null;
  /** Whether the runner's very next question is Market-shaped (a box with a Market). */
  marketOpenNow: boolean;
}

export interface CoverCtx {
  readonly scene: Phaser.Scene;
  readonly glyphs: SheetGlyphs;
  readonly actions: Map<string, () => void>;
  readonly stops: Map<string, FocusStop>;
  readonly obstacles: Rect[];
  readonly state: CoverState;
}
