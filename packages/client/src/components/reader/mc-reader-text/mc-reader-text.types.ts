import type { McArticleModel } from "@mc/ui";

export interface McReaderTextProps {
  /** A wide screen (PDF buttons in the tools row) or a phone (a CONTENTS button there). */
  wide: boolean;
  /** The open section: a title and its blocks (a page picture where the book has one). */
  article: McArticleModel | null;
  /** The tallest a page picture gets, in px, so a whole page fits the reading area. */
  pictureMax: number;
  /** PDF button labels (wide only; a phone shows them in the contents). */
  pdfs: readonly string[];
}
