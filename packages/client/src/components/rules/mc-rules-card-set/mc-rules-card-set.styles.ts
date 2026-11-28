import { css } from "lit";

export const McRulesCardSetStyles = css`
  :host {
    display: block;
    content-visibility: auto;
    contain-intrinsic-size: auto 520px;
    --tile-caption: var(--caption, 46px);
    --tile-name: 12px;
  }
  .heading {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 4px 4px 8px;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 19px;
    line-height: 1.1;
    text-transform: uppercase;
  }
  .heading::after {
    content: "";
    flex: 1 1 0;
    height: 3px;
    background: var(--mc-fill-ink);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(130px * var(--card-scale, 1)), 1fr));
    gap: 12px;
    padding: 0 4px 14px;
  }
`;
