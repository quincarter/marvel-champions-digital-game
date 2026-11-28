import { css } from "lit";

export const McDetailInsightsStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .lines {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .line {
    display: flex;
    gap: 6px;
    font-family: var(--mc-font-body);
    font-size: 13px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .line[data-tone="meta"] {
    opacity: 0.85;
  }
  .line[data-tone="caution"] {
    font-weight: 800;
  }
  .mark {
    flex: none;
    width: 1.1em;
    text-align: center;
    border: 1.5px solid currentcolor;
    border-radius: 50%;
    height: 1.1em;
    line-height: 1;
    font-size: 12px;
    margin-top: 1px;
  }
`;
