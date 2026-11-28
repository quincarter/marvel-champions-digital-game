/**
 * A log line's words as plain text for lists that draw no chips: the board's log panel draws a status tag as a chip after
 * the sentence ("Rhino is [TOUGH]"), so the sentence alone ("Rhino is", "Wolverine lost") drops the status word. Pause's
 * log (`scenes/pause/pause-compose.ts`) and the issue report (`view/issue-report.ts`) read lines this way.
 */
import type { LogLine } from "./log-lines.js";

export function logLineWords(line: LogLine): string {
  const words = line.tags.map((tag) => tag.status.toUpperCase());
  return words.length === 0 ? line.text : `${line.text} ${words.join(" ")}`;
}
