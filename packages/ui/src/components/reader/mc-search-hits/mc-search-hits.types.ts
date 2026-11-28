import type { McTocRow } from "../mc-toc/mc-toc.types.js";

export interface McSearchHitsProps {
  query: string;
  placeholder: string;
  focusPlaceholder: string;
  clearLabel: string;
  rows: readonly McTocRow[];
  selected: string;
  empty: string;
  searchStop: string;
}
