import { css } from "lit";

export const McHintButtonStyles = css`
  :host {
    display: block;
    position: relative;
  }
  mc-button {
    width: 100%;
    height: 100%;
  }
  /* The glyph hangs at the button's left inside its edge; the word centres in the room that is left. */
  mc-glyph {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
  }
`;
