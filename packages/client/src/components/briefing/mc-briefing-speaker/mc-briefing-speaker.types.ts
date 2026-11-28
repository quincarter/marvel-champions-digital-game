import type { PictureSource } from "@mc/ui";

/** Whoever the briefing line speaks as, and the line. Every word arrives translated. */
export interface SpeakerModel {
  /** The portrait: a picture (a hero, a villain, the box cover), or none for a voice that gets its initial. */
  readonly portrait: { readonly picture: PictureSource | null; readonly initial: string | null };
  /** The speaker named in the story data, or null for narration. */
  readonly speaker: string | null;
  readonly text: string;
}
