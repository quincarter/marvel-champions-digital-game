import { css } from "lit";

export const McCivilSidesStyles = css`
  :host {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
    gap: 12px;
    color: var(--mc-text-ink);
  }
  .title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .name {
    font-family: var(--mc-font-display);
    font-size: 24px;
    letter-spacing: 0.03em;
  }
  .shape {
    flex: none;
    width: 22px;
    height: 22px;
    background: var(--mc-fill-ink);
  }
  .triangle {
    clip-path: polygon(50% 0, 100% 100%, 0 100%);
  }
  .leaders {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 10px;
  }
  figure {
    margin: 0;
  }
  mc-picture-tile {
    display: block;
    aspect-ratio: 5 / 7;
    width: 100%;
  }
  figcaption {
    margin-top: 4px;
    font-weight: 800;
    font-size: var(--mc-small-13, 13px);
  }
`;
