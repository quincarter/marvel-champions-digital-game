import { css } from "lit";

export const McPastGamePicturesStyles = css`
  :host {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    min-width: 0;
    flex: none;
  }
  .pic {
    position: relative;
    flex: 0 1 auto;
    min-width: 0;
    aspect-ratio: 63 / 88;
    height: var(--pic-h, 84px);
    outline: 1.5px solid color-mix(in srgb, var(--mc-line-ink) 85%, transparent);
    outline-offset: -0.75px;
    overflow: hidden;
  }
  /* A wider gap sets the villain apart from the heroes. */
  .pic[data-role="villain"] {
    margin-right: 12px;
  }
  .pic mc-picture-tile {
    width: 100%;
    height: 100%;
  }
  .pic mc-past-game-aspects {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
  }
  /* The details: the villain large, the heroes beside it, all shrinking to the panel's width. */
  :host([size="detail"]) {
    width: 100%;
    gap: 6px;
  }
  :host([size="detail"]) .pic {
    height: auto;
    flex: 1 1 0;
    max-width: 67px;
  }
  :host([size="detail"]) .pic[data-role="villain"] {
    flex: 1.6 1 0;
    max-width: 107px;
    margin-right: 2px;
  }
`;
