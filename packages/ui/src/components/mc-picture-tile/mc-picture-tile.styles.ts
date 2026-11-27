import { css } from "lit";

/** The box: a ground under the picture and an ink frame drawn inside its edge; no press of its own. */
export const McPictureTileStyles = css`
  :host {
    display: block;
    pointer-events: none;
  }
  .tile {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--mc-fill-spent);
    color: var(--mc-text-paper);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -2px;
    container-type: size;
  }
  :host([ground="ink"]) .tile {
    background: var(--mc-fill-ink);
  }
  :host([ground="parchment"]) .tile {
    background: var(--mc-fill-parchment);
    color: var(--mc-text-ink);
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    user-select: none;
  }
  img.dim {
    filter: grayscale(1);
    opacity: 0.3;
  }
  .missing {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    text-align: center;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .missing.letter {
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 55cqh;
    letter-spacing: 0;
    opacity: 0.3;
  }
`;
