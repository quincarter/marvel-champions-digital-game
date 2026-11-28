import { css } from "lit";

/** One to three columns of at least 300px each; the cards of a row are as tall as the tallest. */
export const McRulesGlossaryStyles = css`
  :host {
    display: block;
    min-height: 0;
    background: var(--mc-fill-parchment);
    border: 2px solid var(--mc-line-ink);
  }
  .scroller {
    height: 100%;
    padding: 4px 12px 12px 4px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(max(300px, calc((100% - 24px) / 3)), 1fr));
    gap: 12px;
    padding: 2px 4px;
  }
  mc-empty-state {
    padding: 12px;
  }
`;
