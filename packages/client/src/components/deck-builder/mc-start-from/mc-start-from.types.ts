import type { PictureSource } from "@mc/ui";

/** One way to start: an empty deck (`id` null) or a copy of one of the hero's precons, in its aspect's own colors. */
export interface StartOption {
  readonly id: string | null;
  readonly label: string;
  readonly tint?: { readonly fill: string; readonly ink: string } | undefined;
}

/** New deck's "Start from" step. */
export interface StartFromModel {
  readonly label: string;
  readonly cardId: string;
  readonly picture: PictureSource;
  readonly options: readonly StartOption[];
  readonly backLabel: string;
}
