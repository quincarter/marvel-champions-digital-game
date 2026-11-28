import { css } from "lit";

export const McDeckCheckPageStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: var(--mc-fill-paper);
    background-image: radial-gradient(
      circle,
      color-mix(in srgb, var(--mc-fill-ink) 10%, transparent) 1px,
      transparent 1px
    );
    background-size: 6px 6px;
  }
  mc-deck-check-header {
    flex: none;
  }
`;
