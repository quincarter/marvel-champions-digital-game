import { css } from "lit";

export const McPastGameAspectsStyles = css`
  :host {
    display: flex;
    height: 14px;
    pointer-events: none;
  }
  .chip {
    flex: 1 1 0;
    min-width: 0;
    container-type: inline-size;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--chip-fill);
    color: var(--chip-ink);
    outline: 1px solid var(--mc-line-ink);
    outline-offset: -0.5px;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: 9px;
    letter-spacing: 0.4px;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
  }
  /* The room the chip has says how much of the name it writes: its first letter, a three-letter code, or the whole word. */
  .code,
  .full {
    display: none;
  }
  @container (min-width: 27px) {
    .letter {
      display: none;
    }
    .code {
      display: inline;
    }
  }
  @container (min-width: 41px) {
    .word[data-fit="short"] .code {
      display: none;
    }
    .word[data-fit="short"] .full {
      display: inline;
    }
  }
  @container (min-width: 55px) {
    .word[data-fit="mid"] .code {
      display: none;
    }
    .word[data-fit="mid"] .full {
      display: inline;
    }
  }
  @container (min-width: 76px) {
    .word[data-fit="long"] .code {
      display: none;
    }
    .word[data-fit="long"] .full {
      display: inline;
    }
  }
`;
