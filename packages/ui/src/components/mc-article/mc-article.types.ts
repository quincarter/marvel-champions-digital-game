/** One block of an article, in reading order. Text is plain (the client has already cleaned markup off). */
export type McArticleBlock =
  /** A heading inside the article. */
  | { readonly kind: "heading"; readonly text: string }
  | { readonly kind: "paragraph"; readonly text: string }
  /** A list item; `depth` 0 is top level. */
  | { readonly kind: "bullet"; readonly text: string; readonly depth: number }
  /** A called-out passage (a card, a sidebar, flavor text): lines separated by newlines. */
  | { readonly kind: "quote"; readonly text: string }
  /** A page picture fitted whole under the title; `fallback` says what it is while there is none. */
  | { readonly kind: "picture"; readonly src: string | null; readonly fallback: string };

/** A titled article: a Bangers title with a red rule, then the blocks. */
export interface McArticleModel {
  readonly title: string;
  readonly blocks: readonly McArticleBlock[];
}
