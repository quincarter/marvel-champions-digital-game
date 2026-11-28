import type { ControlGlyph } from "@mc/ui";
import type { AspectRowModel } from "../../../components/learn/mc-aspect-row/mc-aspect-row.types.js";
import type { LinkListRow } from "../../../components/learn/mc-link-list/mc-link-list.types.js";
import type { LessonRowModel } from "../../../components/learn/mc-lesson-row/mc-lesson-row.types.js";

/** Wide (a tablet in landscape, a desktop): two columns; narrow: one. */
export type HowToPlayMode = "wide" | "narrow";

/** Everything the How to play hub shows, already computed and translated by the scene's view models. */
export interface HowToPlayPageModel {
  readonly header: {
    readonly heading: string;
    readonly closeLabel: string;
    /** The Cancel glyph after the title while a keyboard or pad is in use. */
    readonly glyph: ControlGlyph | undefined;
    /** How far the title drops under the dark mode tab, and how wide it may be (0: no limit). */
    readonly drop: number;
    readonly max: number;
  };
  readonly lessons: { readonly heading: string; readonly rows: readonly LessonRowModel[] };
  readonly aspects: { readonly heading: string; readonly rows: readonly AspectRowModel[] };
  readonly reference: { readonly heading: string; readonly rows: readonly LinkListRow[] };
  /** One row per "New in this box" page the player has unlocked; none while no box has a page. */
  readonly boxes: { readonly heading: string; readonly rows: readonly LinkListRow[] };
  readonly continue: { readonly label: string; readonly starting: boolean };
}
