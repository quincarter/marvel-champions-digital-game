import type { McTermRun, McTermTipContent, PictureSource } from "@mc/ui";

/** One card: its stamp, title, scan and words. */
export interface WinCardModel {
  /** WIN or LOSE, already translated. */
  readonly tag: string;
  readonly tone: "heal" | "red";
  readonly heading: string;
  /** The card the scan is of, and the face of it, for hover and Inspect. */
  readonly cardId: string;
  readonly face: unknown;
  readonly picture: PictureSource | null;
  readonly art: "portrait" | "landscape";
  /** Names the scan in the page (`scan:win`, `scan:scheme`, `scan:hero`). */
  readonly scanKey: string;
  /** The words, already translated. */
  readonly body: string;
  /** The words as a sentence with glossary terms, when they have any (it replaces `body`). */
  readonly terms?: { readonly runs: readonly McTermRun[]; readonly tips: Readonly<Record<string, McTermTipContent>> };
}

/** What `mc-win-cards` shows. */
export interface WinCardsInput {
  readonly win: WinCardModel;
  readonly scheme: WinCardModel;
  readonly hero: WinCardModel;
}

/** Wide: the tall WIN card at the left; narrow: all three stacked. */
export type WinCardsMode = "wide" | "narrow";
