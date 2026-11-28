import { css } from "lit";

/**
 * The grid: as many columns as fit at 168px each, two at least (so a phone still reads as a shelf). A tile is its width
 * times its picture's ratio plus the 52px caption strip, worked out from the tile's own width (`cqw`).
 */
export const McExtrasShelfStyles = css`
  :host {
    display: block;
    min-height: 0;
    --ratio: 0.62;
    --gap: 16px;
  }
  :host([shape="portrait"]) {
    --ratio: 1.1;
  }
  :host([shape="card"]) {
    --ratio: 1.4;
  }
  .scroller {
    height: 100%;
    padding-right: 12px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(168px, calc((100% - var(--gap)) / 2)), 1fr));
    gap: var(--gap);
    padding-bottom: 8px;
  }
  .tile {
    container-type: inline-size;
  }
  mc-picture-card {
    display: block;
    height: calc(100cqw * var(--ratio) + 52px);
  }
  mc-empty-state {
    padding: 4px 0;
  }
  @media (max-width: 600px) {
    :host {
      --gap: 10px;
    }
  }
`;
