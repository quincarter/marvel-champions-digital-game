/**
 * A decision the client asks itself, shown on the same choice sheet as the engine's (`scenes/choice.ts`): an action's
 * cost that picks cards in play (Repurpose's "Discard a Tech upgrade you control", issue #991) is asked before the play
 * is sent, so the engine has no pending choice for it. While one is set, the sheet reads it as the pending choice and
 * sends its answer here instead of to the engine. Only the Board sets it, and only while the engine asks nothing.
 */
import type { PendingChoice } from "@mc/engine";

export interface LocalChoice {
  readonly choice: PendingChoice;
  /** The sheet's title, in place of the prompt's generic one ("Choose cards to exhaust (1 of 2)"). */
  readonly title: string;
  /** The line under the decision for these picks: a running total, a preview, why Confirm waits. Null for none. */
  note(ids: readonly string[]): string | null;
  /** Whether Confirm takes these picks (a combined total past its mark, not only the count). */
  canConfirm(ids: readonly string[]): boolean;
  /** Confirm with these option ids. False when the answer was not taken, so the sheet stays up. */
  answer(ids: readonly string[]): Promise<boolean>;
  /** Back out: the play is not made. */
  backOut(): void;
}

let current: LocalChoice | null = null;
const listeners = new Set<() => void>();

export const localChoice = (): LocalChoice | null => current;

/** Sets or clears the local decision; listeners hear only a real change (a new question or none). */
export function setLocalChoice(next: LocalChoice | null): void {
  if (next === current) return;
  const changed = (next?.choice.choiceId ?? null) !== (current?.choice.choiceId ?? null);
  current = next;
  if (changed) for (const listener of [...listeners]) listener();
}

export function onLocalChoiceChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
