import type { HintGlyph, McArticleModel, McTocRow } from "@mc/ui";

/** The ink bar across the top. */
export interface ReaderBarModel {
  /** "◂ EXTRAS" (a phone: the bare arrow). */
  readonly backLabel: string;
  /** The book's title. */
  readonly title: string;
  /** "3 / 12" while a section shows, else "". */
  readonly right: string;
  readonly backGlyph: HintGlyph | null;
}

/** What the page shows while there is no section to read: the book is not in this build, is loading, or failed. */
export type ReaderStatus = "ready" | "loading" | "failed" | "none";

/** Everything the Extras reader shows; the scene builds it from the book and sets it on the page. */
export interface ReaderPageModel {
  /** The contents beside the text (a wide screen), or one at a time (a phone). */
  readonly wide: boolean;
  readonly phone: boolean;
  /** A phone's single pane: the contents, or the open section. */
  readonly pane: "toc" | "text";
  readonly bar: ReaderBarModel;
  readonly status: ReaderStatus;
  /** The sentence for a status other than `ready`, already translated. */
  readonly message: string;
  readonly contents: {
    readonly query: string;
    readonly padKeyboard: boolean;
    readonly hits: readonly McTocRow[];
    /** The open section's row key; "" on a phone's contents pane. */
    readonly current: string;
    /** A phone's PDF buttons, in the contents pane. */
    readonly pdfs: readonly string[];
  };
  readonly text: {
    readonly article: McArticleModel | null;
    readonly pictureMax: number;
    /** A wide screen's PDF buttons, over the text. */
    readonly pdfs: readonly string[];
  };
  readonly nav: { readonly atStart: boolean; readonly atEnd: boolean };
}
