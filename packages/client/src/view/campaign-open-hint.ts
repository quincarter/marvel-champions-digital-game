/**
 * Why the Briefing's red Open issue button is greyed, in plain words, for a pending "Your call" or a compose still
 * running (the owner's report on Fear No Evil, 2026-10-20: a page waiting on the first-playthrough question gave no
 * hint that answering it was the way forward). A blocked deck keeps its own reason (the scene prints the engine's).
 */
export interface OpenIssueHint {
  /** The line printed beside (desktop) or above (phone) the greyed button. */
  readonly bar: string;
  /** The line under the "Your call" heading, telling the player this question is what stands between them and the issue. */
  readonly call: string | null;
}

export interface OpenIssueHintInput {
  readonly issueNumber: number;
  readonly pending: boolean;
  readonly composing: boolean;
  readonly starting: boolean;
  readonly deckBlocked: boolean;
}

export function openIssueHintOf(input: OpenIssueHintInput): OpenIssueHint | null {
  if (input.deckBlocked || input.starting) return null;
  const issue = `Issue #${input.issueNumber}`;
  if (input.pending) {
    return {
      bar: `Answer the question on this page to open ${issue}.`,
      call: `Answer this to open ${issue}.`,
    };
  }
  if (input.composing) return { bar: `Getting ${issue} ready...`, call: null };
  return null;
}
