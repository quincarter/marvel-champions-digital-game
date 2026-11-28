import { css } from "lit";

export const McGuideArtStyles = css`
  :host {
    position: relative;
    display: block;
    overflow: hidden;
    min-height: 0;
    background-color: var(--mc-fill-ink);
    background-image: radial-gradient(
      circle,
      color-mix(in srgb, var(--mc-text-paper) 13%, transparent) 1px,
      transparent 1.2px
    );
    background-size: 8px 8px;
  }
  .pic {
    position: absolute;
    inset: 0;
  }
  /* The scrim so the banner reads over any picture. */
  .scrim {
    position: absolute;
    inset: 0;
    background: var(--mc-fill-ink);
    opacity: 0.5;
  }
  :host([wide]) .scrim {
    opacity: 0.28;
  }
  .banner {
    position: absolute;
    left: 16px;
    bottom: 20px;
    width: min(240px, calc(100% - 32px));
    height: 56px;
    display: grid;
    place-items: center;
    background: var(--mc-fill-caution);
    color: var(--mc-text-ink-on-hue);
    border: 3px solid var(--mc-line-ink);
    box-shadow: 3px 3px 0 var(--mc-fill-ink);
  }
  :host([wide]) .banner {
    left: 20px;
    width: min(280px, calc(100% - 40px));
  }
  .words {
    padding: 0 8px;
    text-align: center;
    font-family: var(--mc-font-display);
    font-size: 22px;
    line-height: 1.05;
    text-transform: uppercase;
  }
`;
