import { css } from "lit";

export const McDetailHeroStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .name {
    margin: 0;
    font-family: var(--mc-font-display);
    font-size: 22px;
    font-weight: 400;
    line-height: 1.15;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }
  .credit,
  .stats {
    margin: 0;
    font-family: var(--mc-font-body);
    font-weight: 700;
    font-size: var(--mc-small-11);
    letter-spacing: 1px;
    text-transform: uppercase;
    line-height: 1.35;
    opacity: 0.75;
  }
  .rule {
    width: 100%;
    height: 1px;
    margin: 6px 0;
    border: 0;
    background: currentcolor;
    opacity: 0.3;
  }
  mc-detail-fact + mc-detail-fact {
    margin-top: 6px;
  }
`;
