import { css } from "lit";

export const McCivilSheetStyles = css`
  :host {
    position: absolute;
    inset: 0;
    z-index: 5;
    --dialog-width: 900px;
  }
  .intro {
    margin: 0;
    font-size: var(--mc-small-12, 12px);
    opacity: 0.75;
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
  }
  mc-card-art {
    display: block;
    width: 100%;
    aspect-ratio: 5 / 7;
    margin-bottom: 4px;
  }
  mc-card-art.landscape {
    aspect-ratio: 7 / 5;
  }
  .name {
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    line-height: 1.25;
  }
  .type {
    margin-top: 2px;
    font-size: var(--mc-small-10, 10px);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.7;
  }
  .footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
  }
  mc-hint-button {
    height: 46px;
    min-width: 140px;
  }
`;
