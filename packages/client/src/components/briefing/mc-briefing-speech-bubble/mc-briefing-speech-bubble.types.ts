/** The properties of the bubble: its line and who says it (plain strings, so it has no model type of its own). */
export interface SpeechBubbleProps {
  readonly text: string;
  readonly speaker: string;
}
