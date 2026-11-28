import type { ControlGlyph } from "@mc/ui";
import type { LearnHeaderTicks } from "../../../components/learn/shared/learn-ticks.types.js";
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
  };
  readonly title: { readonly first: string; readonly second: string };
  readonly cards: WinCardsInput;
  readonly round: { readonly label: string; readonly steps: readonly string[] };
  readonly actions: { readonly tellLabel: string; readonly startLabel: string; readonly starting: boolean };
}
