import type { ControlGlyph } from "@mc/ui";
import type { LearnHeaderTicks } from "../../../components/learn/mc-learn-header/mc-learn-header.types.js";
import type { WinCardsInput } from "../../../components/learn/mc-win-cards/mc-win-cards.types.js";

/** Wide (a tablet in landscape, a desktop): two columns of cards; narrow: one. */
export type HowToWinMode = "wide" | "narrow";

/** Everything How to win shows, already computed and translated by the scene's view models. */
export interface HowToWinPageModel {
  readonly header: {
    readonly heading: string;
    readonly closeLabel: string;
    /** The Cancel glyph after the title while a keyboard or pad is in use. */
    readonly glyph: ControlGlyph | undefined;
    readonly ticks: LearnHeaderTicks;
    /** How far the title drops under the dark mode tab, and how wide it may be (0: no limit). */
    readonly drop: number;
    readonly max: number;
  };
  readonly title: { readonly first: string; readonly second: string };
  readonly cards: WinCardsInput;
  readonly round: { readonly label: string; readonly steps: readonly string[] };
  readonly actions: { readonly tellLabel: string; readonly startLabel: string; readonly starting: boolean };
}
