import { css } from "lit";

export const GuideChooserPageStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    font-family: var(--mc-font-body);
    color: var(--mc-text-ink);
    background-color: var(--mc-fill-paper);
    -webkit-font-smoothing: antialiased;
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  /* Narrow: the picture over the choices, 42% of the height, the banner at its foot. */
  mc-guide-art {
    flex: 0 0 42%;
  }
  .column {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 16px 16px;
  }
  /* The choices scroll when a long translation needs the room; Suit up stays in reach under them. */
  .choices {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: clip;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    /* A 3px outline on a card is not clipped by the scroller. */
    padding: 3px;
    margin: -3px;
  }
  mc-guide-actions {
    flex: none;
  }
  /* A short phone gives the choices more of its height. */
  @media (max-height: 720px) {
    :host(:not([mode="wide"])) mc-guide-art {
      flex-basis: 30%;
    }
  }
  /* Wide: the picture is a left panel (42% of the width), the choices a column beside it. */
  :host([mode="wide"]) {
    flex-direction: row;
    background-image: radial-gradient(
      circle,
      color-mix(in srgb, var(--mc-fill-ink) 10%, transparent) 1px,
      transparent 1.2px
    );
    background-size: 6px 6px;
  }
  :host([mode="wide"]) mc-guide-art {
    flex: 0 0 42%;
  }
  /* The column opens under the dark mode tab, which hangs from the top centre of the screen. */
  :host([mode="wide"]) .column {
    padding: 48px 24px 24px;
  }
`;
