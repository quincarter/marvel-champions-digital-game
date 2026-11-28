import type { McTocRow } from "@mc/ui";

export interface McReaderContentsProps {
  /** The search field's text. */
  query: string;
  /** A Steam pad is in use: the field says how to open its on-screen keyboard while focused. */
  padKeyboard: boolean;
  /** The sections the search left, as rows keyed `toc:<index in the book>`. */
  hits: readonly McTocRow[];
  /** The open section's row key (`toc:<index>`), or "" while none shows as open (a phone's contents pane). */
  current: string;
  /** A phone's PDF buttons, shown under the field; empty on a wide screen (they sit beside the text). */
  pdfs: readonly string[];
}
