import { css } from "lit";

export const McBriefingOptionTileStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  mc-press-card {
    height: 100%;
  }
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 56px;
    padding: 2px 4px 2px 2px;
  }
  .tile.striped {
    padding-left: 10px;
  }
  .tile.striped::before {
    content: "";
    position: absolute;
    left: -10px;
    top: -8px;
    bottom: -8px;
    width: 6px;
    background: var(--mc-fill-heal);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }
  .name {
    flex: 0 1 auto;
    min-width: 0;
    font-size: 22px;
    line-height: 1.05;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chips {
    flex: none;
    display: inline-flex;
    gap: 6px;
  }
  .words.body {
    margin: 0;
  }
  .words.label {
    font-size: var(--mc-small-10);
  }
  .foot {
    margin-top: auto;
    font-size: var(--mc-small-10);
    opacity: 0.75;
  }
  .foot.cost,
  .foot.heal,
  .foot.red {
    opacity: 1;
  }
`;
