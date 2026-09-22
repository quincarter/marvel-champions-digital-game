/**
 * The errors the frame guard caught (`ui/frame-guard.ts`), kept for the Ctrl+Shift+D snapshot
 * (`ui/debug-dump.ts`). Its own module, free of Phaser, so it can be unit-tested without a browser.
 */

export interface RecordedError {
  readonly at: string;
  readonly where: string;
  readonly message: string;
  readonly stack: string;
  /** How many times this same message was seen in a row. */
  count: number;
}

const MAX_RECORDED = 10;
const recorded: RecordedError[] = [];

/** The most recent errors, newest last. Read by the debug snapshot. */
export function recentErrors(): readonly RecordedError[] {
  return recorded;
}

export function recordError(cause: unknown, where: string): void {
  const error = cause instanceof Error ? cause : new Error(String(cause));
  const last = recorded[recorded.length - 1];
  if (last && last.message === error.message && last.where === where) {
    last.count += 1;
    return;
  }
  recorded.push({
    at: new Date().toISOString(),
    where,
    message: error.message,
    stack: (error.stack ?? "").split("\n").slice(0, 8).join("\n"),
    count: 1,
  });
  if (recorded.length > MAX_RECORDED) recorded.shift();
  console.error(`[mc] ${where}:`, error);
}
