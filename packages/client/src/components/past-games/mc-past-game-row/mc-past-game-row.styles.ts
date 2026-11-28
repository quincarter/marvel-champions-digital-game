import { css } from "lit";

export const McPastGameRowStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    min-width: 0;
    container-type: inline-size;
    /* A long history only draws the rows near the view. */
    content-visibility: auto;
    contain-intrinsic-size: auto 124px;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  .frame {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px;
    background: var(--mc-fill-card);
    border: 3px solid var(--mc-line-ink);
    color: var(--mc-text-ink);
    --pic-h: 84px;
  }
  :host([selected]) .frame {
    border-color: var(--mc-line-red);
    box-shadow: inset 0 0 0 2px var(--mc-line-red);
  }
  mc-past-game-summary {
    flex: 1 1 0;
    min-width: 0;
  }
  /* A phone's row: the pictures make a strip above the words. */
  @container (max-width: 519px) {
    .frame {
      flex-direction: column;
      gap: 8px;
      --pic-h: 64px;
    }
    mc-past-game-summary {
      flex: none;
      width: 100%;
    }
  }
`;
