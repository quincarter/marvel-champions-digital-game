import type { PictureSource } from "@mc/ui";

export interface RulesStepModel {
  /** Its place in the phase, from 0: the focus stop is `row:step:<index>`. */
  readonly index: number;
  /** "1. Place threat". */
  readonly label: string;
  readonly detail: string;
  /** The live game is on this step. */
  readonly current: boolean;
  /** The illustration, or null for a step with none. */
  readonly picture: PictureSource | null;
  /** The card the picture is of (a live scheme or villain), for the hover popover; absent for a card back. */
  readonly cardId?: string;
  readonly face?: unknown;
}

export interface McRulesStepProps {
  step: RulesStepModel | null;
}
