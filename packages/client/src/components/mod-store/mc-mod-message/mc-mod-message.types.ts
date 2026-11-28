/** `plain`: a line in place of a list; `offline`: the ink strip that says the list is the saved copy. */
export type ModMessageKind = "plain" | "offline";

export interface McModMessageProps {
  kind: ModMessageKind;
  /** What it says, already translated. */
  text: string;
  /** Try again's words; empty for none (only the failed-load message has it). */
  retryLabel: string;
}
