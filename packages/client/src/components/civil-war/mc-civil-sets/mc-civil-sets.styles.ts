import { css } from "lit";

export const McCivilSetsStyles = css`
  :host {
    display: block;
    color: var(--mc-text-ink);
  }
  .counter {
    margin: 0 0 12px;
    font-weight: 800;
    font-size: var(--mc-small-13, 13px);
  }
  section {
    margin-bottom: 16px;
  }
  .label {
    margin: 0 0 6px;
    font-size: var(--mc-small-11, 11px);
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.7;
  }
  .fold {
    display: block;
    margin-bottom: 8px;
    font-weight: 800;
    font-size: var(--mc-small-13, 13px);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
    gap: 10px;
  }
  mc-setup-set-tile {
    --tile-height: 84px;
  }
`;
