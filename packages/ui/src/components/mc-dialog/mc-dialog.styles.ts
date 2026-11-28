import { css } from "lit";

export const McDialogStyles = css`
  :host {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px;
  }
  @media (max-width: 600px) {
    :host {
      padding: 8px;
    }
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--mc-fill-ink) 55%, transparent);
  }
  .box {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(var(--dialog-width, 520px), 100%);
    max-height: 100%;
    padding: 16px;
    background: var(--mc-fill-paper);
    color: var(--mc-text-ink);
    border: 4px solid var(--mc-line-ink);
  }
  :host([tall]) .box {
    height: 100%;
  }
  .heading {
    margin: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 24px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    line-height: 1.1;
  }
  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-gutter: stable;
  }
  .footer {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
`;
