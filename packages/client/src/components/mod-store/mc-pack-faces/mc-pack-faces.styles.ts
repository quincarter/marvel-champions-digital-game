import { css } from "lit";

/**
 * The height is the page's (`--mc-face-h`); each picture keeps its own ratio, a card 5:7 and a cover 600:984. Where the
 * title block beside them has no room the host is narrower than its pictures: they wrap, and the row that does not
 * fit is clipped, so a face goes whole, never half.
 */
export const McPackFacesStyles = css`
  :host {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 0 8px;
    height: var(--mc-face-h, 124px);
    min-width: 0;
    overflow: hidden;
  }
  .cover,
  .face,
  .square {
    position: relative;
    flex: none;
    height: var(--mc-face-h, 124px);
  }
  .cover {
    aspect-ratio: 600 / 984;
  }
  .face {
    aspect-ratio: 5 / 7;
  }
  .square {
    aspect-ratio: 1;
  }
  mc-picture-tile {
    position: absolute;
    inset: 0;
  }
`;
