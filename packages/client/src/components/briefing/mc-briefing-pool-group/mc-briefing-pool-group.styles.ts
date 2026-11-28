import { css } from "lit";

export const McBriefingPoolGroupStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .bar {
    padding: 4px 8px;
    background: color-mix(in srgb, var(--mc-fill-ink) 8%, transparent);
    margin-bottom: 6px;
  }
  .flat {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  :host(:not([phone])) {
    border: 2px solid var(--mc-line-ink);
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 10px 6px;
    background: var(--mc-fill-parchment);
  }
  .title {
    opacity: 0.8;
    font-size: var(--mc-small-11);
  }
  .note {
    font-size: var(--mc-small-10);
    opacity: 0.55;
  }
  .tiles {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
    padding: 10px 10px 6px;
  }
  .tile {
    width: 64px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    --thumb-width: 64px;
  }
  .rule {
    height: 3px;
    background: var(--mc-fill-red);
  }
  .rule.heal {
    background: var(--mc-fill-heal);
  }
  .name {
    font-size: var(--mc-small-11);
    line-height: 1.1;
    overflow-wrap: anywhere;
  }
  .label {
    font-size: var(--mc-small-9);
  }
`;
