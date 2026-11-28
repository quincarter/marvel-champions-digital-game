import { css } from "lit";

export const McHeroDecksSheetStyles = css`
  :host {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    overflow: hidden;
  }
  /* The scrim takes every press that lands outside the box: a tap closes the sheet, nothing beneath is pressed. */
  .scrim {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--mc-fill-void) 70%, transparent);
  }
  .box {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(680px, 100%);
    max-height: 100%;
    min-height: 0;
    padding: 16px;
    background: var(--mc-fill-paper);
    border: 4px solid var(--mc-line-ink);
  }
  .list {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-right: 4px;
  }
  .list > * {
    flex: none;
  }
  .back {
    flex: none;
    height: 44px;
  }
  @media (max-width: 600px) {
    :host {
      padding: 8px;
    }
  }
`;
